from decimal import Decimal
from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from accounts.models import AuditLog
from procurement.models import PurchaseOrder
from vendors.models import Vendor
from .models import Invoice, Payment
from .serializers import InvoiceSerializer, PaymentSerializer
from .permissions import IsInvoiceAuthorizedUser, IsPurchaseOfficerOrFinanceOrAdmin
from .filters import InvoiceFilter, PaymentFilter


class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsInvoiceAuthorizedUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_class = InvoiceFilter
    search_fields = ['invoice_number', 'remarks', 'purchase_order__po_number', 'vendor__company_name']
    ordering_fields = ['invoice_date', 'total_amount', 'created_at']

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Invoice.objects.none()

        qs = Invoice.objects.select_related(
            'purchase_order', 'purchase_order__vendor', 'vendor', 'verified_by', 'recorded_by'
        ).prefetch_related('payments')

        r_name = user.role.name.lower() if user.role else ''
        is_vendor = 'vendor' in r_name or hasattr(user, 'vendor_profile')

        if is_vendor:
            vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
            if not vendor:
                return Invoice.objects.none()
            return qs.filter(vendor=vendor).order_by('-created_at')

        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_vendor = 'vendor' in r_name or hasattr(user, 'vendor_profile')

        po_id = request.data.get('purchase_order')
        if not po_id:
            return Response({'detail': 'Purchase order is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            po = PurchaseOrder.objects.get(pk=po_id)
        except PurchaseOrder.DoesNotExist:
            return Response({'detail': f'Purchase Order {po_id} does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce vendor authorization: prevent vendors from accessing or submitting invoices for another vendor's PO
        if is_vendor:
            vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
            if not vendor:
                return Response({'detail': 'Vendor profile not found for this user.'}, status=status.HTTP_403_FORBIDDEN)
            if po.vendor_id != vendor.id:
                return Response(
                    {'detail': "You are not authorized to submit invoices for another vendor's purchase order."},
                    status=status.HTTP_403_FORBIDDEN
                )
        else:
            vendor = po.vendor
            if not vendor:
                return Response({'detail': 'Linked purchase order does not have an assigned vendor.'}, status=status.HTTP_400_BAD_REQUEST)

        invoice_number = request.data.get('invoice_number', '').strip()
        if not invoice_number:
            return Response({'detail': 'Invoice number is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent duplicate invoice numbers for the same vendor
        if Invoice.objects.filter(vendor=vendor, invoice_number__iexact=invoice_number).exists():
            return Response(
                {'detail': f"An invoice with number '{invoice_number}' already exists for vendor '{vendor.company_name}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate invoice amount
        try:
            amount = Decimal(str(request.data.get('amount', 0)))
        except Exception:
            return Response({'detail': 'Invalid invoice amount.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= Decimal('0.00'):
            return Response({'detail': 'Invoice amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            tax_amount = Decimal(str(request.data.get('tax_amount', 0)))
        except Exception:
            tax_amount = Decimal('0.00')

        total_amount = amount + tax_amount

        # Check total remaining balance on PO
        existing_invoiced = po.invoices.exclude(
            verification_status=Invoice.VerificationStatusChoices.REJECTED
        ).exclude(
            status__in=[Invoice.StatusChoices.REJECTED, Invoice.StatusChoices.CANCELLED]
        ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

        remaining_po_balance = po.total_amount - existing_invoiced
        if total_amount > remaining_po_balance:
            return Response(
                {
                    'detail': f"Invoice amount ({total_amount}) exceeds remaining purchase order balance ({remaining_po_balance}). Purchase Order total is {po.total_amount}."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        invoice_date = request.data.get('invoice_date') or timezone.now().date()
        due_date = request.data.get('due_date') or None
        remarks = request.data.get('remarks', '')
        invoice_document = request.FILES.get('invoice_document')

        # Initial verification status: vendors can ONLY submit as PENDING_VERIFICATION
        if is_vendor:
            requested_ver_status = Invoice.VerificationStatusChoices.PENDING_VERIFICATION
            verification_remarks = ''
            verified_by = None
            verified_at = None
            status_val = Invoice.StatusChoices.PENDING
        else:
            requested_ver_status = request.data.get('verification_status', Invoice.VerificationStatusChoices.PENDING_VERIFICATION)
            verification_remarks = request.data.get('verification_remarks', '')
            verified_by = None
            verified_at = None
            status_val = Invoice.StatusChoices.PENDING

            if requested_ver_status == Invoice.VerificationStatusChoices.VERIFIED:
                err_msg = self._check_delivery_consistency(po, total_amount)
                if err_msg:
                    return Response({'detail': err_msg}, status=status.HTTP_400_BAD_REQUEST)
                verified_by = request.user
                verified_at = timezone.now()
                status_val = Invoice.StatusChoices.VERIFIED
            elif requested_ver_status == Invoice.VerificationStatusChoices.REJECTED:
                verified_by = request.user
                verified_at = timezone.now()
                status_val = Invoice.StatusChoices.REJECTED
            else:
                requested_ver_status = Invoice.VerificationStatusChoices.PENDING_VERIFICATION

        invoice = Invoice.objects.create(
            invoice_number=invoice_number,
            purchase_order=po,
            vendor=vendor,
            amount=amount,
            tax_amount=tax_amount,
            total_amount=total_amount,
            invoice_date=invoice_date,
            due_date=due_date,
            status=status_val,
            verification_status=requested_ver_status,
            verification_remarks=verification_remarks,
            verified_by=verified_by,
            verified_at=verified_at,
            recorded_by=request.user,
            remarks=remarks,
            invoice_document=invoice_document
        )

        AuditLog.objects.create(
            user=request.user,
            action="RECORD_INVOICE",
            module="Finance",
            description=f"Recorded vendor invoice {invoice.invoice_number} ({invoice.total_amount}) for PO {po.po_number} - Vendor {vendor.company_name}."
        )

        po.check_and_update_procurement_completion()

        serializer = self.get_serializer(invoice)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _check_delivery_consistency(self, po, invoice_total, exclude_invoice_id=None):
        deliveries = po.deliveries.all()
        if not deliveries.exists():
            return f"Cannot verify invoice: No delivery records found for Purchase Order {po.po_number}. Delivery and inspection must be completed before verifying an invoice."

        if po.delivery_status == PurchaseOrder.DeliveryStatusChoices.DELIVERY_ISSUE:
            return f"Cannot verify invoice: Purchase Order {po.po_number} has an unresolved delivery issue or damaged items. Please resolve delivery issues before verifying."

        # Accepted delivered goods value
        accepted_delivered_value = Decimal('0.00')
        for d in deliveries:
            for di in d.items.all():
                unit_price = di.po_item.unit_price if di.po_item else Decimal('0.00')
                accepted_delivered_value += Decimal(di.quantity_accepted) * unit_price

        if accepted_delivered_value <= Decimal('0.00'):
            return "Cannot verify invoice: No goods have been accepted in delivery inspection for this Purchase Order."

        inv_query = po.invoices.filter(verification_status=Invoice.VerificationStatusChoices.VERIFIED)
        if exclude_invoice_id:
            inv_query = inv_query.exclude(id=exclude_invoice_id)
        other_verified_invoiced = inv_query.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

        cumulative_verified = other_verified_invoiced + invoice_total
        if cumulative_verified > accepted_delivered_value:
            return f"Cannot verify invoice: Cumulative verified invoice amount ({cumulative_verified}) exceeds accepted delivered goods value ({accepted_delivered_value}). Only accepted items can be verified for payment."

        return None

    @action(detail=True, methods=['post'], url_path='verify')
    def verify(self, request, pk=None):
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_po_or_admin = user.is_superuser or user.is_staff or any(k in r_name for k in ['purchase', 'procurement officer', 'finance', 'accounts', 'admin'])
        if not is_po_or_admin:
            return Response({'detail': 'Only authorized Purchase Officers, Finance Officers, and Administrators can verify invoices.'}, status=status.HTTP_403_FORBIDDEN)

        invoice = self.get_object()
        new_status = request.data.get('verification_status')
        verification_remarks = request.data.get('verification_remarks', '')

        if new_status not in [Invoice.VerificationStatusChoices.VERIFIED, Invoice.VerificationStatusChoices.REJECTED]:
            return Response(
                {'detail': f"Invalid verification status. Must be '{Invoice.VerificationStatusChoices.VERIFIED}' or '{Invoice.VerificationStatusChoices.REJECTED}'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_status == Invoice.VerificationStatusChoices.VERIFIED:
            if not invoice.invoice_number or not invoice.invoice_date or invoice.amount <= Decimal('0.00') or not invoice.purchase_order:
                return Response(
                    {'detail': 'Cannot verify invoice: Essential invoice details are missing or incomplete.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            err_msg = self._check_delivery_consistency(invoice.purchase_order, invoice.total_amount, exclude_invoice_id=invoice.id)
            if err_msg:
                return Response({'detail': err_msg}, status=status.HTTP_400_BAD_REQUEST)

            invoice.verification_status = Invoice.VerificationStatusChoices.VERIFIED
            invoice.verification_remarks = verification_remarks
            invoice.verified_by = request.user
            invoice.verified_at = timezone.now()
            if invoice.payment_status == Invoice.PaymentStatusChoices.PAID:
                invoice.status = Invoice.StatusChoices.PAID
            elif invoice.payment_status == Invoice.PaymentStatusChoices.PARTIALLY_PAID:
                invoice.status = Invoice.StatusChoices.PARTIALLY_PAID
            else:
                invoice.status = Invoice.StatusChoices.VERIFIED
            invoice.save()

            AuditLog.objects.create(
                user=request.user,
                action="VERIFY_INVOICE",
                module="Finance",
                description=f"Verified invoice {invoice.invoice_number} for PO {invoice.purchase_order.po_number}. Remarks: {verification_remarks}"
            )
        else:
            invoice.verification_status = Invoice.VerificationStatusChoices.REJECTED
            invoice.status = Invoice.StatusChoices.REJECTED
            invoice.verification_remarks = verification_remarks
            invoice.verified_by = request.user
            invoice.verified_at = timezone.now()
            invoice.save()

            AuditLog.objects.create(
                user=request.user,
                action="REJECT_INVOICE",
                module="Finance",
                description=f"Rejected invoice {invoice.invoice_number} for PO {invoice.purchase_order.po_number}. Remarks: {verification_remarks}"
            )

        invoice.purchase_order.check_and_update_procurement_completion()
        serializer = self.get_serializer(invoice)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='record-payment')
    def record_payment(self, request, pk=None):
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_po_or_admin = user.is_superuser or user.is_staff or any(k in r_name for k in ['purchase', 'procurement officer', 'finance', 'accounts', 'admin'])
        if not is_po_or_admin:
            return Response({'detail': 'Only authorized Purchase Officers, Finance Officers, and Administrators can record payments.'}, status=status.HTTP_403_FORBIDDEN)

        invoice = self.get_object()
        return process_record_payment(request.user, invoice, request.data)


class PaymentViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsInvoiceAuthorizedUser]
    filterset_class = PaymentFilter
    search_fields = ['payment_number', 'transaction_reference', 'notes', 'invoice__invoice_number']
    ordering_fields = ['payment_date', 'amount_paid', 'created_at']

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Payment.objects.none()

        qs = Payment.objects.select_related(
            'invoice', 'invoice__purchase_order', 'invoice__vendor', 'processed_by'
        )

        r_name = user.role.name.lower() if user.role else ''
        is_vendor = 'vendor' in r_name or hasattr(user, 'vendor_profile')

        if is_vendor:
            vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
            if not vendor:
                return Payment.objects.none()
            return qs.filter(invoice__vendor=vendor).order_by('-created_at')

        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_po_or_admin = user.is_superuser or user.is_staff or any(k in r_name for k in ['purchase', 'procurement officer', 'finance', 'accounts', 'admin'])
        if not is_po_or_admin:
            return Response({'detail': 'Vendors cannot record payments. Only authorized Purchase Officers or Finance Officers can record payments.'}, status=status.HTTP_403_FORBIDDEN)

        invoice_id = request.data.get('invoice')
        if not invoice_id:
            return Response({'detail': 'Invoice ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invoice = Invoice.objects.get(pk=invoice_id)
        except Invoice.DoesNotExist:
            return Response({'detail': f'Invoice {invoice_id} does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

        return process_record_payment(request.user, invoice, request.data)


def process_record_payment(user, invoice, data):
    if invoice.verification_status != Invoice.VerificationStatusChoices.VERIFIED:
        return Response(
            {
                'detail': f"Payments can only be recorded for verified invoices. Current verification status is '{invoice.get_verification_status_display()}'."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        amount_paid = Decimal(str(data.get('amount_paid', 0)))
    except Exception:
        return Response({'detail': 'Invalid payment amount.'}, status=status.HTTP_400_BAD_REQUEST)

    if amount_paid <= Decimal('0.00'):
        return Response({'detail': 'Payment amount must be greater than zero.'}, status=status.HTTP_400_BAD_REQUEST)

    outstanding = invoice.outstanding_balance
    if amount_paid > outstanding:
        return Response(
            {
                'detail': f"Payment amount ({amount_paid}) exceeds the outstanding invoice balance ({outstanding})."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    payment_date = data.get('payment_date') or timezone.now().date()
    payment_mode = data.get('payment_mode', Payment.PaymentMethodChoices.BANK_TRANSFER)
    transaction_reference = data.get('transaction_reference', '').strip()
    notes = data.get('notes', data.get('remarks', ''))

    payment = Payment.objects.create(
        invoice=invoice,
        amount_paid=amount_paid,
        payment_mode=payment_mode,
        transaction_reference=transaction_reference,
        payment_date=payment_date,
        processed_by=user,
        status=Payment.StatusChoices.COMPLETED,
        notes=notes
    )

    invoice.update_payment_status()
    invoice.purchase_order.check_and_update_procurement_completion()

    AuditLog.objects.create(
        user=user,
        action="RECORD_PAYMENT",
        module="Finance",
        description=f"Recorded payment {payment.payment_number} of {amount_paid} for invoice {invoice.invoice_number} (PO {invoice.purchase_order.po_number})."
    )

    serializer = PaymentSerializer(payment)
    return Response(serializer.data, status=status.HTTP_201_CREATED)

