from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal

from accounts.models import Role, Department
from procurement.models import Requisition, RequisitionItem
from vendors.models import Vendor, SupplierCategory

User = get_user_model()


class CommitteeWorkloadAndVendorSourcingTests(TestCase):
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

        # 5 Procurement Committee Members
        self.pc_members = []
        for i in range(1, 6):
            pc, _ = User.objects.get_or_create(
                username=f'test_pc_{i}',
                defaults={
                    'email': f'test_pc_{i}@procuramed.com',
                    'first_name': f'Member{i}',
                    'last_name': 'Committee',
                    'role': self.committee_role,
                    'employee_id': f'TPC{i:03d}'
                }
            )
            pc.set_password('TestPass123!')
            pc.save()
            self.pc_members.append(pc)

        # Purchase Officer & Department Staff
        self.staff_user, _ = User.objects.get_or_create(
            username='test_staff_user',
            defaults={
                'email': 'staff@procuramed.com',
                'first_name': 'Test',
                'last_name': 'Staff',
                'role': self.staff_role,
                'department': self.dept,
                'employee_id': 'TSTF01'
            }
        )
        self.staff_user.set_password('TestPass123!')
        self.staff_user.save()

        self.po_user, _ = User.objects.get_or_create(
            username='test_po_user',
            defaults={
                'email': 'po@procuramed.com',
                'first_name': 'Test',
                'last_name': 'PO',
                'role': self.po_role,
                'employee_id': 'TPO01'
            }
        )
        self.po_user.set_password('TestPass123!')
        self.po_user.save()

        # Supplier Category & Registered Active Vendors
        self.med_category, _ = SupplierCategory.objects.get_or_create(
            name='Biomedical Equipment',
            defaults={'description': 'Medical & Biomedical Equipment'}
        )

        self.vendor_user, _ = User.objects.get_or_create(
            username='test_vendor_01',
            defaults={
                'email': 'vendor@mediequip.com',
                'first_name': 'MediEquip',
                'last_name': 'Representative',
                'employee_id': 'TVEN01'
            }
        )
        self.vendor, _ = Vendor.objects.get_or_create(
            user=self.vendor_user,
            defaults={
                'company_name': 'MediEquip Solutions Ltd',
                'vendor_code': 'VEN-2026-TEST1',
                'contact_person': 'Robert Fox',
                'phone': '+91 98765 43210',
                'status': Vendor.StatusChoices.ACTIVE,
                'is_active': True
            }
        )
        self.vendor.supplier_categories.add(self.med_category)

    def test_round_robin_initial_distribution_across_5_members(self):
        """
        Verify that initially, 5 purchase-ready requests are distributed
        one per member in sequence (Member 1, Member 2, ..., Member 5).
        """
        created_reqs = []
        for i in range(5):
            req = Requisition.objects.create(
                req_number=f'REQ-DIST-00{i+1}',
                title=f'Test Requisition {i+1}',
                department=self.dept,
                requested_by=self.staff_user,
                assigned_purchase_officer=self.po_user,
                status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
                category='Biomedical Equipment',
                estimated_budget=Decimal('100000.00')
            )
            created_reqs.append(req)

        # Each of the 5 committee members must have received exactly 1 request
        assigned_members = [r.assigned_committee_member for r in created_reqs]
        self.assertEqual(len(set(assigned_members)), 5)
        for member in self.pc_members:
            self.assertIn(member, assigned_members)

    def test_dynamic_workload_balancing(self):
        """
        After each member has 1 request, the next request goes to the member
        with the fewest active assignments. When one finishes, workload balances.
        """
        reqs = []
        for i in range(5):
            req = Requisition.objects.create(
                req_number=f'REQ-BAL-00{i+1}',
                title=f'Requisition {i+1}',
                department=self.dept,
                requested_by=self.staff_user,
                status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
            )
            reqs.append(req)

        # Member 2 (pc_members[1]) completes their assignment
        reqs[1].status = Requisition.StatusChoices.COMPLETED
        reqs[1].save()

        # Now workloads: member 1: 1, member 2: 0, member 3: 1, member 4: 1, member 5: 1
        # Next request must be assigned to member 2 who has the fewest active assignments (0)
        req6 = Requisition.objects.create(
            req_number='REQ-BAL-006',
            title='Requisition 6',
            department=self.dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
        )

        self.assertEqual(req6.assigned_committee_member, self.pc_members[1])

    def test_one_request_per_committee_member_visibility(self):
        """
        Ensure Member 1 can only see their assigned request on the dashboard
        and cannot see Member 2's assigned request.
        """
        req1 = Requisition.objects.create(
            req_number='REQ-VIS-001',
            title='Patient Monitor Alpha',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_committee_member=self.pc_members[0],
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
            category='Biomedical Equipment',
            estimated_budget=Decimal('75000.00')
        )
        req2 = Requisition.objects.create(
            req_number='REQ-VIS-002',
            title='Defibrillator Beta',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_committee_member=self.pc_members[1],
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
            category='Biomedical Equipment',
            estimated_budget=Decimal('120000.00')
        )

        # Member 1 queries dashboard
        self.client.force_authenticate(user=self.pc_members[0])
        response = self.client.get('/api/procurement/committee-dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        pending = response.data.get('pending_reviews', [])
        pending_req_numbers = [r['req_number'] for r in pending]
        self.assertIn('REQ-VIS-001', pending_req_numbers)
        self.assertNotIn('REQ-VIS-002', pending_req_numbers)

        # Member 2 queries dashboard
        self.client.force_authenticate(user=self.pc_members[1])
        response = self.client.get('/api/procurement/committee-dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        pending = response.data.get('pending_reviews', [])
        pending_req_numbers = [r['req_number'] for r in pending]
        self.assertIn('REQ-VIS-002', pending_req_numbers)
        self.assertNotIn('REQ-VIS-001', pending_req_numbers)

    def test_member_cannot_access_unassigned_request_details(self):
        """
        Backend enforcement: Member 1 accessing Member 2's requisition endpoint
        must receive a 404 Not Found (or 403 Forbidden).
        """
        req_member2 = Requisition.objects.create(
            req_number='REQ-SEC-002',
            title='ECG Machine',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_committee_member=self.pc_members[1],
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW
        )

        # Member 1 tries to access Member 2's requisition
        self.client.force_authenticate(user=self.pc_members[0])
        response = self.client.get(f'/api/procurement/requisitions/{req_member2.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_find_vendors_action_for_assigned_committee_member(self):
        """
        Assigned committee member can call the find_vendors endpoint for their request
        and receives matched registered suppliers.
        """
        req = Requisition.objects.create(
            req_number='REQ-VEND-001',
            title='Electrosurgical Generator',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_committee_member=self.pc_members[0],
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
            category='Biomedical Equipment',
            estimated_budget=Decimal('250000.00')
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='Electrosurgical Unit',
            category='Biomedical Equipment',
            quantity=1,
            estimated_unit_price=Decimal('250000.00'),
            total_price=Decimal('250000.00')
        )

        # Assigned member calls find_vendors
        self.client.force_authenticate(user=self.pc_members[0])
        response = self.client.get(f'/api/procurement/requisitions/{req.id}/find-vendors/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['req_number'], 'REQ-VEND-001')
        self.assertGreaterEqual(response.data['matched_count'], 1)

        matched_names = [v['company_name'] for v in response.data['matched_vendors']]
        self.assertIn('MediEquip Solutions Ltd', matched_names)

        # Other committee member (Member 2) cannot call find_vendors for Member 1's request
        self.client.force_authenticate(user=self.pc_members[1])
        unauthorized_res = self.client.get(f'/api/procurement/requisitions/{req.id}/find-vendors/')
        self.assertEqual(unauthorized_res.status_code, status.HTTP_404_NOT_FOUND)
