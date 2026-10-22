import re
from rest_framework import serializers
from .models import SupplierCategory, VendorApplication, Vendor, VendorProduct
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


class VendorProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_details = SupplierCategorySerializer(source='category', read_only=True)
    vendor_name = serializers.CharField(source='vendor.company_name', read_only=True)
    vendor_code = serializers.CharField(source='vendor.vendor_code', read_only=True)
    vendor_id = serializers.IntegerField(source='vendor.id', read_only=True)
    vendor_rating = serializers.DecimalField(source='vendor.performance_rating', max_digits=5, decimal_places=2, read_only=True)
    price_disclaimer = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(default=True, required=False)

    class Meta:
        model = VendorProduct
        fields = [
            'id', 'product_code', 'vendor', 'vendor_id', 'vendor_name', 'vendor_code',
            'vendor_rating', 'name', 'category', 'category_name', 'category_details',
            'brand', 'model_number', 'description', 'technical_specifications',
            'unit_of_measure', 'indicative_price', 'is_active',
            'price_disclaimer', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'product_code', 'vendor', 'created_at', 'updated_at']

    def get_price_disclaimer(self, obj):
        return "Indicative catalogue price only. Non-binding; formal RFQ quotation required for hospital purchase requests."

    def validate_name(self, value):
        val = (value or '').strip()
        if not val:
            raise serializers.ValidationError("Product name is required.")
        return val

    def validate_indicative_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Indicative unit price cannot be negative.")
        return value

    def validate(self, attrs):
        request = self.context.get('request')
        name = attrs.get('name') or (self.instance.name if self.instance else '')
        brand = attrs.get('brand') if 'brand' in attrs else (self.instance.brand if self.instance else '')
        model_number = attrs.get('model_number') if 'model_number' in attrs else (self.instance.model_number if self.instance else '')
        category = attrs.get('category') or (self.instance.category if self.instance else None)

        if not category:
            raise serializers.ValidationError({"category": "Supply category is required."})

        # Resolve vendor
        vendor = None
        if self.instance:
            vendor = self.instance.vendor
        elif request and getattr(request.user, 'vendor_profile', None):
            vendor = request.user.vendor_profile
        elif request and request.user.is_authenticated:
            vendor = Vendor.objects.filter(user=request.user).first()
        elif request and hasattr(request, '_target_vendor'):
            vendor = request._target_vendor

        user = request.user if request else None
        role_name = user.role.name.lower() if (user and hasattr(user, 'role') and user.role) else ''
        is_admin = bool(user and (user.is_superuser or user.is_staff or 'admin' in role_name))

        # Check vendor category assignment: vendor can only add/edit products in assigned categories
        if vendor and not is_admin and ('category' in attrs or not self.instance):
            is_assigned = vendor.supplier_categories.filter(id=category.id).exists()
            if not is_assigned and vendor.application:
                is_assigned = vendor.application.supplier_categories.filter(id=category.id).exists()

            if not is_assigned:
                raise serializers.ValidationError({
                    "category": f"Selected category '{category.name}' is not assigned to your vendor profile. You can only manage products under your assigned supply categories."
                })

        # Duplicate check per vendor
        if vendor and name:
            existing_qs = VendorProduct.objects.filter(
                vendor=vendor,
                name__iexact=name.strip(),
                brand__iexact=(brand or '').strip(),
                model_number__iexact=(model_number or '').strip()
            )
            if self.instance:
                existing_qs = existing_qs.exclude(pk=self.instance.pk)
            if existing_qs.exists():
                raise serializers.ValidationError({
                    "name": "You already have a product with this same Name, Brand, and Model Number in your catalogue."
                })

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
    products_count = serializers.SerializerMethodField()
    products = serializers.SerializerMethodField()

    class Meta:
        model = Vendor
        fields = [
            'id', 'vendor_code', 'user', 'user_details', 'application', 'application_details',
            'company_name', 'contact_person', 'email', 'phone', 'supplier_categories',
            'supplier_category_details', 'status', 'performance_rating', 'is_active',
            'portal_username', 'has_credentials', 'portal_access_active',
            'products_count', 'products',
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

    def get_products_count(self, obj):
        return obj.products.filter(is_active=True).count()

    def get_products(self, obj):
        active_products = obj.products.filter(is_active=True)[:10]
        return VendorProductSerializer(active_products, many=True).data
