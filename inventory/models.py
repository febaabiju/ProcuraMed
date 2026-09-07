from django.db import models
from django.conf import settings
from django.utils import timezone
from procurement.models import PurchaseOrder, PurchaseOrderItem
from vendors.models import Vendor


class InventoryItem(models.Model):
    item_code = models.CharField(max_length=50, unique=True, verbose_name="Item Code")
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, help_text="e.g. Biomedical, IT, Medical Equipment")
    unit_of_measure = models.CharField(max_length=50, default='PCS', help_text="e.g. PCS, Box, Unit")
    current_stock = models.PositiveIntegerField(default=0)
    reorder_level = models.PositiveIntegerField(default=5)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_inventory_item'
        verbose_name = 'Inventory Item'
        verbose_name_plural = 'Inventory Items'
        ordering = ['name']

    def is_low_stock(self):
        return self.current_stock <= self.reorder_level

    def __str__(self):
        return f"{self.item_code} - {self.name} (Stock: {self.current_stock})"


class Delivery(models.Model):
    class StatusChoices(models.TextChoices):
        DISPATCHED = 'DISPATCHED', 'Dispatched'
        IN_TRANSIT = 'IN_TRANSIT', 'In Transit'
        DELIVERED = 'DELIVERED', 'Delivered'
        INSPECTED = 'INSPECTED', 'Inspected'

    delivery_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="Delivery Number")
    purchase_order = models.ForeignKey(
        PurchaseOrder, on_delete=models.CASCADE, related_name='deliveries'
    )
    vendor = models.ForeignKey(
        Vendor, on_delete=models.CASCADE, related_name='deliveries'
    )
    tracking_number = models.CharField(max_length=100, blank=True, null=True)
    delivery_date = models.DateField(default=timezone.now)
    status = models.CharField(
        max_length=20, choices=StatusChoices.choices, default=StatusChoices.DISPATCHED
    )
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_delivery'
        verbose_name = 'Delivery'
        verbose_name_plural = 'Deliveries'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.delivery_number:
            year = timezone.now().strftime('%Y')
            count = Delivery.objects.filter(created_at__year=year).count() + 1
            self.delivery_number = f"DEL-{year}-{count:05d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.delivery_number} (PO: {self.purchase_order.po_number})"


class DeliveryItem(models.Model):
    delivery = models.ForeignKey(
        Delivery, on_delete=models.CASCADE, related_name='items'
    )
    po_item = models.ForeignKey(
        PurchaseOrderItem, on_delete=models.CASCADE, related_name='delivery_items'
    )
    quantity_delivered = models.PositiveIntegerField(default=1)
    remarks = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_delivery_item'
        verbose_name = 'Delivery Item'
        verbose_name_plural = 'Delivery Items'

    def __str__(self):
        return f"{self.po_item.item_name} - Qty Delivered: {self.quantity_delivered}"


class Verification(models.Model):
    class StatusChoices(models.TextChoices):
        ACCEPTED = 'ACCEPTED', 'Accepted'
        REJECTED = 'REJECTED', 'Rejected'
        PARTIALLY_ACCEPTED = 'PARTIALLY_ACCEPTED', 'Partially Accepted'

    delivery_item = models.ForeignKey(
        DeliveryItem, on_delete=models.CASCADE, related_name='verifications'
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='verifications'
    )
    accepted_quantity = models.PositiveIntegerField(default=0)
    rejected_quantity = models.PositiveIntegerField(default=0)
    status = models.CharField(
        max_length=25, choices=StatusChoices.choices, default=StatusChoices.ACCEPTED
    )
    inspection_notes = models.TextField(blank=True, null=True)
    inspection_date = models.DateField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_verification'
        verbose_name = 'Technical Verification'
        verbose_name_plural = 'Technical Verifications'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and self.accepted_quantity > 0:
            # Auto update inventory stock & create StockTransaction
            item_name = self.delivery_item.po_item.item_name
            inv_item, created = InventoryItem.objects.get_or_create(
                name=item_name,
                defaults={
                    'item_code': f"INV-{self.delivery_item.po_item.id:04d}",
                    'unit_price': self.delivery_item.po_item.unit_price,
                    'current_stock': 0
                }
            )
            inv_item.current_stock += self.accepted_quantity
            inv_item.save()

            StockTransaction.objects.create(
                inventory_item=inv_item,
                transaction_type=StockTransaction.TransactionType.IN,
                quantity=self.accepted_quantity,
                reference_type='VERIFICATION',
                reference_id=self.id,
                created_by=self.verified_by,
                notes=f"Stock added from delivery verification #{self.id}"
            )

    def __str__(self):
        return f"Verification #{self.id} - {self.status}"


class StockTransaction(models.Model):
    class TransactionType(models.TextChoices):
        IN = 'IN', 'Stock In'
        OUT = 'OUT', 'Stock Out'
        ADJUSTMENT = 'ADJUSTMENT', 'Adjustment'

    inventory_item = models.ForeignKey(
        InventoryItem, on_delete=models.CASCADE, related_name='transactions'
    )
    transaction_type = models.CharField(
        max_length=20, choices=TransactionType.choices
    )
    quantity = models.IntegerField()
    reference_type = models.CharField(max_length=50, blank=True, null=True)
    reference_id = models.PositiveIntegerField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tbl_stock_transaction'
        verbose_name = 'Stock Transaction'
        verbose_name_plural = 'Stock Transactions'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.inventory_item.name} - {self.transaction_type} {self.quantity}"
