from rest_framework import serializers
from .models import Document
from accounts.serializers import UserSerializer


class DocumentSerializer(serializers.ModelSerializer):
    uploaded_by_details = UserSerializer(source='uploaded_by', read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            'id', 'document_number', 'title', 'document_type', 'file_type',
            'reference_type', 'reference_id', 'file', 'file_url', 'file_size',
            'uploaded_by', 'uploaded_by_details', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'document_number', 'file_size', 'file_type', 'uploaded_by', 'created_at', 'updated_at']

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and hasattr(obj.file, 'url'):
            if request is not None:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
