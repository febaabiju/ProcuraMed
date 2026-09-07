from django.contrib import admin
from .models import Invoice, Payment


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ('payment_number', 'created_at', 'updated_at')


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('id', 'invoice_number', 'purchase_order', 'vendor', 'amount', 'tax_amount', 'total_amount', 'status', 'invoice_date', 'due_date')
    list_filter = ('status', 'invoice_date', 'due_date')
    search_fields = ('invoice_number', 'vendor__company_name', 'purchase_order__po_number')
    inlines = [PaymentInline]
    ordering = ('-created_at',)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'payment_number', 'invoice', 'amount_paid', 'payment_mode', 'transaction_reference', 'payment_date', 'status', 'processed_by')
    list_filter = ('payment_mode', 'status', 'payment_date')
    search_fields = ('payment_number', 'transaction_reference', 'invoice__invoice_number')
    ordering = ('-created_at',)
