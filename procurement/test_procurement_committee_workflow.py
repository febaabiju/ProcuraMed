from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from accounts.models import Role, Department, AuditLog
from procurement.models import Requisition, RequisitionItem, TechnicalEvaluation, Approval

User = get_user_model()


class ProcurementCommitteeWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Roles
        self.committee_role, _ = Role.objects.get_or_create(
            name='Procurement Committee Member',
            defaults={'description': 'Committee Member'}
        )
        self.to_role, _ = Role.objects.get_or_create(
            name='Technical Officer',
            defaults={'description': 'Technical Officer'}
        )
        self.po_role, _ = Role.objects.get_or_create(
            name='Purchase Officer',
            defaults={'description': 'Purchase Officer'}
        )
        self.staff_role, _ = Role.objects.get_or_create(
            name='Department Staff',
            defaults={'description': 'Department Staff'}
        )

        # Department
        self.dept, _ = Department.objects.get_or_create(
            name='Medical & Clinical Services',
            defaults={'code': 'MCS'}
        )

        # Users
        self.committee_user, _ = User.objects.get_or_create(
            username='test_pc_101',
            defaults={
                'email': 'test_pc@procuramed.com',
                'first_name': 'Sara',
                'last_name': 'Issac',
                'role': self.committee_role,
                'employee_id': 'TPC101'
            }
        )
        self.committee_user.set_password('TestPass123!')
        self.committee_user.save()

        self.to_user, _ = User.objects.get_or_create(
            username='test_to_101',
            defaults={
                'email': 'test_to@procuramed.com',
                'first_name': 'Paul',
                'last_name': 'Varghese',
                'role': self.to_role,
                'employee_id': 'TTO101',
                'technical_specializations': ['Biomedical Equipment']
            }
        )
        self.to_user.set_password('TestPass123!')
        self.to_user.save()

        self.po_user, _ = User.objects.get_or_create(
            username='test_po_101',
            defaults={
                'email': 'test_po@procuramed.com',
                'first_name': 'Rahul',
                'last_name': 'Menon',
                'role': self.po_role,
                'employee_id': 'TPO101'
            }
        )
        self.po_user.set_password('TestPass123!')
        self.po_user.save()

        self.staff_user, _ = User.objects.get_or_create(
            username='test_ds_101',
            defaults={
                'email': 'test_ds@procuramed.com',
                'first_name': 'Anil',
                'last_name': 'Kumar',
                'role': self.staff_role,
                'department': self.dept,
                'employee_id': 'TDS101'
            }
        )
        self.staff_user.set_password('TestPass123!')
        self.staff_user.save()

        # Requisition: Technically Suitable & Pending Committee Review
        self.req_technically_approved = Requisition.objects.create(
            req_number='REQ-TEST-PC-001',
            title='Procurement of Anaesthesia Machine',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_purchase_officer=self.po_user,
            assigned_technical_officer=self.to_user,
            requires_technical_evaluation=True,
            technical_specialization='Biomedical Equipment',
            technical_recommendation=TechnicalEvaluation.RecommendationChoices.SUITABLE,
            technical_compliance=TechnicalEvaluation.ComplianceChoices.COMPLIANT,
            technical_evaluation_remarks='Specs verified and technically suitable.',
            estimated_budget=Decimal('350000.00'),
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
            justification='Critical replacement for Operating Room 3.'
        )
        self.item1 = RequisitionItem.objects.create(
            requisition=self.req_technically_approved,
            item_name='Anaesthesia Delivery System',
            category='Medical Equipment & Devices',
            quantity=1,
            specifications='Integrated ventilator with electronic flowmeter',
            estimated_unit_price=Decimal('350000.00'),
            total_price=Decimal('350000.00')
        )
        TechnicalEvaluation.objects.create(
            requisition=self.req_technically_approved,
            evaluated_by=self.to_user,
            compliance=TechnicalEvaluation.ComplianceChoices.COMPLIANT,
            recommendation=TechnicalEvaluation.RecommendationChoices.SUITABLE,
            remarks='Specs verified and technically suitable.'
        )

        # Requisition: Not technically evaluated / Draft
        self.req_draft = Requisition.objects.create(
            req_number='REQ-TEST-PC-002',
            title='Procurement of Surgical Gloves',
            department=self.dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.DRAFT,
            assigned_committee_member=self.committee_user,
            estimated_budget=Decimal('10000.00')
        )

    def test_dashboard_displays_technically_approved_requests(self):
        self.client.force_authenticate(user=self.committee_user)
        response = self.client.get('/api/procurement/committee-dashboard/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        stats = response.data.get('stats', {})
        self.assertGreaterEqual(stats.get('pending_committee_reviews', 0), 1)

        pending_reviews = response.data.get('pending_reviews', [])
        req_numbers = [r['req_number'] for r in pending_reviews]
        self.assertIn('REQ-TEST-PC-001', req_numbers)
        self.assertNotIn('REQ-TEST-PC-002', req_numbers)

        item = next(r for r in pending_reviews if r['req_number'] == 'REQ-TEST-PC-001')
        self.assertEqual(item['department_name'], 'Medical & Clinical Services')
        self.assertEqual(item['item_name'], 'Anaesthesia Delivery System')
        self.assertEqual(item['quantity'], 1)
        self.assertEqual(item['technical_evaluation_result'], 'Technically Suitable')
        self.assertIn('items', item)
        self.assertEqual(len(item['items']), 1)
        self.assertEqual(item['items'][0]['specifications'], 'Integrated ventilator with electronic flowmeter')

    def test_committee_member_can_approve_request(self):
        self.client.force_authenticate(user=self.committee_user)
        url = f'/api/procurement/requisitions/{self.req_technically_approved.id}/approve/'
        payload = {'comments': 'Approved unanimously by Procurement Committee.'}

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.req_technically_approved.refresh_from_db()
        self.assertEqual(self.req_technically_approved.status, Requisition.StatusChoices.APPROVED)
        self.assertEqual(self.req_technically_approved.get_status_display(), 'Committee Approved')
        self.assertEqual(self.req_technically_approved.reviewed_by, self.committee_user)
        self.assertEqual(self.req_technically_approved.review_comments, 'Approved unanimously by Procurement Committee.')

        # Verify Approval record
        latest_approval = Approval.objects.filter(
            requisition=self.req_technically_approved,
            stage='Procurement Committee Review'
        ).first()
        self.assertIsNotNone(latest_approval)
        self.assertEqual(latest_approval.status, Approval.StatusChoices.APPROVED)
        self.assertEqual(latest_approval.approved_by, self.committee_user)

        # Verify AuditLog record
        log = AuditLog.objects.filter(
            action='Procurement Committee Approved',
            module='Procurement Committee'
        ).first()
        self.assertIsNotNone(log)

        # Check dashboard updates
        dash_res = self.client.get('/api/procurement/committee-dashboard/')
        approved_numbers = [r['req_number'] for r in dash_res.data.get('approved_requests', [])]
        self.assertIn('REQ-TEST-PC-001', approved_numbers)
        pending_numbers = [r['req_number'] for r in dash_res.data.get('pending_reviews', [])]
        self.assertNotIn('REQ-TEST-PC-001', pending_numbers)

    def test_committee_member_can_return_for_clarification_to_to(self):
        self.client.force_authenticate(user=self.committee_user)
        url = f'/api/procurement/requisitions/{self.req_technically_approved.id}/return-clarification/'
        payload = {
            'target': 'technical_officer',
            'remarks': 'Please re-verify warranty terms and auxiliary power supply requirements.'
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.req_technically_approved.refresh_from_db()
        self.assertEqual(self.req_technically_approved.status, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION)
        self.assertEqual(self.req_technically_approved.assigned_technical_officer, self.to_user)
        self.assertEqual(self.req_technically_approved.assigned_purchase_officer, self.po_user)

        # Verify Approval record
        app = Approval.objects.filter(
            requisition=self.req_technically_approved,
            stage='Procurement Committee Review'
        ).first()
        self.assertIsNotNone(app)
        self.assertEqual(app.status, Approval.StatusChoices.RETURNED)

        # Check removed from pending reviews
        dash_res = self.client.get('/api/procurement/committee-dashboard/')
        pending_numbers = [r['req_number'] for r in dash_res.data.get('pending_reviews', [])]
        self.assertNotIn('REQ-TEST-PC-001', pending_numbers)

    def test_committee_member_can_return_for_clarification_to_staff(self):
        self.client.force_authenticate(user=self.committee_user)
        url = f'/api/procurement/requisitions/{self.req_technically_approved.id}/return-clarification/'
        payload = {
            'target': 'department_staff',
            'remarks': 'Please provide additional departmental justification regarding OR schedule.'
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.req_technically_approved.refresh_from_db()
        self.assertEqual(self.req_technically_approved.status, Requisition.StatusChoices.RETURNED)
        self.assertEqual(self.req_technically_approved.assigned_technical_officer, self.to_user)
        self.assertEqual(self.req_technically_approved.assigned_purchase_officer, self.po_user)

    def test_committee_member_can_return_for_clarification_to_po(self):
        self.client.force_authenticate(user=self.committee_user)
        url = f'/api/procurement/requisitions/{self.req_technically_approved.id}/return-clarification/'
        payload = {
            'target': 'purchase_officer',
            'remarks': 'Please review the allocated departmental budget code.'
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.req_technically_approved.refresh_from_db()
        self.assertEqual(self.req_technically_approved.status, Requisition.StatusChoices.SUBMITTED)
        self.assertEqual(self.req_technically_approved.assigned_purchase_officer, self.po_user)

    def test_return_requires_mandatory_remarks(self):
        self.client.force_authenticate(user=self.committee_user)
        url = f'/api/procurement/requisitions/{self.req_technically_approved.id}/return-clarification/'
        payload = {'target': 'technical_officer', 'remarks': ''}

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('remarks', response.data)

    def test_rejection_is_forbidden(self):
        self.client.force_authenticate(user=self.committee_user)
        url = f'/api/procurement/requisitions/{self.req_technically_approved.id}/reject/'
        payload = {'comments': 'Rejecting request'}

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Rejection is not permitted', response.data.get('detail', ''))

    def test_unauthorized_user_cannot_approve(self):
        self.client.force_authenticate(user=self.staff_user)
        url = f'/api/procurement/requisitions/{self.req_technically_approved.id}/approve/'
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cannot_approve_non_pending_request(self):
        self.client.force_authenticate(user=self.committee_user)
        url = f'/api/procurement/requisitions/{self.req_draft.id}/approve/'
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_po_approves_non_technical_request_routes_directly_to_committee(self):
        """
        When a Purchase Officer approves a routine non-technical request,
        it must route directly to PENDING_COMMITTEE_REVIEW without technical evaluation.
        """
        # Create a submitted requisition with routine consumable items
        req_routine = Requisition.objects.create(
            req_number='REQ-TEST-ROUTINE-01',
            title='Procurement of Cotton Gauze and Bandages',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_purchase_officer=self.po_user,
            status=Requisition.StatusChoices.SUBMITTED,
            category='Medical Consumables',
            estimated_budget=Decimal('1500.00'),
            requires_technical_evaluation=False
        )
        RequisitionItem.objects.create(
            requisition=req_routine,
            item_name='Sterile Cotton Gauze Rolls',
            category='Medical Consumables',
            quantity=100,
            estimated_unit_price=Decimal('15.00'),
            total_price=Decimal('1500.00'),
            specifications='Standard absorbent sterile medical cotton gauze rolls.'
        )

        self.client.force_authenticate(user=self.po_user)
        url = f'/api/procurement/requisitions/{req_routine.id}/review/'
        payload = {
            'action': 'PROCEED',
            'requires_technical_evaluation': False,
            'reason': 'Routine hospital consumables verified. Proceeding directly to Procurement Committee.'
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        req_routine.refresh_from_db()
        self.assertEqual(req_routine.status, Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW)
        self.assertFalse(req_routine.requires_technical_evaluation)
        self.assertIsNone(req_routine.assigned_technical_officer)
        self.assertEqual(req_routine.assigned_purchase_officer, self.po_user)

        # Check appearance on committee dashboard
        self.client.force_authenticate(user=self.committee_user)
        dash_res = self.client.get('/api/procurement/committee-dashboard/')
        self.assertEqual(dash_res.status_code, status.HTTP_200_OK)
        pending_items = {r['req_number']: r for r in dash_res.data.get('pending_reviews', [])}
        self.assertIn('REQ-TEST-ROUTINE-01', pending_items)
        self.assertEqual(pending_items['REQ-TEST-ROUTINE-01']['technical_evaluation_result'], 'Not Required')
        self.assertFalse(pending_items['REQ-TEST-ROUTINE-01']['requires_technical_evaluation'])

    def test_po_cannot_bypass_technical_evaluation_for_equipment_request(self):
        """
        Verify that requests requiring technical evaluation cannot bypass it.
        Attempting to proceed with requires_technical_evaluation=False must be rejected.
        """
        req_equipment = Requisition.objects.create(
            req_number='REQ-TEST-EQUIP-01',
            title='Procurement of Multiparameter Patient Monitor',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_purchase_officer=self.po_user,
            status=Requisition.StatusChoices.SUBMITTED,
            category='Medical Equipment & Devices',
            estimated_budget=Decimal('120000.00'),
            requires_technical_evaluation=True
        )
        RequisitionItem.objects.create(
            requisition=req_equipment,
            item_name='Multiparameter Patient Monitor',
            category='Medical Equipment & Devices',
            quantity=1,
            estimated_unit_price=Decimal('120000.00'),
            total_price=Decimal('120000.00'),
            specifications='Patient monitor with ECG, NIBP, SpO2, and temperature monitoring.'
        )

        self.client.force_authenticate(user=self.po_user)
        url = f'/api/procurement/requisitions/{req_equipment.id}/review/'
        payload = {
            'action': 'PROCEED',
            'requires_technical_evaluation': False,
            'reason': 'Attempting to bypass technical evaluation.'
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('requires_technical_evaluation', response.data)
        self.assertIn('cannot be bypassed', str(response.data['requires_technical_evaluation']))

    def test_committee_approves_non_technical_request(self):
        """
        Test that a committee member can approve a non-technical request,
        updating status to APPROVED and recording it in decision history.
        """
        req_non_tech = Requisition.objects.create(
            req_number='REQ-TEST-NONTECH-01',
            title='Procurement of Latex Examination Gloves',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_purchase_officer=self.po_user,
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
            category='Medical Consumables',
            estimated_budget=Decimal('3000.00'),
            requires_technical_evaluation=False
        )
        RequisitionItem.objects.create(
            requisition=req_non_tech,
            item_name='Latex Examination Gloves (Box of 100)',
            category='Medical Consumables',
            quantity=20,
            estimated_unit_price=Decimal('150.00'),
            total_price=Decimal('3000.00'),
            specifications='Powder-free disposable latex examination gloves.'
        )

        self.client.force_authenticate(user=self.committee_user)
        url = f'/api/procurement/requisitions/{req_non_tech.id}/approve/'
        payload = {'comments': 'Approved by Procurement Committee for hospital consumable stock.'}

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        req_non_tech.refresh_from_db()
        self.assertEqual(req_non_tech.status, Requisition.StatusChoices.APPROVED)
        self.assertEqual(req_non_tech.get_status_display(), 'Committee Approved')
        self.assertEqual(req_non_tech.reviewed_by, self.committee_user)

        # Verify appearance in Committee Approved section and Decision History
        dash_res = self.client.get('/api/procurement/committee-dashboard/')
        approved_numbers = [r['req_number'] for r in dash_res.data.get('approved_requests', [])]
        self.assertIn('REQ-TEST-NONTECH-01', approved_numbers)

        history_numbers = [h['req_number'] for h in dash_res.data.get('decision_history', [])]
        self.assertIn('REQ-TEST-NONTECH-01', history_numbers)

    def test_committee_cannot_route_non_technical_clarification_to_to(self):
        """
        If a request does not require technical evaluation (no TO assigned),
        the committee cannot route clarification to a Technical Officer.
        """
        req_non_tech = Requisition.objects.create(
            req_number='REQ-TEST-NONTECH-02',
            title='Procurement of Face Masks',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_purchase_officer=self.po_user,
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
            category='Medical Consumables',
            estimated_budget=Decimal('1000.00'),
            requires_technical_evaluation=False
        )

        self.client.force_authenticate(user=self.committee_user)
        url = f'/api/procurement/requisitions/{req_non_tech.id}/return-clarification/'
        payload = {
            'target': 'technical_officer',
            'remarks': 'Clarify specifications'
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('No Technical Officer is assigned', response.data.get('detail', ''))

    def test_committee_returns_non_technical_request_to_po(self):
        """
        Committee returns a non-technical request to the Purchase Officer.
        Preserves assigned PO and transitions status to SUBMITTED.
        """
        req_non_tech = Requisition.objects.create(
            req_number='REQ-TEST-NONTECH-03',
            title='Procurement of Disinfectant Solutions',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_purchase_officer=self.po_user,
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
            category='Cleaning & Housekeeping Supplies',
            estimated_budget=Decimal('2000.00'),
            requires_technical_evaluation=False
        )

        self.client.force_authenticate(user=self.committee_user)
        url = f'/api/procurement/requisitions/{req_non_tech.id}/return-clarification/'
        payload = {
            'target': 'purchase_officer',
            'remarks': 'Please confirm bulk order discount with vendor.'
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        req_non_tech.refresh_from_db()
        self.assertEqual(req_non_tech.status, Requisition.StatusChoices.SUBMITTED)
        self.assertEqual(req_non_tech.assigned_purchase_officer, self.po_user)

        # Check appearance in returned clarifications
        dash_res = self.client.get('/api/procurement/committee-dashboard/')
        returned_numbers = [r['req_number'] for r in dash_res.data.get('returned_clarifications', [])]
        self.assertIn('REQ-TEST-NONTECH-03', returned_numbers)

