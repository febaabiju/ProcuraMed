import django_filters
from .models import Invoice, Payment


class InvoiceFilter(django_filters.FilterSet):
    invoice_number = django_filters.CharFilter(lookup_expr='icontains')
    vendor = django_filters.NumberFilter(field_name='vendor__id')
    purchase_order = django_filters.NumberFilter(field_name='purchase_order__id')
    status = django_filters.CharFilter(lookup_expr='exact')

    class Meta:
        model = Invoice
        fields = ['invoice_number', 'vendor', 'purchase_order', 'status']


class PaymentFilter(django_filters.FilterSet):
    payment_number = django_filters.CharFilter(lookup_expr='icontains')
    invoice = django_filters.NumberFilter(field_name='invoice__id')
    payment_mode = django_filters.CharFilter(lookup_expr='exact')
    status = django_filters.CharFilter(lookup_expr='exact')

    class Meta:
        model = Payment
        fields = ['payment_number', 'invoice', 'payment_mode', 'status']
