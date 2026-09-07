from django.contrib import admin
from .models import Document


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('id', 'document_number', 'title', 'document_type', 'file_type', 'reference_type', 'reference_id', 'file_size', 'uploaded_by', 'created_at')
    list_filter = ('document_type', 'file_type', 'reference_type', 'created_at')
    search_fields = ('document_number', 'title', 'reference_type', 'uploaded_by__username')
    ordering = ('-created_at',)
