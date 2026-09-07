from rest_framework import serializers
from .models import SupplierCategory, VendorApplication, Vendor
from accounts.serializers import UserSerializer


class SupplierCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierCategory
        fields = ['id', 'name', 'description']


class VendorApplicationSerializer(serializers.ModelSerializer):
    supplier_categories = serializers.PrimaryKeyRelatedField(
        queryset=SupplierCategory.objects.all(),
        many=True,
        required=False
    )
    supplier_category_details = SupplierCategorySerializer(
        source='supplier_categories',
        many=True,
        read_only=True
    )
    reviewed_by_name = serializers.CharField(source='reviewed_by.username', read_only=True)
    application_code = serializers.SerializerMethodField()
    has_credentials = serializers.SerializerMethodField()
    portal_username = serializers.SerializerMethodField()
    portal_access_active = serializers.SerializerMethodField()
    vendor_id = serializers.SerializerMethodField()

    class Meta:
        model = VendorApplication
        fields = [
            'id', 'application_code', 'company_name', 'contact_person', 'email', 'phone',
            'address', 'supplier_categories', 'supplier_category_details',
            'products_services_offered', 'certificate_file', 'status',
            'admin_remarks', 'submitted_at', 'reviewed_at', 'reviewed_by', 'reviewed_by_name',
            'has_credentials', 'portal_username', 'portal_access_active', 'vendor_id'
        ]
        read_only_fields = ['id', 'application_code', 'status', 'admin_remarks', 'submitted_at', 'reviewed_at', 'reviewed_by']

    def get_application_code(self, obj):
        year = obj.submitted_at.strftime('%Y') if obj.submitted_at else '2026'
        return f"APP-{year}-{obj.id:04d}"

    def get_has_credentials(self, obj):
        if hasattr(obj, 'approved_vendor') and obj.approved_vendor:
            return bool(obj.approved_vendor.user and obj.approved_vendor.user.username)
        return False

    def get_portal_username(self, obj):
        if hasattr(obj, 'approved_vendor') and obj.approved_vendor and obj.approved_vendor.user:
            return obj.approved_vendor.user.username
        return None

    def get_portal_access_active(self, obj):
        if hasattr(obj, 'approved_vendor') and obj.approved_vendor:
            vendor = obj.approved_vendor
            return bool(vendor.is_active and vendor.status == Vendor.StatusChoices.ACTIVE and vendor.user and vendor.user.is_active)
        return False

    def get_vendor_id(self, obj):
        if hasattr(obj, 'approved_vendor') and obj.approved_vendor:
            return obj.approved_vendor.id
        return None


class VendorApplicationReviewSerializer(serializers.Serializer):
    admin_remarks = serializers.CharField(required=False, allow_blank=True, default='')
    username = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(required=False, allow_blank=True, min_length=6, write_only=True)
    initial_password = serializers.CharField(required=False, allow_blank=True, min_length=6, write_only=True)


class AssignVendorCredentialsSerializer(serializers.Serializer):
    username = serializers.CharField(required=True, min_length=3, max_length=150)
    password = serializers.CharField(required=True, min_length=6, write_only=True)
    confirm_password = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate_username(self, value):
        username = value.strip()
        return username

    def validate(self, attrs):
        password = attrs.get('password')
        confirm_password = attrs.get('confirm_password')
        if confirm_password and password != confirm_password:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        return attrs


class VendorSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    application_details = VendorApplicationSerializer(source='application', read_only=True)
    supplier_categories = serializers.PrimaryKeyRelatedField(
        queryset=SupplierCategory.objects.all(),
        many=True,
        required=False
    )
    supplier_category_details = SupplierCategorySerializer(
        source='supplier_categories',
        many=True,
        read_only=True
    )
    portal_username = serializers.SerializerMethodField()
    has_credentials = serializers.SerializerMethodField()
    portal_access_active = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = [
            'id', 'vendor_code', 'user', 'user_details', 'application', 'application_details',
            'company_name', 'contact_person', 'email', 'phone', 'supplier_categories',
            'supplier_category_details', 'status', 'performance_rating', 'is_active',
            'portal_username', 'has_credentials', 'portal_access_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'vendor_code', 'company_name', 'contact_person', 'email', 'phone',
            'supplier_categories', 'application', 'created_at', 'updated_at'
        ]

    def get_portal_username(self, obj):
        return obj.user.username if obj.user else None

    def get_has_credentials(self, obj):
        return bool(obj.user and obj.user.username)

    def get_portal_access_active(self, obj):
        return bool(obj.is_active and obj.status == Vendor.StatusChoices.ACTIVE and obj.user and obj.user.is_active)
