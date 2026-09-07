import django_filters
from .models import Vendor, VendorApplication, SupplierCategory


class VendorApplicationFilter(django_filters.FilterSet):
    company_name = django_filters.CharFilter(lookup_expr='icontains')
    contact_person = django_filters.CharFilter(lookup_expr='icontains')
    email = django_filters.CharFilter(lookup_expr='icontains')
    category = django_filters.CharFilter(field_name='supplier_categories__name', lookup_expr='icontains')
    status = django_filters.CharFilter(lookup_expr='iexact')

    class Meta:
        model = VendorApplication
        fields = ['company_name', 'contact_person', 'email', 'status']


class VendorFilter(django_filters.FilterSet):
    vendor_code = django_filters.CharFilter(lookup_expr='icontains')
    company_name = django_filters.CharFilter(lookup_expr='icontains')
    contact_person = django_filters.CharFilter(lookup_expr='icontains')
    email = django_filters.CharFilter(lookup_expr='icontains')
    category = django_filters.CharFilter(field_name='supplier_categories__name', lookup_expr='icontains')
    status = django_filters.CharFilter(lookup_expr='iexact')
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = Vendor
        fields = ['vendor_code', 'company_name', 'contact_person', 'email', 'status', 'is_active']
