from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal

from accounts.models import Role
from vendors.models import Vendor, SupplierCategory, VendorProduct
from procurement.models import Requisition

User = get_user_model()


class VendorProductCatalogueTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Create Roles
        self.vendor_role, _ = Role.objects.get_or_create(
            name='Vendor',
            defaults={'description': 'Approved Supplier Vendor', 'is_active': True}
        )
        self.committee_role, _ = Role.objects.get_or_create(
            name='Procurement Committee Member',
            defaults={'description': 'Procurement Committee', 'is_active': True}
        )
        self.staff_role, _ = Role.objects.get_or_create(
            name='Department Staff',
            defaults={'description': 'Department Staff', 'is_active': True}
        )

        # 2. Get or Create Supply Categories
        self.cat_med_equip, _ = SupplierCategory.objects.get_or_create(
            name=SupplierCategory.CategoryChoices.MEDICAL_EQUIPMENT_DEVICES,
            defaults={'description': 'Medical Equipment & Diagnostic Devices'}
        )
        self.cat_consumables, _ = SupplierCategory.objects.get_or_create(
            name=SupplierCategory.CategoryChoices.MEDICAL_CONSUMABLES,
            defaults={'description': 'Clinical consumables, syringes, PPE'}
        )

        # 3. Create Vendor A
        self.user_vendor_a = User.objects.create_user(
            username='vendor_alpha',
            email='vendor_alpha@gmail.com',
            password='Password@123',
            role=self.vendor_role,
            is_active=True
        )
        self.vendor_a = Vendor.objects.create(
            user=self.user_vendor_a,
            company_name='Alpha MedTech Solutions',
            contact_person='Alice Smith',
            email='vendor_alpha@gmail.com',
            phone='9876543210',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_a.supplier_categories.add(self.cat_med_equip, self.cat_consumables)

        # 4. Create Vendor B
        self.user_vendor_b = User.objects.create_user(
            username='vendor_beta',
            email='vendor_beta@gmail.com',
            password='Password@123',
            role=self.vendor_role,
            is_active=True
        )
        self.vendor_b = Vendor.objects.create(
            user=self.user_vendor_b,
            company_name='Beta Healthcare Supplies',
            contact_person='Bob Jones',
            email='vendor_beta@gmail.com',
            phone='9876543211',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_b.supplier_categories.add(self.cat_med_equip)

        # 5. Create Committee User
        self.user_committee = User.objects.create_user(
            username='comm_member_1',
            email='comm1@gmail.com',
            password='Password@123',
            role=self.committee_role,
            is_active=True
        )

        # 6. Create Department Staff User
        self.user_staff = User.objects.create_user(
            username='staff_member_1',
            email='staff1@gmail.com',
            password='Password@123',
            role=self.staff_role,
            is_active=True
        )

    def test_vendor_can_add_product_with_valid_data(self):
        """Vendor A adds a valid product to their catalogue."""
        self.client.force_authenticate(user=self.user_vendor_a)
        payload = {
            'name': 'Digital Ultrasound System',
            'category': self.cat_med_equip.id,
            'brand': 'AlphaTech',
            'model_number': 'US-2026-PRO',
            'description': 'Advanced 3D/4D digital color doppler ultrasound machine',
            'technical_specifications': 'Frequency: 2.0-12.0 MHz; Display: 21.5 inch HD LED',
            'unit_of_measure': 'Unit',
            'indicative_price': '450000.00'
        }
        response = self.client.post('/api/vendors/products/', payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Digital Ultrasound System')
        self.assertEqual(response.data['vendor_name'], 'Alpha MedTech Solutions')
        self.assertEqual(response.data['category'], self.cat_med_equip.id)
        self.assertTrue(response.data['product_code'].startswith('PRD-'))
        self.assertTrue(response.data['is_active'])
        self.assertIn('indicative catalogue price only', response.data['price_disclaimer'].lower())

        # Verify DB entry
        prod = VendorProduct.objects.get(id=response.data['id'])
        self.assertEqual(prod.vendor, self.vendor_a)
        self.assertEqual(prod.indicative_price, Decimal('450000.00'))

    def test_product_validation_required_fields(self):
        """Validation errors on missing name or category."""
        self.client.force_authenticate(user=self.user_vendor_a)
        
        # Missing name
        payload = {
            'name': '',
            'category': self.cat_med_equip.id,
        }
        res = self.client.post('/api/vendors/products/', payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', res.data)

        # Missing category
        payload = {
            'name': 'Sterile Surgical Gloves',
        }
        res = self.client.post('/api/vendors/products/', payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('category', res.data)

    def test_product_validation_negative_price_rejected(self):
        """Indicative price cannot be negative."""
        self.client.force_authenticate(user=self.user_vendor_a)
        payload = {
            'name': 'Surgical Face Mask Box',
            'category': self.cat_consumables.id,
            'indicative_price': '-150.00'
        }
        res = self.client.post('/api/vendors/products/', payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('indicative_price', res.data)

    def test_duplicate_product_prevention_for_same_vendor(self):
        """Vendor cannot add duplicate product with same name, brand, and model."""
        VendorProduct.objects.create(
            vendor=self.vendor_a,
            name='Infusion Pump',
            category=self.cat_med_equip,
            brand='InfuseCare',
            model_number='IP-500',
            indicative_price=Decimal('25000.00')
        )

        self.client.force_authenticate(user=self.user_vendor_a)
        payload = {
            'name': 'Infusion Pump',
            'category': self.cat_med_equip.id,
            'brand': 'InfuseCare',
            'model_number': 'IP-500',
            'indicative_price': '26000.00'
        }
        res = self.client.post('/api/vendors/products/', payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', res.data)
        self.assertIn('already have a product with this same Name', str(res.data['name']))

    def test_different_vendors_can_supply_same_product_name(self):
        """Vendor B can supply the same product name as Vendor A."""
        VendorProduct.objects.create(
            vendor=self.vendor_a,
            name='Infusion Pump',
            category=self.cat_med_equip,
            brand='InfuseCare',
            model_number='IP-500'
        )

        self.client.force_authenticate(user=self.user_vendor_b)
        payload = {
            'name': 'Infusion Pump',
            'category': self.cat_med_equip.id,
            'brand': 'InfuseCare',
            'model_number': 'IP-500',
            'indicative_price': '24500.00'
        }
        res = self.client.post('/api/vendors/products/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['vendor_name'], 'Beta Healthcare Supplies')

    def test_vendor_ownership_isolation_in_product_listing(self):
        """Vendor A only sees Vendor A's products; cannot see Vendor B's products."""
        prod_a = VendorProduct.objects.create(
            vendor=self.vendor_a,
            name='Product Alpha 1',
            category=self.cat_med_equip
        )
        prod_b = VendorProduct.objects.create(
            vendor=self.vendor_b,
            name='Product Beta 1',
            category=self.cat_med_equip
        )

        # Authenticate as Vendor A
        self.client.force_authenticate(user=self.user_vendor_a)
        res = self.client.get('/api/vendors/products/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get('results', res.data)
        returned_ids = [p['id'] for p in results]
        self.assertIn(prod_a.id, returned_ids)
        self.assertNotIn(prod_b.id, returned_ids)

    def test_vendor_can_edit_own_product(self):
        """Vendor A edits their own product."""
        prod = VendorProduct.objects.create(
            vendor=self.vendor_a,
            name='Examination Gloves',
            category=self.cat_consumables,
            indicative_price=Decimal('350.00')
        )
        self.client.force_authenticate(user=self.user_vendor_a)
        res = self.client.patch(f'/api/vendors/products/{prod.id}/', {
            'indicative_price': '380.00',
            'brand': 'AlphaShield'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        prod.refresh_from_db()
        self.assertEqual(prod.indicative_price, Decimal('380.00'))
        self.assertEqual(prod.brand, 'AlphaShield')

    def test_unauthorized_vendor_cannot_edit_another_vendors_product(self):
        """Vendor B cannot edit Vendor A's product (enforces 403 / 404)."""
        prod_a = VendorProduct.objects.create(
            vendor=self.vendor_a,
            name='Alpha Dialysis Cartridge',
            category=self.cat_consumables,
            indicative_price=Decimal('1200.00')
        )
        self.client.force_authenticate(user=self.user_vendor_b)
        res = self.client.patch(f'/api/vendors/products/{prod_a.id}/', {
            'name': 'Hacked Product Name',
            'indicative_price': '1.00'
        })
        # Should return 404 Not Found (filtered by queryset) or 403 Forbidden
        self.assertIn(res.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])
        prod_a.refresh_from_db()
        self.assertEqual(prod_a.name, 'Alpha Dialysis Cartridge')

    def test_vendor_can_toggle_active_status(self):
        """Vendor can deactivate and reactivate their own product."""
        prod = VendorProduct.objects.create(
            vendor=self.vendor_a,
            name='Pulse Oximeter Pro',
            category=self.cat_med_equip,
            is_active=True
        )
        self.client.force_authenticate(user=self.user_vendor_a)
        
        # Deactivate
        res = self.client.post(f'/api/vendors/products/{prod.id}/toggle-active/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        prod.refresh_from_db()
        self.assertFalse(prod.is_active)
        self.assertIn('deactivated', res.data['detail'].lower())

        # Reactivate
        res2 = self.client.post(f'/api/vendors/products/{prod.id}/toggle-active/')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        prod.refresh_from_db()
        self.assertTrue(prod.is_active)
        self.assertIn('activated', res2.data['detail'].lower())

    def test_unauthorized_user_cannot_deactivate_product(self):
        """Vendor B cannot deactivate Vendor A's product."""
        prod = VendorProduct.objects.create(
            vendor=self.vendor_a,
            name='Pulse Oximeter Pro',
            category=self.cat_med_equip,
            is_active=True
        )
        self.client.force_authenticate(user=self.user_vendor_b)
        res = self.client.post(f'/api/vendors/products/{prod.id}/toggle-active/')
        self.assertIn(res.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])
        prod.refresh_from_db()
        self.assertTrue(prod.is_active)

    def test_non_vendor_user_cannot_create_products(self):
        """Department Staff cannot add products to vendor catalogue."""
        self.client.force_authenticate(user=self.user_staff)
        res = self.client.post('/api/vendors/products/', {
            'name': 'Unauthorized Product',
            'category': self.cat_med_equip.id
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_procurement_committee_can_search_catalogue_with_disclaimer(self):
        """Procurement Committee can search the product catalogue; inactive products excluded."""
        active_prod = VendorProduct.objects.create(
            vendor=self.vendor_a,
            name='Philips Affiniti 70 Ultrasound',
            category=self.cat_med_equip,
            brand='Philips',
            model_number='Affiniti-70',
            indicative_price=Decimal('1250000.00'),
            is_active=True
        )
        inactive_prod = VendorProduct.objects.create(
            vendor=self.vendor_a,
            name='Discontinued Ultrasound Model',
            category=self.cat_med_equip,
            brand='Philips',
            model_number='Old-Model',
            indicative_price=Decimal('800000.00'),
            is_active=False
        )

        self.client.force_authenticate(user=self.user_committee)
        res = self.client.get('/api/vendors/products/catalogue/?search=Philips')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data.get('results', res.data)
        item_ids = [p['id'] for p in results]
        self.assertIn(active_prod.id, item_ids)
        self.assertNotIn(inactive_prod.id, item_ids)
        self.assertIn('indicative catalogue price only', results[0]['price_disclaimer'].lower())

    def test_product_search_and_filtering(self):
        """Filter by category and search keyword."""
        p1 = VendorProduct.objects.create(
            vendor=self.vendor_a,
            name='Surgical Scalpel Handle No. 3',
            category=self.cat_consumables,
            brand='MediCut'
        )
        p2 = VendorProduct.objects.create(
            vendor=self.vendor_a,
            name='ECG 12-Channel Monitor',
            category=self.cat_med_equip,
            brand='CardioCare'
        )

        self.client.force_authenticate(user=self.user_vendor_a)
        
        # Filter by category
        res = self.client.get(f'/api/vendors/products/?category={self.cat_consumables.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        ids = [p['id'] for p in res.data.get('results', res.data)]
        self.assertIn(p1.id, ids)
        self.assertNotIn(p2.id, ids)

        # Search by keyword
        res2 = self.client.get('/api/vendors/products/?search=ECG')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        ids2 = [p['id'] for p in res2.data.get('results', res2.data)]
        self.assertIn(p2.id, ids2)
        self.assertNotIn(p1.id, ids2)
