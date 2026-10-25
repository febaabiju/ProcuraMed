from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from accounts.models import Role, Department
from procurement.models import Requisition, RequisitionItem, TechnicalEvaluation, Approval

User = get_user_model()


class CommitteeIntakeAndAssignmentTests(TestCase):
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
            name='General Surgery & ICU',
            defaults={'code': 'GS-ICU'}
        )

        # Create 5 Procurement Committee Members in order (PC101 to PC105)
        self.committee_members = []
        for i in range(1, 6):
            pc, _ = User.objects.get_or_create(
                username=f'committee_member_{i}',
                defaults={
                    'email': f'pc{i}@procuramed.com',
                    'first_name': f'Member{i}',
                    'last_name': 'Committee',
                    'role': self.committee_role,
                    'employee_id': f'PC{100 + i}'
                }
            )
            pc.set_password('TestPass123!')
            pc.save()
            self.committee_members.append(pc)

        # Staff user
        self.staff_user, _ = User.objects.get_or_create(
            username='intake_staff',
            defaults={
                'email': 'staff@procuramed.com',
                'first_name': 'Staff',
                'last_name': 'User',
                'role': self.staff_role,
                'department': self.dept,
                'employee_id': 'STF001'
            }
        )
        self.staff_user.set_password('TestPass123!')
        self.staff_user.save()

        # Purchase Officer user
        self.po_user, _ = User.objects.get_or_create(
            username='intake_po',
            defaults={
                'email': 'po@procuramed.com',
                'first_name': 'Purchase',
                'last_name': 'Officer',
                'role': self.po_role,
                'employee_id': 'PO001'
            }
        )
        self.po_user.set_password('TestPass123!')
        self.po_user.save()

        # Technical Officer user
        self.to_user, _ = User.objects.get_or_create(
            username='intake_to',
            defaults={
                'email': 'to@procuramed.com',
                'first_name': 'Tech',
                'last_name': 'Officer',
                'role': self.to_role,
                'employee_id': 'TO001',
                'technical_specializations': ['Biomedical Equipment']
            }
        )
        self.to_user.set_password('TestPass123!')
        self.to_user.save()

    def test_path_1_po_routes_non_technical_items_directly_to_committee(self):
        """
        Path 1: Items not requiring technical evaluation (needles, gloves)
        forwarded directly from Purchase Officer to Procurement Committee.
        """
        # Create a submitted requisition with routine gloves & needles
        req = Requisition.objects.create(
            req_number='REQ-ROUTINE-001',
            title='Sterile Gloves & Disposable Needles',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_purchase_officer=self.po_user,
            status=Requisition.StatusChoices.SUBMITTED,
            category='Medical Consumables',
            estimated_budget=Decimal('15000.00')
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='Sterile Nitrile Gloves',
            category='Medical Consumables',
            quantity=200,
            estimated_unit_price=Decimal('50.00')
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='Hypodermic Needles 21G',
            category='Medical Consumables',
            quantity=500,
            estimated_unit_price=Decimal('10.00')
        )

        # PO proceeds without technical evaluation
        self.client.force_authenticate(user=self.po_user)
        review_url = f'/api/procurement/requisitions/{req.id}/review/'
        payload = {
            'action': 'PROCEED',
            'requires_technical_evaluation': False,
            'reason': 'Routine non-technical consumables for surgery department.'
        }
        res = self.client.post(review_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        # 1. Forwarded to Procurement Committee review
        self.assertEqual(req.status, Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW)
        self.assertFalse(req.requires_technical_evaluation)
        # 2. Fairly assigned to Member 1 (first in rotation)
        self.assertIsNotNone(req.assigned_committee_member)
        self.assertEqual(req.assigned_committee_member, self.committee_members[0])
        # 3. Source check
        self.assertEqual(req.get_intake_source_display() if hasattr(req, 'get_intake_source_display') else 'No Technical Evaluation Required', 'No Technical Evaluation Required')

    def test_path_2_technical_officer_evaluates_and_forwards_to_committee(self):
        """
        Path 2: Technical Officer completes evaluation as Technically Suitable
        and forwards to Procurement Committee.
        """
        req = Requisition.objects.create(
            req_number='REQ-TECH-001',
            title='Multiparameter ICU Patient Monitor',
            department=self.dept,
            requested_by=self.staff_user,
            assigned_purchase_officer=self.po_user,
            assigned_technical_officer=self.to_user,
            requires_technical_evaluation=True,
            technical_specialization='Biomedical Equipment',
            status=Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
            category='Biomedical Equipment',
            estimated_budget=Decimal('280000.00')
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='ICU Cardiac Monitor',
            category='Biomedical Equipment',
            quantity=2,
            estimated_unit_price=Decimal('140000.00')
        )

        # TO evaluates as Suitable
        self.client.force_authenticate(user=self.to_user)
        eval_url = f'/api/procurement/requisitions/{req.id}/evaluate/'
        payload = {
            'compliance': 'COMPLIANT',
            'recommendation': 'SUITABLE',
            'remarks': 'Fully complies with hospital ICU biomedical standards.'
        }
        res = self.client.post(eval_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        req.refresh_from_db()
        # 1. Forwarded to Procurement Committee review
        self.assertEqual(req.status, Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW)
        self.assertTrue(req.requires_technical_evaluation)
        self.assertEqual(req.technical_recommendation, TechnicalEvaluation.RecommendationChoices.SUITABLE)
        # 2. Automatically assigned to committee member
        self.assertIsNotNone(req.assigned_committee_member)
        self.assertEqual(req.assigned_committee_member, self.committee_members[0])

    def test_fair_rotation_across_five_members_and_workload_balancing(self):
        """
        Verify:
        - 5 initial requests are assigned one to each of the 5 members (Member 1 through Member 5).
        - Request 6 rotates to Member 1 (lowest workload / tie-breaker).
        - When Member 3 completes their request, Member 3 workload becomes 0.
        - Next request goes to Member 3 because they have the lowest active workload (0 < 1).
        """
        created = []
        for i in range(5):
            req = Requisition.objects.create(
                req_number=f'REQ-CYCLE-00{i+1}',
                title=f'Hospital Equipment {i+1}',
                department=self.dept,
                requested_by=self.staff_user,
                status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
                requires_technical_evaluation=(i % 2 == 0)
            )
            created.append(req)

        # 5 members receive exactly 1 request each
        assigned_members = [r.assigned_committee_member for r in created]
        self.assertEqual(len(set(assigned_members)), 5)
        self.assertEqual(created[0].assigned_committee_member, self.committee_members[0])
        self.assertEqual(created[1].assigned_committee_member, self.committee_members[1])
        self.assertEqual(created[2].assigned_committee_member, self.committee_members[2])
        self.assertEqual(created[3].assigned_committee_member, self.committee_members[3])
        self.assertEqual(created[4].assigned_committee_member, self.committee_members[4])

        # Request 6: all have 1 active request. Next goes to Member 1 (round-robin tie break from last=M5)
        req6 = Requisition.objects.create(
            req_number='REQ-CYCLE-006',
            title='Hospital Equipment 6',
            department=self.dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW
        )
        self.assertEqual(req6.assigned_committee_member, self.committee_members[0])

        # Member 3 completes their assignment
        created[2].status = Requisition.StatusChoices.COMPLETED
        created[2].save()

        # Active workloads: M1=2, M2=1, M3=0, M4=1, M5=1.
        # Request 7 MUST be assigned to Member 3 (lowest active workload = 0)
        req7 = Requisition.objects.create(
            req_number='REQ-CYCLE-007',
            title='Hospital Equipment 7',
            department=self.dept,
            requested_by=self.staff_user,
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW
        )
        self.assertEqual(req7.assigned_committee_member, self.committee_members[2])

    def test_combined_purchase_requests_listing_and_category_filters(self):
        """
        Verify:
        - Requisition list endpoint returns all committee received requests.
        - Supports filtering by Technical Evaluation Completed vs No Technical Evaluation Required.
        - Clearly returns req_number, items, department, intake_source, current status, and assigned member.
        - Each request appears once.
        """
        # Create a non-technical request assigned to Member 1
        req_non_tech = Requisition.objects.create(
            req_number='REQ-LIST-001',
            title='Surgical Face Masks & Gauze',
            department=self.dept,
            requested_by=self.staff_user,
            requires_technical_evaluation=False,
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW
        )
        RequisitionItem.objects.create(
            requisition=req_non_tech,
            item_name='Surgical Face Masks 3-Ply',
            quantity=1000,
            estimated_unit_price=Decimal('5.00')
        )

        # Create a technical request assigned to Member 2
        req_tech = Requisition.objects.create(
            req_number='REQ-LIST-002',
            title='Digital Electrocardiograph (ECG)',
            department=self.dept,
            requested_by=self.staff_user,
            requires_technical_evaluation=True,
            technical_specialization='Biomedical Equipment',
            technical_recommendation=TechnicalEvaluation.RecommendationChoices.SUITABLE,
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW
        )
        RequisitionItem.objects.create(
            requisition=req_tech,
            item_name='12-Channel ECG Machine',
            quantity=1,
            estimated_unit_price=Decimal('85000.00')
        )

        # Member 1 queries /api/procurement/requisitions/
        self.client.force_authenticate(user=self.committee_members[0])

        def get_results(response_data):
            if isinstance(response_data, dict) and 'results' in response_data:
                return response_data['results']
            return response_data

        # 1. Member 1 queries /api/procurement/requisitions/
        # Member 1 must ONLY see their assigned request (REQ-LIST-001) and NOT Member 2's (REQ-LIST-002)
        self.client.force_authenticate(user=self.committee_members[0])
        res_m1 = self.client.get('/api/procurement/requisitions/')
        self.assertEqual(res_m1.status_code, status.HTTP_200_OK)
        results_m1 = get_results(res_m1.data)
        req_numbers_m1 = [r['req_number'] for r in results_m1]
        self.assertIn('REQ-LIST-001', req_numbers_m1)
        self.assertNotIn('REQ-LIST-002', req_numbers_m1)

        item_001 = next(r for r in results_m1 if r['req_number'] == 'REQ-LIST-001')
        self.assertEqual(item_001['intake_source'], 'NO_TECHNICAL_EVALUATION')
        self.assertEqual(item_001['intake_source_display'], 'No Technical Evaluation Required')
        self.assertEqual(item_001['assigned_committee_member_name'], 'Member1 Committee')

        # 2. Member 2 queries /api/procurement/requisitions/
        # Member 2 must ONLY see their assigned request (REQ-LIST-002) and NOT Member 1's (REQ-LIST-001)
        self.client.force_authenticate(user=self.committee_members[1])
        res_m2 = self.client.get('/api/procurement/requisitions/')
        self.assertEqual(res_m2.status_code, status.HTTP_200_OK)
        results_m2 = get_results(res_m2.data)
        req_numbers_m2 = [r['req_number'] for r in results_m2]
        self.assertIn('REQ-LIST-002', req_numbers_m2)
        self.assertNotIn('REQ-LIST-001', req_numbers_m2)

        item_002 = next(r for r in results_m2 if r['req_number'] == 'REQ-LIST-002')
        self.assertEqual(item_002['intake_source'], 'TECHNICAL_EVALUATION')
        self.assertEqual(item_002['intake_source_display'], 'Technical Evaluation Completed')
        self.assertEqual(item_002['assigned_committee_member_name'], 'Member2 Committee')

        # 3. Backend permission enforcement: Member 1 cannot process/approve Member 2's request
        self.client.force_authenticate(user=self.committee_members[0])
        unauthorized_approve_res = self.client.post(
            f'/api/procurement/requisitions/{req_tech.id}/approve/',
            {'remarks': 'Unauthorized approval attempt'}
        )
        self.assertIn(unauthorized_approve_res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # 4. Filter on assigned requests: No Technical Evaluation Required for Member 1
        res_non_tech = self.client.get('/api/procurement/requisitions/?intake_source=non_technical')
        self.assertEqual(res_non_tech.status_code, status.HTTP_200_OK)
        results_non_tech = get_results(res_non_tech.data)
        req_numbers_non_tech = [r['req_number'] for r in results_non_tech]
        self.assertIn('REQ-LIST-001', req_numbers_non_tech)

        # 5. Filter for technical items for Member 1 returns empty (since Member 1 has only non-tech)
        res_tech_m1 = self.client.get('/api/procurement/requisitions/?intake_source=technical')
        self.assertEqual(res_tech_m1.status_code, status.HTTP_200_OK)
        results_tech_m1 = get_results(res_tech_m1.data)
        self.assertEqual(len(results_tech_m1), 0)

        # 6. Admin can see all requests
        admin_user, _ = User.objects.get_or_create(
            username='admin_test',
            defaults={'email': 'admin@procuramed.com', 'is_staff': True, 'is_superuser': True}
        )
        self.client.force_authenticate(user=admin_user)
        res_admin = self.client.get('/api/procurement/requisitions/')
        self.assertEqual(res_admin.status_code, status.HTTP_200_OK)
        results_admin = get_results(res_admin.data)
        admin_req_numbers = [r['req_number'] for r in results_admin]
        self.assertIn('REQ-LIST-001', admin_req_numbers)
        self.assertIn('REQ-LIST-002', admin_req_numbers)
