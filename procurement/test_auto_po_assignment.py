from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import Department, Role, AuditLog
from procurement.models import Requisition, RequisitionItem

User = get_user_model()


class AutomaticPurchaseOfficerAssignmentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        # Create Roles
        cls.po_role, _ = Role.objects.get_or_create(
            name='Purchase Officer',
            defaults={'description': 'Purchase Officer Role'}
        )
        cls.staff_role, _ = Role.objects.get_or_create(
            name='Department Staff',
            defaults={'description': 'Department Staff Role'}
        )

        # Create Departments
        cls.surgery_dept, _ = Department.objects.get_or_create(
            name='Medical & Surgical Equipment',
            defaults={'code': 'SUR', 'is_active': True}
        )
        cls.admin_dept, _ = Department.objects.get_or_create(
            name='Administration & Office Management',
            defaults={'code': 'ADM', 'is_active': True}
        )

        # Create Department Staff User
        cls.staff_user = User.objects.create_user(
            username='test_staff_assign',
            email='test_staff_assign@procuramed.test',
            password='TestPassword123!',
            first_name='Staff',
            last_name='User',
            role=cls.staff_role,
            department=cls.surgery_dept
        )

        # Create 3 Active Purchase Officers
        cls.po_1 = User.objects.create_user(
            username='test_po_assign_1',
            email='test_po_1@procuramed.test',
            password='TestPassword123!',
            first_name='Officer',
            last_name='One',
            role=cls.po_role,
            department=cls.admin_dept
        )
        cls.po_2 = User.objects.create_user(
            username='test_po_assign_2',
            email='test_po_2@procuramed.test',
            password='TestPassword123!',
            first_name='Officer',
            last_name='Two',
            role=cls.po_role,
            department=cls.admin_dept
        )
        cls.po_3 = User.objects.create_user(
            username='test_po_assign_3',
            email='test_po_3@procuramed.test',
            password='TestPassword123!',
            first_name='Officer',
            last_name='Three',
            role=cls.po_role,
            department=cls.admin_dept
        )

        # Create 1 Inactive Purchase Officer
        cls.po_inactive = User.objects.create_user(
            username='test_po_assign_inactive',
            email='test_po_inactive@procuramed.test',
            password='TestPassword123!',
            first_name='Officer',
            last_name='Inactive',
            role=cls.po_role,
            department=cls.admin_dept,
            is_active=False
        )

    def setUp(self):
        self.client = APIClient()

    def test_01_submitted_requisition_automatically_assigned_to_one_po(self):
        """Newly submitted requisition is automatically assigned to exactly one eligible active PO."""
        req = Requisition.objects.create(
            req_number='REQ-ASSIGN-001',
            title='Auto Assignment Test 1',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('25000.00')
        )

        self.assertIsNotNone(req.assigned_purchase_officer)
        self.assertIsNotNone(req.assigned_at)
        self.assertIn(req.assigned_purchase_officer, [self.po_1, self.po_2, self.po_3])
        self.assertNotEqual(req.assigned_purchase_officer, self.po_inactive)

    def test_02_workload_balancing_assigns_to_lowest_workload_po(self):
        """Requisitions are assigned to the PO with lowest active workload (SUBMITTED status)."""
        # Give po_1 an active workload of 1
        req1 = Requisition.objects.create(
            req_number='REQ-ASSIGN-WL-1',
            title='Workload 1',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_1,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('10000.00')
        )

        # Give po_2 an active workload of 2
        req2 = Requisition.objects.create(
            req_number='REQ-ASSIGN-WL-2',
            title='Workload 2',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_2,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('10000.00')
        )
        req3 = Requisition.objects.create(
            req_number='REQ-ASSIGN-WL-3',
            title='Workload 3',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_2,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('10000.00')
        )

        # po_3 has workload 0. A new requisition must be assigned to po_3!
        new_req = Requisition.objects.create(
            req_number='REQ-ASSIGN-WL-4',
            title='New Requisition for Lowest Workload',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('15000.00')
        )

        self.assertEqual(new_req.assigned_purchase_officer, self.po_3)

    def test_03_completed_or_approved_requests_do_not_count_towards_workload(self):
        """Only SUBMITTED status counts toward active PO workload. Completed/approved do not."""
        # po_3 has 5 completed/approved requisitions
        for i in range(5):
            Requisition.objects.create(
                req_number=f'REQ-COMPLETED-{i}',
                title=f'Completed Requisition {i}',
                department=self.surgery_dept,
                requested_by=self.staff_user,
                status=Requisition.StatusChoices.COMPLETED,
                assigned_purchase_officer=self.po_3,
                assigned_at=timezone.now(),
                estimated_budget=Decimal('5000.00')
            )

        # po_1 has 1 SUBMITTED requisition
        Requisition.objects.create(
            req_number='REQ-SUBMITTED-PO1',
            title='Submitted PO1',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_1,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('5000.00')
        )
        # po_2 has 1 SUBMITTED requisition
        Requisition.objects.create(
            req_number='REQ-SUBMITTED-PO2',
            title='Submitted PO2',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_2,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('5000.00')
        )

        # po_3 has 0 active workload (completed do not count). A new requisition should go to po_3!
        new_req = Requisition.objects.create(
            req_number='REQ-TEST-ZERO-WL',
            title='Should go to PO3',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            submitted_at=timezone.now(),
            estimated_budget=Decimal('10000.00')
        )

        self.assertEqual(new_req.assigned_purchase_officer, self.po_3)

    def test_04_purchase_officer_cannot_see_other_po_assigned_requisitions_in_list(self):
        """Purchase officer sees only requisitions assigned to them in list view."""
        req_po1 = Requisition.objects.create(
            req_number='REQ-FOR-PO1',
            title='For PO1 Only',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_1,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('10000.00')
        )
        req_po2 = Requisition.objects.create(
            req_number='REQ-FOR-PO2',
            title='For PO2 Only',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_2,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('10000.00')
        )

        # Login as po_1
        self.client.force_authenticate(user=self.po_1)
        res = self.client.get('/api/procurement/requisitions/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        req_nums = [r['req_number'] for r in results]

        self.assertIn('REQ-FOR-PO1', req_nums)
        self.assertNotIn('REQ-FOR-PO2', req_nums)

        # Login as po_2
        self.client.force_authenticate(user=self.po_2)
        res = self.client.get('/api/procurement/requisitions/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        req_nums = [r['req_number'] for r in results]

        self.assertIn('REQ-FOR-PO2', req_nums)
        self.assertNotIn('REQ-FOR-PO1', req_nums)

    def test_05_purchase_officer_cannot_retrieve_other_po_requisition_by_id(self):
        """Direct API request to another PO's assigned requisition returns 404."""
        req_po1 = Requisition.objects.create(
            req_number='REQ-SECURE-PO1',
            title='Confidential PO1 Requisition',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_1,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('10000.00')
        )

        # Login as po_2 and attempt to directly GET po_1's requisition
        self.client.force_authenticate(user=self.po_2)
        res = self.client.get(f'/api/procurement/requisitions/{req_po1.id}/')
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_06_purchase_officer_cannot_review_other_po_requisition(self):
        """Purchase officer cannot review a requisition assigned to another PO."""
        req_po1 = Requisition.objects.create(
            req_number='REQ-REVIEW-PO1',
            title='PO1 Review Requisition',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_1,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('10000.00')
        )

        # Login as po_2 and attempt to review po_1's requisition
        self.client.force_authenticate(user=self.po_2)
        res = self.client.post(f'/api/procurement/requisitions/{req_po1.id}/review/', {
            'action': 'PROCEED',
            'requires_technical_evaluation': False
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_07_purchase_officer_dashboard_shows_only_assigned_requisitions(self):
        """Purchase officer dashboard shows only metrics and queue items assigned to logged-in PO."""
        req_po1 = Requisition.objects.create(
            req_number='REQ-DASH-PO1',
            title='Dashboard PO1',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_1,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('12000.00')
        )
        req_po2 = Requisition.objects.create(
            req_number='REQ-DASH-PO2',
            title='Dashboard PO2',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_2,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('18000.00')
        )

        # Check PO 1 Dashboard
        self.client.force_authenticate(user=self.po_1)
        res1 = self.client.get('/api/procurement/purchase-officer-dashboard/')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertEqual(res1.data['stats']['pending_requisitions'], 1)
        pending_nums1 = [r['req_number'] for r in res1.data.get('pending_requisitions', [])]
        self.assertIn('REQ-DASH-PO1', pending_nums1)
        self.assertNotIn('REQ-DASH-PO2', pending_nums1)

        # Check PO 2 Dashboard
        self.client.force_authenticate(user=self.po_2)
        res2 = self.client.get('/api/procurement/purchase-officer-dashboard/')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['stats']['pending_requisitions'], 1)
        pending_nums2 = [r['req_number'] for r in res2.data.get('pending_requisitions', [])]
        self.assertIn('REQ-DASH-PO2', pending_nums2)
        self.assertNotIn('REQ-DASH-PO1', pending_nums2)

        # Check PO 3 Dashboard (0 assigned)
        self.client.force_authenticate(user=self.po_3)
        res3 = self.client.get('/api/procurement/purchase-officer-dashboard/')
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        self.assertEqual(res3.data['stats']['pending_requisitions'], 0)
        pending_nums3 = [r['req_number'] for r in res3.data.get('pending_requisitions', [])]
        self.assertEqual(len(pending_nums3), 0)

    def test_08_staff_submission_via_endpoint_assigns_po_and_logs(self):
        """Submitting a draft requisition via API endpoint automatically assigns PO and logs assignment."""
        req = Requisition.objects.create(
            req_number='REQ-API-SUBMIT',
            title='Staff Endpoint Submission Test',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.DRAFT,
            estimated_budget=Decimal('30000.00')
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='Surgical Scalpels',
            category='Surgical Instruments',
            quantity=50,
            estimated_unit_price=Decimal('600.00'),
            total_price=Decimal('30000.00')
        )

        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(f'/api/procurement/requisitions/{req.id}/submit/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.SUBMITTED)
        self.assertIsNotNone(req.assigned_purchase_officer)
        self.assertIn(req.assigned_purchase_officer, [self.po_1, self.po_2, self.po_3])

        # Verify AuditLog mentions assignment
        log = AuditLog.objects.filter(description__icontains=req.req_number).latest('created_at')
        self.assertIn(f"Assigned to Purchase Officer @{req.assigned_purchase_officer.username}", log.description)

    def test_09_department_staff_can_see_assigned_po_in_list_and_details(self):
        """Department Staff can view assigned Purchase Officer name and status on their requisitions."""
        req_assigned = Requisition.objects.create(
            req_number='REQ-STAFF-VIS-01',
            title='Staff Visibility Test - Assigned',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_1,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('45000.00')
        )
        req_unassigned = Requisition.objects.create(
            req_number='REQ-STAFF-VIS-02',
            title='Staff Visibility Test - Unassigned Draft',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.DRAFT,
            estimated_budget=Decimal('15000.00')
        )

        self.client.force_authenticate(user=self.staff_user)

        # 1. Test List Endpoint (/api/procurement/requisitions/)
        res_list = self.client.get('/api/procurement/requisitions/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        results = res_list.data if isinstance(res_list.data, list) else res_list.data.get('results', [])

        assigned_item = next(r for r in results if r['req_number'] == 'REQ-STAFF-VIS-01')
        self.assertEqual(assigned_item['assigned_purchase_officer'], self.po_1.id)
        self.assertEqual(assigned_item['assigned_purchase_officer_name'], self.po_1.get_full_name() or self.po_1.username)
        self.assertEqual(assigned_item['assignment_status'], 'Assigned')
        self.assertIsNotNone(assigned_item['assigned_purchase_officer_details'])

        unassigned_item = next(r for r in results if r['req_number'] == 'REQ-STAFF-VIS-02')
        self.assertIsNone(unassigned_item['assigned_purchase_officer'])
        self.assertIsNone(unassigned_item['assigned_purchase_officer_name'])
        self.assertEqual(unassigned_item['assignment_status'], 'Pending Assignment')

        # 2. Test Details Endpoint (/api/procurement/requisitions/{id}/)
        res_detail = self.client.get(f'/api/procurement/requisitions/{req_assigned.id}/')
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(res_detail.data['assigned_purchase_officer_name'], self.po_1.get_full_name() or self.po_1.username)
        self.assertEqual(res_detail.data['assignment_status'], 'Assigned')

    def test_10_department_staff_cannot_access_other_staff_requisitions(self):
        """Department Staff cannot view other staff member's requisitions or their assignment info."""
        other_staff = User.objects.create_user(
            username='other_staff_user',
            email='other_staff@procuramed.test',
            password='TestPassword123!',
            first_name='Other',
            last_name='Staff',
            role=self.staff_role,
            department=self.surgery_dept
        )
        other_req = Requisition.objects.create(
            req_number='REQ-OTHER-STAFF-01',
            title='Other Staff Confidential Requisition',
            department=self.surgery_dept,
            requested_by=other_staff,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_2,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('99000.00')
        )

        self.client.force_authenticate(user=self.staff_user)

        # 1. Other requisition must not be in list
        res_list = self.client.get('/api/procurement/requisitions/')
        results = res_list.data if isinstance(res_list.data, list) else res_list.data.get('results', [])
        req_numbers = [r['req_number'] for r in results]
        self.assertNotIn('REQ-OTHER-STAFF-01', req_numbers)

        # 2. Direct GET to other requisition must return 404
        res_direct = self.client.get(f'/api/procurement/requisitions/{other_req.id}/')
        self.assertEqual(res_direct.status_code, status.HTTP_404_NOT_FOUND)

    def test_11_department_staff_cannot_modify_assigned_purchase_officer(self):
        """Department Staff cannot change, remove, or manually set assigned Purchase Officer."""
        req = Requisition.objects.create(
            req_number='REQ-IMMUTABLE-ASSIGN',
            title='Immutable Assignment Requisition',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.DRAFT,
            estimated_budget=Decimal('10000.00')
        )

        self.client.force_authenticate(user=self.staff_user)

        # Attempt to inject assigned_purchase_officer via PATCH
        res = self.client.patch(f'/api/procurement/requisitions/{req.id}/', {
            'assigned_purchase_officer': self.po_3.id
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        # assigned_purchase_officer is read_only on RequisitionSerializer, so it must still be None
        self.assertIsNone(req.assigned_purchase_officer)

    def test_12_department_staff_dashboard_returns_assigned_po_info(self):
        """Department Staff dashboard recent requests include assigned Purchase Officer info."""
        Requisition.objects.create(
            req_number='REQ-DASH-STAFF-01',
            title='Staff Dashboard Requisition with PO',
            department=self.surgery_dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.SUBMITTED,
            assigned_purchase_officer=self.po_2,
            assigned_at=timezone.now(),
            submitted_at=timezone.now(),
            estimated_budget=Decimal('22000.00')
        )

        self.client.force_authenticate(user=self.staff_user)
        res = self.client.get('/api/procurement/staff-dashboard/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        recent = res.data.get('recent_requests', [])
        req_item = next(r for r in recent if r['req_number'] == 'REQ-DASH-STAFF-01')
        self.assertEqual(req_item['assigned_purchase_officer_name'], self.po_2.get_full_name() or self.po_2.username)
        self.assertEqual(req_item['assignment_status'], 'Assigned')
