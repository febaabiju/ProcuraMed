from django.db import models
from django.conf import settings
from django.utils import timezone
from accounts.models import Department


class Requisition(models.Model):
    class PriorityChoices(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    class StatusChoices(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        RFQ_ISSUED = 'RFQ_ISSUED', 'RFQ Issued'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    req_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="Requisition Number")
    title = models.CharField(max_length=255)
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name='requisitions'
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='requisitions'
    )
    priority = models.CharField(
        max_length=20, choices=PriorityChoices.choices, default=PriorityChoices.MEDIUM
    )
    estimated_budget = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    status = models.CharField(
        max_length=30, choices=StatusChoices.choices, default=StatusChoices.DRAFT
    )
    justification = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_requisition'
        verbose_name = 'Purchase Requisition'
        verbose_name_plural = 'Purchase Requisitions'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.req_number:
            year = timezone.now().strftime('%Y')
            count = Requisition.objects.filter(created_at__year=year).count() + 1
            self.req_number = f"REQ-{year}-{count:05d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.req_number} - {self.title}"


class Approval(models.Model):
    class StatusChoices(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    requisition = models.ForeignKey(
        Requisition, on_delete=models.CASCADE, related_name='approvals'
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='approvals'
    )
    stage = models.CharField(max_length=50, help_text="Approval stage or authority role")
    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, default=StatusChoices.PENDING
    )
    comments = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_approval'
        verbose_name = 'Approval'
        verbose_name_plural = 'Approvals'
        ordering = ['-created_at']

    def __str__(self):
        return f"Approval for {self.requisition.req_number} by {self.approved_by}"


class QuotationRequest(models.Model):
    class StatusChoices(models.TextChoices):
        OPEN = 'OPEN', 'Open'
        CLOSED = 'CLOSED', 'Closed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    rfq_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="RFQ Number")
    requisition = models.ForeignKey(
        Requisition, on_delete=models.CASCADE, related_name='quotation_requests'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_rfqs'
    )
    title = models.CharField(max_length=255)
    issue_date = models.DateField(auto_now_add=True)
    due_date = models.DateField()
    terms_and_conditions = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, default=StatusChoices.OPEN
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_quotation_request'
        verbose_name = 'Quotation Request (RFQ)'
        verbose_name_plural = 'Quotation Requests (RFQs)'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.rfq_number:
            year = timezone.now().strftime('%Y')
            count = QuotationRequest.objects.filter(created_at__year=year).count() + 1
            self.rfq_number = f"RFQ-{year}-{count:05d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.rfq_number} - {self.title}"


class Quotation(models.Model):
    class StatusChoices(models.TextChoices):
        SUBMITTED = 'SUBMITTED', 'Submitted'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        REJECTED = 'REJECTED', 'Rejected'

    quotation_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="Quotation Number")
    quotation_request = models.ForeignKey(
        QuotationRequest, on_delete=models.CASCADE, related_name='quotations'
    )
    vendor = models.ForeignKey(
        'vendors.Vendor', on_delete=models.CASCADE, related_name='quotations'
    )
    submission_date = models.DateTimeField(auto_now_add=True)
    valid_until = models.DateField(null=True, blank=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    lead_time_days = models.PositiveIntegerField(null=True, blank=True, help_text="Delivery lead time in days")
    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, default=StatusChoices.SUBMITTED
    )
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_quotation'
        verbose_name = 'Quotation'
        verbose_name_plural = 'Quotations'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.quotation_number:
            year = timezone.now().strftime('%Y')
            count = Quotation.objects.filter(created_at__year=year).count() + 1
            self.quotation_number = f"QT-{year}-{count:05d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.quotation_number} - {self.vendor}"


class QuotationItem(models.Model):
    quotation = models.ForeignKey(
        Quotation, on_delete=models.CASCADE, related_name='items'
    )
    item_name = models.CharField(max_length=255)
    specification = models.TextField(blank=True, null=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_quotation_item'
        verbose_name = 'Quotation Item'
        verbose_name_plural = 'Quotation Items'

    def save(self, *args, **kwargs):
        if self.quantity and self.unit_price:
            self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.item_name} (Qty: {self.quantity})"


class PurchaseOrder(models.Model):
    class StatusChoices(models.TextChoices):
        ISSUED = 'ISSUED', 'Issued'
        PARTIALLY_DELIVERED = 'PARTIALLY_DELIVERED', 'Partially Delivered'
        DELIVERED = 'DELIVERED', 'Delivered'
        INSPECTED = 'INSPECTED', 'Inspected'
        CLOSED = 'CLOSED', 'Closed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    po_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="PO Number")
    quotation = models.ForeignKey(
        Quotation, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchase_orders'
    )
    vendor = models.ForeignKey(
        'vendors.Vendor', on_delete=models.CASCADE, related_name='purchase_orders'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_pos'
    )
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    order_date = models.DateField(auto_now_add=True)
    expected_delivery_date = models.DateField(null=True, blank=True)
    terms_and_conditions = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=30, choices=StatusChoices.choices, default=StatusChoices.ISSUED
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_purchase_order'
        verbose_name = 'Purchase Order'
        verbose_name_plural = 'Purchase Orders'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.po_number:
            year = timezone.now().strftime('%Y')
            count = PurchaseOrder.objects.filter(created_at__year=year).count() + 1
            self.po_number = f"PO-{year}-{count:05d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.po_number} - {self.vendor}"


class PurchaseOrderItem(models.Model):
    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.CASCADE, related_name='items'
    )
    item_name = models.CharField(max_length=255)
    specification = models.TextField(blank=True, null=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_po_item'
        verbose_name = 'Purchase Order Item'
        verbose_name_plural = 'Purchase Order Items'

    def save(self, *args, **kwargs):
        if self.quantity and self.unit_price:
            self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.item_name} (Qty: {self.quantity})"
