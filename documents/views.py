from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import FileResponse, Http404

from .models import Document
from .serializers import DocumentSerializer
from .permissions import IsDocumentOwnerOrStaff
from .filters import DocumentFilter


class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.select_related('uploaded_by').all()
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, IsDocumentOwnerOrStaff]
    filterset_class = DocumentFilter
    search_fields = ['document_number', 'title', 'reference_type']
    ordering_fields = ['created_at', 'title', 'file_size']

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    def get_permissions(self):
        if self.action in ['download', 'preview']:
            return []
        return super().get_permissions()

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        from backend.views import authenticate_media_request, generate_fallback_pdf
        import os, io, mimetypes
        user = authenticate_media_request(request)
        if not user:
            from django.http import HttpResponse
            return HttpResponse("Authentication required.", status=401)

        document = self.get_object()
        # Permission check
        if not (user.is_superuser or user.is_staff or document.uploaded_by == user):
            from django.http import HttpResponseForbidden
            return HttpResponseForbidden("Permission denied.")

        filename = os.path.basename(document.file.name) if document.file else f"{document.document_number}.pdf"
        if document.file:
            try:
                if document.file.storage.exists(document.file.name):
                    return FileResponse(document.file.open(), as_attachment=True, filename=filename)
            except Exception:
                pass
            from django.conf import settings
            local_path = os.path.join(str(settings.MEDIA_ROOT), document.file.name)
            if os.path.exists(local_path) and os.path.isfile(local_path):
                return FileResponse(open(local_path, 'rb'), as_attachment=True, filename=filename)

        pdf_bytes = generate_fallback_pdf(filename, f"Document {document.document_number} - {document.title}")
        return FileResponse(io.BytesIO(pdf_bytes), as_attachment=True, filename=filename)

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        from backend.views import authenticate_media_request, generate_fallback_pdf
        import os, io, mimetypes
        user = authenticate_media_request(request)
        if not user:
            from django.http import HttpResponse
            return HttpResponse("Authentication required.", status=401)

        document = self.get_object()
        if not (user.is_superuser or user.is_staff or document.uploaded_by == user):
            from django.http import HttpResponseForbidden
            return HttpResponseForbidden("Permission denied.")

        filename = os.path.basename(document.file.name) if document.file else f"{document.document_number}.pdf"
        content_type, _ = mimetypes.guess_type(filename)
        if not content_type:
            content_type = 'application/pdf'

        if document.file:
            try:
                if document.file.storage.exists(document.file.name):
                    return FileResponse(document.file.open(), as_attachment=False, content_type=content_type)
            except Exception:
                pass
            from django.conf import settings
            local_path = os.path.join(str(settings.MEDIA_ROOT), document.file.name)
            if os.path.exists(local_path) and os.path.isfile(local_path):
                return FileResponse(open(local_path, 'rb'), as_attachment=False, content_type=content_type)

        pdf_bytes = generate_fallback_pdf(filename, f"Document {document.document_number} - {document.title}")
        return FileResponse(io.BytesIO(pdf_bytes), as_attachment=False, content_type='application/pdf')
