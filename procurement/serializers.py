import os
import json
from decimal import Decimal
from rest_framework import serializers
from .models import (
    Requisition, RequisitionItem, Approval, QuotationRequest, RFQItem, RFQVendorInvitation,
    Quotation, QuotationItem, PurchaseOrder, PurchaseOrderItem,
    TechnicalEvaluation
)
from accounts.models import Department
from accounts.serializers import UserSerializer, DepartmentSerializer
from vendors.models import Vendor
from vendors.serializers import VendorSerializer
from .constants import DEPARTMENT_CATEGORY_MAP, get_allowed_categories_for_department


class TechnicalEvaluationSerializer(serializers.ModelSerializer):
    evaluated_by_details = UserSerializer(source='evaluated_by', read_only=True)
    evaluated_by_name = serializers.SerializerMethodField()
    evaluated_by_employee_id = serializers.SerializerMethodField()
    supporting_document_url = serializers.SerializerMethodField()

    class Meta:
        model = TechnicalEvaluation
        fields = [
            'id', 'requisition', 'evaluated_by', 'evaluated_by_details',
            'evaluated_by_name', 'evaluated_by_employee_id',
            'compliance', 'remarks', 'recommendation',
            'supporting_document', 'supporting_document_url',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'evaluated_by', 'created_at', 'updated_at']

    def get_evaluated_by_name(self, obj):
        if obj.evaluated_by:
            name = obj.evaluated_by.get_full_name()
            return name.strip() if name and name.strip() else obj.evaluated_by.username
        return None

    def get_evaluated_by_employee_id(self, obj):
        if obj.evaluated_by and obj.evaluated_by.employee_id:
            return obj.evaluated_by.employee_id
        return None

    def get_supporting_document_url(self, obj):
        if obj.supporting_document or getattr(obj, 'technical_document', None):
            request = self.context.get('request')
            rel = f"/api/procurement/requisitions/{obj.id}/document/"
            if request:
                return request.build_absolute_uri(rel)
            return rel
        return None


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
    assigned_purchase_officer_employee_id = serializers.SerializerMethodField()
    assignment_status = serializers.SerializerMethodField()
    assigned_technical_officer_details = UserSerializer(source='assigned_technical_officer', read_only=True)
    assigned_technical_officer_name = serializers.SerializerMethodField()
    assigned_technical_officer_employee_id = serializers.SerializerMethodField()
    technical_assignment_status = serializers.SerializerMethodField()
    assigned_committee_member_details = UserSerializer(source='assigned_committee_member', read_only=True)
    assigned_committee_member_name = serializers.SerializerMethodField()
    assigned_committee_member_employee_id = serializers.SerializerMethodField()
    committee_assignment_status = serializers.SerializerMethodField()
    intake_source = serializers.SerializerMethodField()
    intake_source_display = serializers.SerializerMethodField()
    technical_evaluations = TechnicalEvaluationSerializer(many=True, read_only=True)
    technical_document_url = serializers.SerializerMethodField()
    approvals = ApprovalSerializer(many=True, read_only=True)
    items = RequisitionItemSerializer(many=True, required=False)
    supporting_document = serializers.FileField(required=False, allow_null=True)
    requisition_number = serializers.CharField(source='req_number', read_only=True)
    required_date = serializers.SerializerMethodField()
    secure_document_url = serializers.SerializerMethodField()
    technical_evaluation_advisory = serializers.SerializerMethodField()
    latest_rfq = serializers.SerializerMethodField()

    class Meta:
        model = Requisition
        fields = [
            'id', 'req_number', 'requisition_number', 'title', 'category', 'requires_technical_evaluation',
            'technical_specialization', 'department', 'department_details',
            'requested_by', 'requested_by_details', 'assigned_purchase_officer',
            'assigned_purchase_officer_details', 'assigned_purchase_officer_name',
            'assigned_purchase_officer_employee_id',
            'assignment_status', 'assigned_at',
            'assigned_technical_officer', 'assigned_technical_officer_details',
            'assigned_technical_officer_name', 'assigned_technical_officer_employee_id',
            'technical_assignment_status', 'technical_assigned_at',
            'assigned_committee_member', 'assigned_committee_member_details',
            'assigned_committee_member_name', 'assigned_committee_member_employee_id',
            'committee_assignment_status', 'committee_assigned_at',
            'intake_source', 'intake_source_display',
            'technical_compliance', 'technical_evaluation_remarks',
            'technical_recommendation', 'technical_evaluated_at',
            'technical_document', 'technical_document_url', 'technical_evaluations',
            'priority', 'estimated_budget',
            'status', 'justification', 'supporting_document', 'secure_document_url',
            'technical_evaluation_advisory', 'latest_rfq',
            'items', 'approvals', 'review_comments', 'reviewed_by', 'reviewed_by_details',
            'reviewed_at', 'submitted_at', 'required_date', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'req_number', 'requisition_number', 'requested_by', 'assigned_purchase_officer',
            'assigned_purchase_officer_details', 'assigned_purchase_officer_name',
            'assigned_purchase_officer_employee_id',
            'assignment_status', 'assigned_at',
            'assigned_technical_officer', 'assigned_technical_officer_details',
            'assigned_technical_officer_name', 'assigned_technical_officer_employee_id',
            'technical_assignment_status', 'technical_assigned_at',
            'assigned_committee_member', 'assigned_committee_member_details',
            'assigned_committee_member_name', 'assigned_committee_member_employee_id',
            'committee_assignment_status', 'committee_assigned_at',
            'intake_source', 'intake_source_display',
            'technical_compliance', 'technical_evaluation_remarks',
            'technical_recommendation', 'technical_evaluated_at',
            'technical_document', 'technical_document_url', 'technical_evaluations',
            'requires_technical_evaluation',
            'technical_specialization', 'review_comments', 'reviewed_by', 'reviewed_at',
            'submitted_at', 'required_date', 'secure_document_url', 'technical_evaluation_advisory',
            'latest_rfq', 'created_at', 'updated_at'
        ]

    def get_assigned_purchase_officer_name(self, obj):
        if obj.assigned_purchase_officer:
            full_name = obj.assigned_purchase_officer.get_full_name()
            return full_name.strip() if full_name and full_name.strip() else obj.assigned_purchase_officer.username
        return None

    def get_assigned_purchase_officer_employee_id(self, obj):
        if obj.assigned_purchase_officer and obj.assigned_purchase_officer.employee_id:
            return obj.assigned_purchase_officer.employee_id
        return None

    def get_assignment_status(self, obj):
        if obj.assigned_purchase_officer:
            return "Assigned"
        return "Pending Assignment"

    def get_assigned_technical_officer_name(self, obj):
        if obj.assigned_technical_officer:
            full_name = obj.assigned_technical_officer.get_full_name()
            return full_name.strip() if full_name and full_name.strip() else obj.assigned_technical_officer.username
        return None

    def get_assigned_technical_officer_employee_id(self, obj):
        if obj.assigned_technical_officer and obj.assigned_technical_officer.employee_id:
            return obj.assigned_technical_officer.employee_id
        return None

    def get_technical_assignment_status(self, obj):
        if obj.assigned_technical_officer:
            return "Assigned"
        elif obj.requires_technical_evaluation:
            return "Pending Assignment"
        return "Not Applicable"

    def get_technical_evaluation_advisory(self, obj):
        return obj.get_technical_evaluation_advisory()

    def get_required_date(self, obj):
        dates = [it.required_date for it in obj.items.all() if it.required_date]
        return min(dates).isoformat() if dates else None

    def get_secure_document_url(self, obj):
        if obj.supporting_document or obj.technical_document:
            request = self.context.get('request')
            rel_url = f"/api/procurement/requisitions/{obj.id}/document/"
            if request:
                return request.build_absolute_uri(rel_url)
            return rel_url
        return None

    def get_technical_document_url(self, obj):
        if obj.technical_document or obj.supporting_document:
            request = self.context.get('request')
            rel_url = f"/api/procurement/requisitions/{obj.id}/document/"
            if request:
                return request.build_absolute_uri(rel_url)
            return rel_url
        return None

    def get_assigned_committee_member_name(self, obj):
        if obj.assigned_committee_member:
            full_name = obj.assigned_committee_member.get_full_name()
            return full_name.strip() if full_name and full_name.strip() else obj.assigned_committee_member.username
        return None

    def get_assigned_committee_member_employee_id(self, obj):
        if obj.assigned_committee_member and obj.assigned_committee_member.employee_id:
            return obj.assigned_committee_member.employee_id
        return None

    def get_committee_assignment_status(self, obj):
        if obj.assigned_committee_member:
            return "Assigned"
        return "Pending Assignment"

    def get_intake_source(self, obj):
        if obj.requires_technical_evaluation:
            return "TECHNICAL_EVALUATION"
        return "NO_TECHNICAL_EVALUATION"

    def get_intake_source_display(self, obj):
        if obj.requires_technical_evaluation:
            return "Technical Evaluation Completed"
        return "No Technical Evaluation Required"

    def get_latest_rfq(self, obj):
        rfq = obj.quotation_requests.order_by('-created_at').first()
        if not rfq:
            return None

        invitations = rfq.vendor_invitations.select_related('vendor').prefetch_related('vendor__supplier_categories').all()
        quotations_map = {q.vendor_id: q for q in rfq.quotations.all()}

        tracking = []
        for inv in invitations:
            v = inv.vendor
            q = quotations_map.get(v.id)
            tracking.append({
                'invitation_id': inv.id,
                'vendor_id': v.id,
                'vendor_code': v.vendor_code or f"VEN-2026-{v.id:05d}",
                'company_name': v.company_name,
                'contact_person': v.contact_person,
                'email': v.email,
                'phone': v.phone,
                'categories': [c.name for c in v.supplier_categories.all() if c.name],
                'invitation_status': inv.status,
                'invitation_status_display': inv.get_status_display(),
                'invited_at': inv.invited_at.isoformat() if inv.invited_at else None,
                'has_quoted': q is not None,
                'quotation_id': q.id if q else None,
                'quotation_number': q.quotation_number if q else None,
                'quotation_status': q.status if q else 'PENDING',
                'quotation_status_display': q.get_status_display() if q else 'Awaiting Quotation',
                'total_amount': str(q.total_amount) if q else None,
                'lead_time_days': q.lead_time_days if q else None,
                'submission_date': q.submission_date.isoformat() if q and q.submission_date else None,
                'remarks': q.remarks if q else None,
            })

        total_invited = len(tracking)
        quoted_count = sum(1 for t in tracking if t['has_quoted'])

        if rfq.status == 'CANCELLED':
            workflow_status = 'CANCELLED'
            workflow_status_display = 'Cancelled'
        elif rfq.status == 'CLOSED' or any(t.get('quotation_status') == 'ACCEPTED' for t in tracking):
            workflow_status = 'COMPLETED'
            workflow_status_display = 'Quotation Stage Completed'
        elif quoted_count == 0:
            workflow_status = 'AWAITING_QUOTATIONS'
            workflow_status_display = f'Awaiting Quotations (0/{total_invited})'
        elif total_invited > 0 and quoted_count >= total_invited:
            workflow_status = 'ALL_QUOTATIONS_RECEIVED'
            workflow_status_display = f'All Quotations Received ({quoted_count}/{total_invited})'
        else:
            workflow_status = 'QUOTATIONS_RECEIVED'
            workflow_status_display = f'Quotations Received ({quoted_count}/{total_invited})'

        return {
            'id': rfq.id,
            'rfq_number': rfq.rfq_number,
            'title': rfq.title,
            'due_date': rfq.due_date.isoformat() if rfq.due_date else None,
            'delivery_requirements': rfq.delivery_requirements,
            'delivery_location': rfq.delivery_location,
            'terms_and_conditions': rfq.terms_and_conditions,
            'status': rfq.status,
            'status_display': rfq.get_status_display(),
            'invited_vendors_count': total_invited,
            'quotations_count': quoted_count,
            'quotation_workflow_status': workflow_status,
            'quotation_workflow_status_display': workflow_status_display,
            'vendor_tracking': tracking,
            'created_at': rfq.created_at.isoformat() if rfq.created_at else None,
        }

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

        # Check if this is a resubmission of a requisition returned for technical clarification
        is_to_resubmit = (
            self.instance and
            self.instance.status == Requisition.StatusChoices.RETURNED and
            self.instance.is_returned_for_technical_clarification()
        )

        desired_status = attrs.get('status')
        if is_to_resubmit and desired_status in [Requisition.StatusChoices.SUBMITTED, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION]:
            assigned_to = self.instance.assigned_technical_officer
            if not assigned_to or not assigned_to.is_active:
                to_name = (assigned_to.get_full_name() or assigned_to.username) if assigned_to else "Assigned Technical Officer"
                raise serializers.ValidationError({
                    'detail': f"The assigned Technical Officer ({to_name}) is currently inactive or unavailable. Please contact the administrator or Purchase Officer."
                })
            # Route directly to PENDING_TECHNICAL_EVALUATION for the same Technical Officer
            attrs['status'] = Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION
        else:
            # Prevent Department Staff from setting statuses that bypass Purchase Officer review
            if user and user.is_authenticated:
                r_name = user.role.name.lower() if getattr(user, 'role', None) else ''
                is_privileged = user.is_superuser or user.is_staff or any(x in r_name for x in ['purchase', 'committee', 'admin'])
                if not is_privileged:
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
        requisition.assigned_technical_officer = None
        requisition.technical_assigned_at = None
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
            # UNLESS this requisition was returned for clarification by a Technical Officer,
            # in which case the Technical Officer assignment and technical evaluation requirement must be preserved.
            is_to_clarification = instance.is_returned_for_technical_clarification()
            if not is_to_clarification:
                if instance.status in [Requisition.StatusChoices.DRAFT, Requisition.StatusChoices.RETURNED, Requisition.StatusChoices.SUBMITTED]:
                    instance.requires_technical_evaluation = False
                    instance.technical_specialization = None
                    instance.assigned_technical_officer = None
                    instance.technical_assigned_at = None
            else:
                instance.requires_technical_evaluation = True

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
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    quotation_document_url = serializers.SerializerMethodField()

    class Meta:
        model = Quotation
        fields = [
            'id', 'quotation_number', 'quotation_request', 'vendor', 'vendor_details',
            'submission_date', 'valid_until', 'total_amount', 'tax_percentage',
            'tax_amount', 'shipping_charges', 'quotation_document', 'quotation_document_url',
            'lead_time_days', 'status', 'status_display', 'remarks', 'items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'quotation_number', 'created_at', 'updated_at']

    def validate_quotation_document(self, value):
        if value:
            max_size = 15 * 1024 * 1024
            if value.size > max_size:
                raise serializers.ValidationError("Quotation document file size exceeds the 15MB limit.")
            import os
            ext = os.path.splitext(value.name or '')[1].lower()
            if ext != '.pdf':
                raise serializers.ValidationError("Only PDF files (.pdf) are accepted. DOC, DOCX, and images are rejected.")
            header = value.read(5)
            value.seek(0)
            if header != b'%PDF-':
                raise serializers.ValidationError("Uploaded file is not a valid PDF document. Header signature verification failed.")
        return value

    def get_quotation_document_url(self, obj):
        if obj.quotation_document:
            request = self.context.get('request')
            rel_url = f"/api/procurement/quotations/{obj.id}/document/"
            if request:
                return request.build_absolute_uri(rel_url)
            return rel_url
        return None


class RFQItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = RFQItem
        fields = [
            'id', 'quotation_request', 'requisition_item', 'item_name',
            'category', 'quantity', 'unit_of_measurement',
            'technical_specifications', 'estimated_unit_price', 'total_estimated_price',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'total_estimated_price', 'created_at', 'updated_at']


class RFQVendorInvitationSerializer(serializers.ModelSerializer):
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    invited_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = RFQVendorInvitation
        fields = [
            'id', 'quotation_request', 'vendor', 'vendor_details',
            'status', 'status_display', 'invited_at', 'invited_by', 'invited_by_name', 'notes'
        ]
        read_only_fields = ['id', 'invited_at']

    def get_invited_by_name(self, obj):
        if obj.invited_by:
            return obj.invited_by.get_full_name() or obj.invited_by.username
        return None


class QuotationRequestSerializer(serializers.ModelSerializer):
    requisition_details = RequisitionSerializer(source='requisition', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)
    cancelled_by_details = UserSerializer(source='cancelled_by', read_only=True)
    items = RFQItemSerializer(many=True, read_only=True)
    vendor_invitations = RFQVendorInvitationSerializer(many=True, read_only=True)
    quotations = QuotationSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_expired = serializers.SerializerMethodField()
    invited_vendors_count = serializers.SerializerMethodField()
    quotations_count = serializers.SerializerMethodField()
    quotation_workflow_status = serializers.SerializerMethodField()
    quotation_workflow_status_display = serializers.SerializerMethodField()
    has_accepted_quotation = serializers.SerializerMethodField()
    winning_quotation_id = serializers.SerializerMethodField()
    vendor_tracking = serializers.SerializerMethodField()
    my_invitation = serializers.SerializerMethodField()
    my_quotation = serializers.SerializerMethodField()

    class Meta:
        model = QuotationRequest
        fields = [
            'id', 'rfq_number', 'requisition', 'requisition_details',
            'created_by', 'created_by_details', 'title', 'issue_date', 'due_date',
            'delivery_requirements', 'delivery_location', 'estimated_budget',
            'terms_and_conditions', 'status', 'status_display', 'is_expired',
            'cancellation_reason', 'cancelled_by', 'cancelled_by_details', 'cancelled_at',
            'items', 'vendor_invitations', 'invited_vendors_count',
            'quotations', 'quotations_count', 'quotation_workflow_status',
            'quotation_workflow_status_display', 'has_accepted_quotation',
            'winning_quotation_id', 'vendor_tracking', 'my_invitation', 'my_quotation',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'rfq_number', 'created_by', 'cancelled_by', 'cancelled_at',
            'created_at', 'updated_at', 'status_display', 'is_expired', 'invited_vendors_count',
            'quotations_count', 'quotation_workflow_status', 'quotation_workflow_status_display',
            'has_accepted_quotation', 'winning_quotation_id', 'vendor_tracking',
            'my_invitation', 'my_quotation'
        ]

    def get_is_expired(self, obj):
        from django.utils import timezone
        if obj.due_date and obj.status in [QuotationRequest.StatusChoices.OPEN, QuotationRequest.StatusChoices.SENT]:
            return obj.due_date < timezone.now().date()
        return obj.status == QuotationRequest.StatusChoices.EXPIRED

    def get_invited_vendors_count(self, obj):
        return obj.vendor_invitations.count()

    def get_quotations_count(self, obj):
        return obj.quotations.count()

    def get_quotation_workflow_status(self, obj):
        if obj.status == QuotationRequest.StatusChoices.CANCELLED:
            return 'CANCELLED'
        if obj.status == QuotationRequest.StatusChoices.CLOSED:
            return 'COMPLETED'
        from django.utils import timezone
        if obj.due_date and obj.due_date < timezone.now().date():
            return 'EXPIRED'

        has_accepted = obj.quotations.filter(status=Quotation.StatusChoices.ACCEPTED).exists()
        if has_accepted:
            return 'COMPLETED'

        quoted_count = obj.quotations.count()
        if quoted_count == 0:
            return 'AWAITING_QUOTATIONS'
        total_invited = obj.vendor_invitations.count()
        if total_invited > 0 and quoted_count >= total_invited:
            return 'ALL_QUOTATIONS_RECEIVED'
        return 'QUOTATIONS_RECEIVED'

    def get_quotation_workflow_status_display(self, obj):
        wf = self.get_quotation_workflow_status(obj)
        quoted_count = obj.quotations.count()
        total_invited = obj.vendor_invitations.count()
        if wf == 'CANCELLED':
            return 'Cancelled'
        if wf == 'EXPIRED':
            return 'Expired'
        if wf == 'COMPLETED':
            return 'Quotation Stage Completed'
        if wf == 'AWAITING_QUOTATIONS':
            return f"Awaiting Quotations (0/{total_invited})"
        if wf == 'ALL_QUOTATIONS_RECEIVED':
            return f"All Quotations Received ({quoted_count}/{total_invited})"
        return f"Quotations Received ({quoted_count}/{total_invited})"

    def get_has_accepted_quotation(self, obj):
        return obj.quotations.filter(status=Quotation.StatusChoices.ACCEPTED).exists()

    def get_winning_quotation_id(self, obj):
        accepted = obj.quotations.filter(status=Quotation.StatusChoices.ACCEPTED).first()
        return accepted.id if accepted else None

    def get_vendor_tracking(self, obj):
        request = self.context.get('request')
        tracking = []
        invitations = obj.vendor_invitations.select_related('vendor', 'invited_by').all()
        quotations_by_vendor = {
            q.vendor_id: q for q in obj.quotations.select_related('vendor').prefetch_related('items').all()
        }
        for inv in invitations:
            v = inv.vendor
            q = quotations_by_vendor.get(v.id)
            cats = [c.name for c in v.supplier_categories.all() if c.name]
            tracking.append({
                'invitation_id': inv.id,
                'vendor_id': v.id,
                'vendor_code': v.vendor_code or f"VEN-2026-{v.id:05d}",
                'company_name': v.company_name or v.name,
                'contact_person': v.contact_person or 'Representative',
                'email': v.email or 'N/A',
                'phone': v.phone or 'N/A',
                'categories': cats,
                'invitation_status': inv.status,
                'invitation_status_display': inv.get_status_display(),
                'invited_at': inv.invited_at.isoformat() if inv.invited_at else None,
                'has_quoted': q is not None,
                'quotation_id': q.id if q else None,
                'quotation_number': q.quotation_number if q else None,
                'quotation_status': q.status if q else 'PENDING',
                'quotation_status_display': q.get_status_display() if q else 'Awaiting Quotation',
                'total_amount': str(q.total_amount) if q else None,
                'tax_percentage': str(q.tax_percentage) if q and q.tax_percentage is not None else '0.00',
                'tax_amount': str(q.tax_amount) if q and q.tax_amount is not None else '0.00',
                'shipping_charges': str(q.shipping_charges) if q and q.shipping_charges is not None else '0.00',
                'quotation_document_url': (request.build_absolute_uri(f"/api/procurement/quotations/{q.id}/document/") if request else f"/api/procurement/quotations/{q.id}/document/") if (q and q.quotation_document) else None,
                'lead_time_days': q.lead_time_days if q else None,
                'valid_until': q.valid_until.isoformat() if q and q.valid_until else None,
                'submission_date': q.submission_date.isoformat() if q and q.submission_date else None,
                'remarks': q.remarks if q else None,
                'items': [
                    {
                        'id': qi.id,
                        'item_name': qi.item_name,
                        'quantity': qi.quantity,
                        'unit_price': str(qi.unit_price),
                        'total_price': str(qi.total_price),
                        'specification': qi.specification,
                    } for qi in q.items.all()
                ] if q else []
            })
        return tracking

    def _get_request_vendor(self):
        request = self.context.get('request')
        if not request or not request.user or not request.user.is_authenticated:
            return None
        user = request.user
        role_name = user.role.name.lower() if user.role else ''
        if 'vendor' in role_name or hasattr(user, 'vendor_profile'):
            from vendors.models import Vendor
            return getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
        return None

    def get_my_invitation(self, obj):
        vendor = self._get_request_vendor()
        if not vendor:
            return None
        inv = obj.vendor_invitations.filter(vendor=vendor).first()
        if not inv:
            return None
        return {
            'id': inv.id,
            'status': inv.status,
            'status_display': inv.get_status_display(),
            'invited_at': inv.invited_at.isoformat() if inv.invited_at else None,
            'notes': inv.notes
        }

    def get_my_quotation(self, obj):
        vendor = self._get_request_vendor()
        if not vendor:
            return None
        q = obj.quotations.filter(vendor=vendor).prefetch_related('items').first()
        if not q:
            return None
        return QuotationSerializer(q, context=self.context).data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        vendor = self._get_request_vendor()
        if vendor:
            # Mask other vendors' quotations and tracking to enforce privacy
            my_quote = data.get('my_quotation')
            data['quotations'] = [my_quote] if my_quote else []
            data['quotations_count'] = 1 if my_quote else 0
            data['vendor_tracking'] = [
                vt for vt in data.get('vendor_tracking', [])
                if vt.get('vendor_id') == vendor.id
            ]
        return data


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
