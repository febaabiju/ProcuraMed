from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from accounts.models import Role, Department, AuditLog
from procurement.models import (
    Requisition, RequisitionItem, TechnicalEvaluation, Approval
)

User = get_user_model()


class TechnicalOfficerClarificationWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Roles
        self.dept_role, _ = Role.objects.get_or_create(
            name='Department Staff', defaults={'description': 'Staff'}
        )
        self.po_role, _ = Role.objects.get_or_create(
            name='Purchase Officer', defaults={'description': 'PO'}
        )
        self.to_role, _ = Role.objects.get_or_create(
            name='Technical Officer', defaults={'description': 'TO'}
        )
        self.comm_role, _ = Role.objects.get_or_create(
            name='Procurement Committee', defaults={'description': 'Committee'}
        )

        # Department
        self.dept = Department.objects.filter(code='BME').first()
        if not self.dept:
            self.dept, _ = Department.objects.get_or_create(
                name='Biomedical Engineering', defaults={'code': 'BME'}
            )
        self.admin_dept = Department.objects.filter(code='AGS').first()
        if not self.admin_dept:
            self.admin_dept, _ = Department.objects.get_or_create(
                name='Administration & General Supplies', defaults={'code': 'AGS'}
            )

        # Department Staff User
        self.staff_user = User.objects.create_user(
            username='staff_biomed',
            email='staff_biomed@hospital.com',
            role=self.dept_role,
            department=self.dept,
            employee_id='DS_BME01',
            is_active=True
        )

        # 2 Purchase Officers
        self.po_1 = User.objects.create_user(
            username='po_alpha',
            email='po_alpha@hospital.com',
            role=self.po_role,
            employee_id='PO_001',
            is_active=True
        )
        self.po_2 = User.objects.create_user(
            username='po_beta',
            email='po_beta@hospital.com',
            role=self.po_role,
            employee_id='PO_002',
            is_active=True
        )

        # 2 Technical Officers (Both with Biomedical Equipment specialization)
        self.to_1 = User.objects.create_user(
            username='to_evaluator_1',
            first_name='Alice',
            last_name='Biomed',
            email='to1@hospital.com',
            role=self.to_role,
            employee_id='TO_001',
            is_active=True,
            technical_specializations=['Biomedical Equipment']
        )
        self.to_2 = User.objects.create_user(
            username='to_evaluator_2',
            first_name='Bob',
            last_name='Biomed',
            email='to2@hospital.com',
            role=self.to_role,
            employee_id='TO_002',
            is_active=True,
            technical_specializations=['Biomedical Equipment']
        )

    def test_01_complete_clarification_resubmission_workflow(self):
        """
        Tests the complete end-to-end workflow:
        1. Staff submits requisition -> Assigned PO_1.
        2. PO_1 reviews and proceeds for technical evaluation -> Assigned TO_1.
        3. TO_1 evaluates and returns for clarification with remarks.
        4. Staff corrects item specifications and resubmits via PATCH.
        5. Requisition routes directly back to TO_1 in PENDING_TECHNICAL_EVALUATION.
        6. No new PO assignment or workload balancing occurs (PO_1 preserved).
        7. TO_1 sees it in their pending queue with updated specs and clarification history.
        8. TO_1 re-evaluates and approves as Technically Suitable -> PENDING_COMMITTEE_REVIEW.
        """
        # Step 1: Staff creates and submits requisition
        req = Requisition.objects.create(
            req_number='REQ-2026-CLARIF-01',
            title='Ultrasound Diagnostic System',
            department=self.dept,
            requested_by=self.staff_user,
            category='Biomedical Equipment',
            priority=Requisition.PriorityChoices.HIGH,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_1,
            estimated_budget=Decimal('350000.00'),
            justification='Replacement for Emergency Department'
        )
        item = RequisitionItem.objects.create(
            requisition=req,
            item_name='Color Doppler Ultrasound System',
            category='Biomedical Equipment',
            quantity=1,
            estimated_unit_price=Decimal('350000.00'),
            total_price=Decimal('350000.00'),
            specifications='Initial draft specs - lacking probe compatibility details'
        )

        # Step 2: PO_1 reviews and proceeds for Technical Evaluation
        self.client.force_authenticate(user=self.po_1)
        proceed_res = self.client.post(f'/api/procurement/requisitions/{req.id}/review/', {
            'action': 'PROCEED',
            'requires_technical_evaluation': True,
            'technical_specialization': 'Biomedical Equipment',
            'reason': 'Proceeding for specialized biomedical review'
        })
        self.assertEqual(proceed_res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION)
        self.assertIsNotNone(req.assigned_technical_officer)
        assigned_to = req.assigned_technical_officer
        # Both TOs have same workload, so one is deterministically assigned
        initial_to_id = assigned_to.id
        initial_po_id = req.assigned_purchase_officer.id
        self.assertEqual(initial_po_id, self.po_1.id)

        # Step 3: Assigned TO returns requisition for clarification
        self.client.force_authenticate(user=assigned_to)
        eval_res = self.client.post(f'/api/procurement/requisitions/{req.id}/evaluate/', {
            'outcome': 'Return for Clarification',
            'remarks': 'Please provide transducer probe frequencies and DICOM 3.0 conformance specs.'
        })
        self.assertEqual(eval_res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.RETURNED)
        self.assertEqual(req.assigned_technical_officer.id, initial_to_id)
        self.assertEqual(req.assigned_purchase_officer.id, initial_po_id)
        self.assertIn('transducer probe frequencies', req.review_comments)
        self.assertTrue(req.is_returned_for_technical_clarification())

        # Step 4: Staff updates specifications and resubmits via PATCH
        self.client.force_authenticate(user=self.staff_user)
        updated_items = [{
            'item_name': 'Color Doppler Ultrasound System',
            'category': 'Biomedical Equipment',
            'quantity': 1,
            'estimated_unit_price': 350000.00,
            'specifications': 'Updated: Includes convex 2.5-5MHz probe, linear 5-10MHz probe, and full DICOM 3.0 export module.'
        }]
        patch_res = self.client.patch(f'/api/procurement/requisitions/{req.id}/', {
            'title': 'Ultrasound Diagnostic System (Updated Specs)',
            'status': 'SUBMITTED',
            'items': updated_items
        }, format='json')
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)

        # Step 5 & 6: Verify status, preserved assignments, and no new PO assignment
        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION)
        self.assertEqual(req.assigned_technical_officer.id, initial_to_id, "Must remain assigned to the SAME Technical Officer.")
        self.assertEqual(req.assigned_purchase_officer.id, initial_po_id, "Must NOT reassign or change Purchase Officer.")
        self.assertEqual(req.req_number, 'REQ-2026-CLARIF-01', "Requisition number must be preserved.")
        self.assertTrue(req.requires_technical_evaluation)

        # Verify audit log
        clarif_audit = AuditLog.objects.filter(
            description__icontains=req.req_number,
            action='Requisition Resubmitted for Technical Clarification'
        ).first()
        self.assertIsNotNone(clarif_audit, "AuditLog must record resubmission for technical clarification.")

        # Step 7: Assigned TO sees it in their dashboard/queue
        self.client.force_authenticate(user=assigned_to)
        dash_res = self.client.get('/api/procurement/technical-officer-dashboard/')
        self.assertEqual(dash_res.status_code, status.HTTP_200_OK)
        assigned_evals = dash_res.data.get('assigned_evaluations', [])
        found_in_queue = any(e['id'] == req.id for e in assigned_evals)
        self.assertTrue(found_in_queue, "Requisition must appear in the assigned TO's pending evaluations.")

        eval_data = next(e for e in assigned_evals if e['id'] == req.id)
        self.assertEqual(eval_data['items'][0]['specifications'], 'Updated: Includes convex 2.5-5MHz probe, linear 5-10MHz probe, and full DICOM 3.0 export module.')
        self.assertTrue(eval_data.get('is_resubmitted_clarification'))

        # Other TO does NOT see it in their queue
        other_to = self.to_2 if assigned_to == self.to_1 else self.to_1
        self.client.force_authenticate(user=other_to)
        other_dash = self.client.get('/api/procurement/technical-officer-dashboard/')
        other_evals = other_dash.data.get('assigned_evaluations', [])
        self.assertFalse(any(e['id'] == req.id for e in other_evals), "Other TO must NOT see this requisition.")

        # PO does NOT see it in pending review queue
        self.client.force_authenticate(user=self.po_1)
        po_reqs = self.client.get('/api/procurement/requisitions/?status=SUBMITTED')
        po_req_ids = [r['id'] for r in po_reqs.data.get('results', po_reqs.data)]
        self.assertNotIn(req.id, po_req_ids, "Resubmitted technical clarification must not be in PO SUBMITTED review queue.")

        # Step 8: TO re-evaluates and marks Technically Suitable
        self.client.force_authenticate(user=assigned_to)
        final_eval = self.client.post(f'/api/procurement/requisitions/{req.id}/evaluate/', {
            'outcome': 'Technically Suitable',
            'remarks': 'Approved: Clarified transducer specifications and DICOM compatibility are fully compliant with hospital ICU standards.'
        })
        self.assertEqual(final_eval.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW)
        self.assertEqual(req.technical_recommendation, TechnicalEvaluation.RecommendationChoices.SUITABLE)
        self.assertEqual(req.assigned_technical_officer.id, initial_to_id)
        self.assertEqual(req.assigned_purchase_officer.id, initial_po_id)

    def test_02_resubmission_via_dedicated_submit_endpoint(self):
        """
        Staff uses POST /api/procurement/requisitions/{id}/submit/ to resubmit
        a requisition returned for technical clarification.
        """
        req = Requisition.objects.create(
            req_number='REQ-2026-CLARIF-02',
            title='Centrifuge Machine',
            department=self.dept,
            requested_by=self.staff_user,
            category='Biomedical Equipment',
            priority=Requisition.PriorityChoices.MEDIUM,
            status=Requisition.StatusChoices.RETURNED,
            requires_technical_evaluation=True,
            technical_specialization='Biomedical Equipment',
            assigned_purchase_officer=self.po_1,
            assigned_technical_officer=self.to_1,
            technical_recommendation='Requires Clarification',
            review_comments='Clarify max RPM and cooling system specifications.'
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='Benchtop Refrigerated Centrifuge',
            category='Biomedical Equipment',
            quantity=1,
            estimated_unit_price=Decimal('120000.00'),
            total_price=Decimal('120000.00'),
            specifications='15,000 RPM with CFC-free refrigeration'
        )

        self.client.force_authenticate(user=self.staff_user)
        submit_res = self.client.post(f'/api/procurement/requisitions/{req.id}/submit/')
        self.assertEqual(submit_res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION)
        self.assertEqual(req.assigned_technical_officer, self.to_1)
        self.assertEqual(req.assigned_purchase_officer, self.po_1)

    def test_03_inactive_technical_officer_blocks_resubmission_without_silent_reassignment(self):
        """
        If the assigned Technical Officer has become inactive, resubmission must be blocked
        with a descriptive error and must NOT silently reassign to another officer.
        """
        req = Requisition.objects.create(
            req_number='REQ-2026-CLARIF-03',
            title='Anesthesia Workstation',
            department=self.dept,
            requested_by=self.staff_user,
            category='Biomedical Equipment',
            status=Requisition.StatusChoices.RETURNED,
            requires_technical_evaluation=True,
            technical_specialization='Biomedical Equipment',
            assigned_purchase_officer=self.po_1,
            assigned_technical_officer=self.to_1,
            technical_recommendation='Requires Clarification',
            review_comments='Need vaporiser model specifications.'
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='Anesthesia Unit',
            category='Biomedical Equipment',
            quantity=1,
            estimated_unit_price=Decimal('250000.00'),
            total_price=Decimal('250000.00'),
            specifications='Advanced ventilator with gas monitoring'
        )

        # Deactivate the assigned TO
        self.to_1.is_active = False
        self.to_1.save()

        # Staff tries to resubmit
        self.client.force_authenticate(user=self.staff_user)
        submit_res = self.client.post(f'/api/procurement/requisitions/{req.id}/submit/')
        self.assertEqual(submit_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('inactive or unavailable', submit_res.data.get('detail', ''))

        # Check via PATCH as well
        patch_res = self.client.patch(f'/api/procurement/requisitions/{req.id}/', {
            'status': 'SUBMITTED'
        })
        self.assertEqual(patch_res.status_code, status.HTTP_400_BAD_REQUEST)

        # Verify no silent reassignment occurred
        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.RETURNED)
        self.assertEqual(req.assigned_technical_officer, self.to_1, "Must NOT silently reassign to to_2.")
        self.assertEqual(req.assigned_purchase_officer, self.po_1)

    def test_04_po_return_workflow_remains_unaffected(self):
        """
        When a Purchase Officer returns a requisition for correction (before any technical evaluation),
        resubmission still routes to SUBMITTED for PO review.
        """
        admin_staff = User.objects.create_user(
            username='staff_admin_test',
            email='staff_admin_test@hospital.com',
            role=self.dept_role,
            department=self.admin_dept,
            employee_id='DS_AGS01',
            is_active=True
        )
        req = Requisition.objects.create(
            req_number='REQ-2026-PO-RET-01',
            title='Office Desks',
            department=self.admin_dept,
            requested_by=admin_staff,
            category='Hospital Furniture & Fixtures',
            status=Requisition.StatusChoices.RETURNED,
            requires_technical_evaluation=False,
            assigned_purchase_officer=self.po_1,
            assigned_technical_officer=None,
            review_comments='Please reduce quantity from 20 to 10.'
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='Executive Desk',
            category='Hospital Furniture & Fixtures',
            quantity=10,
            estimated_unit_price=Decimal('5000.00'),
            total_price=Decimal('50000.00'),
            specifications='Wooden desk'
        )

        self.client.force_authenticate(user=admin_staff)
        submit_res = self.client.post(f'/api/procurement/requisitions/{req.id}/submit/')
        self.assertEqual(submit_res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.SUBMITTED, "PO return must resubmit to SUBMITTED status.")
        self.assertEqual(req.assigned_purchase_officer, self.po_1, "Original PO assignment must be preserved.")
        self.assertIsNone(req.assigned_technical_officer)

    def test_05_dashboard_removes_approved_requisition_from_clarification_and_preserves_history(self):
        """
        Verify that when a returned requisition is corrected, resubmitted, and approved as Technically Suitable:
        1. It appears as Technically Suitable (Approved) in recent recommendations.
        2. It no longer appears as Returned for Clarification.
        3. Its approved evaluation remarks and previous clarification history remain available.
        4. Requisition proceeds to PENDING_COMMITTEE_REVIEW.
        5. Total completed evaluations count and stats match distinct evaluated requisitions.
        """
        req = Requisition.objects.create(
            req_number='REQ-2026-DASH-01',
            title='Haemodialysis Machine',
            department=self.dept,
            requested_by=self.staff_user,
            category='Biomedical Equipment',
            priority=Requisition.PriorityChoices.HIGH,
            status=Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
            requires_technical_evaluation=True,
            technical_specialization='Biomedical Equipment',
            assigned_purchase_officer=self.po_1,
            assigned_technical_officer=self.to_1
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='Dialysis Unit',
            category='Biomedical Equipment',
            quantity=1,
            estimated_unit_price=Decimal('600000.00'),
            total_price=Decimal('600000.00'),
            specifications='Basic hemodialysis machine'
        )

        # 1. TO returns for clarification
        self.client.force_authenticate(user=self.to_1)
        ret_res = self.client.post(f'/api/procurement/requisitions/{req.id}/evaluate/', {
            'outcome': 'Return for Clarification',
            'remarks': 'Clarify ultrafiltration rate and endotoxin filter specifications.'
        })
        self.assertEqual(ret_res.status_code, status.HTTP_200_OK)

        # Verify dashboard shows 1 clarification recommendation
        dash_res1 = self.client.get('/api/procurement/technical-officer-dashboard/')
        self.assertEqual(dash_res1.status_code, status.HTTP_200_OK)
        recs1 = dash_res1.data.get('recent_recommendations', [])
        clarif_recs1 = [r for r in recs1 if r['recommendation'] == 'Requires Clarification']
        suitable_recs1 = [r for r in recs1 if r['recommendation'] == 'Technically Suitable']
        self.assertEqual(len(clarif_recs1), 1)
        self.assertEqual(len(suitable_recs1), 0)
        self.assertEqual(clarif_recs1[0]['procurement_ref'], 'REQ-2026-DASH-01')

        # 2. Staff corrects specs and resubmits
        self.client.force_authenticate(user=self.staff_user)
        submit_res = self.client.post(f'/api/procurement/requisitions/{req.id}/submit/')
        self.assertEqual(submit_res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION)

        # 3. TO approves as Technically Suitable
        self.client.force_authenticate(user=self.to_1)
        approve_res = self.client.post(f'/api/procurement/requisitions/{req.id}/evaluate/', {
            'outcome': 'Technically Suitable',
            'remarks': 'The hemodialysis unit specifications are verified compliant with hospital ICU standards.'
        })
        self.assertEqual(approve_res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW)
        self.assertFalse(req.is_returned_for_technical_clarification())
        self.assertEqual(req.review_comments, 'The hemodialysis unit specifications are verified compliant with hospital ICU standards.')

        # 4. Verify dashboard state after approval
        dash_res2 = self.client.get('/api/procurement/technical-officer-dashboard/')
        self.assertEqual(dash_res2.status_code, status.HTTP_200_OK)
        recs2 = dash_res2.data.get('recent_recommendations', [])

        # Must have exactly 1 record in recent_recommendations (not 2 duplicates)
        req_recs = [r for r in recs2 if r['procurement_ref'] == 'REQ-2026-DASH-01']
        self.assertEqual(len(req_recs), 1, "Must deduplicate to the single latest evaluation per requisition.")

        approved_item = req_recs[0]
        self.assertEqual(approved_item['recommendation'], 'Technically Suitable')
        self.assertEqual(approved_item['compliance'], 'Compliant')
        self.assertEqual(approved_item['remarks'], 'The hemodialysis unit specifications are verified compliant with hospital ICU standards.')

        # Clarification history is preserved and attached
        self.assertEqual(len(approved_item['clarification_history']), 1)
        hist = approved_item['clarification_history'][0]
        self.assertEqual(hist['recommendation'], 'Requires Clarification')
        self.assertIn('ultrafiltration rate', hist['remarks'])

        # Must NOT appear as clarification
        clarif_recs2 = [r for r in recs2 if r['recommendation'] == 'Requires Clarification']
        self.assertEqual(len(clarif_recs2), 0, "Approved requisition must NOT appear in clarification section.")

        # Stats reflect 1 completed, 1 approved
        stats = dash_res2.data.get('stats', {})
        self.assertEqual(stats.get('completed_evaluations'), 1)
        self.assertEqual(stats.get('compliance_approved'), 1)
        self.assertEqual(stats.get('compliance_rejected'), 0)

