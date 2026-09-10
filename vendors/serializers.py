import re
from rest_framework import serializers
from .models import SupplierCategory, VendorApplication, Vendor
from accounts.serializers import UserSerializer


class SupplierCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierCategory
        fields = ['id', 'name', 'description']


class VendorApplicationSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(required=False, allow_blank=True)
    contact_person = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True)
    products_services_offered = serializers.CharField(required=False, allow_blank=True)
    certificate_file = serializers.FileField(required=False, allow_null=True)
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
    vendor_code = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = VendorApplication
        fields = [
            'id', 'application_code', 'company_name', 'contact_person', 'email', 'phone',
            'address', 'supplier_categories', 'supplier_category_details',
            'products_services_offered', 'certificate_file', 'status',
            'admin_remarks', 'submitted_at', 'reviewed_at', 'reviewed_by', 'reviewed_by_name',
            'has_credentials', 'portal_username', 'portal_access_active', 'vendor_id',
            'vendor_code', 'is_active'
        ]
        read_only_fields = ['id', 'application_code', 'status', 'admin_remarks', 'submitted_at', 'reviewed_at', 'reviewed_by']

    def validate_company_name(self, value):
        val = (value or '').strip()
        if not val:
            raise serializers.ValidationError("Company name is required.")
        return val

    def validate_contact_person(self, value):
        val = (value or '').strip()
        if not val:
            raise serializers.ValidationError("Contact person name is required.")
        return val

    def validate_email(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Email address is required.")
        if any(c.isupper() for c in value):
            raise serializers.ValidationError("Email must be in lowercase and end with @gmail.com.")
        if not re.match(r'^[a-z0-9._%+-]+@gmail\.com$', value):
            raise serializers.ValidationError("Email must be a valid Gmail address ending with @gmail.com.")
        return value

    def validate_phone(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("Phone number is required.")
        if not re.match(r'^\d{10}$', value):
            raise serializers.ValidationError("Phone number must contain exactly 10 digits.")
        return value

    def validate_address(self, value):
        val = (value or '').strip()
        if not val:
            raise serializers.ValidationError("Company address is required.")
        return val

    def validate_products_services_offered(self, value):
        val = (value or '').strip()
        if not val:
            raise serializers.ValidationError("Products / Services offered description is required.")
        return val

    def validate_supplier_categories(self, value):
        if not value or len(value) == 0:
            raise serializers.ValidationError("At least one supplier category must be selected.")
        return value

    def validate_certificate_file(self, value):
        if not value:
            raise serializers.ValidationError("Business License / Registration Certificate is required.")
        
        name = getattr(value, 'name', '') or ''
        if not name.lower().endswith('.pdf'):
            raise serializers.ValidationError("Only PDF files (.pdf) are allowed for the Business License / Registration Certificate.")
        
        content_type = getattr(value, 'content_type', '') or ''
        if content_type and content_type.lower() not in [
            'application/pdf', 'application/x-pdf', 'application/acrobat', 
            'applications/vnd.pdf', 'text/pdf', 'text/x-pdf'
        ]:
            raise serializers.ValidationError("Only PDF files (.pdf) with valid PDF MIME type are allowed.")
        
        # Verify actual file contents begin with the PDF signature %PDF-
        try:
            value.seek(0)
            header = value.read(5)
            value.seek(0)
            if not header.startswith(b'%PDF-'):
                raise serializers.ValidationError("The uploaded file does not have a valid PDF signature (%PDF-). Spoofed or non-PDF files are not allowed.")
        except serializers.ValidationError:
            raise
        except Exception:
            raise serializers.ValidationError("Unable to verify the uploaded certificate file format. Please upload a valid PDF document.")
        
        return value

    def to_internal_value(self, data):
        errors = {}
        if self.instance is None:
            required_fields = {
                'company_name': 'Company name',
                'contact_person': 'Contact person name',
                'email': 'Email address',
                'phone': 'Phone number',
                'address': 'Company address',
                'products_services_offered': 'Products / Services offered description',
            }
            for field, label in required_fields.items():
                val = data.get(field) if hasattr(data, 'get') else None
                if val is None or (isinstance(val, str) and not val.strip()):
                    errors[field] = f"{label} is required."

            # Check certificate file presence
            cert = data.get('certificate_file') if hasattr(data, 'get') else None
            if not cert:
                errors['certificate_file'] = "Business License / Registration Certificate is required."

            # Check supplier categories presence
            cats = None
            if hasattr(data, 'getlist'):
                cats = data.getlist('supplier_categories')
            elif hasattr(data, 'get'):
                cats = data.get('supplier_categories')
            if not cats or len(cats) == 0:
                errors['supplier_categories'] = "At least one supplier category must be selected."

        try:
            ret = super().to_internal_value(data)
        except serializers.ValidationError as exc:
            for k, v in exc.detail.items():
                errors[k] = v

        if errors:
            raise serializers.ValidationError(errors)
        return ret

    def validate(self, attrs):
        if self.instance is None:
            required_fields = {
                'company_name': 'Company name',
                'contact_person': 'Contact person name',
                'email': 'Email address',
                'phone': 'Phone number',
                'address': 'Company address',
                'products_services_offered': 'Products / Services description',
            }
            errors = {}
            for field, label in required_fields.items():
                val = attrs.get(field)
                if val is None or (isinstance(val, str) and not val.strip()):
                    errors[field] = f"{label} is required."

            categories = attrs.get('supplier_categories')
            if not categories or len(categories) == 0:
                errors['supplier_categories'] = "At least one supplier category must be selected."

            cert = attrs.get('certificate_file')
            if not cert:
                errors['certificate_file'] = "Business License / Registration Certificate is required."

            if errors:
                raise serializers.ValidationError(errors)

        return attrs

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

    def get_vendor_code(self, obj):
        if hasattr(obj, 'approved_vendor') and obj.approved_vendor:
            return obj.approved_vendor.vendor_code
        return None

    def get_is_active(self, obj):
        if hasattr(obj, 'approved_vendor') and obj.approved_vendor:
            vendor = obj.approved_vendor
            return bool(vendor.is_active and vendor.status == Vendor.StatusChoices.ACTIVE and (not vendor.user or vendor.user.is_active))
        return True


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
