import os
import json
from decimal import Decimal
from rest_framework import serializers
from .models import (
    Requisition, RequisitionItem, Approval, QuotationRequest, Quotation, QuotationItem, PurchaseOrder, PurchaseOrderItem
)
from accounts.models import Department
from accounts.serializers import UserSerializer, DepartmentSerializer
from vendors.models import Vendor
from vendors.serializers import VendorSerializer
from .constants import DEPARTMENT_CATEGORY_MAP, get_allowed_categories_for_department


class ApprovalSerializer(serializers.ModelSerializer):
    approved_by_details = UserSerializer(source='approved_by', read_only=True)

    class Meta:
        model = Approval
        fields = ['id', 'requisition', 'approved_by', 'approved_by_details', 'stage', 'status', 'comments', 'created_at', 'updated_at']
        read_only_fields = ['id', 'approved_by', 'created_at', 'updated_at']


class RequisitionItemSerializer(serializers.ModelSerializer):
    technical_advisory = serializers.SerializerMethodField()

    class Meta:
        model = RequisitionItem
        fields = [
            'id', 'requisition', 'item_name', 'category', 'quantity',
            'specifications', 'estimated_unit_price', 'total_price',
            'required_date', 'technical_advisory', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'requisition', 'total_price', 'technical_advisory', 'created_at', 'updated_at']

    def get_technical_advisory(self, obj):
        is_tech, spec, reason = obj.determine_technical_requirement_details()
        return {
            'is_technical': is_tech,
            'suggested_specialization': spec,
            'reason': reason
        }

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value

    def validate_estimated_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Estimated unit price cannot be negative.")
        return value

    def validate_required_date(self, value):
        if value:
            from django.utils import timezone
            today = timezone.localdate()
            if value < today:
                raise serializers.ValidationError("Required date cannot be in the past. Minimum allowed date is today.")
        return value


