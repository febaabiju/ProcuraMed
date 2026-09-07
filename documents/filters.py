import django_filters
from .models import Document


class DocumentFilter(django_filters.FilterSet):
    title = django_filters.CharFilter(lookup_expr='icontains')
    document_type = django_filters.CharFilter(lookup_expr='exact')
    file_type = django_filters.CharFilter(lookup_expr='exact')
    reference_type = django_filters.CharFilter(lookup_expr='iexact')
    reference_id = django_filters.NumberFilter()

    class Meta:
        model = Document
        fields = ['title', 'document_type', 'file_type', 'reference_type', 'reference_id']
