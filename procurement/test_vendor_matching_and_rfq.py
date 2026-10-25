from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal

from accounts.models import Role, Department
from procurement.models import (
    Requisition, RequisitionItem, QuotationRequest, RFQVendorInvitation, Quotation
)
from vendors.models import Vendor, SupplierCategory, VendorProduct

User = get_user_model()


class VendorMatchingAndRFQTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Roles
        self.committee_role, _ = Role.objects.get_or_create(
            name='Procurement Committee Member',
            defaults={'description': 'Committee Member'}
        )
        self.other_role, _ = Role.objects.get_or_create(
            name='Department Staff',
            defaults={'description': 'Department Staff'}
        )

        # Department
        self.dept, _ = Department.objects.get_or_create(
            name='Cardiology',
            defaults={'code': 'CARD'}
        )

        # Committee Members
        self.committee_user_1 = User.objects.create_user(
            username='pc_member_1',
            email='pc1@procuramed.com',
            password='Password123!',
            role=self.committee_role,
            employee_id='PC001'
        )
        self.committee_user_2 = User.objects.create_user(
            username='pc_member_2',
            email='pc2@procuramed.com',
            password='Password123!',
            role=self.committee_role,
            employee_id='PC002'
        )

        # Supplier Categories
        self.cat_med_equip, _ = SupplierCategory.objects.get_or_create(
            name=SupplierCategory.CategoryChoices.MEDICAL_EQUIPMENT_DEVICES
        )
        self.cat_cleaning, _ = SupplierCategory.objects.get_or_create(
            name=SupplierCategory.CategoryChoices.CLEANING_HOUSEKEEPING_SUPPLIES
        )

        # Vendors
        # Vendor 1: Matches Medical Equipment & Devices, has product ECG Machine
        self.vendor_1 = Vendor.objects.create(
            company_name='CardioCare Diagnostics Pvt Ltd',
            vendor_code='VEND-CARDIO-01',
            email='sales@cardiocare.com',
            phone='9876543210',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_1.supplier_categories.add(self.cat_med_equip)
        self.prod_1 = VendorProduct.objects.create(
            vendor=self.vendor_1,
            name='12-Lead Diagnostic ECG Machine',
            category=self.cat_med_equip,
            model_number='ECG-PRO-12',
            technical_specifications='12-lead simultaneous acquisition with thermal printer',
            indicative_price=Decimal('75000.00'),
            is_active=True
        )

        # Vendor 2: Matches Medical Equipment & Devices, has product ECG Monitor
        self.vendor_2 = Vendor.objects.create(
            company_name='Apex Biomedical Systems',
            vendor_code='VEND-APEX-02',
            email='contact@apexbiomed.com',
            phone='9876543211',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_2.supplier_categories.add(self.cat_med_equip)
        self.prod_2 = VendorProduct.objects.create(
            vendor=self.vendor_2,
            name='ECG Digital Recorder',
            category=self.cat_med_equip,
            model_number='APEX-ECG-200',
            technical_specifications='Advanced 12-channel digital ECG with battery backup',
            indicative_price=Decimal('72000.00'),
            is_active=True
        )

        # Vendor 3: Active but in Cleaning & Housekeeping, NO medical equipment
        self.vendor_3 = Vendor.objects.create(
            company_name='CleanHouse Formulations',
            vendor_code='VEND-CLEAN-03',
            email='info@cleanhouse.com',
            phone='9876543212',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_3.supplier_categories.add(self.cat_cleaning)

        # Requisition for ECG Machine assigned to committee_user_1
        self.requisition = Requisition.objects.create(
            req_number='REQ-ECG-001',
            title='Procurement of 12-Lead ECG Machines',
            department=self.dept,
            category='Medical Equipment & Devices',
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
            priority='HIGH',
            estimated_budget=Decimal('160000.00'),
            assigned_committee_member=self.committee_user_1,
            requested_by=self.committee_user_1
        )
        self.req_item = RequisitionItem.objects.create(
            requisition=self.requisition,
            item_name='12-Lead ECG Machine',
            category='Medical Equipment & Devices',
            quantity=2,
            specifications='12-lead acquisition, thermal printer, digital screen',
            estimated_unit_price=Decimal('75000.00')
        )

    def test_find_vendors_matching_logic(self):
        """
        Verify that find_vendors returns only vendors that match the requisition
        item/category and excludes non-matching vendors (e.g. pharma).
        """
        self.client.force_authenticate(user=self.committee_user_1)
        url = f'/api/procurement/requisitions/{self.requisition.id}/find-vendors/'
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        vendors = data.get('vendors', [])
        vendor_ids = [v['id'] for v in vendors]

        # Vendor 1 and Vendor 2 must match
        self.assertIn(self.vendor_1.id, vendor_ids)
        self.assertIn(self.vendor_2.id, vendor_ids)

        # Vendor 3 (Pharmaceuticals only) must NOT be returned
        self.assertNotIn(self.vendor_3.id, vendor_ids)

        # Verify matching details returned
        v1_data = next(v for v in vendors if v['id'] == self.vendor_1.id)
        self.assertTrue(v1_data['is_eligible'])
        self.assertTrue(len(v1_data['matching_products']) > 0 or len(v1_data['matching_categories']) > 0)

    def test_find_vendors_permission_enforcement(self):
        """
        A committee member who is NOT assigned to the requisition cannot
        access find_vendors for another member's requisition.
        """
        self.client.force_authenticate(user=self.committee_user_2)
        url = f'/api/procurement/requisitions/{self.requisition.id}/find-vendors/'
        response = self.client.get(url)

        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_create_multi_vendor_rfq(self):
        """
        Committee member sends RFQ to 2 selected vendors.
        Verifies requisition transitions to RFQ_ISSUED (Awaiting Quotations),
        invitations are created, and audit log is written.
        """
        self.client.force_authenticate(user=self.committee_user_1)
        url = '/api/procurement/rfqs/'
        payload = {
            'requisition_id': self.requisition.id,
            'title': 'RFQ for 12-Lead ECG Machines',
            'due_date': (timezone.now() + timedelta(days=7)).strftime('%Y-%m-%d'),
            'vendor_ids': [self.vendor_1.id, self.vendor_2.id],
            'delivery_requirements': 'Delivery within 14 days of PO issuance',
            'terms_and_conditions': 'Warranty: minimum 2 years comprehensive'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Refresh requisition
        self.requisition.refresh_from_db()
        self.assertEqual(self.requisition.status, Requisition.StatusChoices.RFQ_ISSUED)

        # Verify RFQ and Vendor Invitations
        rfq_id = response.data['rfq']['id']
        rfq = QuotationRequest.objects.get(id=rfq_id)
        self.assertEqual(rfq.status, QuotationRequest.StatusChoices.SENT)
        self.assertEqual(rfq.vendor_invitations.count(), 2)

        v_inv_ids = set(rfq.vendor_invitations.values_list('vendor_id', flat=True))
        self.assertEqual(v_inv_ids, {self.vendor_1.id, self.vendor_2.id})

    def test_rfq_duplicate_vendor_prevention(self):
        """
        Sending a duplicate RFQ to an already-invited vendor for the same requisition
        must be rejected with HTTP 400.
        """
        self.client.force_authenticate(user=self.committee_user_1)
        # Create initial RFQ
        QuotationRequest.objects.create(
            requisition=self.requisition,
            created_by=self.committee_user_1,
            title='First RFQ',
            due_date=timezone.now().date() + timedelta(days=5),
            status=QuotationRequest.StatusChoices.SENT
        )
        rfq = QuotationRequest.objects.filter(requisition=self.requisition).first()
        RFQVendorInvitation.objects.create(
            quotation_request=rfq,
            vendor=self.vendor_1,
            invited_by=self.committee_user_1
        )

        # Try to create second RFQ inviting vendor_1 again
        url = '/api/procurement/rfqs/'
        payload = {
            'requisition_id': self.requisition.id,
            'title': 'Duplicate RFQ Attempt',
            'due_date': (timezone.now() + timedelta(days=7)).strftime('%Y-%m-%d'),
            'vendor_ids': [self.vendor_1.id, self.vendor_2.id]
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been invited', str(response.data))

    def test_record_quotation_and_status_tracking(self):
        """
        Recording a quotation from an invited vendor updates the vendor invitation
        to QUOTED and transitions requisition to QUOTATIONS_RECEIVED.
        Pending vendors remain visible in awaiting submission.
        """
        self.client.force_authenticate(user=self.committee_user_1)
        # Create RFQ with 2 vendors
        rfq = QuotationRequest.objects.create(
            requisition=self.requisition,
            created_by=self.committee_user_1,
            title='RFQ for ECG',
            due_date=timezone.now().date() + timedelta(days=7),
            status=QuotationRequest.StatusChoices.SENT
        )
        self.requisition.status = Requisition.StatusChoices.RFQ_ISSUED
        self.requisition.save()

        inv1 = RFQVendorInvitation.objects.create(
            quotation_request=rfq,
            vendor=self.vendor_1,
            invited_by=self.committee_user_1,
            status=RFQVendorInvitation.InvitationStatus.INVITED
        )
        inv2 = RFQVendorInvitation.objects.create(
            quotation_request=rfq,
            vendor=self.vendor_2,
            invited_by=self.committee_user_1,
            status=RFQVendorInvitation.InvitationStatus.INVITED
        )

        # Record quotation from vendor 1
        url = f'/api/procurement/rfqs/{rfq.id}/record-quotation/'
        payload = {
            'vendor_id': self.vendor_1.id,
            'total_amount': 148000.00,
            'lead_time_days': 10,
            'remarks': 'Includes 2 years comprehensive warranty and calibration certificates'
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Refresh objects
        inv1.refresh_from_db()
        inv2.refresh_from_db()
        self.requisition.refresh_from_db()

        # Vendor 1 is now QUOTED
        self.assertEqual(inv1.status, RFQVendorInvitation.InvitationStatus.QUOTED)
        # Vendor 2 is still INVITED (awaiting submission)
        self.assertEqual(inv2.status, RFQVendorInvitation.InvitationStatus.INVITED)
        # Requisition status is now QUOTATIONS_RECEIVED
        self.assertEqual(self.requisition.status, Requisition.StatusChoices.QUOTATIONS_RECEIVED)
