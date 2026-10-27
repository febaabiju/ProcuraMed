from decimal import Decimal
from datetime import timedelta
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import Role, Department, AuditLog
from procurement.models import (
    Requisition, RequisitionItem, QuotationRequest, RFQItem, RFQVendorInvitation,
    Quotation, QuotationItem, Approval, PurchaseOrder, PurchaseOrderItem
)
from vendors.models import Vendor, SupplierCategory

User = get_user_model()


class VendorSelectionAndPOIntegrationTests(TestCase):
    def make_valid_pdf(self, name="signed_quote.pdf"):
        content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n0000000000 65535 f \n0000000009 00000 n \ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n50\n%%EOF"
        return SimpleUploadedFile(name, content, content_type="application/pdf")

    def setUp(self):
        self.client = APIClient()

        # Roles
        self.committee_role, _ = Role.objects.get_or_create(
            name='Procurement Committee Member',
            defaults={'description': 'Committee Member'}
        )
        self.po_role, _ = Role.objects.get_or_create(
            name='Purchase Officer',
            defaults={'description': 'Purchase Officer'}
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
            name='Critical Care',
            defaults={'code': 'CCU'}
        )

        # Category
        self.category, _ = SupplierCategory.objects.get_or_create(
            name='Medical Equipment & Devices',
            defaults={'description': 'Medical Equipment'}
        )

        # Committee Member
        self.committee_member = User.objects.create_user(
            username='committee_lead',
            email='committee@procuramed.com',
            password='Password123!',
            role=self.committee_role,
            employee_id='PC001'
        )

        # Another Committee Member
        self.other_committee_member = User.objects.create_user(
            username='committee_other',
            email='other_comm@procuramed.com',
            password='Password123!',
            role=self.committee_role,
            employee_id='PC002'
        )

        # Purchase Officer
        self.purchase_officer = User.objects.create_user(
            username='po_officer',
            email='po@procuramed.com',
            password='Password123!',
            role=self.po_role,
            employee_id='PO001'
        )

        # Department Staff
        self.dept_user = User.objects.create_user(
            username='dr_smith',
            email='smith@procuramed.com',
            password='Password123!',
            role=self.dept_role,
            department=self.dept,
            employee_id='STF001'
        )

        # Vendors
        self.vendor_user_1 = User.objects.create_user(
            username='medtech_vendor',
            email='sales@medtech.com',
            password='Password123!',
            role=self.vendor_role
        )
        self.vendor_1 = Vendor.objects.create(
            user=self.vendor_user_1,
            company_name='MedTech Diagnostics Inc.',
            vendor_code='VEN-2026-00001',
            contact_person='David Miller',
            email='sales@medtech.com',
            phone='+91 98765 43210',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_1.supplier_categories.add(self.category)

        self.vendor_user_2 = User.objects.create_user(
            username='biocare_vendor',
            email='sales@biocare.com',
            password='Password123!',
            role=self.vendor_role
        )
        self.vendor_2 = Vendor.objects.create(
            user=self.vendor_user_2,
            company_name='BioCare Systems Ltd.',
            vendor_code='VEN-2026-00002',
            contact_person='Sarah Connor',
            email='sales@biocare.com',
            phone='+91 91234 56789',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_2.supplier_categories.add(self.category)

        # Requisition assigned to committee_member
        self.requisition = Requisition.objects.create(
            req_number='PR-2026-00099',
            title='Multipara Patient Monitor ICU',
            category='Medical Equipment & Devices',
            department=self.dept,
            requested_by=self.dept_user,
            assigned_committee_member=self.committee_member,
            assigned_purchase_officer=self.purchase_officer,
            priority='HIGH',
            estimated_budget=Decimal('250000.00'),
            status=Requisition.StatusChoices.QUOTATIONS_RECEIVED,
            justification='Critical monitoring requirement in ICU expansion.'
        )

        self.req_item = RequisitionItem.objects.create(
            requisition=self.requisition,
            item_name='ICU Multipara Monitor',
            specifications='12-inch color TFT display, ECG, SpO2, NIBP, Respiration',
            quantity=2,
            estimated_unit_price=Decimal('125000.00'),
            total_price=Decimal('250000.00')
        )

        # RFQ
        self.rfq = QuotationRequest.objects.create(
            rfq_number='RFQ-2026-00099',
            title='Procurement of Multipara Patient Monitors',
            requisition=self.requisition,
            created_by=self.committee_member,
            status=QuotationRequest.StatusChoices.OPEN,
            due_date=timezone.now() + timedelta(days=7),
            delivery_requirements='Immediate delivery to ICU 3rd floor',
            delivery_location='Central Hospital Main ICU'
        )

        RFQVendorInvitation.objects.create(
            quotation_request=self.rfq,
            vendor=self.vendor_1,
            status=RFQVendorInvitation.InvitationStatus.QUOTED
        )
        RFQVendorInvitation.objects.create(
            quotation_request=self.rfq,
            vendor=self.vendor_2,
            status=RFQVendorInvitation.InvitationStatus.QUOTED
        )

        # Quotation 1 (MedTech - Total 240,000)
        self.quote_1 = Quotation.objects.create(
            quotation_number='QT-2026-00101',
            quotation_request=self.rfq,
            vendor=self.vendor_1,
            total_amount=Decimal('240000.00'),
            lead_time_days=10,
            valid_until=timezone.now().date() + timedelta(days=30),
            status=Quotation.StatusChoices.SUBMITTED,
            remarks='Includes 2-year comprehensive hospital warranty and calibration certificate.',
            quotation_document=self.make_valid_pdf('medtech_quote.pdf')
        )
        QuotationItem.objects.create(
            quotation=self.quote_1,
            item_name='ICU Multipara Monitor 12-inch',
            specification='12-inch color display, 5-lead ECG, SpO2, NIBP',
            quantity=2,
            unit_price=Decimal('120000.00'),
            total_price=Decimal('240000.00')
        )

        # Quotation 2 (BioCare - Total 260,000)
        self.quote_2 = Quotation.objects.create(
            quotation_number='QT-2026-00102',
            quotation_request=self.rfq,
            vendor=self.vendor_2,
            total_amount=Decimal('260000.00'),
            lead_time_days=5,
            valid_until=timezone.now().date() + timedelta(days=30),
            status=Quotation.StatusChoices.SUBMITTED,
            remarks='Fast delivery within 5 days with 1-year standard warranty.',
            quotation_document=self.make_valid_pdf('biocare_quote.pdf')
        )
        QuotationItem.objects.create(
            quotation=self.quote_2,
            item_name='ICU Multipara Monitor Model B',
            specification='12-inch screen, ECG, SpO2, NIBP',
            quantity=2,
            unit_price=Decimal('130000.00'),
            total_price=Decimal('260000.00')
        )

    def test_quotation_review_requests_endpoint(self):
        """Committee member retrieves purchase requests awaiting review."""
        self.client.force_authenticate(user=self.committee_member)
        response = self.client.get('/api/procurement/requisitions/quotation-review-requests/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        req_numbers = [r['req_number'] for r in response.data]
        self.assertIn(self.requisition.req_number, req_numbers)

    def test_compare_quotations_side_by_side(self):
        """Committee compares quotations for the purchase request."""
        self.client.force_authenticate(user=self.committee_member)
        response = self.client.get(f'/api/procurement/quotations/compare/?requisition_id={self.requisition.id}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['quotations']), 2)
        self.assertEqual(response.data['lowest_price_quotation_id'], self.quote_1.id)
        self.assertEqual(response.data['fastest_delivery_quotation_id'], self.quote_2.id)

    def test_select_vendor_requires_justification_remarks(self):
        """Vendor selection requires non-empty decision remarks."""
        self.client.force_authenticate(user=self.committee_member)
        response = self.client.post(f'/api/procurement/quotations/{self.quote_1.id}/select-vendor/', {
            'decision_remarks': '   '
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('decision_remarks', response.data)

    def test_select_vendor_success_and_state_updates(self):
        """Committee successfully selects a vendor quotation."""
        self.client.force_authenticate(user=self.committee_member)
        remarks = "Selected MedTech Diagnostics based on lower overall cost, 2-year warranty, and ISO compliance."
        response = self.client.post(f'/api/procurement/quotations/{self.quote_1.id}/select-vendor/', {
            'decision_remarks': remarks
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 1. Winning quotation updated
        self.quote_1.refresh_from_db()
        self.assertEqual(self.quote_1.status, Quotation.StatusChoices.SELECTED)
        self.assertTrue(self.quote_1.is_recommended)
        self.assertEqual(self.quote_1.recommended_by, self.committee_member)

        # 2. Competing quotation marked NOT_SELECTED (not deleted)
        self.quote_2.refresh_from_db()
        self.assertEqual(self.quote_2.status, Quotation.StatusChoices.NOT_SELECTED)
        self.assertFalse(self.quote_2.is_recommended)

        # 3. Requisition updated
        self.requisition.refresh_from_db()
        self.assertEqual(self.requisition.selected_vendor, self.vendor_1)
        self.assertEqual(self.requisition.selected_quotation, self.quote_1)
        self.assertEqual(self.requisition.vendor_selected_by, self.committee_member)
        self.assertIsNotNone(self.requisition.vendor_selected_at)
        self.assertEqual(self.requisition.vendor_selection_remarks, remarks)
        self.assertEqual(self.requisition.status, Requisition.StatusChoices.VENDOR_SELECTED)

        # 4. RFQ closed
        self.rfq.refresh_from_db()
        self.assertEqual(self.rfq.status, QuotationRequest.StatusChoices.CLOSED)

        # 5. Approval record created
        approval = Approval.objects.filter(requisition=self.requisition, stage='Procurement Committee Vendor Selection').first()
        self.assertIsNotNone(approval)
        self.assertEqual(approval.status, Approval.StatusChoices.APPROVED)
        self.assertEqual(approval.approved_by, self.committee_member)

    def test_unauthorized_user_cannot_select_vendor(self):
        """Department staff and other committee members cannot select vendor."""
        # Staff
        self.client.force_authenticate(user=self.dept_user)
        response = self.client.post(f'/api/procurement/quotations/{self.quote_1.id}/select-vendor/', {
            'decision_remarks': 'Unauthorized staff decision'
        })
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # Other committee member not assigned to this requisition
        self.client.force_authenticate(user=self.other_committee_member)
        response = self.client.post(f'/api/procurement/quotations/{self.quote_1.id}/select-vendor/', {
            'decision_remarks': 'Unassigned committee member decision'
        })
        self.assertIn(response.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_purchase_officer_can_retrieve_approved_vendor_selections(self):
        """Approved vendor selections appear in Purchase Officer queue."""
        # Complete committee vendor selection
        self.client.force_authenticate(user=self.committee_member)
        self.client.post(f'/api/procurement/quotations/{self.quote_1.id}/select-vendor/', {
            'decision_remarks': 'Selected MedTech Diagnostics for ICU equipment.'
        })

        # Purchase Officer queries approved selections
        self.client.force_authenticate(user=self.purchase_officer)
        response = self.client.get('/api/procurement/requisitions/approved-vendor-selections/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        sel = response.data[0]
        self.assertEqual(sel['req_number'], self.requisition.req_number)
        self.assertEqual(sel['selected_vendor_details']['company_name'], self.vendor_1.company_name)
        self.assertEqual(sel['selected_quotation_details']['quotation_number'], self.quote_1.quotation_number)
        self.assertEqual(sel['selected_quotation_details']['total_amount'], '240000.00')
        self.assertEqual(sel['vendor_selected_by_name'], self.committee_member.username)
        self.assertFalse(sel['has_purchase_order'])

    def test_purchase_officer_creates_purchase_order(self):
        """Purchase Officer creates a PO for an approved vendor selection."""
        # Complete committee vendor selection first
        self.client.force_authenticate(user=self.committee_member)
        self.client.post(f'/api/procurement/quotations/{self.quote_1.id}/select-vendor/', {
            'decision_remarks': 'Selected MedTech Diagnostics.'
        })

        # Purchase Officer creates PO
        self.client.force_authenticate(user=self.purchase_officer)
        po_payload = {
            'requisition': self.requisition.id,
            'quotation': self.quote_1.id,
            'vendor': self.vendor_1.id,
            'expected_delivery_date': (timezone.now() + timedelta(days=14)).date().isoformat(),
            'terms_and_conditions': 'Payment within 30 days of delivery and inspection.',
            'total_amount': '240000.00'
        }
        response = self.client.post('/api/procurement/purchase-orders/', po_payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['po_number'].startswith('PO-'))
        self.assertEqual(response.data['status'], 'ISSUED')

        # Requisition status updated to PO_CREATED
        self.requisition.refresh_from_db()
        self.assertEqual(self.requisition.status, Requisition.StatusChoices.PO_CREATED)
        self.assertEqual(self.requisition.purchase_orders.count(), 1)

        # Quotation status updated to ACCEPTED
        self.quote_1.refresh_from_db()
        self.assertEqual(self.quote_1.status, Quotation.StatusChoices.ACCEPTED)

        # PO items populated
        po_id = response.data['id']
        po = PurchaseOrder.objects.get(pk=po_id)
        self.assertEqual(po.items.count(), 1)
        self.assertEqual(po.items.first().item_name, 'ICU Multipara Monitor 12-inch')

    def test_prevent_duplicate_purchase_orders(self):
        """Cannot create duplicate purchase orders for the same approved selection."""
        # Committee selects vendor
        self.client.force_authenticate(user=self.committee_member)
        self.client.post(f'/api/procurement/quotations/{self.quote_1.id}/select-vendor/', {
            'decision_remarks': 'Selected MedTech Diagnostics.'
        })

        # PO created once
        self.client.force_authenticate(user=self.purchase_officer)
        po_payload = {
            'requisition': self.requisition.id,
            'quotation': self.quote_1.id,
            'vendor': self.vendor_1.id,
            'total_amount': '240000.00'
        }
        res1 = self.client.post('/api/procurement/purchase-orders/', po_payload)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        # Attempt duplicate PO creation
        res2 = self.client.post('/api/procurement/purchase-orders/', po_payload)
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been created', res2.data['detail'])

    def test_prevent_modifying_vendor_selection_after_po_creation(self):
        """Once PO is created, committee cannot change vendor selection."""
        # Committee selects vendor
        self.client.force_authenticate(user=self.committee_member)
        self.client.post(f'/api/procurement/quotations/{self.quote_1.id}/select-vendor/', {
            'decision_remarks': 'Selected MedTech Diagnostics.'
        })

        # PO created
        self.client.force_authenticate(user=self.purchase_officer)
        self.client.post('/api/procurement/purchase-orders/', {
            'requisition': self.requisition.id,
            'quotation': self.quote_1.id,
            'vendor': self.vendor_1.id,
            'total_amount': '240000.00'
        })

        # Attempt to change selection back to quote 2
        self.client.force_authenticate(user=self.committee_member)
        response = self.client.post(f'/api/procurement/quotations/{self.quote_2.id}/select-vendor/', {
            'decision_remarks': 'Attempting to change vendor.'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Purchase Order has already been created', response.data['detail'])
