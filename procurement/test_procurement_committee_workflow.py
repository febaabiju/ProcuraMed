from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from accounts.models import Role, Department, AuditLog
from procurement.models import (
    Requisition, RequisitionItem, TechnicalEvaluation, Approval,
    QuotationRequest, Quotation, RFQVendorInvitation
)
from vendors.models import Vendor, SupplierCategory

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

    def test_assigned_request_remains_visible_during_vendor_sourcing_until_status_changes(self):
        """
        Verify that opening a request and searching for vendors:
        1. Keeps the requisition in pending_reviews (Assigned Requests) without disappearing.
        2. Status remains PENDING_COMMITTEE_REVIEW until genuinely changed.
        3. When an RFQ is issued or approved, it transitions correctly to the next stage.
        """
        self.client.force_authenticate(user=self.committee_user)

        # 1. Check initially present in pending_reviews
        dash_res = self.client.get('/api/procurement/committee-dashboard/')
        pending_nums = [r['req_number'] for r in dash_res.data.get('pending_reviews', [])]
        self.assertIn('REQ-TEST-PC-001', pending_nums)

        # 2. Perform vendor search
        vendor_res = self.client.get(f'/api/procurement/requisitions/{self.req_technically_approved.id}/find-vendors/')
        self.assertEqual(vendor_res.status_code, status.HTTP_200_OK)

        # 3. Verify request is STILL in pending_reviews after vendor search
        dash_res2 = self.client.get('/api/procurement/committee-dashboard/')
        pending_nums2 = [r['req_number'] for r in dash_res2.data.get('pending_reviews', [])]
        self.assertIn('REQ-TEST-PC-001', pending_nums2)

        # Verify DB status unchanged
        self.req_technically_approved.refresh_from_db()
        self.assertEqual(self.req_technically_approved.status, Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW)

        # 4. Genuinely change status by approving
        app_res = self.client.post(
            f'/api/procurement/requisitions/{self.req_technically_approved.id}/approve/',
            {'comments': 'Approved for hospital supply.'},
            format='json'
        )
        self.assertEqual(app_res.status_code, status.HTTP_200_OK)

        # 5. After genuine status change, verify it moves to approved_requests (Approved & Sourcing)
        dash_res3 = self.client.get('/api/procurement/committee-dashboard/')
        pending_nums3 = [r['req_number'] for r in dash_res3.data.get('pending_reviews', [])]
        self.assertNotIn('REQ-TEST-PC-001', pending_nums3)

        approved_nums3 = [r['req_number'] for r in dash_res3.data.get('approved_requests', [])]
        self.assertIn('REQ-TEST-PC-001', approved_nums3)

    def _create_category_and_vendors(self, count=4):
        cat, _ = SupplierCategory.objects.get_or_create(
            name='Medical Equipment & Devices',
            defaults={'description': 'Medical equipment category'}
        )
        vendors = []
        for i in range(1, count + 1):
            v, _ = Vendor.objects.get_or_create(
                company_name=f'MedTech Supplier {i} Pvt Ltd',
                defaults={
                    'email': f'contact{i}@medtechsupplier{i}.com',
                    'phone': f'+91 987654321{i}',
                    'contact_person': f'Manager {i}',
                    'status': Vendor.StatusChoices.ACTIVE,
                    'is_active': True
                }
            )
            v.supplier_categories.add(cat)
            vendors.append(v)
        return cat, vendors

    def test_rfq_creation_allows_2_to_4_vendors_and_sets_awaiting_quotations_status(self):
        """
        Requirements 1 & 3:
        1. Committee must be able to select and send RFQs to 2-4 eligible vendors.
        2. Reject <2 vendors if >=2 available, reject >4 vendors.
        3. After issuing RFQs, requisition status is RFQ_ISSUED ('Awaiting Quotations').
        """
        self.client.force_authenticate(user=self.committee_user)
        cat, vendors = self._create_category_and_vendors(5)

        req = Requisition.objects.create(
            req_number='REQ-MULTI-VENDOR-01',
            title='Procurement of Patient Monitors',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_committee_member=self.committee_user,
            status=Requisition.StatusChoices.APPROVED,
            category=cat.name,
            estimated_budget=Decimal('150000.00'),
            requires_technical_evaluation=False
        )

        rfq_url = '/api/procurement/rfqs/'
        future_due_date = (timezone.now() + timedelta(days=14)).date().isoformat()

        # Attempt 1: Only 1 vendor when 5 available -> Should fail (minimum 2 required)
        res_fail_1 = self.client.post(rfq_url, {
            'requisition_id': req.id,
            'title': 'RFQ for Patient Monitors',
            'due_date': future_due_date,
            'vendor_ids': [vendors[0].id]
        }, format='json')
        self.assertEqual(res_fail_1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('vendor_ids', res_fail_1.data)

        # Attempt 2: 5 vendors -> Should fail (maximum 4 allowed)
        res_fail_5 = self.client.post(rfq_url, {
            'requisition_id': req.id,
            'title': 'RFQ for Patient Monitors',
            'due_date': future_due_date,
            'vendor_ids': [v.id for v in vendors[:5]]
        }, format='json')
        self.assertEqual(res_fail_5.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('vendor_ids', res_fail_5.data)

        # Attempt 3: Exactly 3 vendors (within 2 to 4 range) -> Should succeed!
        selected_3 = vendors[:3]
        res_success = self.client.post(rfq_url, {
            'requisition_id': req.id,
            'title': 'RFQ for Patient Monitors',
            'due_date': future_due_date,
            'vendor_ids': [v.id for v in selected_3],
            'delivery_requirements': '14 days delivery to Central Stores.'
        }, format='json')
        self.assertEqual(res_success.status_code, status.HTTP_201_CREATED)

        # Verify DB records
        rfq_data = res_success.data['rfq']
        self.assertEqual(rfq_data['invited_vendors_count'], 3)
        self.assertEqual(len(rfq_data['vendor_invitations']), 3)

        # Requisition status must transition to RFQ_ISSUED ('Awaiting Quotations')
        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.RFQ_ISSUED)
        self.assertEqual(req.get_status_display(), 'Awaiting Quotations')

        # Serializer workflow status should report AWAITING_QUOTATIONS
        self.assertEqual(rfq_data['quotation_workflow_status'], 'AWAITING_QUOTATIONS')
        self.assertIn('Awaiting Quotations', rfq_data['quotation_workflow_status_display'])

        # Verify individual invitations created in INVITED status
        invitations = RFQVendorInvitation.objects.filter(quotation_request_id=rfq_data['id'])
        self.assertEqual(invitations.count(), 3)
        for inv in invitations:
            self.assertEqual(inv.status, RFQVendorInvitation.InvitationStatus.INVITED)

    def test_quotation_workflow_vendor_wise_tracking_and_status_transitions(self):
        """
        Requirements 2, 3, 4:
        1. Sending RFQ to multiple vendors does not complete the process.
        2. Receiving 1 vendor quotation updates requisition to 'Quotations Received' (QUOTATIONS_RECEIVED),
           updates that vendor's status to QUOTED, while keeping other vendors as 'Awaiting Quotation'.
        3. Quotation stage completes only when a quotation is accepted.
        """
        self.client.force_authenticate(user=self.committee_user)
        cat, vendors = self._create_category_and_vendors(3)

        req = Requisition.objects.create(
            req_number='REQ-MULTI-VENDOR-02',
            title='Procurement of Defibrillators',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_committee_member=self.committee_user,
            status=Requisition.StatusChoices.APPROVED,
            category=cat.name,
            estimated_budget=Decimal('200000.00'),
            requires_technical_evaluation=False
        )

        future_due_date = (timezone.now() + timedelta(days=14)).date().isoformat()
        rfq_res = self.client.post('/api/procurement/rfqs/', {
            'requisition_id': req.id,
            'title': 'RFQ for Defibrillators',
            'due_date': future_due_date,
            'vendor_ids': [v.id for v in vendors]
        }, format='json')
        self.assertEqual(rfq_res.status_code, status.HTTP_201_CREATED)
        rfq_id = rfq_res.data['rfq']['id']

        # Status is RFQ_ISSUED ('Awaiting Quotations')
        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.RFQ_ISSUED)
        self.assertEqual(req.get_status_display(), 'Awaiting Quotations')

        # Step 1: Vendor 1 submits a quotation
        q1_res = self.client.post('/api/procurement/quotations/', {
            'quotation_request': rfq_id,
            'vendor': vendors[0].id,
            'total_amount': '195000.00',
            'lead_time_days': 10,
            'remarks': 'Includes warranty and delivery.'
        }, format='json')
        self.assertEqual(q1_res.status_code, status.HTTP_201_CREATED)
        q1_id = q1_res.data['id']

        # Requisition status must transition to QUOTATIONS_RECEIVED ('Quotations Received')
        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.QUOTATIONS_RECEIVED)
        self.assertEqual(req.get_status_display(), 'Quotations Received')

        # Check vendor-wise tracking on the RFQ detail endpoint
        rfq_detail_res = self.client.get(f'/api/procurement/rfqs/{rfq_id}/')
        self.assertEqual(rfq_detail_res.status_code, status.HTTP_200_OK)
        vt = rfq_detail_res.data['vendor_tracking']
        self.assertEqual(len(vt), 3)

        # Vendor 1 should be QUOTED with quotation details
        v1_track = next(v for v in vt if v['vendor_id'] == vendors[0].id)
        self.assertTrue(v1_track['has_quoted'])
        self.assertEqual(v1_track['invitation_status'], 'QUOTED')
        self.assertEqual(v1_track['quotation_status'], 'SUBMITTED')
        self.assertEqual(Decimal(v1_track['total_amount']), Decimal('195000.00'))

        # Vendor 2 & 3 must still be Awaiting Quotation
        v2_track = next(v for v in vt if v['vendor_id'] == vendors[1].id)
        self.assertFalse(v2_track['has_quoted'])
        self.assertEqual(v2_track['invitation_status'], 'INVITED')
        self.assertEqual(v2_track['quotation_status_display'], 'Awaiting Quotation')

        v3_track = next(v for v in vt if v['vendor_id'] == vendors[2].id)
        self.assertFalse(v3_track['has_quoted'])
        self.assertEqual(v3_track['invitation_status'], 'INVITED')

        # Step 2: Vendor 2 submits a quotation via record-quotation endpoint
        record_res = self.client.post(f'/api/procurement/rfqs/{rfq_id}/record-quotation/', {
            'vendor_id': vendors[1].id,
            'total_amount': '180000.00',
            'lead_time_days': 7,
            'remarks': 'Fast delivery within 7 days.'
        }, format='json')
        self.assertEqual(record_res.status_code, status.HTTP_201_CREATED)
        q2_id = record_res.data['quotation']['id']

        # Verify Vendor 2 is now quoted
        inv2 = RFQVendorInvitation.objects.get(quotation_request_id=rfq_id, vendor=vendors[1])
        self.assertEqual(inv2.status, RFQVendorInvitation.InvitationStatus.QUOTED)

        # Step 3: Committee accepts Vendor 2's quotation
        accept_res = self.client.post(f'/api/procurement/quotations/{q2_id}/accept/', format='json')
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)

        # Verify Vendor 2 quotation is ACCEPTED
        q2 = Quotation.objects.get(id=q2_id)
        self.assertEqual(q2.status, Quotation.StatusChoices.ACCEPTED)

        # Verify Vendor 1 competing quotation is REJECTED
        q1 = Quotation.objects.get(id=q1_id)
        self.assertEqual(q1.status, Quotation.StatusChoices.REJECTED)

        # Verify RFQ is CLOSED and Requisition is COMPLETED (quotation stage fulfilled)
        rfq_obj = QuotationRequest.objects.get(id=rfq_id)
        self.assertEqual(rfq_obj.status, QuotationRequest.StatusChoices.CLOSED)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.COMPLETED)

    def _create_test_requisition(self, title, category, budget, status, req_number=None):
        import uuid
        if not req_number:
            req_number = f"REQ-TEST-{uuid.uuid4().hex[:8].upper()}"
        req = Requisition.objects.create(
            req_number=req_number,
            title=title,
            department=self.dept,
            requested_by=self.staff_user,
            assigned_committee_member=self.committee_user,
            assigned_purchase_officer=self.po_user,
            status=status,
            category=category,
            estimated_budget=budget,
            requires_technical_evaluation=False
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name=f"{title} Item",
            category=category,
            quantity=2,
            specifications="Hospital grade",
            estimated_unit_price=budget / Decimal('2.00'),
            total_price=budget
        )
        return req

    def test_my_assigned_requests_remain_visible_across_all_stages(self):
        """
        Verify that all requisitions assigned to the logged-in committee member
        remain visible in assigned_requests across all workflow stages (Requirement 1, 2, 5).
        """
        self.client.force_authenticate(user=self.committee_user)

        # 1. Newly Assigned request
        req_newly = self._create_test_requisition(
            title='Cardiac Monitoring System',
            category='Biomedical Equipment',
            budget=Decimal('250000.00'),
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW
        )

        # 2. Approved for Vendor Sourcing request
        req_sourcing = self._create_test_requisition(
            title='Sterilization Autoclave Units',
            category='Medical Consumables',
            budget=Decimal('120000.00'),
            status=Requisition.StatusChoices.APPROVED
        )

        # 3. RFQ Issued / Awaiting Quotations request
        req_rfq = self._create_test_requisition(
            title='Diagnostic Ultrasound Probes',
            category='Biomedical Equipment',
            budget=Decimal('180000.00'),
            status=Requisition.StatusChoices.RFQ_ISSUED
        )

        # 4. Quotations Received request
        req_quotes = self._create_test_requisition(
            title='Surgical Gloves Bulk Order',
            category='Medical Consumables',
            budget=Decimal('50000.00'),
            status=Requisition.StatusChoices.QUOTATIONS_RECEIVED
        )

        # 5. Completed request
        req_completed = self._create_test_requisition(
            title='Patient Beds Delivery Complete',
            category='Hospital Furniture',
            budget=Decimal('90000.00'),
            status=Requisition.StatusChoices.COMPLETED
        )

        # Call committee dashboard endpoint
        res = self.client.get('/api/procurement/committee-dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        data = res.data
        self.assertIn('assigned_requests', data)
        assigned_reqs = data['assigned_requests']
        assigned_ids = [r['id'] for r in assigned_reqs]

        # Requirement 1: All active and in-progress requests MUST be present (none disappear)
        self.assertIn(req_newly.id, assigned_ids)
        self.assertIn(req_sourcing.id, assigned_ids)
        self.assertIn(req_rfq.id, assigned_ids)
        self.assertIn(req_quotes.id, assigned_ids)
        self.assertIn(req_completed.id, assigned_ids)

        # Requirement 2: Categorization by stage
        item_newly = next(r for r in assigned_reqs if r['id'] == req_newly.id)
        self.assertEqual(item_newly['stage_key'], 'NEWLY_ASSIGNED')
        self.assertTrue(item_newly['action_required'])
        self.assertTrue(item_newly['is_active'])

        item_sourcing = next(r for r in assigned_reqs if r['id'] == req_sourcing.id)
        self.assertEqual(item_sourcing['stage_key'], 'VENDOR_SOURCING')
        self.assertTrue(item_sourcing['is_active'])

        item_rfq = next(r for r in assigned_reqs if r['id'] == req_rfq.id)
        self.assertEqual(item_rfq['stage_key'], 'AWAITING_QUOTATIONS')
        self.assertTrue(item_rfq['is_active'])

        item_quotes = next(r for r in assigned_reqs if r['id'] == req_quotes.id)
        self.assertEqual(item_quotes['stage_key'], 'QUOTATION_REVIEW')
        self.assertTrue(item_quotes['action_required'])
        self.assertTrue(item_quotes['is_active'])

        item_completed = next(r for r in assigned_reqs if r['id'] == req_completed.id)
        self.assertEqual(item_completed['stage_key'], 'COMPLETED')
        self.assertFalse(item_completed['is_active'])

        # Requirement 5: Data consistency between dashboard stats and assigned_requests
        stats = data['stats']
        self.assertEqual(stats['total_assigned'], len(assigned_reqs))
        self.assertGreaterEqual(stats['active_assigned'], 4)
        self.assertGreaterEqual(stats['newly_assigned'], 1)
        self.assertGreaterEqual(stats['vendor_sourcing'], 1)
        self.assertGreaterEqual(stats['awaiting_quotations'], 1)
        self.assertGreaterEqual(stats['quotation_review'], 1)

    def test_request_lifecycle_persists_in_assigned_queue_across_all_stage_transitions(self):
        """
        Verify that as a single requisition progresses through each stage:
        PENDING_COMMITTEE_REVIEW -> APPROVED -> RFQ_ISSUED -> QUOTATIONS_RECEIVED -> COMPLETED,
        it remains continuously visible in assigned_requests and properly categorized at each step.
        """
        self.client.force_authenticate(user=self.committee_user)

        # Prepare vendors
        cat, vendors = self._create_category_and_vendors(2)

        # Stage 1: Newly Assigned
        req = self._create_test_requisition(
            title='Endoscopy Video Tower Unit',
            category=cat.name,
            budget=Decimal('350000.00'),
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW
        )

        res1 = self.client.get('/api/procurement/committee-dashboard/')
        assigned1 = next(r for r in res1.data['assigned_requests'] if r['id'] == req.id)
        self.assertEqual(assigned1['stage_key'], 'NEWLY_ASSIGNED')
        self.assertTrue(assigned1['action_required'])

        # Stage 2: Committee Approval
        req.status = Requisition.StatusChoices.APPROVED
        req.save()

        res2 = self.client.get('/api/procurement/committee-dashboard/')
        assigned2 = next(r for r in res2.data['assigned_requests'] if r['id'] == req.id)
        self.assertEqual(assigned2['stage_key'], 'VENDOR_SOURCING')
        self.assertTrue(assigned2['is_active'])

        # Stage 3: RFQ issued to 2 vendors (Previously disappeared here!)
        rfq_res = self.client.post('/api/procurement/rfqs/', {
            'requisition_id': req.id,
            'title': 'RFQ for Endoscopy Tower',
            'due_date': (timezone.now() + timedelta(days=10)).strftime('%Y-%m-%d'),
            'vendor_ids': [v.id for v in vendors]
        }, format='json')
        self.assertEqual(rfq_res.status_code, status.HTTP_201_CREATED)
        rfq_id = rfq_res.data['rfq']['id']

        res3 = self.client.get('/api/procurement/committee-dashboard/')
        assigned3 = next(r for r in res3.data['assigned_requests'] if r['id'] == req.id)
        self.assertEqual(assigned3['stage_key'], 'AWAITING_QUOTATIONS')
        self.assertEqual(assigned3['status'], 'RFQ_ISSUED')
        self.assertTrue(assigned3['is_active'])
        self.assertIsNotNone(assigned3['linked_rfq'])

        # Stage 4: Quotation recorded from vendor 1
        quote_res = self.client.post(f'/api/procurement/rfqs/{rfq_id}/record-quotation/', {
            'vendor_id': vendors[0].id,
            'total_amount': '330000.00',
            'lead_time_days': 10,
            'remarks': 'Complete endoscopy tower setup.'
        }, format='json')
        self.assertEqual(quote_res.status_code, status.HTTP_201_CREATED)
        quote_id = quote_res.data['quotation']['id']

        res4 = self.client.get('/api/procurement/committee-dashboard/')
        assigned4 = next(r for r in res4.data['assigned_requests'] if r['id'] == req.id)
        self.assertEqual(assigned4['stage_key'], 'QUOTATION_REVIEW')
        self.assertEqual(assigned4['status'], 'QUOTATIONS_RECEIVED')
        self.assertTrue(assigned4['action_required'])

        # Stage 5: Quotation accepted by committee
        accept_res = self.client.post(f'/api/procurement/quotations/{quote_id}/accept/', format='json')
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)

        res5 = self.client.get('/api/procurement/committee-dashboard/')
        assigned5 = next(r for r in res5.data['assigned_requests'] if r['id'] == req.id)
        self.assertEqual(assigned5['stage_key'], 'COMPLETED')
        self.assertEqual(assigned5['status'], 'COMPLETED')
        self.assertFalse(assigned5['is_active'])



