from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from django.utils import timezone

from accounts.models import Role, Department, AuditLog
from vendors.models import Vendor, SupplierCategory
from procurement.models import (
    Requisition, RequisitionItem, QuotationRequest, RFQItem,
    RFQVendorInvitation, Quotation, PurchaseOrder
)
from inventory.models import Delivery

User = get_user_model()


class VendorDashboardViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Create Roles
        self.vendor_role, _ = Role.objects.get_or_create(
            name='Vendor',
            defaults={'description': 'Approved Supplier Vendor', 'is_active': True}
        )
        self.staff_role, _ = Role.objects.get_or_create(
            name='Department Staff',
            defaults={'description': 'Department Staff', 'is_active': True}
        )

        # 2. Create Department
        self.department = Department.objects.create(
            name='Cardiology',
            code='CARD-01'
        )

        # 3. Create Users
        self.staff_user = User.objects.create_user(
            username='cardio_staff',
            email='cardio_staff@hospital.com',
            password='StaffPassword@123',
            role=self.staff_role,
            department=self.department,
            is_active=True
        )

        self.vendor_user = User.objects.create_user(
            username='medtech_vendor',
            email='vendor@medtech.com',
            password='VendorPassword@123',
            role=self.vendor_role,
            is_active=True
        )

        # 4. Create Supplier Category
        self.category, _ = SupplierCategory.objects.get_or_create(
            name=SupplierCategory.CategoryChoices.BIOMEDICAL_EQUIPMENT,
            defaults={'description': 'Biomedical Equipment'}
        )

        # 5. Create Vendor Profile
        self.vendor = Vendor.objects.create(
            user=self.vendor_user,
            company_name='MedTech Solutions Ltd',
            contact_person='John Doe',
            email='vendor@medtech.com',
            phone='+919876543210',
            status=Vendor.StatusChoices.ACTIVE,
            is_active=True
        )
        self.vendor.supplier_categories.add(self.category)

    def test_vendor_dashboard_empty_state_success(self):
        """Tests that a vendor with no activity can load the dashboard cleanly with 200 OK."""
        self.client.force_authenticate(user=self.vendor_user)
        response = self.client.get('/api/vendors/dashboard-stats/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['vendor']['company_name'], 'MedTech Solutions Ltd')
        self.assertEqual(response.data['stats']['open_opportunities'], 0)
        self.assertEqual(response.data['stats']['quotations_submitted'], 0)
        self.assertEqual(len(response.data['opportunities']), 0)
        self.assertEqual(len(response.data['recent_quotations']), 0)
        self.assertEqual(len(response.data['recent_purchase_orders']), 0)
        self.assertEqual(len(response.data['recent_deliveries']), 0)

    def test_vendor_dashboard_with_open_rfqs_and_requisitions(self):
        """
        Regression test: Verifies that open RFQs linked to requisitions (with items)
        do not crash with AttributeError and properly populate opportunity fields.
        """
        # Create Requisition
        req = Requisition.objects.create(
            title='ECG Monitor Requirement',
            department=self.department,
            requested_by=self.staff_user,
            priority=Requisition.PriorityChoices.HIGH,
            status=Requisition.StatusChoices.APPROVED
        )
        req_item = RequisitionItem.objects.create(
            requisition=req,
            item_name='12-Lead ECG Machine',
            quantity=2,
            estimated_unit_price=Decimal('150000.00'),
            category='Biomedical Equipment'
        )

        # Create Quotation Request (RFQ)
        rfq = QuotationRequest.objects.create(
            requisition=req,
            created_by=self.staff_user,
            title='RFQ for ECG Machines',
            due_date=timezone.now().date() + timezone.timedelta(days=14),
            status=QuotationRequest.StatusChoices.OPEN
        )
        rfq_item = RFQItem.objects.create(
            quotation_request=rfq,
            requisition_item=req_item,
            item_name='12-Lead ECG Machine',
            quantity=2,
            unit_of_measurement='Piece'
        )

        # Invite vendor
        invitation = RFQVendorInvitation.objects.create(
            quotation_request=rfq,
            vendor=self.vendor,
            status=RFQVendorInvitation.InvitationStatus.INVITED
        )

        # Create PO and Delivery
        po = PurchaseOrder.objects.create(
            vendor=self.vendor,
            created_by=self.staff_user,
            total_amount=Decimal('300000.00'),
            status=PurchaseOrder.StatusChoices.ISSUED
        )
        delivery = Delivery.objects.create(
            purchase_order=po,
            vendor=self.vendor,
            status=Delivery.StatusChoices.DISPATCHED
        )

        # Create Audit Log
        AuditLog.objects.create(
            user=self.vendor_user,
            action='Vendor Login',
            module='Vendor Portal',
            description=f'Vendor MedTech Solutions Ltd logged in.'
        )

        # Fetch Vendor Dashboard
        self.client.force_authenticate(user=self.vendor_user)
        response = self.client.get('/api/vendors/dashboard-stats/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['stats']['open_opportunities'], 1)
        self.assertEqual(response.data['stats']['approved_pos'], 1)
        self.assertEqual(response.data['stats']['pending_deliveries'], 1)

        # Verify opportunity fields
        opps = response.data['opportunities']
        self.assertEqual(len(opps), 1)
        opp = opps[0]
        self.assertEqual(opp['id'], rfq.id)
        self.assertEqual(opp['rfq_number'], rfq.rfq_number)
        self.assertEqual(opp['department'], 'Cardiology')
        self.assertEqual(opp['requisition_number'], req.req_number)
        self.assertEqual(opp['req_number'], req.req_number)
        self.assertEqual(opp['item_name'], '12-Lead ECG Machine')
        self.assertEqual(opp['quantity'], 2)
        self.assertEqual(opp['unit'], 'Piece')
        self.assertEqual(opp['invitation_status'], 'INVITED')
        self.assertFalse(opp['has_quoted'])

        # Verify deliveries and purchase orders
        self.assertEqual(len(response.data['recent_purchase_orders']), 1)
        self.assertEqual(response.data['recent_purchase_orders'][0]['po_number'], po.po_number)
        self.assertEqual(len(response.data['recent_deliveries']), 1)
        self.assertEqual(response.data['recent_deliveries'][0]['delivery_number'], delivery.delivery_number)

    def test_vendor_dashboard_unauthenticated_forbidden(self):
        """Unauthenticated requests are rejected with 401."""
        response = self.client.get('/api/vendors/dashboard-stats/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_vendor_dashboard_non_vendor_forbidden(self):
        """Staff user without vendor role is rejected with 403."""
        self.client.force_authenticate(user=self.staff_user)
        response = self.client.get('/api/vendors/dashboard-stats/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_vendor_dashboard_inactive_vendor_rejected(self):
        """Vendor with is_active=False cannot access portal."""
        self.vendor.is_active = False
        self.vendor.save()

        self.client.force_authenticate(user=self.vendor_user)
        response = self.client.get('/api/vendors/dashboard-stats/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
