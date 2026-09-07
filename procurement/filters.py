import django_filters
from .models import Requisition, QuotationRequest, Quotation, PurchaseOrder


class RequisitionFilter(django_filters.FilterSet):
    req_number = django_filters.CharFilter(lookup_expr='icontains')
    title = django_filters.CharFilter(lookup_expr='icontains')
    department = django_filters.NumberFilter(field_name='department__id')
    requested_by = django_filters.NumberFilter(field_name='requested_by__id')
    priority = django_filters.CharFilter(lookup_expr='exact')
    status = django_filters.CharFilter(lookup_expr='exact')

    class Meta:
        model = Requisition
        fields = ['req_number', 'title', 'department', 'requested_by', 'priority', 'status']


class QuotationRequestFilter(django_filters.FilterSet):
    rfq_number = django_filters.CharFilter(lookup_expr='icontains')
    title = django_filters.CharFilter(lookup_expr='icontains')
    requisition = django_filters.NumberFilter(field_name='requisition__id')
    status = django_filters.CharFilter(lookup_expr='exact')

    class Meta:
        model = QuotationRequest
        fields = ['rfq_number', 'title', 'requisition', 'status']


class QuotationFilter(django_filters.FilterSet):
    quotation_number = django_filters.CharFilter(lookup_expr='icontains')
    quotation_request = django_filters.NumberFilter(field_name='quotation_request__id')
    vendor = django_filters.NumberFilter(field_name='vendor__id')
    status = django_filters.CharFilter(lookup_expr='exact')

    class Meta:
        model = Quotation
        fields = ['quotation_number', 'quotation_request', 'vendor', 'status']


class PurchaseOrderFilter(django_filters.FilterSet):
    po_number = django_filters.CharFilter(lookup_expr='icontains')
    vendor = django_filters.NumberFilter(field_name='vendor__id')
    status = django_filters.CharFilter(lookup_expr='exact')

    class Meta:
        model = PurchaseOrder
        fields = ['po_number', 'vendor', 'status']