class RequisitionSerializer(serializers.ModelSerializer):
    department = serializers.PrimaryKeyRelatedField(
        queryset=Department.objects.all(),
        required=False,
        allow_null=True
    )
    department_details = DepartmentSerializer(source='department', read_only=True)
    requested_by_details = UserSerializer(source='requested_by', read_only=True)
    reviewed_by_details = UserSerializer(source='reviewed_by', read_only=True)
    assigned_purchase_officer_details = UserSerializer(source='assigned_purchase_officer', read_only=True)
    assigned_purchase_officer_name = serializers.SerializerMethodField()
    assignment_status = serializers.SerializerMethodField()
    approvals = ApprovalSerializer(many=True, read_only=True)
    items = RequisitionItemSerializer(many=True, required=False)
    supporting_document = serializers.FileField(required=False, allow_null=True)
    required_date = serializers.SerializerMethodField()
    secure_document_url = serializers.SerializerMethodField()
    technical_evaluation_advisory = serializers.SerializerMethodField()

    class Meta:
        model = Requisition
        fields = [
            'id', 'req_number', 'title', 'category', 'requires_technical_evaluation',
            'technical_specialization', 'department', 'department_details',
            'requested_by', 'requested_by_details', 'assigned_purchase_officer',
            'assigned_purchase_officer_details', 'assigned_purchase_officer_name',
            'assignment_status', 'assigned_at',
            'priority', 'estimated_budget',
            'status', 'justification', 'supporting_document', 'secure_document_url',
            'technical_evaluation_advisory',
            'items', 'approvals', 'review_comments', 'reviewed_by', 'reviewed_by_details',
            'reviewed_at', 'submitted_at', 'required_date', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'req_number', 'requested_by', 'assigned_purchase_officer',
            'assigned_purchase_officer_details', 'assigned_purchase_officer_name',
            'assignment_status', 'assigned_at',
            'requires_technical_evaluation',
            'technical_specialization', 'review_comments', 'reviewed_by', 'reviewed_at',
            'submitted_at', 'required_date', 'secure_document_url', 'technical_evaluation_advisory',
            'created_at', 'updated_at'
        ]

    def get_assigned_purchase_officer_name(self, obj):
        if obj.assigned_purchase_officer:
            full_name = obj.assigned_purchase_officer.get_full_name()
            return full_name.strip() if full_name and full_name.strip() else obj.assigned_purchase_officer.username
        return None

    def get_assignment_status(self, obj):
        if obj.assigned_purchase_officer:
            return "Assigned"
        return "Pending Assignment"

    def get_technical_evaluation_advisory(self, obj):
        return obj.get_technical_evaluation_advisory()

    def get_required_date(self, obj):
        dates = [it.required_date for it in obj.items.all() if it.required_date]
        return min(dates).isoformat() if dates else None

    def get_secure_document_url(self, obj):
        if obj.supporting_document:
            request = self.context.get('request')
            rel_url = f"/api/procurement/requisitions/{obj.id}/document/"
            if request:
                return request.build_absolute_uri(rel_url)
            return rel_url
        return None

    def validate_supporting_document(self, value):
        if not value:
            return value
        max_size = 10 * 1024 * 1024  # 10 MB
        if value.size > max_size:
            raise serializers.ValidationError("Supporting document file size cannot exceed 10 MB.")

        ext = os.path.splitext(value.name)[1].lower()
        if ext != '.pdf':
            raise serializers.ValidationError(
                f"Unsupported file format '{ext}'. Only PDF documents (.pdf) are allowed as supporting documents."
            )

        content_type = getattr(value, 'content_type', None)
        if content_type and content_type.lower() != 'application/pdf':
            raise serializers.ValidationError("Invalid file MIME type. Supporting document must be an 'application/pdf'.")

        try:
            initial_pos = value.tell()
            header = value.read(5)
            value.seek(initial_pos)
            if not header.startswith(b'%PDF-'):
                raise serializers.ValidationError(
                    "Invalid PDF file. The file content does not begin with the valid PDF signature (%PDF-)."
                )
        except Exception as e:
            if isinstance(e, serializers.ValidationError):
                raise e
            raise serializers.ValidationError("Unable to verify PDF file contents.")

        return value

    def to_internal_value(self, data):
        items_data = data.get('items')
        if isinstance(items_data, str):
            try:
                # Create a shallow dict copy instead of data.copy() to avoid deepcopying file handles
                if hasattr(data, 'dict'):
                    shallow_data = data.dict()
                else:
                    shallow_data = dict(data)
                shallow_data['items'] = json.loads(items_data)
                return super().to_internal_value(shallow_data)
            except (json.JSONDecodeError, TypeError):
                pass
        return super().to_internal_value(data)

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None

        # Determine effective department strictly from authenticated account
        target_department = None
        if user and user.is_authenticated:
            r_name = user.role.name.lower() if getattr(user, 'role', None) else ''
            is_staff_role = 'staff' in r_name or 'department' in r_name

            if is_staff_role or getattr(user, 'department', None):
                if not user.department:
                    raise serializers.ValidationError({
                        'department': 'Department Staff must have an assigned department to create or update purchase requisitions.'
                    })
                # Lock department strictly to user's real assigned department (never trust payload)
                target_department = user.department
                attrs['department'] = user.department

        # For admin or privileged roles without user.department
        if not target_department:
            if attrs.get('department'):
                target_department = attrs.get('department')
            elif self.instance and self.instance.department:
                target_department = self.instance.department

        target_status = attrs.get('status')
        if not target_status and self.instance:
            target_status = self.instance.status
        is_submitting = target_status == Requisition.StatusChoices.SUBMITTED

        if target_department:
            dept_name = target_department.name if hasattr(target_department, 'name') else str(target_department)
            allowed_categories = get_allowed_categories_for_department(dept_name)

            # Validate top-level category if provided
            top_category = attrs.get('category')
            if top_category and str(top_category).strip():
                top_category = str(top_category).strip()
                if top_category not in allowed_categories:
                    raise serializers.ValidationError({
                        'category': f"Category '{top_category}' is not allowed for department '{dept_name}'. Allowed categories: {', '.join(allowed_categories)}."
                    })

            # Validate items' categories (create, update, or resubmit)
            items_data = attrs.get('items')
            if items_data is not None:
                if is_submitting and len(items_data) == 0:
                    raise serializers.ValidationError({
                        'items': 'At least one item must be included in the requisition.'
                    })
                for idx, item in enumerate(items_data):
                    item_cat = item.get('category') if isinstance(item, dict) else getattr(item, 'category', None)
                    if not item_cat or not str(item_cat).strip():
                        if is_submitting:
                            raise serializers.ValidationError({
                                'items': f"Item #{idx + 1}: Category is required before submission. Please select an allowed category."
                            })
                    else:
                        item_cat = str(item_cat).strip()
                        if item_cat not in allowed_categories:
                            raise serializers.ValidationError({
                                'items': f"Item #{idx + 1}: Category '{item_cat}' is not allowed for department '{dept_name}'. Allowed categories: {', '.join(allowed_categories)}."
                            })

        # Prevent Department Staff from setting statuses that bypass Purchase Officer review
        if user and user.is_authenticated:
            r_name = user.role.name.lower() if getattr(user, 'role', None) else ''
            is_privileged = user.is_superuser or user.is_staff or any(x in r_name for x in ['purchase', 'committee', 'admin'])
            if not is_privileged:
                desired_status = attrs.get('status')
                if desired_status and desired_status not in [Requisition.StatusChoices.DRAFT, Requisition.StatusChoices.SUBMITTED]:
                    raise serializers.ValidationError({
                        'status': f"Department Staff cannot directly set status to '{desired_status}'. Requisitions must be submitted for Purchase Officer Review."
                    })

        return super().validate(attrs)

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        requisition = Requisition.objects.create(**validated_data)

        total_budget = Decimal('0.00')
        first_category = None
        for item_dict in items_data:
            item = RequisitionItem.objects.create(requisition=requisition, **item_dict)
            total_budget += item.total_price
            if not first_category and item.category:
                first_category = item.category

        requisition.estimated_budget = total_budget
        if not requisition.category and first_category:
            requisition.category = first_category

        # Technical evaluation is NOT decided by Department Staff.
        # It is decided explicitly by the Purchase Officer during review.
        requisition.requires_technical_evaluation = False
        requisition.technical_specialization = None
        requisition.save()

        return requisition

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)

        if items_data is not None:
            instance.items.all().delete()
            total_budget = Decimal('0.00')
            first_category = None
            for item_dict in items_data:
                item = RequisitionItem.objects.create(requisition=instance, **item_dict)
                total_budget += item.total_price
                if not first_category and item.category:
                    first_category = item.category

            instance.estimated_budget = total_budget
            if first_category:
                instance.category = first_category

            # When modified or resubmitted, technical evaluation must be decided again by PO
            if instance.status in [Requisition.StatusChoices.DRAFT, Requisition.StatusChoices.RETURNED, Requisition.StatusChoices.SUBMITTED]:
                instance.requires_technical_evaluation = False
                instance.technical_specialization = None

        instance.save()
        return instance


class QuotationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationItem
        fields = ['id', 'quotation', 'item_name', 'specification', 'quantity', 'unit_price', 'total_price', 'created_at', 'updated_at']
        read_only_fields = ['id', 'total_price', 'created_at', 'updated_at']


class QuotationSerializer(serializers.ModelSerializer):
    vendor = serializers.PrimaryKeyRelatedField(
        queryset=Vendor.objects.filter(status=Vendor.StatusChoices.ACTIVE, is_active=True)
    )
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    items = QuotationItemSerializer(many=True, read_only=True)

    class Meta:
        model = Quotation
        fields = [
            'id', 'quotation_number', 'quotation_request', 'vendor', 'vendor_details',
            'submission_date', 'valid_until', 'total_amount', 'lead_time_days',
            'status', 'remarks', 'items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'quotation_number', 'total_amount', 'created_at', 'updated_at']


class QuotationRequestSerializer(serializers.ModelSerializer):
    requisition_details = RequisitionSerializer(source='requisition', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)
    quotations = QuotationSerializer(many=True, read_only=True)

    class Meta:
        model = QuotationRequest
        fields = [
            'id', 'rfq_number', 'requisition', 'requisition_details', 'created_by',
            'created_by_details', 'title', 'issue_date', 'due_date',
            'terms_and_conditions', 'status', 'quotations', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'rfq_number', 'created_by', 'created_at', 'updated_at']


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderItem
        fields = ['id', 'purchase_order', 'item_name', 'specification', 'quantity', 'unit_price', 'total_price', 'created_at', 'updated_at']
        read_only_fields = ['id', 'total_price', 'created_at', 'updated_at']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    vendor = serializers.PrimaryKeyRelatedField(
        queryset=Vendor.objects.filter(status=Vendor.StatusChoices.ACTIVE, is_active=True)
    )
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)
    items = PurchaseOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'quotation', 'vendor', 'vendor_details',
            'created_by', 'created_by_details', 'total_amount', 'order_date',
            'expected_delivery_date', 'terms_and_conditions', 'status',
            'items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'po_number', 'created_by', 'created_at', 'updated_at']
