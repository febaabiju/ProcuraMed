from django.contrib import admin
from .models import (
    Requisition, Approval, QuotationRequest, 
    Quotation, QuotationItem, PurchaseOrder, PurchaseOrderItem
)


class ApprovalInline(admin.TabularInline):
    model = Approval
    extra = 0
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Requisition)
class RequisitionAdmin(admin.ModelAdmin):
    list_display = ('id', 'req_number', 'title', 'department', 'requested_by', 'priority', 'estimated_budget', 'status', 'created_at')
    list_filter = ('status', 'priority', 'department', 'created_at')
    search_fields = ('req_number', 'title', 'justification')
    inlines = [ApprovalInline]
    ordering = ('-created_at',)


@admin.register(Approval)
class ApprovalAdmin(admin.ModelAdmin):
    list_display = ('id', 'requisition', 'approved_by', 'stage', 'status', 'created_at')
    list_filter = ('status', 'stage', 'created_at')
    search_fields = ('requisition__req_number', 'comments')
    ordering = ('-created_at',)


@admin.register(QuotationRequest)
class QuotationRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'rfq_number', 'title', 'requisition', 'created_by', 'issue_date', 'due_date', 'status')
    list_filter = ('status', 'issue_date', 'due_date')
    search_fields = ('rfq_number', 'title', 'terms_and_conditions')
    ordering = ('-created_at',)


class QuotationItemInline(admin.TabularInline):
    model = QuotationItem
    extra = 1


@admin.register(Quotation)
class QuotationAdmin(admin.ModelAdmin):
    list_display = ('id', 'quotation_number', 'quotation_request', 'vendor', 'total_amount', 'lead_time_days', 'status', 'submission_date')
    list_filter = ('status', 'submission_date')
    search_fields = ('quotation_number', 'vendor__company_name')
    inlines = [QuotationItemInline]
    ordering = ('-created_at',)


class PurchaseOrderItemInline(admin.TabularInline):
    model = PurchaseOrderItem
    extra = 1


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'po_number', 'quotation', 'vendor', 'total_amount', 'status', 'order_date', 'expected_delivery_date')
    list_filter = ('status', 'order_date')
    search_fields = ('po_number', 'vendor__company_name')
    inlines = [PurchaseOrderItemInline]
    ordering = ('-created_at',)
