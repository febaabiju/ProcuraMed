import os
from django.db import models
from django.conf import settings
from django.utils import timezone


def document_upload_path(instance, filename):
    ref_type = instance.reference_type or 'general'
    return f"documents/{ref_type}/{filename}"


class Document(models.Model):
    class DocumentTypeChoices(models.TextChoices):
        REQUISITION = 'REQUISITION', 'Requisition'
        QUOTATION = 'QUOTATION', 'Quotation'
        PO = 'PO', 'Purchase Order'
        INSPECTION = 'INSPECTION', 'Inspection Report'
        INVOICE = 'INVOICE', 'Invoice'
        OTHER = 'OTHER', 'Other'

    class FileTypeChoices(models.TextChoices):
        PDF = 'PDF', 'PDF Document'
        DOCX = 'DOCX', 'Word Document'
        XLSX = 'XLSX', 'Excel Spreadsheet'
        IMAGE = 'IMAGE', 'Image File'
        OTHER = 'OTHER', 'Other'

    document_number = models.CharField(max_length=50, unique=True, blank=True, verbose_name="Document Number")
    title = models.CharField(max_length=255)
    document_type = models.CharField(
        max_length=30, choices=DocumentTypeChoices.choices, default=DocumentTypeChoices.OTHER
    )
    file_type = models.CharField(
        max_length=20, choices=FileTypeChoices.choices, default=FileTypeChoices.PDF
    )
    reference_type = models.CharField(
        max_length=50, help_text="Target table or module name (e.g. REQUISITION, QUOTATION, INVOICE)"
    )
    reference_id = models.PositiveIntegerField(help_text="Primary Key of referenced record")
    file = models.FileField(upload_to=document_upload_path)
    file_size = models.PositiveIntegerField(default=0, help_text="File size in bytes")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='uploaded_documents'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_document'
        verbose_name = 'Document'
        verbose_name_plural = 'Documents'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.document_number:
            year = timezone.now().strftime('%Y')
            count = Document.objects.filter(created_at__year=year).count() + 1
            self.document_number = f"DOC-{year}-{count:05d}"
        if self.file and not self.file_size:
            try:
                self.file_size = self.file.size
            except Exception:
                pass
        if self.file and not self.file_type:
            ext = os.path.splitext(self.file.name)[1].lower()
            if ext == '.pdf':
                self.file_type = self.FileTypeChoices.PDF
            elif ext in ['.doc', '.docx']:
                self.file_type = self.FileTypeChoices.DOCX
            elif ext in ['.xls', '.xlsx']:
                self.file_type = self.FileTypeChoices.XLSX
            elif ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
                self.file_type = self.FileTypeChoices.IMAGE
            else:
                self.file_type = self.FileTypeChoices.OTHER
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.document_number} - {self.title}"
