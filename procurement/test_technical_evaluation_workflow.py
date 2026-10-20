from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile
from accounts.models import Role, Department, AuditLog
from procurement.models import (
    Requisition, RequisitionItem, TechnicalEvaluation, Approval
)

User = get_user_model()


class TechnicalEvaluationWorkflowTests(TestCase):
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
        self.dept, _ = Department.objects.get_or_create(
            name='Cardiology', defaults={'code': 'CARD'}
        )

        # Users
        self.staff_user = User.objects.create_user(
            username='staff_test',
            email='staff@hospital.com',
            role=self.dept_role,
            department=self.dept,
            employee_id='DS001',
            is_active=True
        )

        self.po_user = User.objects.create_user(
            username='po_test',
            email='po@hospital.com',
            role=self.po_role,
            employee_id='PO001',
            is_active=True
        )

        # 2 Technical Officers with different specializations
        self.to_biomed = User.objects.create_user(
            username='to_biomed',
            email='biomed@hospital.com',
            role=self.to_role,
            employee_id='TO001',
            is_active=True,
            technical_specializations=['Biomedical Equipment']
        )

        self.to_imaging = User.objects.create_user(
            username='to_imaging',
            email='imaging@hospital.com',
            role=self.to_role,
            employee_id='TO002',
            is_active=True,
            technical_specializations=['Radiology & Medical Imaging']
        )

        # Create PO-approved requisition assigned to to_biomed
        self.req_biomed = Requisition.objects.create(
            req_number='REQ-2026-TEST01',
            title='ECG Monitor Set',
            department=self.dept,
            requested_by=self.staff_user,
            category='Biomedical Equipment',
            priority=Requisition.PriorityChoices.HIGH,
            status=Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
            requires_technical_evaluation=True,
            technical_specialization='Biomedical Equipment',
            assigned_purchase_officer=self.po_user,
            assigned_technical_officer=self.to_biomed,
            technical_assigned_at=timezone.now(),
            justification='Critical replacement for Cardiac ICU',
            estimated_budget=150000.00
        )
        self.item1 = RequisitionItem.objects.create(
            requisition=self.req_biomed,
            item_name='12-Channel ECG Machine',
            category='Biomedical Equipment',
            quantity=2,
            estimated_unit_price=75000.00,
            specifications='12-lead simultaneous acquisition with thermal printer',
            required_date=timezone.localdate() + timezone.timedelta(days=14)
        )

        # Create another requisition assigned to to_imaging
        self.req_imaging = Requisition.objects.create(
            req_number='REQ-2026-TEST02',
            title='Portable Ultrasound System',
            department=self.dept,
            requested_by=self.staff_user,
            category='Radiology & Medical Imaging',
            priority=Requisition.PriorityChoices.MEDIUM,
            status=Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
            requires_technical_evaluation=True,
            technical_specialization='Radiology & Medical Imaging',
            assigned_purchase_officer=self.po_user,
            assigned_technical_officer=self.to_imaging,
            technical_assigned_at=timezone.now(),
            justification='Diagnostic imaging for triage',
            estimated_budget=450000.00
        )

        # Unapproved/Submitted request (waiting for PO review, NOT pending technical evaluation)
        self.req_submitted = Requisition.objects.create(
            req_number='REQ-2026-TEST03',
            title='Surgical Scissors Set',
            department=self.dept,
            requested_by=self.staff_user,
            category='Biomedical Equipment',
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_user
        )

    def test_dashboard_shows_only_assigned_requests_for_logged_in_to(self):
        """
        Technical Officer dashboard must return ONLY purchase requests assigned
        to the logged-in Technical Officer, and ONLY requests pending technical evaluation.
        """
        self.client.force_authenticate(user=self.to_biomed)
        res = self.client.get('/api/procurement/technical-officer-dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        assigned = data['assigned_evaluations']
        assigned_ids = [item['id'] for item in assigned]

        # to_biomed should see req_biomed
        self.assertIn(self.req_biomed.id, assigned_ids)
        # to_biomed should NOT see req_imaging (assigned to to_imaging)
        self.assertNotIn(self.req_imaging.id, assigned_ids)
        # to_biomed should NOT see req_submitted (not PO-approved for technical eval)
        self.assertNotIn(self.req_submitted.id, assigned_ids)

        # Check request information fields
        item_info = assigned[0]
        self.assertEqual(item_info['req_number'], 'REQ-2026-TEST01')
        self.assertEqual(item_info['department_name'], 'Cardiology')
        self.assertEqual(item_info['category'], 'Biomedical Equipment')
        self.assertEqual(item_info['title'], 'ECG Monitor Set')
        self.assertEqual(len(item_info['items']), 1)
        self.assertEqual(item_info['items'][0]['item_name'], '12-Channel ECG Machine')
        self.assertEqual(item_info['items'][0]['quantity'], 2)
        self.assertEqual(item_info['items'][0]['specifications'], '12-lead simultaneous acquisition with thermal printer')
        self.assertEqual(item_info['justification'], 'Critical replacement for Cardiac ICU')

    def test_to_cannot_view_another_to_assigned_requisition(self):
        """
        A Technical Officer cannot access another Technical Officer's assigned requisition.
        """
        self.client.force_authenticate(user=self.to_biomed)
        # Trying to access req_imaging (assigned to to_imaging) directly
        res = self.client.get(f'/api/procurement/requisitions/{self.req_imaging.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_to_cannot_evaluate_another_to_assigned_requisition(self):
        """
        A Technical Officer cannot evaluate a requisition assigned to another Technical Officer.
        """
        self.client.force_authenticate(user=self.to_biomed)
        res = self.client.post(f'/api/procurement/requisitions/{self.req_imaging.id}/evaluate/', {
            'compliance': 'Compliant',
            'remarks': 'Testing unauthorized evaluation',
            'recommendation': 'Technically Suitable'
        })
        # Either 404 (because not in queryset) or 403 (permission denied)
        self.assertIn(res.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

    def test_cannot_evaluate_unapproved_or_submitted_request(self):
        """
        Technical Evaluation must reject requests that have not been approved/proceeded by PO
        with status PENDING_TECHNICAL_EVALUATION.
        """
        self.req_submitted.assigned_technical_officer = self.to_biomed
        self.req_submitted.save()

        self.client.force_authenticate(user=self.to_biomed)
        res = self.client.post(f'/api/procurement/requisitions/{self.req_submitted.id}/evaluate/', {
            'compliance': 'Compliant',
            'remarks': 'Premature evaluation attempt',
            'recommendation': 'Technically Suitable'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('pending technical evaluation', res.data.get('detail', '').lower())

    def test_evaluation_validation_missing_fields(self):
        """
        Remarks and recommendation are strictly validated. Documents are not required.
        """
        self.client.force_authenticate(user=self.to_biomed)

        # Missing recommendation
        res = self.client.post(f'/api/procurement/requisitions/{self.req_biomed.id}/evaluate/', {
            'remarks': 'Some remarks',
            'recommendation': ''
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recommendation', res.data)

        # Missing remarks
        res = self.client.post(f'/api/procurement/requisitions/{self.req_biomed.id}/evaluate/', {
            'remarks': '   ',
            'recommendation': 'Technically Suitable'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('remarks', res.data)

        # Invalid recommendation choice
        res = self.client.post(f'/api/procurement/requisitions/{self.req_biomed.id}/evaluate/', {
            'remarks': 'Valid remarks',
            'recommendation': 'Invalid Choice'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recommendation', res.data)

    def test_successful_evaluation_technically_suitable_moves_to_committee(self):
        """
        When recommendation is Technically Suitable:
        - Saves evaluation against the same existing purchase request.
        - Preserves original purchase request unchanged.
        - Moves status to PENDING_COMMITTEE_REVIEW.
        - Records assigned Technical Officer and details.
        - Records audit log and approval record.
        """
        self.client.force_authenticate(user=self.to_biomed)
        res = self.client.post(f'/api/procurement/requisitions/{self.req_biomed.id}/evaluate/', {
            'compliance': 'Compliant',
            'remarks': 'Meets all clinical and biomedical safety specifications (IEC 60601-1 certified).',
            'recommendation': 'Technically Suitable'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.req_biomed.refresh_from_db()

        # Moved to Procurement Committee review
        self.assertEqual(self.req_biomed.status, Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW)
        self.assertEqual(self.req_biomed.technical_compliance, 'Compliant')
        self.assertEqual(self.req_biomed.technical_recommendation, 'Technically Suitable')
        self.assertIn('IEC 60601-1', self.req_biomed.technical_evaluation_remarks)
        self.assertIsNotNone(self.req_biomed.technical_evaluated_at)

        # Original purchase request fields preserved unchanged
        self.assertEqual(self.req_biomed.title, 'ECG Monitor Set')
        self.assertEqual(self.req_biomed.department, self.dept)
        self.assertEqual(self.req_biomed.requested_by, self.staff_user)
        self.assertEqual(self.req_biomed.estimated_budget, 150000.00)
        self.assertEqual(self.req_biomed.justification, 'Critical replacement for Cardiac ICU')
        self.assertEqual(self.req_biomed.items.count(), 1)

        # TechnicalEvaluation record created
        eval_record = TechnicalEvaluation.objects.filter(requisition=self.req_biomed).first()
        self.assertIsNotNone(eval_record)
        self.assertEqual(eval_record.evaluated_by, self.to_biomed)
        self.assertEqual(eval_record.compliance, 'Compliant')
        self.assertEqual(eval_record.recommendation, 'Technically Suitable')

        # Approval record created
        approval = Approval.objects.filter(requisition=self.req_biomed, stage='Technical Evaluation').first()
        self.assertIsNotNone(approval)
        self.assertEqual(approval.approved_by, self.to_biomed)
        self.assertEqual(approval.status, Approval.StatusChoices.APPROVED)

        # AuditLog record created
        audit = AuditLog.objects.filter(action__icontains='Technical Evaluation Completed').first()
        self.assertIsNotNone(audit)
        self.assertEqual(audit.user, self.to_biomed)

    def test_evaluation_technically_not_suitable_is_forbidden(self):
        """
        Technical Officers cannot reject purchase requests.
        Submitting Technically Not Suitable or rejection returns 400 Bad Request.
        """
        self.client.force_authenticate(user=self.to_biomed)
        res = self.client.post(f'/api/procurement/requisitions/{self.req_biomed.id}/evaluate/', {
            'remarks': 'Fails hospital electrical safety harmonics threshold; unacceptable patient leakage current.',
            'recommendation': 'Technically Not Suitable'
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Rejection is not permitted', res.data.get('recommendation', ''))

        # Verify requisition status remained unchanged
        self.req_biomed.refresh_from_db()
        self.assertEqual(self.req_biomed.status, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION)

    def test_evaluation_requires_remarks_for_both_outcomes(self):
        """
        Remarks are mandatory when submitting either outcome.
        """
        self.client.force_authenticate(user=self.to_biomed)
        # Empty remarks on Suitable
        res1 = self.client.post(f'/api/procurement/requisitions/{self.req_biomed.id}/evaluate/', {
            'recommendation': 'Technically Suitable',
            'remarks': ''
        })
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)

        # Empty remarks on Clarification
        res2 = self.client.post(f'/api/procurement/requisitions/{self.req_biomed.id}/evaluate/', {
            'recommendation': 'Return for Clarification',
            'remarks': '   '
        })
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_evaluation_requires_clarification_returns_requisition(self):
        """
        When recommendation is Requires Clarification:
        - Requisition status moves to RETURNED.
        - Remarks preserved in review_comments and technical_evaluation_remarks.
        """
        self.client.force_authenticate(user=self.to_biomed)
        res = self.client.post(f'/api/procurement/requisitions/{self.req_biomed.id}/evaluate/', {
            'compliance': 'Partially Compliant',
            'remarks': 'Please clarify whether telemetry transmitter modules and central monitor license are included.',
            'recommendation': 'Requires Clarification'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.req_biomed.refresh_from_db()
        self.assertEqual(self.req_biomed.status, Requisition.StatusChoices.RETURNED)
        self.assertEqual(self.req_biomed.technical_compliance, 'Partially Compliant')
        self.assertEqual(self.req_biomed.technical_recommendation, 'Requires Clarification')
        self.assertIn('telemetry transmitter', self.req_biomed.review_comments)

    def test_to_cannot_edit_requisition_details(self):
        """
        A Technical Officer cannot change title, department, requested_by, budget, or other original fields.
        """
        self.client.force_authenticate(user=self.to_biomed)
        res = self.client.patch(f'/api/procurement/requisitions/{self.req_biomed.id}/', {
            'title': 'Hacked Title',
            'estimated_budget': 999999.00
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('strictly read-only', res.data.get('detail', ''))

    def test_to_can_view_assigned_requisition_supporting_document(self):
        """
        Technical Officer can view the supporting document uploaded by Department Staff
        for assigned purchase requests, via both actual media URL and document API endpoint.
        """
        dummy_file = SimpleUploadedFile("department_specs.pdf", b"%PDF-1.4 test specs", content_type="application/pdf")
        self.req_biomed.supporting_document = dummy_file
        self.req_biomed.save()

        try:
            # 1. Technical Officer Dashboard returns actual document URL
            self.client.force_authenticate(user=self.to_biomed)
            dash_res = self.client.get('/api/procurement/technical-officer-dashboard/')
            self.assertEqual(dash_res.status_code, status.HTTP_200_OK)
            eval_item = next((item for item in dash_res.data['assigned_evaluations'] if item['id'] == self.req_biomed.id), None)
            self.assertIsNotNone(eval_item)
            self.assertIsNotNone(eval_item.get('supporting_document'))
            self.assertIn('department_specs', eval_item['supporting_document'])
            self.assertIsNotNone(eval_item.get('actual_document_url'))
            self.assertIn('department_specs', eval_item['actual_document_url'])

            # 2. Requisition document endpoint delivers inline FileResponse
            doc_res = self.client.get(f'/api/procurement/requisitions/{self.req_biomed.id}/document/')
            self.assertEqual(doc_res.status_code, status.HTTP_200_OK)
            self.assertEqual(doc_res['Content-Type'], 'application/pdf')
            self.assertIn('inline', doc_res.get('Content-Disposition', ''))
            if hasattr(doc_res, 'file_to_stream') and doc_res.file_to_stream:
                doc_res.file_to_stream.close()

            # 3. Another TO not assigned to this requisition is denied access (403)
            self.client.force_authenticate(user=self.to_imaging)
            forbidden_res = self.client.get(f'/api/procurement/requisitions/{self.req_biomed.id}/document/')
            self.assertEqual(forbidden_res.status_code, status.HTTP_403_FORBIDDEN)

            # 4. Unauthenticated access returns 401
            self.client.logout()
            unauth_res = self.client.get(f'/api/procurement/requisitions/{self.req_biomed.id}/document/')
            self.assertEqual(unauth_res.status_code, status.HTTP_401_UNAUTHORIZED)
        finally:
            if self.req_biomed.supporting_document and self.req_biomed.supporting_document.storage.exists(self.req_biomed.supporting_document.name):
                try:
                    self.req_biomed.supporting_document.storage.delete(self.req_biomed.supporting_document.name)
                except Exception:
                    pass
