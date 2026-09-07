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

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        document = self.get_object()
        if not document.file or not document.file.storage.exists(document.file.name):
            raise Http404("Requested file does not exist on storage.")
        return FileResponse(document.file.open(), as_attachment=True, filename=document.file.name.split('/')[-1])

    @action(detail=True, methods=['get'])
    def preview(self, request, pk=None):
        document = self.get_object()
        if not document.file or not document.file.storage.exists(document.file.name):
            raise Http404("Requested file does not exist on storage.")
        return FileResponse(document.file.open(), as_attachment=False)
