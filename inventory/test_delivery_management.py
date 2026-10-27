from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import Role, Department
from procurement.models import Requisition, RequisitionItem, PurchaseOrder, PurchaseOrderItem
from vendors.models import Vendor, SupplierCategory
from inventory.models import Delivery, DeliveryItem

User = get_user_model()


class DeliveryManagementWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Roles
        self.po_role, _ = Role.objects.get_or_create(
            name='Purchase Officer',
            defaults={'description': 'Purchase Officer'}
        )
        self.vendor_role, _ = Role.objects.get_or_create(
            name='Vendor',
            defaults={'description': 'Vendor Account'}
        )
        self.dept_role, _ = Role.objects.get_or_create(
            name='Department Staff',
            defaults={'description': 'Staff Member'}
        )

        # Department & Category
        self.dept, _ = Department.objects.get_or_create(
            name='ICU Department',
            defaults={'code': 'ICU'}
        )
        self.category, _ = SupplierCategory.objects.get_or_create(
            name='Biomedical Devices',
            defaults={'description': 'Biomedical'}
        )

        # Users
        self.purchase_officer = User.objects.create_user(
            username='po_delivery_officer',
            email='po_deliv@procuramed.com',
            password='Password123!',
            role=self.po_role,
            employee_id='PO_DELIV_01'
        )
        self.dept_staff = User.objects.create_user(
            username='icu_staff_test',
            email='icu_staff@procuramed.com',
            password='Password123!',
            role=self.dept_role,
            employee_id='STF_ICU_01'
        )

        # Vendors
        self.vendor_user_1 = User.objects.create_user(
            username='biomed_supplier_1',
            email='vendor1@procuramed.com',
            password='Password123!',
            role=self.vendor_role
        )
        self.vendor_1 = Vendor.objects.create(
            user=self.vendor_user_1,
            company_name='Apex Biomed Solutions',
            contact_person='David Miller',
            email='vendor1@procuramed.com',
            phone='+91 9876543210',
            vendor_code='VND-DELIV-001',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_1.supplier_categories.add(self.category)

        self.vendor_user_2 = User.objects.create_user(
            username='biomed_supplier_2',
            email='vendor2@procuramed.com',
            password='Password123!',
            role=self.vendor_role
        )
        self.vendor_2 = Vendor.objects.create(
            user=self.vendor_user_2,
            company_name='MedTech Global Ltd',
            contact_person='Sarah Connor',
            email='vendor2@procuramed.com',
            phone='+91 9876543211',
            vendor_code='VND-DELIV-002',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor_2.supplier_categories.add(self.category)

        # Requisition
        self.req = Requisition.objects.create(
            title='ICU Ventilators & Monitors',
            department=self.dept,
            requested_by=self.dept_staff,
            assigned_purchase_officer=self.purchase_officer,
            priority='HIGH',
            estimated_budget=Decimal('500000.00'),
            status=Requisition.StatusChoices.PO_CREATED
        )

        # Purchase Order with multiple items
        self.po = PurchaseOrder.objects.create(
            requisition=self.req,
            vendor=self.vendor_1,
            created_by=self.purchase_officer,
            total_amount=Decimal('500000.00'),
            delivery_location='Hospital ICU Receiving Dock Bay 3',
            status=PurchaseOrder.StatusChoices.ISSUED
        )
        self.po_item_1 = PurchaseOrderItem.objects.create(
            purchase_order=self.po,
            item_name='ICU Multi-Parameter Patient Monitor',
            specification='12-inch color TFT display, ECG, SpO2, NIBP, Temp',
            quantity=10,
            unit_price=Decimal('25000.00'),
            total_price=Decimal('250000.00')
        )
        self.po_item_2 = PurchaseOrderItem.objects.create(
            purchase_order=self.po,
            item_name='High-Flow Oxygen Cannula Unit',
            specification='Heated humidifier system with integrated flow generator',
            quantity=5,
            unit_price=Decimal('50000.00'),
            total_price=Decimal('250000.00')
        )

    def test_vendor_view_own_pos_and_isolation(self):
        """Vendor 1 can view PO 1, but Vendor 2 cannot see Vendor 1's PO."""
        self.client.force_authenticate(user=self.vendor_user_1)
        response = self.client.get('/api/procurement/purchase-orders/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        po_ids = [item['id'] for item in response.data.get('results', response.data)]
        self.assertIn(self.po.id, po_ids)

        # Vendor 2 cannot see Vendor 1's PO
        self.client.force_authenticate(user=self.vendor_user_2)
        response2 = self.client.get(f'/api/procurement/purchase-orders/{self.po.id}/')
        self.assertIn(response2.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_vendor_update_dispatch_status(self):
        """Vendor can update dispatch status to Preparing, Dispatched, Delivered to Hospital."""
        self.client.force_authenticate(user=self.vendor_user_1)

        # 1. Update to Preparing
        resp1 = self.client.post(
            f'/api/procurement/purchase-orders/{self.po.id}/update-dispatch-status/',
            {'dispatch_status': 'PREPARING', 'notes': 'Assembly and packaging started'}
        )
        self.assertEqual(resp1.status_code, status.HTTP_200_OK)
        self.po.refresh_from_db()
        self.assertEqual(self.po.vendor_dispatch_status, 'PREPARING')
        self.assertEqual(self.po.vendor_dispatch_notes, 'Assembly and packaging started')
        # Crucial: Delivery status must NOT be hospital-delivered!
        self.assertEqual(self.po.delivery_status, PurchaseOrder.DeliveryStatusChoices.AWAITING_DELIVERY)

        # 2. Update to Dispatched
        resp2 = self.client.post(
            f'/api/procurement/purchase-orders/{self.po.id}/update-dispatch-status/',
            {
                'dispatch_status': 'DISPATCHED',
                'tracking_number': 'BLUEDART-882910',
                'notes': 'Dispatched via BlueDart express cargo'
            }
        )
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.po.refresh_from_db()
        self.assertEqual(self.po.vendor_dispatch_status, 'DISPATCHED')
        self.assertEqual(self.po.vendor_tracking_number, 'BLUEDART-882910')
        self.assertIsNotNone(self.po.vendor_dispatched_at)
        # Hospital delivery status remains Awaiting Delivery
        self.assertEqual(self.po.delivery_status, PurchaseOrder.DeliveryStatusChoices.AWAITING_DELIVERY)

        # 3. Update to Delivered to Hospital (Vendor claim)
        resp3 = self.client.post(
            f'/api/procurement/purchase-orders/{self.po.id}/update-dispatch-status/',
            {
                'dispatch_status': 'DELIVERED_TO_HOSPITAL',
                'notes': 'Consignment delivered at hospital gate'
            }
        )
        self.assertEqual(resp3.status_code, status.HTTP_200_OK)
        self.po.refresh_from_db()
        self.assertEqual(self.po.vendor_dispatch_status, 'DELIVERED_TO_HOSPITAL')
        # Crucial check: Hospital delivery receipt has NOT been recorded by Purchase Officer yet!
        self.assertEqual(self.po.delivery_status, PurchaseOrder.DeliveryStatusChoices.AWAITING_DELIVERY)

    def test_vendor_cannot_update_other_vendor_po(self):
        """Vendor 2 cannot update dispatch status for Vendor 1's PO."""
        self.client.force_authenticate(user=self.vendor_user_2)
        resp = self.client.post(
            f'/api/procurement/purchase-orders/{self.po.id}/update-dispatch-status/',
            {'dispatch_status': 'DISPATCHED'}
        )
        self.assertIn(resp.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

    def test_staff_cannot_record_delivery(self):
        """Department Staff cannot confirm hospital delivery receipt (only Purchase Officer can)."""
        self.client.force_authenticate(user=self.dept_staff)
        resp = self.client.post(
            f'/api/procurement/purchase-orders/{self.po.id}/record-delivery/',
            {
                'delivery_date': '2026-10-27',
                'items': [{'po_item': self.po_item_1.id, 'quantity_delivered': 5}]
            }
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_partial_delivery_and_remaining_quantities(self):
        """Purchase Officer records partial delivery; received and remaining quantities update accurately."""
        self.client.force_authenticate(user=self.purchase_officer)

        # Deliver 6 out of 10 monitors, and 2 out of 5 oxygen cannula units
        payload = {
            'delivery_date': '2026-10-27',
            'tracking_number': 'BLUEDART-882910',
            'inspection_result': 'PASSED',
            'inspection_notes': 'Initial batch passed electrical safety checks',
            'remarks': 'Received at receiving dock bay 3',
            'items': [
                {
                    'po_item': self.po_item_1.id,
                    'quantity_delivered': 6,
                    'condition': 'SATISFACTORY',
                    'remarks': '6 units verified'
                },
                {
                    'po_item': self.po_item_2.id,
                    'quantity_delivered': 2,
                    'condition': 'SATISFACTORY',
                    'remarks': '2 units verified'
                }
            ]
        }
        resp = self.client.post(f'/api/procurement/purchase-orders/{self.po.id}/record-delivery/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.po.refresh_from_db()
        self.po_item_1.refresh_from_db()
        self.po_item_2.refresh_from_db()

        # PO Delivery status must be PARTIALLY_DELIVERED
        self.assertEqual(self.po.delivery_status, PurchaseOrder.DeliveryStatusChoices.PARTIALLY_DELIVERED)

        # Quantity calculations
        self.assertEqual(self.po_item_1.total_quantity_received, 6)
        self.assertEqual(self.po_item_1.remaining_quantity, 4)
        self.assertEqual(self.po_item_2.total_quantity_received, 2)
        self.assertEqual(self.po_item_2.remaining_quantity, 3)

        # Delivery record created
        self.assertEqual(Delivery.objects.filter(purchase_order=self.po).count(), 1)
        deliv = Delivery.objects.filter(purchase_order=self.po).first()
        self.assertEqual(deliv.recorded_by, self.purchase_officer)
        self.assertEqual(deliv.items.count(), 2)

    def test_excessive_and_negative_quantity_validation(self):
        """Prevent negative, zero, or excessive delivery quantities."""
        self.client.force_authenticate(user=self.purchase_officer)

        # 1. Negative quantity
        resp_neg = self.client.post(
            f'/api/procurement/purchase-orders/{self.po.id}/record-delivery/',
            {
                'delivery_date': '2026-10-27',
                'items': [{'po_item': self.po_item_1.id, 'quantity_delivered': -2}]
            },
            format='json'
        )
        self.assertEqual(resp_neg.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('greater than zero', resp_neg.data.get('detail', ''))

        # 2. Zero quantity
        resp_zero = self.client.post(
            f'/api/procurement/purchase-orders/{self.po.id}/record-delivery/',
            {
                'delivery_date': '2026-10-27',
                'items': [{'po_item': self.po_item_1.id, 'quantity_delivered': 0}]
            },
            format='json'
        )
        self.assertEqual(resp_zero.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Excessive quantity (> 10 ordered)
        resp_excess = self.client.post(
            f'/api/procurement/purchase-orders/{self.po.id}/record-delivery/',
            {
                'delivery_date': '2026-10-27',
                'items': [{'po_item': self.po_item_1.id, 'quantity_delivered': 15}]
            },
            format='json'
        )
        self.assertEqual(resp_excess.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('exceeds remaining', resp_excess.data.get('detail', ''))

    def test_full_delivery_completion(self):
        """Completing all ordered quantities automatically sets delivery_status to DELIVERED."""
        self.client.force_authenticate(user=self.purchase_officer)

        # Deliver first batch
        self.client.post(
            f'/api/procurement/purchase-orders/{self.po.id}/record-delivery/',
            {
                'items': [
                    {'po_item': self.po_item_1.id, 'quantity_delivered': 6},
                    {'po_item': self.po_item_2.id, 'quantity_delivered': 2}
                ]
            },
            format='json'
        )

        # Deliver remaining quantities (4 monitors and 3 cannula units)
        resp2 = self.client.post(
            f'/api/procurement/purchase-orders/{self.po.id}/record-delivery/',
            {
                'items': [
                    {'po_item': self.po_item_1.id, 'quantity_delivered': 4},
                    {'po_item': self.po_item_2.id, 'quantity_delivered': 3}
                ]
            },
            format='json'
        )
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)

        self.po.refresh_from_db()
        self.po_item_1.refresh_from_db()
        self.po_item_2.refresh_from_db()

        self.assertEqual(self.po.delivery_status, PurchaseOrder.DeliveryStatusChoices.DELIVERED)
        self.assertEqual(self.po_item_1.remaining_quantity, 0)
        self.assertEqual(self.po_item_2.remaining_quantity, 0)

    def test_damaged_or_rejected_items_record_delivery_issue(self):
        """Damaged or rejected items are automatically flagged as DELIVERY_ISSUE."""
        self.client.force_authenticate(user=self.purchase_officer)

        resp = self.client.post(
            f'/api/procurement/purchase-orders/{self.po.id}/record-delivery/',
            {
                'delivery_date': '2026-10-27',
                'inspection_result': 'DAMAGED',
                'inspection_notes': 'Display screen cracked during transit',
                'items': [
                    {
                        'po_item': self.po_item_1.id,
                        'quantity_delivered': 3,
                        'condition': 'DAMAGED',
                        'remarks': 'Cracked outer display casing'
                    }
                ]
            },
            format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        self.po.refresh_from_db()
        self.assertEqual(self.po.delivery_status, PurchaseOrder.DeliveryStatusChoices.DELIVERY_ISSUE)

        deliv = Delivery.objects.filter(purchase_order=self.po).first()
        self.assertEqual(deliv.status, Delivery.StatusChoices.DELIVERY_ISSUE)
        self.assertIn(deliv.inspection_result, [Delivery.InspectionChoices.DAMAGED, Delivery.InspectionChoices.DELIVERY_ISSUE])

    def test_delivery_history_in_purchase_order_details(self):
        """Delivery history is included in the purchase order details serialization."""
        self.client.force_authenticate(user=self.purchase_officer)

        # Record a delivery batch
        self.client.post(
            f'/api/procurement/purchase-orders/{self.po.id}/record-delivery/',
            {
                'delivery_date': '2026-10-27',
                'tracking_number': 'EXP-9921',
                'inspection_result': 'PASSED',
                'remarks': 'Batch 1 receipt',
                'items': [{'po_item': self.po_item_1.id, 'quantity_delivered': 5}]
            },
            format='json'
        )

        # Fetch PO details
        resp = self.client.get(f'/api/procurement/purchase-orders/{self.po.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        history = resp.data.get('delivery_history', [])
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]['tracking_number'], 'EXP-9921')
        self.assertEqual(len(history[0]['items']), 1)
        self.assertEqual(history[0]['items'][0]['quantity_delivered'], 5)

        # Vendor also sees delivery history on their PO details
        self.client.force_authenticate(user=self.vendor_user_1)
        resp_v = self.client.get(f'/api/procurement/purchase-orders/{self.po.id}/')
        self.assertEqual(resp_v.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp_v.data.get('delivery_history', [])), 1)

    def test_dashboards_reflect_real_database_counts(self):
        """Purchase Officer and Vendor dashboards update counts using real database records."""
        self.client.force_authenticate(user=self.purchase_officer)

        # Initial PO dashboard check
        po_dash_resp = self.client.get('/api/procurement/purchase-officer-dashboard/')
        self.assertEqual(po_dash_resp.status_code, status.HTTP_200_OK)
        stats = po_dash_resp.data.get('summary_cards', {})
        self.assertGreaterEqual(stats.get('approved_pos', 0), 1)
        self.assertGreaterEqual(stats.get('pending_deliveries', 0), 1)

        # Vendor dashboard check
        self.client.force_authenticate(user=self.vendor_user_1)
        v_dash_resp = self.client.get('/api/vendors/dashboard-stats/')
        self.assertEqual(v_dash_resp.status_code, status.HTTP_200_OK)
        v_stats = v_dash_resp.data.get('stats', {})
        self.assertGreaterEqual(v_stats.get('approved_pos', 0), 1)
        self.assertGreaterEqual(v_stats.get('pending_deliveries', 0), 1)
