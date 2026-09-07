import django_filters
from .models import InventoryItem, Delivery, Verification, StockTransaction


class InventoryItemFilter(django_filters.FilterSet):
    name = django_filters.CharFilter(lookup_expr='icontains')
    item_code = django_filters.CharFilter(lookup_expr='icontains')
    category = django_filters.CharFilter(lookup_expr='icontains')
    is_low_stock = django_filters.BooleanFilter(method='filter_low_stock')

    class Meta:
        model = InventoryItem
        fields = ['name', 'item_code', 'category', 'is_low_stock']

    def filter_low_stock(self, queryset, name, value):
        if value:
            return queryset.filter(current_stock__lte=django_filters.db_models.F('reorder_level'))
        return queryset


class DeliveryFilter(django_filters.FilterSet):
    delivery_number = django_filters.CharFilter(lookup_expr='icontains')
    purchase_order = django_filters.NumberFilter(field_name='purchase_order__id')
    vendor = django_filters.NumberFilter(field_name='vendor__id')
    status = django_filters.CharFilter(lookup_expr='exact')

    class Meta:
        model = Delivery
        fields = ['delivery_number', 'purchase_order', 'vendor', 'status']


class VerificationFilter(django_filters.FilterSet):
    delivery_item = django_filters.NumberFilter(field_name='delivery_item__id')
    status = django_filters.CharFilter(lookup_expr='exact')

    class Meta:
        model = Verification
        fields = ['delivery_item', 'status']


class StockTransactionFilter(django_filters.FilterSet):
    inventory_item = django_filters.NumberFilter(field_name='inventory_item__id')
    transaction_type = django_filters.CharFilter(lookup_expr='exact')

    class Meta:
        model = StockTransaction
        fields = ['inventory_item', 'transaction_type']
