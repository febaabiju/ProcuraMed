from decimal import Decimal
from django.db import models
from django.conf import settings
from django.utils import timezone
from procurement.models import PurchaseOrder
from vendors.models import Vendor


class Invoice(models.Model):
    class StatusChoices(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        VERIFIED = 'VERIFIED', 'Verified'
        PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
        PAID = 'PAID', 'Paid'
        REJECTED = 'REJECTED', 'Rejected'
        CANCELLED = 'CANCELLED', 'Cancelled'

    class VerificationStatusChoices(models.TextChoices):
        PENDING_VERIFICATION = 'PENDING_VERIFICATION', 'Pending Verification'
        VERIFIED = 'VERIFIED', 'Verified'
        REJECTED = 'REJECTED', 'Rejected'

    class PaymentStatusChoices(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PARTIALLY_PAID = 'PARTIALLY_PAID', 'Partially Paid'
        PAID = 'PAID', 'Paid'

    invoice_number = models.CharField(max_length=50, blank=True, verbose_name="Invoice Number")
    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.CASCADE, related_name='invoices'
    )
    vendor = models.ForeignKey(
        Vendor, on_delete=models.CASCADE, related_name='invoices'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    invoice_date = models.DateField(default=timezone.now)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=30, choices=StatusChoices.choices, default=StatusChoices.PENDING
    )
    verification_status = models.CharField(
        max_length=30, choices=VerificationStatusChoices.choices, default=VerificationStatusChoices.PENDING_VERIFICATION
    )
    payment_status = models.CharField(
        max_length=30, choices=PaymentStatusChoices.choices, default=PaymentStatusChoices.PENDING
    )
    verification_remarks = models.TextField(blank=True, null=True, verbose_name="Verification Remarks")
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='verified_invoices', verbose_name="Verified By"
    )
    verified_at = models.DateTimeField(null=True, blank=True, verbose_name="Verified At")
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='recorded_invoices', verbose_name="Recorded By"
    )
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_invoice'
        verbose_name = 'Invoice'
        verbose_name_plural = 'Invoices'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['invoice_number', 'vendor'], name='unique_vendor_invoice_number')
        ]

    @property
    def total_amount_paid(self):
        from django.db.models import Sum
        paid = self.payments.filter(status__in=['COMPLETED', 'PAID', Payment.StatusChoices.COMPLETED]).aggregate(
            total=Sum('amount_paid')
        )['total'] or Decimal('0.00')
        return paid

    @property
    def outstanding_balance(self):
        total = self.total_amount if self.total_amount is not None else (self.amount or Decimal('0.00'))
        return max(Decimal('0.00'), total - self.total_amount_paid)

    def update_payment_status(self):
        total_paid = self.total_amount_paid
        total_inv = self.total_amount if self.total_amount is not None else (self.amount or Decimal('0.00'))
        if total_paid >= total_inv and total_inv > 0:
            self.payment_status = self.PaymentStatusChoices.PAID
            self.status = self.StatusChoices.PAID
        elif total_paid > 0:
            self.payment_status = self.PaymentStatusChoices.PARTIALLY_PAID
            self.status = self.StatusChoices.PARTIALLY_PAID
        else:
            self.payment_status = self.PaymentStatusChoices.PENDING
            if self.verification_status == self.VerificationStatusChoices.VERIFIED:
                self.status = self.StatusChoices.VERIFIED
            else:
                self.status = self.StatusChoices.PENDING
        self.save(update_fields=['payment_status', 'status', 'updated_at'])
        return self.payment_status

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            year = timezone.now().strftime('%Y')
            count = Invoice.objects.filter(created_at__year=year).count() + 1
            self.invoice_number = f"INV-{year}-{count:05d}"
        if self.amount is not None and (self.total_amount is None or self.total_amount == 0):
            tax = self.tax_amount if self.tax_amount is not None else Decimal('0.00')
            self.total_amount = self.amount + tax
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.invoice_number} - {self.vendor.company_name} ({self.verification_status} / {self.payment_status})"


class Payment(models.Model):
    class PaymentMethodChoices(models.TextChoices):
        CASH = 'CASH', 'Cash'
        CHEQUE = 'CHEQUE', 'Cheque'
        BANK_TRANSFER = 'BANK_TRANSFER', 'Bank Transfer'
        UPI = 'UPI', 'UPI'

    class StatusChoices(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    payment_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="Payment Number")
    invoice = models.ForeignKey(
        Invoice, on_delete=models.CASCADE, related_name='payments'
    )
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2)
    payment_mode = models.CharField(
        max_length=20, choices=PaymentMethodChoices.choices, default=PaymentMethodChoices.BANK_TRANSFER
    )
    transaction_reference = models.CharField(max_length=100, blank=True, null=True)
    payment_date = models.DateField(default=timezone.now)
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='processed_payments'
    )
    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, default=StatusChoices.COMPLETED
    )
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_payment'
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.payment_number:
            year = timezone.now().strftime('%Y')
            count = Payment.objects.filter(created_at__year=year).count() + 1
            self.payment_number = f"PAY-{year}-{count:05d}"
        super().save(*args, **kwargs)

        if self.status == self.StatusChoices.COMPLETED:
            self.invoice.update_payment_status()
            if hasattr(self.invoice.purchase_order, 'check_and_update_procurement_completion'):
                self.invoice.purchase_order.check_and_update_procurement_completion()

    def __str__(self):
        return f"{self.payment_number} - Invoice {self.invoice.invoice_number}"
