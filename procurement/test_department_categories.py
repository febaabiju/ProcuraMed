from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import Department, Role
from procurement.models import Requisition, RequisitionItem
from procurement.constants import DEPARTMENT_CATEGORY_MAP, get_allowed_categories_for_department

User = get_user_model()


class DepartmentCategoryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff_role, _ = Role.objects.get_or_create(
            name='Department Staff',
            defaults={'description': 'Department Staff Role'}
        )

        # Ensure all 7 departments exist
        self.departments = {}
        for dept_name in DEPARTMENT_CATEGORY_MAP.keys():
            dept, _ = Department.objects.get_or_create(
                name=dept_name,
                defaults={'code': dept_name[:3].upper(), 'is_active': True}
            )
            self.departments[dept_name] = dept

    def test_department_categories_endpoint_returns_only_user_department_categories(self):
        """Test GET /api/procurement/requisitions/department-categories/ returns only user's categories."""
        dept = self.departments['Medical & Clinical Services']
        user = User.objects.create_user(
            username='test_staff_mcs',
            password='Password123!',
            role=self.staff_role,
            department=dept
        )
        self.client.force_authenticate(user=user)

        response = self.client.get('/api/procurement/requisitions/department-categories/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        self.assertEqual(data['department'], 'Medical & Clinical Services')
        self.assertEqual(
            data['allowed_categories'],
            [
                'Medical Equipment & Devices',
                'Surgical Instruments',
                'Medical Consumables',
                'ICU & Critical Care Equipment'
            ]
        )
        # Verify it does NOT contain categories of other departments
        self.assertNotIn('IT Hardware & Software', data['allowed_categories'])
        self.assertNotIn('Cleaning & Housekeeping Supplies', data['allowed_categories'])
        # Verify full mapping is NOT exposed in response
        self.assertNotIn('mapping', data)
        self.assertNotIn('all_mappings', data)

    def test_all_7_departments_allowed_and_disallowed_categories(self):
        """
        Verify for all 7 departments that:
        1. All allowed categories are accepted.
        2. Disallowed categories are strictly rejected with HTTP 400.
        """
        all_categories = set()
        for cats in DEPARTMENT_CATEGORY_MAP.values():
            all_categories.update(cats)

        for dept_name, allowed_cats in DEPARTMENT_CATEGORY_MAP.items():
            dept = self.departments[dept_name]
            user = User.objects.create_user(
                username=f"staff_{dept.id}_{dept.code or 'dept'}",
                password='Password123!',
                role=self.staff_role,
                department=dept
            )
            self.client.force_authenticate(user=user)

            # 1. Test every allowed category
            for cat in allowed_cats:
                payload = {
                    'title': f"Requisition for {cat}",
                    'priority': 'MEDIUM',
                    'justification': 'Routine clinical replenishment requirement',
                    'status': 'DRAFT',
                    'items': [
                        {
                            'item_name': f"Item under {cat}",
                            'category': cat,
                            'quantity': 5,
                            'estimated_unit_price': '100.00'
                        }
                    ]
                }
                response = self.client.post('/api/procurement/requisitions/', payload, format='json')
                self.assertEqual(
                    response.status_code, status.HTTP_201_CREATED,
                    f"Expected 201 for dept '{dept_name}' and allowed category '{cat}', got: {response.data}"
                )
                self.assertEqual(response.data['department'], dept.id)

            # 2. Test disallowed categories (categories belonging to other departments)
            disallowed_cats = [c for c in all_categories if c not in allowed_cats]
            for bad_cat in disallowed_cats[:2]:  # Test sample of disallowed categories for each department
                payload = {
                    'title': f"Invalid Requisition for {bad_cat}",
                    'priority': 'MEDIUM',
                    'justification': 'Attempting unauthorized category',
                    'status': 'SUBMITTED',
                    'items': [
                        {
                            'item_name': f"Item under {bad_cat}",
                            'category': bad_cat,
                            'quantity': 2,
                            'estimated_unit_price': '50.00'
                        }
                    ]
                }
                response = self.client.post('/api/procurement/requisitions/', payload, format='json')
                self.assertEqual(
                    response.status_code, status.HTTP_400_BAD_REQUEST,
                    f"Expected 400 for dept '{dept_name}' and disallowed category '{bad_cat}', but request passed!"
                )
                self.assertIn('items', response.data)

    def test_department_anti_tampering_and_spoofing(self):
        """
        If Department Staff for 'Medical & Clinical Services' passes department ID of 'IT & Digital Services',
        the backend must lock the department to 'Medical & Clinical Services' and reject 'IT Hardware & Software'.
        """
        dept_mcs = self.departments['Medical & Clinical Services']
        dept_it = self.departments['IT & Digital Services']

        user = User.objects.create_user(
            username='staff_tamper_tester',
            password='Password123!',
            role=self.staff_role,
            department=dept_mcs
        )
        self.client.force_authenticate(user=user)

        # Attempt to spoof department to IT and submit IT category
        payload = {
            'department': dept_it.id,
            'title': 'Spoofed IT Equipment Request',
            'priority': 'HIGH',
            'justification': 'Trying to bypass department restriction',
            'status': 'SUBMITTED',
            'items': [
                {
                    'item_name': 'Server Rack',
                    'category': 'IT Hardware & Software',
                    'quantity': 1,
                    'estimated_unit_price': '1500.00'
                }
            ]
        }
        response = self.client.post('/api/procurement/requisitions/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('items', response.data)
        self.assertIn('Medical & Clinical Services', str(response.data['items']))

    def test_submit_action_blocks_unallowed_category(self):
        """
        If a draft requisition has an unallowed category, hitting /submit/ action directly
        must block submission until a valid category is selected.
        """
        dept = self.departments['Medical & Clinical Services']
        user = User.objects.create_user(
            username='staff_submit_tester',
            password='Password123!',
            role=self.staff_role,
            department=dept
        )
        self.client.force_authenticate(user=user)

        # Create a draft directly in DB with a disallowed category (simulating legacy data)
        req = Requisition.objects.create(
            title='Legacy Draft Requisition',
            department=dept,
            requested_by=user,
            status=Requisition.StatusChoices.DRAFT,
            category='Cleaning & Housekeeping Supplies'
        )
        RequisitionItem.objects.create(
            requisition=req,
            item_name='Disinfectant',
            category='Cleaning & Housekeeping Supplies',
            quantity=10,
            estimated_unit_price=Decimal('15.00')
        )

        # Attempt to submit via /submit/ endpoint
        submit_res = self.client.post(f'/api/procurement/requisitions/{req.id}/submit/')
        self.assertEqual(submit_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Cleaning & Housekeeping Supplies', submit_res.data.get('detail', ''))

        # Update item to allowed category and resubmit
        patch_res = self.client.patch(
            f'/api/procurement/requisitions/{req.id}/',
            {
                'items': [
                    {
                        'item_name': 'Surgical Scalpels',
                        'category': 'Surgical Instruments',
                        'quantity': 10,
                        'estimated_unit_price': '25.00'
                    }
                ]
            },
            format='json'
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)

        # Now submission must succeed
        submit_res2 = self.client.post(f'/api/procurement/requisitions/{req.id}/submit/')
        self.assertEqual(submit_res2.status_code, status.HTTP_200_OK)
        req.refresh_from_db()
        self.assertEqual(req.status, Requisition.StatusChoices.SUBMITTED)
