from django.contrib import admin
from .models import InventoryItem, Delivery, DeliveryItem, Verification, StockTransaction


class DeliveryItemInline(admin.TabularInline):
    model = DeliveryItem
    extra = 1


@admin.register(InventoryItem)
class InventoryItemAdmin(admin.ModelAdmin):
    list_display = ('id', 'item_code', 'name', 'category', 'unit_of_measure', 'current_stock', 'reorder_level', 'unit_price', 'is_active')
    list_filter = ('category', 'is_active')
    search_fields = ('item_code', 'name', 'category')
    ordering = ('name',)


@admin.register(Delivery)
class DeliveryAdmin(admin.ModelAdmin):
    list_display = ('id', 'delivery_number', 'purchase_order', 'vendor', 'tracking_number', 'delivery_date', 'status')
    list_filter = ('status', 'delivery_date')
    search_fields = ('delivery_number', 'tracking_number', 'vendor__company_name')
    inlines = [DeliveryItemInline]
    ordering = ('-created_at',)


@admin.register(Verification)
class VerificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'delivery_item', 'verified_by', 'accepted_quantity', 'rejected_quantity', 'status', 'inspection_date')
    list_filter = ('status', 'inspection_date')
    search_fields = ('inspection_notes', 'verified_by__username')
    ordering = ('-created_at',)


@admin.register(StockTransaction)
class StockTransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'inventory_item', 'transaction_type', 'quantity', 'reference_type', 'reference_id', 'created_by', 'created_at')
    list_filter = ('transaction_type', 'created_at')
    search_fields = ('inventory_item__name', 'notes')
    ordering = ('-created_at',)
