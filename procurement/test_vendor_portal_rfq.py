from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal

from accounts.models import Role, Department
from procurement.models import (
    Requisition, RequisitionItem, QuotationRequest, RFQItem, RFQVendorInvitation, Quotation, QuotationItem
)
from vendors.models import Vendor, SupplierCategory, VendorProduct

User = get_user_model()


class VendorPortalRFQIntegrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Roles
        self.committee_role, _ = Role.objects.get_or_create(
            name='Procurement Committee Member',
            defaults={'description': 'Committee Member'}
        )
        self.vendor_role, _ = Role.objects.get_or_create(
            name='Vendor',
            defaults={'description': 'Approved Supplier Vendor Account'}
        )
        self.dept_role, _ = Role.objects.get_or_create(
            name='Department Staff',
            defaults={'description': 'Staff Member'}
        )

        # Department
        self.dept, _ = Department.objects.get_or_create(
            name='Radiology & Imaging',
            defaults={'code': 'RAD'}
        )

        # Users
        self.committee_user = User.objects.create_user(
            username='committee_lead',
            email='committee_lead@procuramed.com',
            password='Password123!',
            role=self.committee_role,
            employee_id='PC001'
        )

        self.staff_user = User.objects.create_user(
            username='rad_staff',
            email='rad_staff@procuramed.com',
            password='Password123!',
            role=self.dept_role,
            department=self.dept,
            employee_id='RAD001'
        )

        # Category
        self.cat_med_equip, _ = SupplierCategory.objects.get_or_create(
            name=SupplierCategory.CategoryChoices.MEDICAL_EQUIPMENT_DEVICES
        )

        # Vendors & Vendor Users
        # Vendor A (Invited)
        self.vendor_user_a = User.objects.create_user(
            username='vendor_a_user',
            email='contact@vendora.com',
            password='Password123!',
            role=self.vendor_role
        )
        self.vendor_a = Vendor.objects.create(
            user=self.vendor_user_a,
            company_name='Alpha Medical Diagnostics Pvt Ltd',
            vendor_code='VEND-ALPHA-01',
            email='contact@vendora.com',
            phone='9876543210',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_a.supplier_categories.add(self.cat_med_equip)

        # Vendor B (Invited)
        self.vendor_user_b = User.objects.create_user(
            username='vendor_b_user',
            email='contact@vendorb.com',
            password='Password123!',
            role=self.vendor_role
        )
        self.vendor_b = Vendor.objects.create(
            user=self.vendor_user_b,
            company_name='Beta Healthcare Solutions',
            vendor_code='VEND-BETA-02',
            email='contact@vendorb.com',
            phone='9876543211',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_b.supplier_categories.add(self.cat_med_equip)

        # Vendor C (NOT Invited - Competitor)
        self.vendor_user_c = User.objects.create_user(
            username='vendor_c_user',
            email='contact@vendorc.com',
            password='Password123!',
            role=self.vendor_role
        )
        self.vendor_c = Vendor.objects.create(
            user=self.vendor_user_c,
            company_name='Gamma Supplies Corp',
            vendor_code='VEND-GAMMA-03',
            email='contact@vendorc.com',
            phone='9876543212',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_c.supplier_categories.add(self.cat_med_equip)

        # Create purchase requisition assigned to committee member
        self.req = Requisition.objects.create(
            title='High-Resolution Ultrasound Transducer Probe',
            requested_by=self.staff_user,
            department=self.dept,
            category=SupplierCategory.CategoryChoices.MEDICAL_EQUIPMENT_DEVICES,
            estimated_budget=Decimal('250000.00'),
            justification='Replacement probe for high-volume emergency and abdominal scans',
            status=Requisition.StatusChoices.APPROVED,
            assigned_committee_member=self.committee_user,
            committee_assigned_at=timezone.now()
        )

        RequisitionItem.objects.create(
            requisition=self.req,
            item_name='High-Resolution Ultrasound Transducer Probe',
            category=SupplierCategory.CategoryChoices.MEDICAL_EQUIPMENT_DEVICES,
            quantity=2,
            specifications='Curvilinear 3.5MHz transducer probe with abdominal imaging preset',
            estimated_unit_price=Decimal('125000.00'),
            total_price=Decimal('250000.00')
        )

        # Committee creates and sends RFQ to Vendor A and Vendor B
        self.rfq = QuotationRequest.objects.create(
            requisition=self.req,
            created_by=self.committee_user,
            title='RFQ: Ultrasound Transducer Probe',
            issue_date=timezone.now().date(),
            due_date=timezone.now().date() + timedelta(days=15),
            delivery_location='Radiology Ultrasound Suite Room 102',
            delivery_requirements='Sterile packaging with 2-year hospital manufacturer warranty',
            terms_and_conditions='Payment within 30 days of physical delivery and biomedical engineering acceptance test',
            estimated_budget=Decimal('250000.00'),
            status=QuotationRequest.StatusChoices.SENT
        )

        RFQItem.objects.create(
            quotation_request=self.rfq,
            item_name='High-Resolution Ultrasound Transducer Probe',
            category=SupplierCategory.CategoryChoices.MEDICAL_EQUIPMENT_DEVICES,
            quantity=2,
            unit_of_measurement='Pieces',
            technical_specifications='Curvilinear 3.5MHz transducer probe with abdominal imaging preset',
            estimated_unit_price=Decimal('125000.00'),
            total_estimated_price=Decimal('250000.00')
        )

        # Send invitations to Vendor A and Vendor B
        self.invitation_a = RFQVendorInvitation.objects.create(
            quotation_request=self.rfq,
            vendor=self.vendor_a,
            invited_by=self.committee_user,
            status=RFQVendorInvitation.InvitationStatus.INVITED
        )

        self.invitation_b = RFQVendorInvitation.objects.create(
            quotation_request=self.rfq,
            vendor=self.vendor_b,
            invited_by=self.committee_user,
            status=RFQVendorInvitation.InvitationStatus.INVITED
        )

        self.req.status = Requisition.StatusChoices.RFQ_ISSUED
        self.req.save(update_fields=['status'])

    def test_vendor_rfq_listing_and_isolation(self):
        """
        Verify that Vendor A and Vendor B see the RFQ, while non-invited Vendor C sees nothing.
        """
        # 1. Vendor A checks RFQ list
        self.client.force_authenticate(user=self.vendor_user_a)
        res_a = self.client.get('/api/procurement/rfqs/')
        self.assertEqual(res_a.status_code, status.HTTP_200_OK)
        rfqs_a = res_a.data.get('results', res_a.data)
        self.assertEqual(len(rfqs_a), 1)
        self.assertEqual(rfqs_a[0]['rfq_number'], self.rfq.rfq_number)
        self.assertEqual(rfqs_a[0]['my_invitation']['status'], 'INVITED')

        # 2. Vendor B checks RFQ list
        self.client.force_authenticate(user=self.vendor_user_b)
        res_b = self.client.get('/api/procurement/rfqs/')
        self.assertEqual(res_b.status_code, status.HTTP_200_OK)
        rfqs_b = res_b.data.get('results', res_b.data)
        self.assertEqual(len(rfqs_b), 1)
        self.assertEqual(rfqs_b[0]['rfq_number'], self.rfq.rfq_number)

        # 3. Non-invited Vendor C checks RFQ list -> strict isolation
        self.client.force_authenticate(user=self.vendor_user_c)
        res_c = self.client.get('/api/procurement/rfqs/')
        self.assertEqual(res_c.status_code, status.HTTP_200_OK)
        rfqs_c = res_c.data.get('results', res_c.data)
        self.assertEqual(len(rfqs_c), 0, "Non-invited Vendor C must never see RFQs sent to other vendors.")

    def test_vendor_rfq_details_and_automatic_viewed_transition(self):
        """
        Opening an RFQ displays complete purchase request details and transitions
        the vendor's invitation status from INVITED to VIEWED.
        """
        self.client.force_authenticate(user=self.vendor_user_a)

        # Verify initial status is INVITED
        self.assertEqual(self.invitation_a.status, RFQVendorInvitation.InvitationStatus.INVITED)

        # Retrieve RFQ details
        res = self.client.get(f'/api/procurement/rfqs/{self.rfq.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data

        # Check full purchase request details
        self.assertEqual(data['rfq_number'], self.rfq.rfq_number)
        req_details = data['requisition_details']
        self.assertEqual(req_details['req_number'], self.req.req_number)
        self.assertEqual(req_details['items'][0]['item_name'], 'High-Resolution Ultrasound Transducer Probe')
        self.assertEqual(req_details['items'][0]['quantity'], 2)
        self.assertEqual(req_details['department_details']['name'], 'Radiology & Imaging')
        self.assertEqual(data['delivery_location'], 'Radiology Ultrasound Suite Room 102')
        self.assertIn('Curvilinear 3.5MHz transducer probe', data['items'][0]['technical_specifications'])
        self.assertEqual(data['delivery_requirements'], 'Sterile packaging with 2-year hospital manufacturer warranty')
        self.assertIsNotNone(data['due_date'])

        # Verify invitation status automatically updated to VIEWED
        self.invitation_a.refresh_from_db()
        self.assertEqual(self.invitation_a.status, RFQVendorInvitation.InvitationStatus.VIEWED)
        self.assertEqual(data['my_invitation']['status'], 'VIEWED')

        # Verify competitor privacy: Vendor A's view must not leak Vendor B's tracking
        tracking = data.get('vendor_tracking', [])
        self.assertEqual(len(tracking), 1)
        self.assertEqual(tracking[0]['vendor_id'], self.vendor_a.id)

    def test_vendor_submit_quotation_success_and_lifecycle(self):
        """
        Vendor A submits a formal price quotation with item pricing, tax, shipping,
        lead time, and validity. Validates database persistence and workflow transitions.
        """
        self.client.force_authenticate(user=self.vendor_user_a)

        payload = {
            'total_amount': '266500.00',
            'tax_percentage': '18.00',
            'tax_amount': '40500.00',
            'shipping_charges': '1000.00',
            'lead_time_days': 10,
            'valid_until': (timezone.now().date() + timedelta(days=45)).isoformat(),
            'remarks': 'Includes 2 years comprehensive manufacturer on-site warranty and calibration report.',
            'items': [
                {
                    'item_name': 'High-Resolution Ultrasound Transducer Probe',
                    'specification': 'Curvilinear 3.5MHz probe',
                    'quantity': 2,
                    'unit_price': '112500.00',
                    'total_price': '225000.00'
                }
            ]
        }

        res = self.client.post(f'/api/procurement/rfqs/{self.rfq.id}/submit-quotation/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertIn('quotation', res.data)
        quote_data = res.data['quotation']

        # 1. Verify Quotation record created in database
        quotation = Quotation.objects.filter(quotation_request=self.rfq, vendor=self.vendor_a).first()
        self.assertIsNotNone(quotation)
        self.assertEqual(quotation.status, Quotation.StatusChoices.SUBMITTED)
        self.assertEqual(float(quotation.total_amount), 266500.00)
        self.assertEqual(float(quotation.tax_percentage), 18.00)
        self.assertEqual(float(quotation.tax_amount), 40500.00)
        self.assertEqual(float(quotation.shipping_charges), 1000.00)
        self.assertEqual(quotation.lead_time_days, 10)
        self.assertIn('2 years comprehensive manufacturer', quotation.remarks)

        # 2. Verify QuotationItem created
        items = quotation.items.all()
        self.assertEqual(items.count(), 1)
        self.assertEqual(items[0].quantity, 2)
        self.assertEqual(float(items[0].unit_price), 112500.00)

        # 3. Verify Vendor A's invitation status updated to QUOTED
        self.invitation_a.refresh_from_db()
        self.assertEqual(self.invitation_a.status, RFQVendorInvitation.InvitationStatus.QUOTED)

        # 4. Verify Vendor B's invitation remains INVITED (untouched)
        self.invitation_b.refresh_from_db()
        self.assertEqual(self.invitation_b.status, RFQVendorInvitation.InvitationStatus.INVITED)

        # 5. Verify requisition status transitioned to QUOTATIONS_RECEIVED
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, Requisition.StatusChoices.QUOTATIONS_RECEIVED)

        # 6. Verify RFQ remains active (not closed simply because one vendor quoted)
        self.rfq.refresh_from_db()
        self.assertEqual(self.rfq.status, QuotationRequest.StatusChoices.SENT)

    def test_non_invited_vendor_cannot_submit_quotation(self):
        """
        Vendor C, who was not invited to this RFQ, must be blocked from submitting a quotation.
        """
        self.client.force_authenticate(user=self.vendor_user_c)

        payload = {
            'total_amount': '200000.00',
            'lead_time_days': 5,
            'valid_until': (timezone.now().date() + timedelta(days=30)).isoformat(),
        }

        res = self.client.post(f'/api/procurement/rfqs/{self.rfq.id}/submit-quotation/', payload, format='json')
        self.assertIn(res.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

    def test_committee_view_of_quotation_and_acceptance_lifecycle(self):
        """
        Procurement Committee member views submitted quotation and accepts it.
        Validates that other competing quotes become REJECTED and requisition completes.
        """
        # Vendor A submits quotation
        self.client.force_authenticate(user=self.vendor_user_a)
        payload_a = {
            'total_amount': '240000.00',
            'tax_percentage': '18.00',
            'tax_amount': '36610.17',
            'shipping_charges': '0.00',
            'lead_time_days': 7,
            'valid_until': (timezone.now().date() + timedelta(days=30)).isoformat(),
            'remarks': 'Alpha Medical proposal'
        }
        res_a = self.client.post(f'/api/procurement/rfqs/{self.rfq.id}/submit-quotation/', payload_a, format='json')
        self.assertEqual(res_a.status_code, status.HTTP_201_CREATED)
        quote_a_id = res_a.data['quotation']['id']

        # Committee member reviews the RFQ
        self.client.force_authenticate(user=self.committee_user)
        res_rfq = self.client.get(f'/api/procurement/rfqs/{self.rfq.id}/')
        self.assertEqual(res_rfq.status_code, status.HTTP_200_OK)

        tracking = res_rfq.data['vendor_tracking']
        self.assertEqual(len(tracking), 2)

        # Alpha Medical should be QUOTED
        vendor_a_track = next(t for t in tracking if t['vendor_id'] == self.vendor_a.id)
        self.assertTrue(vendor_a_track['has_quoted'])
        self.assertEqual(vendor_a_track['quotation_status'], 'SUBMITTED')
        self.assertEqual(float(vendor_a_track['total_amount']), 240000.00)
        self.assertEqual(vendor_a_track['lead_time_days'], 7)

        # Beta Healthcare should be Awaiting Quotation
        vendor_b_track = next(t for t in tracking if t['vendor_id'] == self.vendor_b.id)
        self.assertFalse(vendor_b_track['has_quoted'])
        self.assertEqual(vendor_b_track['invitation_status'], 'INVITED')

        # Committee accepts Vendor A's quotation
        res_accept = self.client.post(f'/api/procurement/quotations/{quote_a_id}/accept/')
        self.assertEqual(res_accept.status_code, status.HTTP_200_OK)

        # Verify quotation status is ACCEPTED
        quote_a = Quotation.objects.get(id=quote_a_id)
        self.assertEqual(quote_a.status, Quotation.StatusChoices.ACCEPTED)

        # Verify RFQ status is CLOSED
        self.rfq.refresh_from_db()
        self.assertEqual(self.rfq.status, QuotationRequest.StatusChoices.CLOSED)

        # Verify Requisition status is COMPLETED
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, Requisition.StatusChoices.COMPLETED)

        # Verify Vendor A sees their quotation as ACCEPTED in quotations list
        self.client.force_authenticate(user=self.vendor_user_a)
        res_quotes = self.client.get('/api/procurement/quotations/')
        self.assertEqual(res_quotes.status_code, status.HTTP_200_OK)
        my_quotes = res_quotes.data.get('results', res_quotes.data)
        self.assertEqual(len(my_quotes), 1)
        self.assertEqual(my_quotes[0]['status'], 'ACCEPTED')

        # Verify Vendor B sees 0 quotations
        self.client.force_authenticate(user=self.vendor_user_b)
        res_quotes_b = self.client.get('/api/procurement/quotations/')
        self.assertEqual(res_quotes_b.status_code, status.HTTP_200_OK)
        my_quotes_b = res_quotes_b.data.get('results', res_quotes_b.data)
        self.assertEqual(len(my_quotes_b), 0)
