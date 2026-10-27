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


class VendorPurchaseOrdersWorkflowTests(TestCase):
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
            name='Cardiology Department',
            defaults={'code': 'CARD'}
        )

        # Category
        self.category, _ = SupplierCategory.objects.get_or_create(
            name='Medical Equipment & Devices',
            defaults={'description': 'Medical Equipment'}
        )

        # Users
        self.committee_member = User.objects.create_user(
            username='comm_member_po',
            email='committee_po@procuramed.com',
            password='Password123!',
            role=self.committee_role,
            employee_id='PC_PO_01'
        )

        self.purchase_officer = User.objects.create_user(
            username='po_user_test',
            email='po_test@procuramed.com',
            password='Password123!',
            role=self.po_role,
            employee_id='PO_TST_01'
        )

        self.dept_user = User.objects.create_user(
            username='dept_user_test',
            email='dept_test@procuramed.com',
            password='Password123!',
            role=self.dept_role,
            department=self.dept,
            employee_id='STF_TST_01'
        )

        # Vendor 1 (Approved Winner)
        self.vendor_user_1 = User.objects.create_user(
            username='vendor1_portal_user',
            email='vendor1@procuramed-test.com',
            password='Password123!',
            role=self.vendor_role
        )
        self.vendor_1 = Vendor.objects.create(
            user=self.vendor_user_1,
            company_name='Alpha Med Supplies Co.',
            vendor_code='VEN-TEST-001',
            contact_person='Alice Walker',
            email='vendor1@procuramed-test.com',
            phone='+91 98765 00001',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_1.supplier_categories.add(self.category)

        # Vendor 2 (Competitor / Other Vendor)
        self.vendor_user_2 = User.objects.create_user(
            username='vendor2_portal_user',
            email='vendor2@procuramed-test.com',
            password='Password123!',
            role=self.vendor_role
        )
        self.vendor_2 = Vendor.objects.create(
            user=self.vendor_user_2,
            company_name='Beta Hospital Equipment Ltd.',
            vendor_code='VEN-TEST-002',
            contact_person='Bob Vance',
            email='vendor2@procuramed-test.com',
            phone='+91 98765 00002',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_2.supplier_categories.add(self.category)

        # Create Requisition & Items
        self.requisition = Requisition.objects.create(
            req_number='PR-2026-PO-01',
            title='Echocardiogram Machine Premium',
            category='Medical Equipment & Devices',
            department=self.dept,
            requested_by=self.dept_user,
            assigned_committee_member=self.committee_member,
            assigned_purchase_officer=self.purchase_officer,
            estimated_budget=Decimal('850000.00'),
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
            justification='Critical diagnostic equipment required for cath lab.'
        )
        self.req_item = RequisitionItem.objects.create(
            requisition=self.requisition,
            item_name='Echocardiogram Machine Premium',
            specifications='4D ultrasound with pediatric & adult probes',
            quantity=1,
            estimated_unit_price=Decimal('850000.00')
        )

        # Create RFQ
        self.rfq = QuotationRequest.objects.create(
            requisition=self.requisition,
            rfq_number='RFQ-2026-PO-01',
            title='RFQ - Echocardiogram Machine Premium',
            status=QuotationRequest.StatusChoices.OPEN,
            issue_date=timezone.now().date(),
            due_date=timezone.now().date() + timedelta(days=7),
            delivery_location='Cardiology Cath Lab 2, 2nd Floor',
            created_by=self.purchase_officer
        )
        self.rfq_item = RFQItem.objects.create(
            quotation_request=self.rfq,
            item_name='Echocardiogram Machine Premium',
            technical_specifications='4D ultrasound with probes',
            quantity=1
        )
        RFQVendorInvitation.objects.create(
            quotation_request=self.rfq,
            vendor=self.vendor_1,
            status=RFQVendorInvitation.InvitationStatus.INVITED
        )
        RFQVendorInvitation.objects.create(
            quotation_request=self.rfq,
            vendor=self.vendor_2,
            status=RFQVendorInvitation.InvitationStatus.INVITED
        )

        # Quotation 1 (Vendor 1)
        self.quote_1 = Quotation.objects.create(
            quotation_request=self.rfq,
            vendor=self.vendor_1,
            quotation_number='QT-ALPHA-01',
            total_amount=Decimal('820000.00'),
            lead_time_days=10,
            status=Quotation.StatusChoices.SUBMITTED,
            quotation_document=self.make_valid_pdf("alpha_quote.pdf")
        )
        QuotationItem.objects.create(
            quotation=self.quote_1,
            item_name='Echocardiogram Machine Premium',
            specification='4D probe, 2-year warranty included',
            quantity=1,
            unit_price=Decimal('820000.00'),
            total_price=Decimal('820000.00')
        )

        # Quotation 2 (Vendor 2)
        self.quote_2 = Quotation.objects.create(
            quotation_request=self.rfq,
            vendor=self.vendor_2,
            quotation_number='QT-BETA-02',
            total_amount=Decimal('845000.00'),
            lead_time_days=15,
            status=Quotation.StatusChoices.SUBMITTED,
            quotation_document=self.make_valid_pdf("beta_quote.pdf")
        )
        QuotationItem.objects.create(
            quotation=self.quote_2,
            item_name='Echocardiogram Machine Premium',
            specification='Standard probe package',
            quantity=1,
            unit_price=Decimal('845000.00'),
            total_price=Decimal('845000.00')
        )

    def test_complete_vendor_po_workflow_end_to_end(self):
        """
        Comprehensive test covering all 8 requirements:
        1. Committee selects and approves Vendor 1.
        2. Purchase Officer creates PO with vendor ID.
        3. Vendor 1 sees PO in /purchase-orders/ with required fields.
        4. Vendor 1 views order details.
        5. Vendor 2 CANNOT view Vendor 1's PO (404/403).
        6. Vendor 1 acknowledges order (status updates to ACKNOWLEDGED, timestamp saved).
        7. Duplicate acknowledgment is rejected.
        8. Purchase Officer sees acknowledgment status, timestamp, portal visibility.
        """
        # Step 1: Procurement Committee selects and approves Vendor 1
        self.client.force_authenticate(user=self.committee_member)
        select_url = f'/api/procurement/quotations/{self.quote_1.id}/select-vendor/'
        select_resp = self.client.post(select_url, {
            'remarks': 'Approved lowest qualified quote with comprehensive warranty.'
        }, format='json')
        self.assertEqual(select_resp.status_code, status.HTTP_200_OK)

        self.requisition.refresh_from_db()
        self.assertEqual(self.requisition.selected_vendor, self.vendor_1)
        self.assertEqual(self.requisition.selected_quotation, self.quote_1)

        # Step 2: Purchase Officer creates and issues Purchase Order
        self.client.force_authenticate(user=self.purchase_officer)
        po_create_url = '/api/procurement/purchase-orders/'
        po_payload = {
            'requisition': self.requisition.id,
            'quotation': self.quote_1.id,
            'vendor': self.vendor_1.id,
            'expected_delivery_date': (timezone.now().date() + timedelta(days=10)).isoformat(),
            'delivery_location': 'Cardiology Cath Lab 2, 2nd Floor',
            'delivery_instructions': 'Receiving hours 08:00 - 16:00. Prior call required.',
            'terms_and_conditions': 'Payment within 30 days of inspection certification.',
            'total_amount': '820000.00'
        }
        po_resp = self.client.post(po_create_url, po_payload, format='json')
        self.assertEqual(po_resp.status_code, status.HTTP_201_CREATED)
        po_data = po_resp.data
        po_id = po_data['id']
        po_number = po_data['po_number']
        self.assertTrue(po_number.startswith('PO-'))
        self.assertEqual(po_data['vendor'], self.vendor_1.id)

        # Step 3: Order automatically appears in Vendor 1 portal
        self.client.force_authenticate(user=self.vendor_user_1)
        vendor1_list_resp = self.client.get('/api/procurement/purchase-orders/')
        self.assertEqual(vendor1_list_resp.status_code, status.HTTP_200_OK)
        v1_results = vendor1_list_resp.data.get('results', vendor1_list_resp.data)
        self.assertEqual(len(v1_results), 1)

        v1_po = v1_results[0]
        self.assertEqual(v1_po['id'], po_id)
        self.assertEqual(v1_po['po_number'], po_number)
        self.assertEqual(v1_po['requisition_details']['req_number'], self.requisition.req_number)
        self.assertEqual(Decimal(str(v1_po['total_amount'])), Decimal('820000.00'))
        self.assertEqual(v1_po['delivery_location'], 'Cardiology Cath Lab 2, 2nd Floor')
        self.assertEqual(v1_po['delivery_instructions'], 'Receiving hours 08:00 - 16:00. Prior call required.')
        self.assertEqual(v1_po['acknowledgment_status'], 'Pending Acknowledgment')
        self.assertFalse(v1_po['is_acknowledged'])

        # Verify ordered items
        self.assertEqual(len(v1_po['items']), 1)
        self.assertEqual(v1_po['items'][0]['item_name'], 'Echocardiogram Machine Premium')
        self.assertEqual(v1_po['items'][0]['quantity'], 1)
        self.assertEqual(Decimal(str(v1_po['items'][0]['unit_price'])), Decimal('820000.00'))

        # Step 4: Vendor 1 can view detailed order by ID
        vendor1_detail_resp = self.client.get(f'/api/procurement/purchase-orders/{po_id}/')
        self.assertEqual(vendor1_detail_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(vendor1_detail_resp.data['po_number'], po_number)
        # Viewing does NOT automatically mark as acknowledged
        self.assertFalse(vendor1_detail_resp.data['is_acknowledged'])

        # Step 5: Vendor 2 CANNOT see or view Vendor 1's Purchase Order
        self.client.force_authenticate(user=self.vendor_user_2)
        vendor2_list_resp = self.client.get('/api/procurement/purchase-orders/')
        self.assertEqual(vendor2_list_resp.status_code, status.HTTP_200_OK)
        v2_results = vendor2_list_resp.data.get('results', vendor2_list_resp.data)
        self.assertEqual(len(v2_results), 0)

        vendor2_detail_resp = self.client.get(f'/api/procurement/purchase-orders/{po_id}/')
        self.assertIn(vendor2_detail_resp.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

        # Step 6: Vendor 2 CANNOT acknowledge Vendor 1's Purchase Order
        vendor2_ack_resp = self.client.post(f'/api/procurement/purchase-orders/{po_id}/acknowledge/', {
            'notes': 'Intruder trying to acknowledge'
        })
        self.assertIn(vendor2_ack_resp.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

        # Step 7: Vendor 1 acknowledges the Purchase Order
        self.client.force_authenticate(user=self.vendor_user_1)
        ack_resp = self.client.post(f'/api/procurement/purchase-orders/{po_id}/acknowledge/', {
            'notes': 'Order accepted, scheduled for delivery on Nov 5th.'
        }, format='json')
        self.assertEqual(ack_resp.status_code, status.HTTP_200_OK)
        ack_data = ack_resp.data
        self.assertTrue(ack_data['is_acknowledged'])
        self.assertIsNotNone(ack_data['acknowledged_at'])
        self.assertEqual(ack_data['acknowledgment_status'], 'Vendor Acknowledged')
        self.assertIn(ack_data['status'], ['ACKNOWLEDGED', 'VENDOR_ACKNOWLEDGED'])

        # Step 8: Duplicate acknowledgment is prevented
        dup_ack_resp = self.client.post(f'/api/procurement/purchase-orders/{po_id}/acknowledge/', {
            'notes': 'Trying duplicate acknowledgment'
        }, format='json')
        self.assertEqual(dup_ack_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('already been acknowledged', dup_ack_resp.data['detail'])

        # Step 9: Purchase Officer can see the updated acknowledgment status, timestamp & portal visibility
        self.client.force_authenticate(user=self.purchase_officer)
        po_get_resp = self.client.get(f'/api/procurement/purchase-orders/{po_id}/')
        self.assertEqual(po_get_resp.status_code, status.HTTP_200_OK)
        po_view = po_get_resp.data
        self.assertTrue(po_view['portal_visible'])
        self.assertTrue(po_view['is_acknowledged'])
        self.assertEqual(po_view['acknowledgment_status'], 'Vendor Acknowledged')
        self.assertIsNotNone(po_view['acknowledged_at'])
        self.assertEqual(po_view['vendor_details']['company_name'], 'Alpha Med Supplies Co.')

        # Step 10: Vendor cannot modify or delete the Purchase Order
        self.client.force_authenticate(user=self.vendor_user_1)
        patch_resp = self.client.patch(f'/api/procurement/purchase-orders/{po_id}/', {
            'total_amount': '999999.00'
        }, format='json')
        self.assertEqual(patch_resp.status_code, status.HTTP_403_FORBIDDEN)

        delete_resp = self.client.delete(f'/api/procurement/purchase-orders/{po_id}/')
        self.assertEqual(delete_resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_isolation_with_multiple_purchase_orders(self):
        """
        Verify that multiple vendors only see their own respective orders in their portals.
        """
        po_1 = PurchaseOrder.objects.create(
            requisition=self.requisition,
            quotation=self.quote_1,
            vendor=self.vendor_1,
            created_by=self.purchase_officer,
            total_amount=Decimal('820000.00'),
            delivery_location='Cath Lab Room 101',
            delivery_instructions='Handle with medical care',
            status=PurchaseOrder.StatusChoices.ISSUED
        )
        PurchaseOrderItem.objects.create(
            purchase_order=po_1,
            item_name='Cath Item 1',
            quantity=1,
            unit_price=Decimal('820000.00')
        )

        po_2 = PurchaseOrder.objects.create(
            requisition=None,
            quotation=self.quote_2,
            vendor=self.vendor_2,
            created_by=self.purchase_officer,
            total_amount=Decimal('845000.00'),
            delivery_location='Biomedical Bay 2',
            delivery_instructions='Standard unloading',
            status=PurchaseOrder.StatusChoices.ISSUED
        )
        PurchaseOrderItem.objects.create(
            purchase_order=po_2,
            item_name='Biomedical Item 2',
            quantity=1,
            unit_price=Decimal('845000.00')
        )

        # Vendor 1 queries PO list -> sees only PO 1
        self.client.force_authenticate(user=self.vendor_user_1)
        resp1 = self.client.get('/api/procurement/purchase-orders/')
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        results1 = resp1.data.get('results', resp1.data)
        self.assertEqual(len(results1), 1)
        self.assertEqual(results1[0]['id'], po_1.id)
        self.assertEqual(results1[0]['po_number'], po_1.po_number)

        # Vendor 2 queries PO list -> sees only PO 2
        self.client.force_authenticate(user=self.vendor_user_2)
        resp2 = self.client.get('/api/procurement/purchase-orders/')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        results2 = resp2.data.get('results', resp2.data)
        self.assertEqual(len(results2), 1)
        self.assertEqual(results2[0]['id'], po_2.id)
        self.assertEqual(results2[0]['po_number'], po_2.po_number)

        # Cross-access is blocked: Vendor 1 trying to access PO 2
        self.client.force_authenticate(user=self.vendor_user_1)
        resp1_cross = self.client.get(f'/api/procurement/purchase-orders/{po_2.id}/')
        self.assertIn(resp1_cross.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

        # Cross-access is blocked: Vendor 2 trying to access PO 1
        self.client.force_authenticate(user=self.vendor_user_2)
        resp2_cross = self.client.get(f'/api/procurement/purchase-orders/{po_1.id}/')
        self.assertIn(resp2_cross.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

    def test_unauthenticated_access_is_blocked(self):
        """
        Unauthenticated users cannot access purchase orders.
        """
        self.client.logout()
        resp = self.client.get('/api/procurement/purchase-orders/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

