from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import Role, Department
from procurement.models import Requisition, RequisitionItem, PurchaseOrder, PurchaseOrderItem
from vendors.models import Vendor, SupplierCategory
from inventory.models import Delivery, DeliveryItem
from finance.models import Invoice, Payment

User = get_user_model()


class InvoicePaymentTrackingTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Roles
        self.role_po, _ = Role.objects.get_or_create(name='Purchase Officer')
        self.role_staff, _ = Role.objects.get_or_create(name='Department Staff')
        self.role_admin, _ = Role.objects.get_or_create(name='Admin')
        self.role_vendor, _ = Role.objects.get_or_create(name='Vendor')

        # Department
        self.department, _ = Department.objects.get_or_create(
            name='ICU', defaults={'code': 'ICU', 'description': 'Intensive Care Unit'}
        )

        # Users
        self.purchase_officer = User.objects.create_user(
            username='po_user',
            email='po@hospital.org',
            password='Password123!',
            role=self.role_po,
            department=self.department
        )
        self.department_staff = User.objects.create_user(
            username='staff_user',
            email='staff@hospital.org',
            password='Password123!',
            role=self.role_staff,
            department=self.department
        )

        # Vendors
        self.category, _ = SupplierCategory.objects.get_or_create(name='Biomedical Equipment')
        self.vendor_1 = Vendor.objects.create(
            company_name='MedTech Supplies Ltd',
            vendor_code='VEND-MED-01',
            contact_person='John Doe',
            email='sales@medtech.com',
            phone='1234567890',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_1.supplier_categories.add(self.category)

        self.vendor_user_1 = User.objects.create_user(
            username='vendor1_user',
            email='vendor1@medtech.com',
            password='Password123!',
            role=self.role_vendor
        )
        self.vendor_1.user = self.vendor_user_1
        self.vendor_1.save()

        self.vendor_2 = Vendor.objects.create(
            company_name='BioCare Global',
            vendor_code='VEND-BIO-02',
            contact_person='Jane Smith',
            email='sales@biocare.com',
            phone='9876543210',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_2.supplier_categories.add(self.category)

        self.vendor_user_2 = User.objects.create_user(
            username='vendor2_user',
            email='vendor2@biocare.com',
            password='Password123!',
            role=self.role_vendor
        )
        self.vendor_2.user = self.vendor_user_2
        self.vendor_2.save()

        # Requisition
        self.requisition = Requisition.objects.create(
            title='ICU Patient Monitors',
            department=self.department,
            requested_by=self.department_staff,
            assigned_purchase_officer=self.purchase_officer,
            estimated_budget=Decimal('50000.00'),
            status=Requisition.StatusChoices.PO_CREATED
        )

        # Purchase Order for Vendor 1, total $50,000 (10 monitors @ $5,000 each)
        self.po = PurchaseOrder.objects.create(
            requisition=self.requisition,
            vendor=self.vendor_1,
            created_by=self.purchase_officer,
            total_amount=Decimal('50000.00'),
            status=PurchaseOrder.StatusChoices.ISSUED,
            delivery_status=PurchaseOrder.DeliveryStatusChoices.AWAITING_DELIVERY
        )
        self.po_item = PurchaseOrderItem.objects.create(
            purchase_order=self.po,
            item_name='ICU Patient Monitor',
            quantity=10,
            unit_price=Decimal('5000.00'),
            total_price=Decimal('50000.00')
        )

        # Purchase Order for Vendor 2, total $15,000
        self.po_2 = PurchaseOrder.objects.create(
            requisition=self.requisition,
            vendor=self.vendor_2,
            created_by=self.purchase_officer,
            total_amount=Decimal('15000.00'),
            status=PurchaseOrder.StatusChoices.ISSUED,
            delivery_status=PurchaseOrder.DeliveryStatusChoices.AWAITING_DELIVERY
        )
        self.po_item_2 = PurchaseOrderItem.objects.create(
            purchase_order=self.po_2,
            item_name='Diagnostic Ultrasound Probe',
            quantity=3,
            unit_price=Decimal('5000.00'),
            total_price=Decimal('15000.00')
        )

    def test_record_invoice_success(self):
        self.client.force_authenticate(user=self.purchase_officer)
        payload = {
            'purchase_order': self.po.id,
            'invoice_number': 'INV-2026-001',
            'amount': '25000.00',
            'tax_amount': '0.00',
            'invoice_date': '2026-10-27',
            'remarks': 'First partial invoice for 5 monitors.'
        }
        response = self.client.post('/api/finance/invoices/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data
        self.assertEqual(data['invoice_number'], 'INV-2026-001')
        self.assertEqual(data['vendor'], self.vendor_1.id)
        self.assertEqual(data['vendor_name'], self.vendor_1.company_name)
        self.assertEqual(Decimal(data['amount']), Decimal('25000.00'))
        self.assertEqual(data['verification_status'], 'PENDING_VERIFICATION')
        self.assertEqual(data['payment_status'], 'PENDING')
        self.assertEqual(Decimal(data['total_amount_paid']), Decimal('0.00'))
        self.assertEqual(Decimal(data['outstanding_balance']), Decimal('25000.00'))

    def test_record_duplicate_invoice_rejected_for_same_vendor(self):
        self.client.force_authenticate(user=self.purchase_officer)
        Invoice.objects.create(
            purchase_order=self.po,
            vendor=self.vendor_1,
            invoice_number='INV-DUP-01',
            amount=Decimal('10000.00'),
            total_amount=Decimal('10000.00'),
            recorded_by=self.purchase_officer
        )

        payload = {
            'purchase_order': self.po.id,
            'invoice_number': 'INV-DUP-01',
            'amount': '15000.00',
        }
        response = self.client.post('/api/finance/invoices/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("already exists", response.data['detail'])

    def test_record_invoice_invalid_amount_or_exceeding_po_total(self):
        self.client.force_authenticate(user=self.purchase_officer)

        # Zero or negative amount
        response_zero = self.client.post('/api/finance/invoices/', {
            'purchase_order': self.po.id,
            'invoice_number': 'INV-ERR-01',
            'amount': '0.00',
        }, format='json')
        self.assertEqual(response_zero.status_code, status.HTTP_400_BAD_REQUEST)

        # Exceeding PO total (PO total is 50,000, invoice is 60,000)
        response_excess = self.client.post('/api/finance/invoices/', {
            'purchase_order': self.po.id,
            'invoice_number': 'INV-ERR-02',
            'amount': '60000.00',
        }, format='json')
        self.assertEqual(response_excess.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeds remaining purchase order balance", response_excess.data['detail'])

    def test_invoice_verification_checks_deliveries(self):
        self.client.force_authenticate(user=self.purchase_officer)

        # Create invoice of 25,000
        invoice = Invoice.objects.create(
            purchase_order=self.po,
            vendor=self.vendor_1,
            invoice_number='INV-DELIV-CHECK',
            amount=Decimal('25000.00'),
            total_amount=Decimal('25000.00'),
            recorded_by=self.purchase_officer,
            verification_status=Invoice.VerificationStatusChoices.PENDING_VERIFICATION
        )

        # 1. Attempt verification when no delivery records exist
        resp_no_delivery = self.client.post(f'/api/finance/invoices/{invoice.id}/verify/', {
            'verification_status': 'VERIFIED',
            'verification_remarks': 'Approved without delivery'
        }, format='json')
        self.assertEqual(resp_no_delivery.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("No delivery records found", resp_no_delivery.data['detail'])

        # 2. Record partial delivery of only 2 units (2 * 5000 = $10,000 value accepted)
        delivery = Delivery.objects.create(
            purchase_order=self.po,
            vendor=self.vendor_1,
            status=Delivery.StatusChoices.DELIVERED,
            inspection_result=Delivery.InspectionChoices.PASSED,
            recorded_by=self.purchase_officer
        )
        DeliveryItem.objects.create(
            delivery=delivery,
            po_item=self.po_item,
            quantity_delivered=2,
            quantity_accepted=2,
            quantity_rejected=0,
            condition=DeliveryItem.ConditionChoices.SATISFACTORY
        )
        self.po.update_delivery_status()

        # 3. Attempt verification of $25,000 invoice when only $10,000 was accepted
        resp_exceed_delivery = self.client.post(f'/api/finance/invoices/{invoice.id}/verify/', {
            'verification_status': 'VERIFIED',
            'verification_remarks': 'Approved'
        }, format='json')
        self.assertEqual(resp_exceed_delivery.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeds accepted delivered goods value", resp_exceed_delivery.data['detail'])

        # 4. Now deliver 8 more units (all 10 delivered and accepted)
        delivery_2 = Delivery.objects.create(
            purchase_order=self.po,
            vendor=self.vendor_1,
            status=Delivery.StatusChoices.DELIVERED,
            inspection_result=Delivery.InspectionChoices.PASSED,
            recorded_by=self.purchase_officer
        )
        DeliveryItem.objects.create(
            delivery=delivery_2,
            po_item=self.po_item,
            quantity_delivered=8,
            quantity_accepted=8,
            quantity_rejected=0,
            condition=DeliveryItem.ConditionChoices.SATISFACTORY
        )
        self.po.update_delivery_status()
        self.assertEqual(self.po.delivery_status, PurchaseOrder.DeliveryStatusChoices.DELIVERED)

        # 5. Verification succeeds now
        resp_verified = self.client.post(f'/api/finance/invoices/{invoice.id}/verify/', {
            'verification_status': 'VERIFIED',
            'verification_remarks': 'Deliveries verified and accepted by Biomedical engineering.'
        }, format='json')
        self.assertEqual(resp_verified.status_code, status.HTTP_200_OK)
        self.assertEqual(resp_verified.data['verification_status'], 'VERIFIED')
        self.assertEqual(resp_verified.data['status'], 'VERIFIED')

    def test_payment_tracking_partial_and_full(self):
        self.client.force_authenticate(user=self.purchase_officer)

        # Complete delivery
        delivery = Delivery.objects.create(
            purchase_order=self.po,
            vendor=self.vendor_1,
            status=Delivery.StatusChoices.DELIVERED,
            inspection_result=Delivery.InspectionChoices.PASSED,
            recorded_by=self.purchase_officer
        )
        DeliveryItem.objects.create(
            delivery=delivery,
            po_item=self.po_item,
            quantity_delivered=10,
            quantity_accepted=10,
            quantity_rejected=0,
            condition=DeliveryItem.ConditionChoices.SATISFACTORY
        )
        self.po.update_delivery_status()

        # Create unverified invoice of $50,000
        invoice = Invoice.objects.create(
            purchase_order=self.po,
            vendor=self.vendor_1,
            invoice_number='INV-PAY-001',
            amount=Decimal('50000.00'),
            total_amount=Decimal('50000.00'),
            recorded_by=self.purchase_officer,
            verification_status=Invoice.VerificationStatusChoices.PENDING_VERIFICATION
        )

        # 1. Attempt payment on unverified invoice -> Must be blocked
        resp_unverified_pay = self.client.post('/api/finance/payments/', {
            'invoice': invoice.id,
            'amount_paid': '10000.00',
        }, format='json')
        self.assertEqual(resp_unverified_pay.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Payments can only be recorded for verified invoices", resp_unverified_pay.data['detail'])

        # Verify the invoice
        invoice.verification_status = Invoice.VerificationStatusChoices.VERIFIED
        invoice.status = Invoice.StatusChoices.VERIFIED
        invoice.verified_by = self.purchase_officer
        invoice.verified_at = timezone.now()
        invoice.save()

        # 2. Attempt negative or zero payment
        resp_zero_pay = self.client.post('/api/finance/payments/', {
            'invoice': invoice.id,
            'amount_paid': '0.00',
        }, format='json')
        self.assertEqual(resp_zero_pay.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Attempt payment exceeding outstanding balance
        resp_excess_pay = self.client.post('/api/finance/payments/', {
            'invoice': invoice.id,
            'amount_paid': '60000.00',
        }, format='json')
        self.assertEqual(resp_excess_pay.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("exceeds the outstanding invoice balance", resp_excess_pay.data['detail'])

        # 4. Partial Payment of $20,000
        resp_part_1 = self.client.post('/api/finance/payments/', {
            'invoice': invoice.id,
            'amount_paid': '20000.00',
            'payment_mode': 'BANK_TRANSFER',
            'transaction_reference': 'UTR123456789',
            'notes': 'First 40% installment'
        }, format='json')
        self.assertEqual(resp_part_1.status_code, status.HTTP_201_CREATED)

        invoice.refresh_from_db()
        self.assertEqual(invoice.payment_status, Invoice.PaymentStatusChoices.PARTIALLY_PAID)
        self.assertEqual(invoice.total_amount_paid, Decimal('20000.00'))
        self.assertEqual(invoice.outstanding_balance, Decimal('30000.00'))

        self.po.refresh_from_db()
        self.assertEqual(self.po.procurement_stage, 'PARTIALLY_PAID')
        self.assertFalse(self.po.status == PurchaseOrder.StatusChoices.CLOSED)

        # 5. Full remaining payment of $30,000
        resp_part_2 = self.client.post(f'/api/finance/invoices/{invoice.id}/record-payment/', {
            'amount_paid': '30000.00',
            'payment_mode': 'CHEQUE',
            'transaction_reference': 'CHQ-987654',
            'notes': 'Final payment in full'
        }, format='json')
        self.assertEqual(resp_part_2.status_code, status.HTTP_201_CREATED)

        invoice.refresh_from_db()
        self.assertEqual(invoice.payment_status, Invoice.PaymentStatusChoices.PAID)
        self.assertEqual(invoice.total_amount_paid, Decimal('50000.00'))
        self.assertEqual(invoice.outstanding_balance, Decimal('0.00'))

        # Check procurement completion
        self.po.refresh_from_db()
        self.assertEqual(self.po.procurement_stage, 'COMPLETED')
        self.assertEqual(self.po.status, PurchaseOrder.StatusChoices.CLOSED)

        self.requisition.refresh_from_db()
        self.assertEqual(self.requisition.status, Requisition.StatusChoices.COMPLETED)

    def test_procurement_history_endpoint(self):
        self.client.force_authenticate(user=self.purchase_officer)
        response = self.client.get(f'/api/procurement/purchase-orders/{self.po.id}/procurement-history/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        self.assertIn('purchase_request', data)
        self.assertIn('rfq', data)
        self.assertIn('selected_vendor', data)
        self.assertIn('purchase_order', data)
        self.assertIn('deliveries', data)
        self.assertIn('invoices', data)
        self.assertIn('payments', data)
        self.assertIn('summary', data)
        self.assertEqual(data['selected_vendor']['name'], self.vendor_1.company_name)
        self.assertEqual(data['purchase_order']['po_number'], self.po.po_number)

    def test_department_staff_forbidden_from_recording_invoice(self):
        # Department staff cannot record vendor invoices
        self.client.force_authenticate(user=self.department_staff)
        response = self.client.post('/api/finance/invoices/', {
            'purchase_order': self.po.id,
            'invoice_number': 'INV-STAFF-FORBIDDEN',
            'amount': '1000.00'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_submit_invoice_for_own_po_with_document(self):
        # Vendor submits invoice for their own PO with document upload
        self.client.force_authenticate(user=self.vendor_user_1)
        invoice_file = SimpleUploadedFile(
            "vendor_invoice_doc.pdf",
            b"%PDF-1.4 sample vendor invoice content",
            content_type="application/pdf"
        )
        response = self.client.post('/api/finance/invoices/', {
            'purchase_order': self.po.id,
            'invoice_number': 'INV-MED-2026-001',
            'invoice_date': '2026-10-27',
            'amount': '12500.00',
            'tax_amount': '625.00',
            'notes': 'Partial billing for delivery batch 1',
            'invoice_document': invoice_file
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['invoice_number'], 'INV-MED-2026-001')
        self.assertEqual(response.data['verification_status'], 'PENDING_VERIFICATION')
        self.assertEqual(response.data['vendor'], self.vendor_1.id)
        self.assertEqual(response.data['vendor_name'], self.vendor_1.company_name)
        self.assertIsNotNone(response.data.get('invoice_document_url'))

        # Check DB state
        created_invoice = Invoice.objects.get(invoice_number='INV-MED-2026-001')
        self.assertEqual(created_invoice.vendor, self.vendor_1)
        self.assertEqual(created_invoice.purchase_order, self.po)
        self.assertEqual(created_invoice.verification_status, Invoice.VerificationStatusChoices.PENDING_VERIFICATION)
        self.assertTrue(bool(created_invoice.invoice_document))

    def test_vendor_forbidden_from_submitting_invoice_for_another_vendor_po(self):
        # Vendor 1 attempts to submit an invoice for Vendor 2's purchase order
        self.client.force_authenticate(user=self.vendor_user_1)
        response = self.client.post('/api/finance/invoices/', {
            'purchase_order': self.po_2.id,  # PO belongs to Vendor 2
            'invoice_number': 'INV-UNAUTHORIZED-01',
            'invoice_date': '2026-10-27',
            'amount': '5000.00',
            'notes': 'Unauthorized attempt'
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("not authorized to submit invoices for another vendor's purchase order", response.data['detail'])

    def test_vendor_forbidden_from_verifying_invoice(self):
        # Create invoice for vendor 1
        invoice = Invoice.objects.create(
            purchase_order=self.po,
            vendor=self.vendor_1,
            invoice_number='INV-TEST-VERIFY',
            amount=Decimal('10000.00'),
            total_amount=Decimal('10000.00'),
            recorded_by=self.vendor_user_1,
            verification_status=Invoice.VerificationStatusChoices.PENDING_VERIFICATION
        )
        self.client.force_authenticate(user=self.vendor_user_1)
        response = self.client.post(f'/api/finance/invoices/{invoice.id}/verify/', {
            'verification_status': 'VERIFIED',
            'verification_remarks': 'Self-approval attempt'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_forbidden_from_recording_payment(self):
        # Create verified invoice
        invoice = Invoice.objects.create(
            purchase_order=self.po,
            vendor=self.vendor_1,
            invoice_number='INV-TEST-PAY',
            amount=Decimal('10000.00'),
            total_amount=Decimal('10000.00'),
            recorded_by=self.vendor_user_1,
            verification_status=Invoice.VerificationStatusChoices.VERIFIED
        )
        self.client.force_authenticate(user=self.vendor_user_1)
        
        # Test 1: Action on invoice endpoint
        resp1 = self.client.post(f'/api/finance/invoices/{invoice.id}/record-payment/', {
            'amount_paid': '5000.00',
            'payment_mode': 'BANK_TRANSFER'
        }, format='json')
        self.assertEqual(resp1.status_code, status.HTTP_403_FORBIDDEN)

        # Test 2: Direct POST to payment endpoint
        resp2 = self.client.post('/api/finance/payments/', {
            'invoice': invoice.id,
            'amount_paid': '5000.00',
            'payment_mode': 'BANK_TRANSFER'
        }, format='json')
        self.assertEqual(resp2.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_invoice_list_is_strictly_scoped_to_own_vendor(self):
        # Create Invoice 1 for Vendor 1
        inv1 = Invoice.objects.create(
            purchase_order=self.po,
            vendor=self.vendor_1,
            invoice_number='INV-VEND1-SCOPED',
            amount=Decimal('5000.00'),
            total_amount=Decimal('5000.00')
        )
        # Create Invoice 2 for Vendor 2
        inv2 = Invoice.objects.create(
            purchase_order=self.po_2,
            vendor=self.vendor_2,
            invoice_number='INV-VEND2-SCOPED',
            amount=Decimal('7000.00'),
            total_amount=Decimal('7000.00')
        )

        # Vendor 1 queries list
        self.client.force_authenticate(user=self.vendor_user_1)
        resp1 = self.client.get('/api/finance/invoices/')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        returned_ids_1 = [item['id'] for item in resp1.data.get('results', resp1.data)]
        self.assertIn(inv1.id, returned_ids_1)
        self.assertNotIn(inv2.id, returned_ids_1)

        # Vendor 2 queries list
        self.client.force_authenticate(user=self.vendor_user_2)
        resp2 = self.client.get('/api/finance/invoices/')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        returned_ids_2 = [item['id'] for item in resp2.data.get('results', resp2.data)]
        self.assertIn(inv2.id, returned_ids_2)
        self.assertNotIn(inv1.id, returned_ids_2)

        # Purchase Officer queries list and sees both
        self.client.force_authenticate(user=self.purchase_officer)
        resp_po = self.client.get('/api/finance/invoices/')
        self.assertEqual(resp_po.status_code, status.HTTP_200_OK)
        po_returned_ids = [item['id'] for item in resp_po.data.get('results', resp_po.data)]
        self.assertIn(inv1.id, po_returned_ids)
        self.assertIn(inv2.id, po_returned_ids)

    def test_purchase_officer_reject_invoice_with_remarks(self):
        # Create pending invoice
        invoice = Invoice.objects.create(
            purchase_order=self.po,
            vendor=self.vendor_1,
            invoice_number='INV-REJECT-TEST',
            amount=Decimal('8000.00'),
            total_amount=Decimal('8000.00'),
            verification_status=Invoice.VerificationStatusChoices.PENDING_VERIFICATION
        )

        self.client.force_authenticate(user=self.purchase_officer)
        response = self.client.post(f'/api/finance/invoices/{invoice.id}/verify/', {
            'verification_status': 'REJECTED',
            'verification_remarks': 'Tax invoice serial number does not match registered GSTIN'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['verification_status'], 'REJECTED')
        self.assertEqual(response.data['status'], 'REJECTED')

        invoice.refresh_from_db()
        self.assertEqual(invoice.verification_status, Invoice.VerificationStatusChoices.REJECTED)
        self.assertEqual(invoice.status, Invoice.StatusChoices.REJECTED)
        self.assertEqual(invoice.verification_remarks, 'Tax invoice serial number does not match registered GSTIN')
        self.assertEqual(invoice.verified_by, self.purchase_officer)

