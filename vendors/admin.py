from django.contrib import admin
from .models import SupplierCategory, VendorApplication, Vendor, VendorProduct


@admin.register(SupplierCategory)
class SupplierCategoryAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'description')
    search_fields = ('name', 'description')


@admin.register(VendorApplication)
class VendorApplicationAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'company_name', 'contact_person', 'email', 'phone',
        'status', 'submitted_at', 'reviewed_at', 'reviewed_by'
    )
    list_filter = ('status', 'supplier_categories', 'submitted_at')
    search_fields = ('company_name', 'contact_person', 'email', 'phone')
    ordering = ('-submitted_at',)
    readonly_fields = ('submitted_at', 'reviewed_at')
    filter_horizontal = ('supplier_categories',)


@admin.register(Vendor)
class VendorAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'vendor_code', 'company_name', 'contact_person', 'email',
        'phone', 'status', 'performance_rating', 'is_active', 'created_at'
    )
    list_filter = ('status', 'is_active', 'supplier_categories', 'created_at')
    search_fields = ('vendor_code', 'company_name', 'contact_person', 'email', 'phone')
    ordering = ('company_name',)
    readonly_fields = ('vendor_code', 'created_at', 'updated_at')
    filter_horizontal = ('supplier_categories',)


@admin.register(VendorProduct)
class VendorProductAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'product_code', 'name', 'vendor', 'category', 'brand',
        'model_number', 'unit_of_measure', 'indicative_price', 'is_active', 'created_at'
    )
    list_filter = ('is_active', 'category', 'vendor', 'created_at')
    search_fields = ('product_code', 'name', 'brand', 'model_number', 'description', 'vendor__company_name')
    ordering = ('-created_at',)
    readonly_fields = ('product_code', 'created_at', 'updated_at')
