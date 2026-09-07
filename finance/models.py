from django.db import models
from django.conf import settings
from django.utils import timezone
from procurement.models import PurchaseOrder
from vendors.models import Vendor


class Invoice(models.Model):
    class StatusChoices(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        PAID = 'PAID', 'Paid'
        CANCELLED = 'CANCELLED', 'Cancelled'

    invoice_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="Invoice Number")
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
        max_length=20, choices=StatusChoices.choices, default=StatusChoices.PENDING
    )
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_invoice'
        verbose_name = 'Invoice'
        verbose_name_plural = 'Invoices'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            year = timezone.now().strftime('%Y')
            count = Invoice.objects.filter(created_at__year=year).count() + 1
            self.invoice_number = f"INV-{year}-{count:05d}"
        if not self.total_amount:
            self.total_amount = self.amount + self.tax_amount
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.invoice_number} - {self.vendor.company_name} ({self.status})"


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

        # Auto-update Invoice status after successful payment
        if self.status == Payment.StatusChoices.COMPLETED:
            total_paid = sum(
                p.amount_paid for p in self.invoice.payments.filter(status=Payment.StatusChoices.COMPLETED)
            ) + (self.amount_paid if self.pk is None else 0)
            
            if total_paid >= self.invoice.total_amount:
                self.invoice.status = Invoice.StatusChoices.PAID
                self.invoice.save()

    def __str__(self):
        return f"{self.payment_number} - Invoice {self.invoice.invoice_number}"
