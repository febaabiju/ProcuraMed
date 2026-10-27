import os
import io
import json
import mimetypes
from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from accounts.models import AuditLog
from accounts.permissions import IsDepartmentStaff, IsPurchaseOfficer, IsCommitteeMember, IsTechnicalOfficer
from inventory.models import Delivery
from vendors.models import Vendor
from .models import (
    Requisition, Approval, QuotationRequest, RFQItem, RFQVendorInvitation,
    Quotation, QuotationItem, PurchaseOrder, PurchaseOrderItem,
    TechnicalEvaluation,
    NON_TECHNICAL_CATEGORIES, CATEGORY_TO_SPECIALIZATION
)
from .serializers import (
    RequisitionSerializer, ApprovalSerializer, QuotationRequestSerializer,
    RFQItemSerializer, RFQVendorInvitationSerializer,
    QuotationSerializer, QuotationItemSerializer, PurchaseOrderSerializer, PurchaseOrderItemSerializer,
    TechnicalEvaluationSerializer
)
from .permissions import IsRequisitionOwnerOrOfficer, IsCommitteeOrAdmin, IsPurchaseOfficerOrAdmin
from .filters import RequisitionFilter, QuotationRequestFilter, QuotationFilter, PurchaseOrderFilter
from .constants import DEPARTMENT_CATEGORY_MAP, get_allowed_categories_for_department


class RequisitionViewSet(viewsets.ModelViewSet):
    queryset = Requisition.objects.select_related('department', 'requested_by', 'assigned_purchase_officer', 'assigned_technical_officer').prefetch_related('approvals', 'items').all()
    serializer_class = RequisitionSerializer
    permission_classes = [IsAuthenticated, IsRequisitionOwnerOrOfficer]
    filterset_class = RequisitionFilter
    search_fields = ['req_number', 'title', 'justification']
    ordering_fields = ['id', 'created_at', 'priority', 'status']

    def get_permissions(self):
        if self.action == 'review':
            return [IsAuthenticated(), IsPurchaseOfficerOrAdmin()]
        elif self.action == 'approve':
            return [IsCommitteeOrAdmin()]
        elif self.action == 'evaluate':
            return [IsAuthenticated(), IsTechnicalOfficer()]
        elif self.action == 'document':
            return [AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Requisition.objects.none()

        r_name = user.role.name.lower() if user.role else ''
        is_to = 'technical' in r_name
        is_staff_role = 'staff' in r_name or 'department' in r_name
        is_po = ('purchase' in r_name or 'purchase officer' in r_name) and ('staff' not in r_name) and not is_to
        is_admin_or_super = user.is_superuser or user.is_staff or 'admin' in r_name

        qs = Requisition.objects.select_related(
            'department', 'requested_by', 'assigned_purchase_officer', 'assigned_technical_officer', 'assigned_committee_member'
        ).prefetch_related(
            'approvals', 'items', 'technical_evaluations',
            'quotation_requests__vendor_invitations__vendor__supplier_categories',
            'quotation_requests__quotations'
        )

        if is_admin_or_super:
            return qs

        if is_to:
            # Technical Officers can ONLY see requisitions assigned to them (or requested by them)
            return qs.filter(Q(assigned_technical_officer=user) | Q(requested_by=user))

        if is_po:
            if self.action in ['review', 'approved_vendor_selections']:
                return qs
            return qs.filter(
                Q(assigned_purchase_officer=user) |
                Q(requested_by=user) |
                Q(assigned_purchase_officer__isnull=True, reviewed_by=user)
            )

        is_committee = 'committee' in r_name
        if is_committee:
            # Auto-assign any unassigned committee requisitions to ensure all received requests have assignments
            unassigned_qs = Requisition.objects.filter(
                status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
                assigned_committee_member__isnull=True
            )
            for u_req in unassigned_qs:
                u_req.assign_committee_member(save=True)

            # Individual request assignment:
            # Each committee member can ONLY see and process purchase requests assigned directly to them.
            qs = qs.filter(Q(assigned_committee_member=user) | Q(requested_by=user))

            # Category / Intake Source filtering
            intake_filter = self.request.query_params.get('intake_source')
            if intake_filter in ['technical', 'TECHNICAL', 'Technical Evaluation Completed']:
                qs = qs.filter(requires_technical_evaluation=True)
            elif intake_filter in ['non_technical', 'NON_TECHNICAL', 'No Technical Evaluation Required']:
                qs = qs.filter(requires_technical_evaluation=False)

            return qs

        if is_staff_role:
            return qs.filter(requested_by=user)

        return qs.filter(requested_by=user)

    def filter_queryset(self, queryset):
        if self.action == 'find_vendors':
            return queryset
        return super().filter_queryset(queryset)

    def perform_create(self, serializer):
        user = self.request.user
        r_name = user.role.name.lower() if user.role else ''
        is_staff_role = 'staff' in r_name or 'department' in r_name

        # Department Staff must automatically and strictly use their assigned department
        if is_staff_role or user.department:
            if not user.department:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'department': 'Department Staff must have an assigned department to create a purchase requisition.'})
            instance = serializer.save(requested_by=user, department=user.department)
        else:
            instance = serializer.save(requested_by=user)

        if instance.status == Requisition.StatusChoices.SUBMITTED:
            po_tag = f" Assigned to Purchase Officer @{instance.assigned_purchase_officer.username}." if instance.assigned_purchase_officer else ""
            AuditLog.objects.create(
                user=user,
                action='Requisition Submitted',
                module='Purchase Requisition',
                description=f"Department staff @{user.username} created and submitted requisition {instance.req_number} ('{instance.title}').{po_tag}"
            )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_staff_role = 'staff' in r_name or 'department' in r_name
        is_po = any(x in r_name for x in ['purchase', 'officer']) and ('staff' not in r_name)
        is_to = 'technical' in r_name

        # Technical Officers cannot directly edit purchase request details
        if is_to and not (user.is_superuser or user.is_staff):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Technical Officers cannot edit purchase requests. Original request fields are strictly read-only.')

        # Purchase Officers cannot directly edit submitted requisition details
        if is_po and not (user.is_superuser or user.is_staff):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Purchase Officers cannot directly edit submitted requisitions. Requisitions are strictly read-only during review.')

        # Procurement Committee Members cannot directly edit purchase request details
        is_committee = 'committee' in r_name
        if is_committee and not (user.is_superuser or user.is_staff):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Committee Members cannot directly edit purchase requests. Decisions must be recorded via review actions.')

        # Once submitted, Department Staff cannot edit submitted data unless returned for correction
        if is_staff_role and instance.status not in [Requisition.StatusChoices.DRAFT, Requisition.StatusChoices.RETURNED]:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'Submitted requisitions cannot be edited unless returned for correction.'})

        prev_status = instance.status
        is_to_clarification = (
            prev_status == Requisition.StatusChoices.RETURNED and
            instance.is_returned_for_technical_clarification()
        )
        response = super().update(request, *args, **kwargs)
        new_status = request.data.get('status')
        if prev_status == Requisition.StatusChoices.RETURNED and new_status in [Requisition.StatusChoices.SUBMITTED, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION]:
            instance.refresh_from_db()
            if is_to_clarification:
                assigned_to = instance.assigned_technical_officer
                to_name = (assigned_to.get_full_name() or assigned_to.username) if assigned_to else "Assigned Technical Officer"
                instance.status = Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION
                instance.submitted_at = timezone.now()
                instance.requires_technical_evaluation = True
                instance.save(update_fields=['status', 'submitted_at', 'requires_technical_evaluation', 'updated_at'])
                AuditLog.objects.create(
                    user=request.user,
                    action='Requisition Resubmitted for Technical Clarification',
                    module='Purchase Requisition',
                    description=f"Department staff @{request.user.username} corrected and resubmitted requisition {instance.req_number} ('{instance.title}') directly to Technical Officer @{assigned_to.username} ({to_name}) for re-evaluation."
                )
            else:
                instance.submitted_at = timezone.now()
                if not instance.assigned_purchase_officer:
                    instance.assign_purchase_officer(save=False)
                instance.save(update_fields=['submitted_at', 'assigned_purchase_officer', 'assigned_at'])
                po_tag = f" Assigned to Purchase Officer @{instance.assigned_purchase_officer.username}." if instance.assigned_purchase_officer else ""
                AuditLog.objects.create(
                    user=request.user,
                    action='Requisition Resubmitted',
                    module='Purchase Requisition',
                    description=f"Department staff @{request.user.username} corrected and resubmitted requisition {instance.req_number} ('{instance.title}').{po_tag}"
                )
        return response

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_staff_role = 'staff' in r_name or 'department' in r_name
        is_po = any(x in r_name for x in ['purchase', 'officer']) and ('staff' not in r_name)

        # Purchase Officers cannot directly edit submitted requisition details
        if is_po and not (user.is_superuser or user.is_staff):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Purchase Officers cannot directly edit submitted requisitions. Requisitions are strictly read-only during review.')

        # Technical Officers cannot directly edit purchase request details
        is_to = 'technical' in r_name
        if is_to and not (user.is_superuser or user.is_staff):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Technical Officers cannot edit purchase requests. Original request fields are strictly read-only.')

        # Procurement Committee Members cannot directly edit purchase request details
        is_committee = 'committee' in r_name
        if is_committee and not (user.is_superuser or user.is_staff):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Committee Members cannot directly edit purchase requests. Decisions must be recorded via review actions.')

        # Once submitted, Department Staff cannot edit submitted data unless returned for correction
        if is_staff_role and instance.status not in [Requisition.StatusChoices.DRAFT, Requisition.StatusChoices.RETURNED]:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'Submitted requisitions cannot be edited unless returned for correction.'})

        prev_status = instance.status
        is_to_clarification = (
            prev_status == Requisition.StatusChoices.RETURNED and
            instance.is_returned_for_technical_clarification()
        )
        response = super().partial_update(request, *args, **kwargs)
        new_status = request.data.get('status')
        if prev_status == Requisition.StatusChoices.RETURNED and new_status in [Requisition.StatusChoices.SUBMITTED, Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION]:
            instance.refresh_from_db()
            if is_to_clarification:
                assigned_to = instance.assigned_technical_officer
                to_name = (assigned_to.get_full_name() or assigned_to.username) if assigned_to else "Assigned Technical Officer"
                instance.status = Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION
                instance.submitted_at = timezone.now()
                instance.requires_technical_evaluation = True
                instance.save(update_fields=['status', 'submitted_at', 'requires_technical_evaluation', 'updated_at'])
                AuditLog.objects.create(
                    user=request.user,
                    action='Requisition Resubmitted for Technical Clarification',
                    module='Purchase Requisition',
                    description=f"Department staff @{request.user.username} corrected and resubmitted requisition {instance.req_number} ('{instance.title}') directly to Technical Officer @{assigned_to.username} ({to_name}) for re-evaluation."
                )
            else:
                instance.submitted_at = timezone.now()
                if not instance.assigned_purchase_officer:
                    instance.assign_purchase_officer(save=False)
                instance.save(update_fields=['submitted_at', 'assigned_purchase_officer', 'assigned_at'])
                po_tag = f" Assigned to Purchase Officer @{instance.assigned_purchase_officer.username}." if instance.assigned_purchase_officer else ""
                AuditLog.objects.create(
                    user=request.user,
                    action='Requisition Resubmitted',
                    module='Purchase Requisition',
                    description=f"Department staff @{request.user.username} corrected and resubmitted requisition {instance.req_number} ('{instance.title}').{po_tag}"
                )
        return response

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_staff_role = 'staff' in r_name or 'department' in r_name

        if is_staff_role and instance.status != Requisition.StatusChoices.DRAFT:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'Submitted requisitions cannot be deleted.'})

        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='department-categories', permission_classes=[IsAuthenticated])
    def department_categories(self, request):
        """
        Returns ONLY the authenticated user's assigned department and its allowed categories.
        Does not expose the complete 7-department mapping to Department Staff.
        """
        user = request.user
        dept = getattr(user, 'department', None)
        dept_name = dept.name if dept else None
        allowed = get_allowed_categories_for_department(dept_name) if dept_name else []
        return Response({
            'department': dept_name,
            'allowed_categories': allowed
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        requisition = self.get_object()
        if requisition.status not in [Requisition.StatusChoices.DRAFT, Requisition.StatusChoices.RETURNED]:
            return Response(
                {'detail': f'Only draft or returned requisitions can be submitted. Current status is {requisition.status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not requisition.items.exists():
            return Response(
                {'detail': 'Requisition must contain at least one item to submit.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enforce that all items have valid allowed categories for the user's assigned department
        dept = requisition.department or getattr(request.user, 'department', None)
        if dept:
            dept_name = dept.name
            allowed_categories = get_allowed_categories_for_department(dept_name)
            for item in requisition.items.all():
                if not item.category or item.category not in allowed_categories:
                    return Response(
                        {
                            'detail': f"Item '{item.item_name}' has category '{item.category or 'Empty'}' which is not allowed for department '{dept_name}'. Allowed categories: {', '.join(allowed_categories)}. Please select an allowed category before submitting."
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

        previous_status = requisition.status
        is_to_clarification = (
            previous_status == Requisition.StatusChoices.RETURNED and
            requisition.is_returned_for_technical_clarification()
        )

        if is_to_clarification:
            assigned_to = requisition.assigned_technical_officer
            if not assigned_to or not assigned_to.is_active:
                to_name = (assigned_to.get_full_name() or assigned_to.username) if assigned_to else "Unknown Officer"
                return Response(
                    {
                        'detail': f"The assigned Technical Officer ({to_name}) is currently inactive or unavailable. Please contact the administrator or Purchase Officer."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                requisition.status = Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION
                requisition.submitted_at = timezone.now()
                requisition.requires_technical_evaluation = True
                # Preserve assigned_technical_officer, technical_specialization, and assigned_purchase_officer
                requisition.save(update_fields=[
                    'status', 'submitted_at', 'requires_technical_evaluation', 'updated_at'
                ])

                to_name = assigned_to.get_full_name() or assigned_to.username
                AuditLog.objects.create(
                    user=request.user,
                    action='Requisition Resubmitted for Technical Clarification',
                    module='Purchase Requisition',
                    description=f"Department staff @{request.user.username} corrected and resubmitted requisition {requisition.req_number} ('{requisition.title}') directly to Technical Officer @{assigned_to.username} ({to_name}) for re-evaluation."
                )

            return Response({
                'status': 'Requisition Resubmitted for Technical Evaluation',
                'requisition': RequisitionSerializer(requisition, context={'request': request}).data
            }, status=status.HTTP_200_OK)

        # Standard PO submission / resubmission
        requisition.status = Requisition.StatusChoices.SUBMITTED
        requisition.submitted_at = timezone.now()
        # Ensure technical evaluation decision is fresh for Purchase Officer review
        requisition.requires_technical_evaluation = False
        requisition.technical_specialization = None
        requisition.assigned_technical_officer = None
        requisition.technical_assigned_at = None
        if not requisition.assigned_purchase_officer:
            requisition.assign_purchase_officer(save=False)
        requisition.save()

        # Record submission / resubmission in AuditLog
        action_name = 'Requisition Resubmitted' if previous_status == Requisition.StatusChoices.RETURNED else 'Requisition Submitted'
        po_tag = f" Assigned to Purchase Officer @{requisition.assigned_purchase_officer.username}." if requisition.assigned_purchase_officer else ""
        AuditLog.objects.create(
            user=request.user,
            action=action_name,
            module='Purchase Requisition',
            description=f"Department staff @{request.user.username} submitted requisition {requisition.req_number} ('{requisition.title}') with {requisition.items.count()} items (Est. budget: ₹{requisition.estimated_budget or 0}).{po_tag}"
        )

        return Response({
            'status': 'Requisition Submitted Successfully',
            'requisition': RequisitionSerializer(requisition, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsPurchaseOfficerOrAdmin])
    def review(self, request, pk=None):
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_po = any(x in r_name for x in ['purchase', 'officer']) and ('staff' not in r_name)
        if not (user.is_superuser or user.is_staff or is_po):
            return Response(
                {'detail': 'Only Purchase Officers or Administrators can review requisitions.'},
                status=status.HTTP_403_FORBIDDEN
            )

        requisition = self.get_object()

        # Business Rule: Do not allow a Purchase Officer to review their own submitted requisition
        if requisition.requested_by == user:
            return Response(
                {'detail': 'You cannot review your own submitted requisition.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Business Rule: Purchase Officers can only review requisitions assigned to them
        if is_po and not (user.is_superuser or user.is_staff):
            if requisition.assigned_purchase_officer and requisition.assigned_purchase_officer != user:
                return Response(
                    {'detail': 'You can only review requisitions assigned to you.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # Business Rule: Only submitted requisitions can be reviewed
        if requisition.status != Requisition.StatusChoices.SUBMITTED:
            return Response(
                {'detail': f'Only submitted requisitions can be reviewed. Current status is {requisition.status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        action_type = request.data.get('action', '').upper().strip()
        reason = request.data.get('reason', '').strip() or request.data.get('comments', '').strip()

        if action_type not in ['APPROVE', 'PROCEED', 'RETURN', 'RETURN_FOR_CORRECTION', 'REJECT']:
            return Response(
                {'detail': "Invalid review action. Allowed actions are 'PROCEED', 'RETURN FOR CORRECTION', 'REJECT'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Return for Correction must require a reason
        if action_type in ['RETURN', 'RETURN_FOR_CORRECTION'] and not reason:
            return Response(
                {'reason': "A correction reason is mandatory when returning a requisition for correction."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Reject must require a reason
        if action_type == 'REJECT' and not reason:
            return Response(
                {'reason': "A rejection reason is mandatory when rejecting a requisition."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # For PROCEED action, Purchase Officer MUST explicitly make the Technical Evaluation decision (Yes / No)
        requires_tech = False
        if action_type in ['APPROVE', 'PROCEED']:
            tech_eval_raw = request.data.get('requires_technical_evaluation')
            if tech_eval_raw is None:
                return Response(
                    {'requires_technical_evaluation': "Please specify whether technical evaluation is required (Yes or No) before proceeding."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if isinstance(tech_eval_raw, bool):
                requires_tech = tech_eval_raw
            elif str(tech_eval_raw).lower() in ['true', 'yes', '1']:
                requires_tech = True
            elif str(tech_eval_raw).lower() in ['false', 'no', '0']:
                requires_tech = False
            else:
                return Response(
                    {'requires_technical_evaluation': "Invalid technical evaluation decision. Must be Yes (true) or No (false)."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Requisitions explicitly marked as requiring technical evaluation cannot be bypassed
            if requisition.requires_technical_evaluation and not requires_tech:
                return Response(
                    {'requires_technical_evaluation': "Technical evaluation is mandatory for this requisition and cannot be bypassed."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Rule: If the system advisory recommends technical evaluation, the Purchase Officer must provide an explicit justification reason if bypassing it.
            advisory = requisition.get_technical_evaluation_advisory()
            if not requires_tech and advisory.get('recommended') and not (reason and str(reason).strip()):
                return Response(
                    {
                        'requires_technical_evaluation': (
                            f"Technical Officer evaluation is recommended for this purchase request based on item specifications/category. "
                            f"Please provide an explicit justification remarks/reason to proceed without it."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        reviewer_name = user.get_full_name() or user.username

        with transaction.atomic():
            if action_type in ['APPROVE', 'PROCEED']:
                if requires_tech:
                    # PROCEED WITH TECHNICAL EVALUATION:
                    # 1. Determine the required Technical Specialization based on the purchase item's existing category:
                    cat_spec = requisition.get_requisition_technical_specialization()

                    # Check PO explicit specialization input if provided
                    provided_spec = request.data.get('technical_specialization')
                    if provided_spec and str(provided_spec).strip():
                        spec = str(provided_spec).strip()
                    else:
                        advisory = requisition.get_technical_evaluation_advisory()
                        adv_spec = advisory.get('suggested_specialization')
                        cat_spec = requisition.get_requisition_technical_specialization()
                        spec = adv_spec or cat_spec or 'Biomedical Equipment'
                        if spec in ['Medical & Surgical Equipment', 'Critical Care & Life-Support Equipment']:
                            spec = 'Medical, Surgical & Critical Care Equipment'

                    requisition.requires_technical_evaluation = True
                    requisition.technical_specialization = spec
                    requisition.status = Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION
                    next_stage = f"Technical Officer Evaluation ({spec})"

                    # 2. Check if purchase category requires Technical Evaluation (Requirement 7):
                    item_cat = requisition.category
                    if not item_cat and requisition.items.exists():
                        item_cat = requisition.items.first().category

                    is_non_tech = False
                    if item_cat:
                        clean_cat = str(item_cat).strip().lower()
                        if clean_cat in [c.lower() for c in NON_TECHNICAL_CATEGORIES]:
                            is_non_tech = True

                    if is_non_tech:
                        # Requirement 7: If the purchase category does not require Technical Evaluation, do not assign a Technical Officer.
                        requisition.assigned_technical_officer = None
                        requisition.technical_assigned_at = None
                        assigned_to = None
                    else:
                        # 3. Match category to Technical Specialization -> Eligible Technical Officers -> Workload
                        assigned_to = requisition.assign_technical_officer(specialization=spec, save=False)

                    to_tag = ""
                    if assigned_to:
                        to_tag = f" Assigned to Technical Officer @{assigned_to.username} ({assigned_to.get_full_name() or assigned_to.username})."
                    elif is_non_tech:
                        to_tag = " Purchase category does not require Technical Evaluation; Technical Officer assignment bypassed."
                    else:
                        to_tag = f" No eligible active Technical Officer found for specialization '{spec}'; request remains unassigned."

                    Approval.objects.create(
                        requisition=requisition,
                        approved_by=user,
                        stage='Purchase Officer Review',
                        status=Approval.StatusChoices.APPROVED,
                        comments=reason or f"Purchase Officer proceeded requisition for Technical Officer Evaluation ({spec}).{to_tag}"
                    )
                    AuditLog.objects.create(
                        user=user,
                        action='Purchase Officer proceeded requisition for Technical Officer Evaluation',
                        module='Purchase Requisition',
                        description=f"Purchase Officer @{user.username} ({reviewer_name}) proceeded requisition {requisition.req_number} ('{requisition.title}') for Technical Officer Evaluation ({spec}). Remarks: {reason or 'Proceeded for Technical Officer Evaluation.'}{to_tag}"
                    )
                    action_result = 'Requisition Proceeded for Technical Officer Evaluation'

                else:
                    # PROCEED WITHOUT TECHNICAL EVALUATION:
                    # Set status to PENDING_COMMITTEE_REVIEW, requires_technical_evaluation=False,
                    # technical_specialization=None, and route directly to Procurement Committee.
                    requisition.requires_technical_evaluation = False
                    requisition.technical_specialization = None
                    requisition.assigned_technical_officer = None
                    requisition.technical_assigned_at = None
                    requisition.status = Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW
                    requisition.assign_committee_member()
                    next_stage = "Procurement Committee Review"

                    Approval.objects.create(
                        requisition=requisition,
                        approved_by=user,
                        stage='Purchase Officer Review',
                        status=Approval.StatusChoices.APPROVED,
                        comments=reason or "Purchase Officer proceeded requisition directly to Procurement Committee."
                    )
                    AuditLog.objects.create(
                        user=user,
                        action='Purchase Officer proceeded requisition directly to Procurement Committee',
                        module='Purchase Requisition',
                        description=f"Purchase Officer @{user.username} ({reviewer_name}) proceeded requisition {requisition.req_number} ('{requisition.title}') directly to Procurement Committee. Remarks: {reason or 'Proceeded directly to Procurement Committee.'}"
                    )
                    action_result = 'Requisition Proceeded directly to Procurement Committee'

            elif action_type in ['RETURN', 'RETURN_FOR_CORRECTION']:
                # RETURN FOR CORRECTION:
                # Requires correction reason, sets status to RETURNED, creates NO approval record.
                requisition.status = Requisition.StatusChoices.RETURNED
                requisition.requires_technical_evaluation = False
                requisition.technical_specialization = None
                requisition.assigned_technical_officer = None
                requisition.technical_assigned_at = None
                AuditLog.objects.create(
                    user=user,
                    action='Purchase Officer Requisition Returned',
                    module='Purchase Requisition',
                    description=f"Purchase Officer @{user.username} ({reviewer_name}) returned requisition {requisition.req_number} ('{requisition.title}') for correction. Reason: {reason}"
                )
                action_result = 'Requisition Returned for Correction'

            elif action_type == 'REJECT':
                # REJECT:
                # Requires rejection reason, sets status to REJECTED, creates NO approval record.
                requisition.status = Requisition.StatusChoices.REJECTED
                requisition.requires_technical_evaluation = False
                requisition.technical_specialization = None
                requisition.assigned_technical_officer = None
                requisition.technical_assigned_at = None
                AuditLog.objects.create(
                    user=user,
                    action='Purchase Officer Requisition Rejected',
                    module='Purchase Requisition',
                    description=f"Purchase Officer @{user.username} ({reviewer_name}) rejected requisition {requisition.req_number} ('{requisition.title}'). Reason: {reason}"
                )
                action_result = 'Requisition Rejected'

            requisition.review_comments = reason
            requisition.reviewed_by = user
            requisition.reviewed_at = timezone.now()
            requisition.save()

        return Response({
            'status': action_result,
            'requisition': RequisitionSerializer(requisition, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='document', permission_classes=[AllowAny])
    def document(self, request, pk=None):
        try:
            requisition = Requisition.objects.get(pk=pk)
        except Requisition.DoesNotExist:
            from django.http import Http404
            raise Http404("Requisition not found.")

        user = request.user
        if not user or not user.is_authenticated:
            token = request.query_params.get('token')
            if token:
                try:
                    from rest_framework_simplejwt.authentication import JWTAuthentication
                    jwt_auth = JWTAuthentication()
                    validated_token = jwt_auth.get_validated_token(token)
                    user = jwt_auth.get_user(validated_token)
                except Exception:
                    pass

        if not user or not user.is_authenticated:
            from rest_framework.exceptions import NotAuthenticated
            raise NotAuthenticated("Authentication credentials were not provided.")

        r_name = user.role.name.lower() if user.role else ''
        is_to = 'technical' in r_name
        is_po = ('purchase' in r_name or 'purchase officer' in r_name) and ('staff' not in r_name) and not is_to
        is_admin_or_super = user.is_superuser or user.is_staff or 'admin' in r_name

        if is_to and not is_admin_or_super:
            if requisition.assigned_technical_officer and requisition.assigned_technical_officer != user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You do not have permission to access this supporting document.")

        elif is_po and not is_admin_or_super:
            if requisition.assigned_purchase_officer and requisition.assigned_purchase_officer != user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You do not have permission to access this supporting document.")
            if requisition.assigned_purchase_officer is None and requisition.reviewed_by and requisition.reviewed_by != user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You do not have permission to access this supporting document.")

        is_invited_vendor = False
        if 'vendor' in r_name or hasattr(user, 'vendor_profile'):
            from procurement.models import RFQVendorInvitation
            v_prof = getattr(user, 'vendor_profile', None) or getattr(user, 'vendor', None)
            if not v_prof:
                from vendors.models import Vendor
                v_prof = Vendor.objects.filter(user=user).first()
            if v_prof:
                is_invited_vendor = RFQVendorInvitation.objects.filter(
                    quotation_request__requisition=requisition,
                    vendor=v_prof
                ).exists()

        is_privileged = (
            is_admin_or_super or
            any(role in r_name for role in ['admin', 'purchase', 'committee', 'technical'])
        )

        if not is_privileged and requisition.requested_by != user and not is_invited_vendor:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to access this supporting document.")

        doc_field = requisition.supporting_document or requisition.technical_document
        if not doc_field:
            from django.http import Http404
            raise Http404("Supporting document not found on requisition.")

        from django.http import FileResponse
        from django.conf import settings
        import os
        import io
        import mimetypes

        filename = os.path.basename(doc_field.name)
        content_type, _ = mimetypes.guess_type(filename)
        if not content_type:
            content_type = 'application/pdf'

        try:
            if doc_field.storage.exists(doc_field.name):
                response = FileResponse(
                    doc_field.open('rb'),
                    content_type=content_type,
                    as_attachment=False,
                    filename=filename
                )
                response['Content-Disposition'] = f'inline; filename="{filename}"'
                return response
        except Exception:
            pass

        local_path = os.path.join(str(settings.MEDIA_ROOT), doc_field.name)
        if os.path.exists(local_path) and os.path.isfile(local_path):
            response = FileResponse(
                open(local_path, 'rb'),
                content_type=content_type,
                as_attachment=False,
                filename=filename
            )
            response['Content-Disposition'] = f'inline; filename="{filename}"'
            return response

        # Verified fallback PDF so production links never 404
        from backend.views import generate_fallback_pdf
        pdf_bytes = generate_fallback_pdf(
            filename,
            f"Requisition {requisition.req_number} - {requisition.title}"
        )
        response = FileResponse(io.BytesIO(pdf_bytes), content_type='application/pdf', as_attachment=False)
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response

    @action(detail=True, methods=['get'], url_path='technical-document', permission_classes=[AllowAny])
    def technical_document(self, request, pk=None):
        return self.document(request, pk)

    @action(detail=True, methods=['get'], url_path='find-vendors', permission_classes=[IsAuthenticated], filter_backends=[])
    def find_vendors(self, request, pk=None):
        """
        Action to find suitable vendors for a purchase-ready requisition.
        Returns only matching registered vendors who supply the requested item's category.
        Excludes vendors from unrelated categories.
        Only accessible to the assigned committee member (or admin/authorized roles).
        """
        requisition = self.get_object()
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_committee = 'committee' in r_name
        is_admin_or_super = user.is_superuser or user.is_staff or 'admin' in r_name

        if is_committee and not is_admin_or_super:
            if requisition.assigned_committee_member and requisition.assigned_committee_member != user:
                return Response(
                    {'detail': 'You can only source vendors for purchase requests assigned to you.'},
                    status=status.HTTP_403_FORBIDDEN
                )

        # 1. Identify the requested item's category
        match_categories = set()
        for it in requisition.items.all():
            if it.category and it.category.strip():
                match_categories.add(it.category.strip())
        if requisition.category and requisition.category.strip():
            match_categories.add(requisition.category.strip())

        # 6. Handle missing categories
        if not match_categories:
            return Response({
                'requisition_id': requisition.id,
                'req_number': requisition.req_number,
                'title': requisition.title,
                'category': None,
                'matched_categories': [],
                'has_category': False,
                'message': 'No supply category is associated with this purchase request. Please select or assign a category before finding vendors.',
                'assigned_committee_member_id': requisition.assigned_committee_member_id,
                'assigned_committee_member_name': (
                    requisition.assigned_committee_member.get_full_name() or
                    requisition.assigned_committee_member.username
                ) if requisition.assigned_committee_member else None,
                'matched_vendors': [],
                'matched_count': 0,
                'other_vendors': [],
                'total_active_vendors': 0,
                'matched_products': [],
                'matched_products_count': 0,
                'pricing_notice': 'Indicative catalogue prices are non-binding estimates only. Formal quotations must be requested for hospital purchase orders.'
            }, status=status.HTTP_200_OK)

        from vendors.models import Vendor, VendorProduct
        from vendors.serializers import VendorSerializer, VendorProductSerializer

        # 2, 3, 4. Match against existing vendor category assignments
        active_vendors_qs = Vendor.objects.filter(
            is_active=True,
            status=Vendor.StatusChoices.ACTIVE
        ).select_related('user', 'application').prefetch_related('supplier_categories')

        # Multi-category support: vendor is included if at least one assigned category matches
        cat_q = Q()
        for cat in match_categories:
            cat_q |= Q(supplier_categories__name__iexact=cat) | Q(application__supplier_categories__name__iexact=cat)

        matched_vendors_qs = active_vendors_qs.filter(cat_q).distinct()

        # 5. Apply filtering to search results
        search_query = request.query_params.get('search', '').strip()
        if search_query:
            matched_vendors_qs = matched_vendors_qs.filter(
                Q(company_name__icontains=search_query) |
                Q(contact_person__icontains=search_query) |
                Q(email__icontains=search_query) |
                Q(vendor_code__icontains=search_query) |
                Q(application__products_services_offered__icontains=search_query) |
                Q(user__username__icontains=search_query)
            )

        matched_vendors_qs = matched_vendors_qs.order_by('-performance_rating', 'company_name')
        matched_data = VendorSerializer(matched_vendors_qs, many=True, context={'request': request}).data

        # Catalogue products: ONLY products matching the category and supplied by matching vendors
        matched_vendor_ids = [v['id'] for v in matched_data]
        product_cat_q = Q()
        for cat in match_categories:
            product_cat_q |= Q(category__name__iexact=cat)

        matched_products_qs = VendorProduct.objects.filter(
            is_active=True,
            vendor__is_active=True,
            vendor__status=Vendor.StatusChoices.ACTIVE,
            vendor_id__in=matched_vendor_ids
        ).filter(product_cat_q).select_related('vendor', 'category').distinct()

        if search_query:
            matched_products_qs = matched_products_qs.filter(
                Q(name__icontains=search_query) |
                Q(brand__icontains=search_query) |
                Q(model_number__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(technical_specifications__icontains=search_query) |
                Q(product_code__icontains=search_query)
            )

        matched_products_qs = matched_products_qs.order_by('name')[:40]
        matched_products_data = VendorProductSerializer(matched_products_qs, many=True, context={'request': request}).data

        # Map matching products by vendor ID
        products_by_vendor = {}
        for p in matched_products_data:
            vid = p.get('vendor')
            if vid not in products_by_vendor:
                products_by_vendor[vid] = []
            products_by_vendor[vid].append(p)

        # Check existing active invitations for duplicate prevention
        existing_active_rfqs = QuotationRequest.objects.filter(
            requisition=requisition,
            status__in=[QuotationRequest.StatusChoices.SENT, QuotationRequest.StatusChoices.OPEN]
        )
        already_invited_vendor_ids = set(
            RFQVendorInvitation.objects.filter(
                quotation_request__in=existing_active_rfqs
            ).values_list('vendor_id', flat=True)
        )

        # Enrich each matched vendor with capability, product, and suitability details
        for v in matched_data:
            vid = v['id']
            v_cats = [
                c.get('name') for c in (v.get('supplier_category_details') or [])
                if isinstance(c, dict) and c.get('name')
            ]
            if not v_cats and v.get('supplier_categories'):
                v_cats = list(
                    SupplierCategory.objects.filter(
                        id__in=[cid for cid in v.get('supplier_categories', []) if isinstance(cid, int)]
                    ).values_list('name', flat=True)
                )
            overlapping_cats = [c for c in v_cats if any(mc.lower() == c.lower() for mc in match_categories)]
            v_prods = products_by_vendor.get(vid, [])

            reasons = []
            if overlapping_cats:
                reasons.append(f"Supplies category: {', '.join(overlapping_cats)}")
            if v_prods:
                item_names_summary = ', '.join([p['name'] for p in v_prods[:2]])
                reasons.append(f"Catalogue items: {item_names_summary}")
            if requisition.department:
                reasons.append(f"Verified for {requisition.department.name}")

            v['matching_products'] = v_prods
            v['matching_categories'] = overlapping_cats
            v['suitability_reasons'] = reasons
            v['already_invited'] = vid in already_invited_vendor_ids
            v['is_eligible'] = True

        primary_category = requisition.category or (list(match_categories)[0] if match_categories else None)

        req_items_summary = [
            {
                'id': it.id,
                'item_name': it.item_name,
                'category': it.category,
                'quantity': it.quantity,
                'specifications': it.specifications,
                'estimated_unit_price': str(it.estimated_unit_price) if it.estimated_unit_price else '0.00'
            }
            for it in requisition.items.all()
        ]

        return Response({
            'requisition_id': requisition.id,
            'req_number': requisition.req_number,
            'title': requisition.title,
            'category': primary_category,
            'department_name': requisition.department.name if requisition.department else None,
            'items': req_items_summary,
            'matched_categories': list(match_categories),
            'has_category': True,
            'assigned_committee_member_id': requisition.assigned_committee_member_id,
            'assigned_committee_member_name': (
                requisition.assigned_committee_member.get_full_name() or
                requisition.assigned_committee_member.username
            ) if requisition.assigned_committee_member else None,
            'matched_vendors': matched_data,
            'vendors': matched_data,
            'matched_count': len(matched_data),
            'other_vendors': [],  # Unrelated vendors are excluded
            'total_active_vendors': len(matched_data),
            'matched_products': matched_products_data,
            'matched_products_count': len(matched_products_data),
            'pricing_notice': 'Indicative catalogue prices are non-binding estimates only. Formal quotations must be requested for hospital purchase orders.'
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsCommitteeOrAdmin])
    def approve(self, request, pk=None):
        requisition = self.get_object()
        user = request.user

        # Assignment enforcement: Committee member can ONLY approve requests assigned to them
        is_admin = user.is_superuser or user.is_staff or (user.role and 'admin' in user.role.name.lower())
        if not is_admin and requisition.assigned_committee_member and requisition.assigned_committee_member != user:
            return Response(
                {'detail': 'You cannot approve this purchase request. It is assigned to another committee member.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # 1. State validation: Must be pending committee review
        if requisition.status != Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW:
            return Response(
                {
                    'detail': f'This purchase request cannot be approved because its status is {requisition.get_status_display()} ({requisition.status}). Only requests pending committee review can be approved.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Technical evaluation compliance: Must have passed as Technically Suitable
        if requisition.requires_technical_evaluation and requisition.technical_recommendation != TechnicalEvaluation.RecommendationChoices.SUITABLE:
            return Response(
                {
                    'detail': 'This purchase request cannot be approved by the committee because it has not passed technical evaluation as Technically Suitable.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        comments = str(
            request.data.get('comments', '') or
            request.data.get('remarks', '')
        ).strip()
        stage = request.data.get('stage', 'Procurement Committee Review')
        approval_comments = comments or 'Approved by Procurement Committee.'

        with transaction.atomic():
            Approval.objects.create(
                requisition=requisition,
                approved_by=user,
                stage=stage,
                status=Approval.StatusChoices.APPROVED,
                comments=approval_comments
            )
            requisition.status = Requisition.StatusChoices.APPROVED
            requisition.reviewed_by = user
            requisition.reviewed_at = timezone.now()
            requisition.review_comments = approval_comments
            requisition.save(update_fields=[
                'status', 'reviewed_by', 'reviewed_at', 'review_comments', 'updated_at'
            ])

            reviewer_name = user.get_full_name() or user.username
            AuditLog.objects.create(
                user=user,
                action='Procurement Committee Approved',
                module='Procurement Committee',
                description=f"Procurement Committee member @{user.username} ({reviewer_name}) approved requisition {requisition.req_number} ('{requisition.title}'). Remarks: {approval_comments}"
            )

        return Response({
            'status': 'Requisition Approved Successfully',
            'message': f'Purchase request {requisition.req_number} has been approved by the Procurement Committee.',
            'requisition': RequisitionSerializer(requisition, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='return-clarification', permission_classes=[IsCommitteeOrAdmin])
    def return_clarification(self, request, pk=None):
        requisition = self.get_object()
        user = request.user

        # Assignment enforcement: Committee member can ONLY return requests assigned to them
        is_admin = user.is_superuser or user.is_staff or (user.role and 'admin' in user.role.name.lower())
        if not is_admin and requisition.assigned_committee_member and requisition.assigned_committee_member != user:
            return Response(
                {'detail': 'You cannot return this purchase request for clarification. It is assigned to another committee member.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # 1. State validation: Must be pending committee review
        if requisition.status != Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW:
            return Response(
                {
                    'detail': f'This purchase request cannot be returned for clarification because its status is {requisition.get_status_display()} ({requisition.status}). Only requests pending committee review can be returned.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Mandatory clarification remarks
        remarks = str(
            request.data.get('remarks', '') or
            request.data.get('clarification_reason', '') or
            request.data.get('comments', '')
        ).strip()
        if not remarks:
            return Response(
                {'remarks': 'Clarification remarks are mandatory. Please explain what information, specifications, or adjustments are needed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Route to the appropriate existing responsible user based on the issue
        target = str(
            request.data.get('target', '') or
            request.data.get('route_to', '') or
            request.data.get('recipient', '')
        ).strip().lower()

        target_map = {
            'technical_officer': 'technical_officer',
            'technical officer': 'technical_officer',
            'to': 'technical_officer',
            'department_staff': 'department_staff',
            'department staff': 'department_staff',
            'staff': 'department_staff',
            'requester': 'department_staff',
            'purchase_officer': 'purchase_officer',
            'purchase officer': 'purchase_officer',
            'po': 'purchase_officer',
        }
        resolved_target = target_map.get(target)

        if not resolved_target:
            return Response(
                {
                    'target': "Please specify the clarification recipient: 'technical_officer' (Technical Officer), 'department_staff' (Department Requester), or 'purchase_officer' (Purchase Officer)."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            if resolved_target == 'technical_officer':
                if not requisition.assigned_technical_officer:
                    return Response(
                        {'detail': 'Cannot route clarification to Technical Officer: No Technical Officer is assigned to this purchase request.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                requisition.status = Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION
                requisition.technical_recommendation = TechnicalEvaluation.RecommendationChoices.REQUIRES_CLARIFICATION
                assigned_to = requisition.assigned_technical_officer
                to_name = assigned_to.get_full_name() or assigned_to.username
                target_label = f"Technical Officer @{assigned_to.username} ({to_name})"
                update_fields = [
                    'status', 'technical_recommendation', 'reviewed_by', 'reviewed_at', 'review_comments', 'updated_at'
                ]
            elif resolved_target == 'department_staff':
                requisition.status = Requisition.StatusChoices.RETURNED
                staff_name = requisition.requested_by.get_full_name() or requisition.requested_by.username if requisition.requested_by else 'Department Staff'
                target_label = f"Department Staff @{requisition.requested_by.username if requisition.requested_by else 'staff'} ({staff_name})"
                update_fields = [
                    'status', 'reviewed_by', 'reviewed_at', 'review_comments', 'updated_at'
                ]
            else:  # purchase_officer
                if not requisition.assigned_purchase_officer:
                    requisition.assign_purchase_officer(save=False)
                requisition.status = Requisition.StatusChoices.SUBMITTED
                po = requisition.assigned_purchase_officer
                po_name = (po.get_full_name() or po.username) if po else "Purchase Officer"
                target_label = f"Purchase Officer @{po.username if po else 'po'} ({po_name})"
                update_fields = [
                    'status', 'assigned_purchase_officer', 'reviewed_by', 'reviewed_at', 'review_comments', 'updated_at'
                ]

            requisition.reviewed_by = user
            requisition.reviewed_at = timezone.now()
            requisition.review_comments = remarks
            requisition.save(update_fields=update_fields)

            Approval.objects.create(
                requisition=requisition,
                approved_by=user,
                stage='Procurement Committee Review',
                status=Approval.StatusChoices.RETURNED,
                comments=f"[Returned for Clarification to {target_label}]: {remarks}"
            )

            reviewer_name = user.get_full_name() or user.username
            AuditLog.objects.create(
                user=user,
                action='Procurement Committee Returned for Clarification',
                module='Procurement Committee',
                description=f"Procurement Committee member @{user.username} ({reviewer_name}) returned requisition {requisition.req_number} ('{requisition.title}') for clarification to {target_label}. Remarks: {remarks}"
            )

        return Response({
            'status': 'Returned for Clarification',
            'message': f'Purchase request {requisition.req_number} returned for clarification to {target_label}.',
            'target': resolved_target,
            'requisition': RequisitionSerializer(requisition, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsCommitteeOrAdmin])
    def reject(self, request, pk=None):
        return Response(
            {
                'detail': 'Rejection is not permitted at this stage of the Procurement Committee workflow.'
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    @action(
        detail=True,
        methods=['post'],
        permission_classes=[IsAuthenticated, IsTechnicalOfficer],
        parser_classes=[MultiPartParser, FormParser, JSONParser]
    )
    def evaluate(self, request, pk=None):
        requisition = self.get_object()
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_admin_or_super = user.is_superuser or user.is_staff or 'admin' in r_name

        # 1. Enforce assigned Technical Officer constraint (Security & Permissions)
        if not is_admin_or_super and requisition.assigned_technical_officer != user:
            return Response(
                {'detail': 'You can only evaluate purchase requests assigned directly to you.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # 2. Enforce purchase request is in PENDING_TECHNICAL_EVALUATION state
        if requisition.status != Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION:
            return Response(
                {
                    'detail': f'This purchase request cannot be evaluated because its status is {requisition.get_status_display()} ({requisition.status}). Only requests pending technical evaluation can be evaluated.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Validate Evaluation Outcome / Recommendation (Exactly 2 outcomes: Suitable or Return for Clarification)
        rec_raw = str(
            request.data.get('recommendation', '') or
            request.data.get('outcome', '') or
            request.data.get('action', '')
        ).strip()
        rec_lower = rec_raw.lower()

        # Strict business rule: Technical Officers must NOT reject purchase requests
        if rec_lower in [
            'technically not suitable', 'not suitable', 'reject', 'rejected', 'rejection', 'not compliant'
        ]:
            return Response(
                {
                    'recommendation': 'Rejection is not permitted. Technical Officers cannot reject purchase requests; only "Technically Suitable (Approve)" or "Return for Clarification" are allowed.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if rec_lower in ['technically suitable', 'suitable', 'approve', 'approved', 'technically suitable (approve)']:
            recommendation = TechnicalEvaluation.RecommendationChoices.SUITABLE
            default_compliance = TechnicalEvaluation.ComplianceChoices.COMPLIANT
        elif rec_lower in ['return for clarification', 'requires clarification', 'clarification', 'return', 'returned']:
            recommendation = TechnicalEvaluation.RecommendationChoices.REQUIRES_CLARIFICATION
            default_compliance = TechnicalEvaluation.ComplianceChoices.PARTIALLY_COMPLIANT
        else:
            return Response(
                {
                    'recommendation': "Invalid evaluation outcome. Allowed outcomes are 'Technically Suitable (Approve)' or 'Return for Clarification'."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 4. Validate Technical Assessment / Remarks / Clarification Reason (Required text field)
        remarks = str(
            request.data.get('remarks', '') or
            request.data.get('clarification_reason', '') or
            request.data.get('reason', '')
        ).strip()
        if not remarks:
            if recommendation == TechnicalEvaluation.RecommendationChoices.REQUIRES_CLARIFICATION:
                return Response(
                    {'remarks': 'A clarification reason is required when returning a purchase request for clarification. Please explain what specifications or information are needed.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            return Response(
                {'remarks': 'Technical Assessment / Remarks is required when submitting an evaluation.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 5. Technical Compliance (Derived from outcome or optional explicit choice)
        compliance_raw = str(request.data.get('compliance', '')).strip().lower()
        compliance_map = {
            'compliant': TechnicalEvaluation.ComplianceChoices.COMPLIANT,
            'partially compliant': TechnicalEvaluation.ComplianceChoices.PARTIALLY_COMPLIANT,
        }
        compliance = compliance_map.get(compliance_raw, default_compliance)

        # 6. Supporting technical documents are NOT required from Technical Officers
        supporting_doc = request.FILES.get('supporting_document') or request.FILES.get('technical_document')

        with transaction.atomic():
            eval_instance = TechnicalEvaluation.objects.create(
                requisition=requisition,
                evaluated_by=user,
                compliance=compliance,
                remarks=remarks,
                recommendation=recommendation,
                supporting_document=supporting_doc
            )

            # Update requisition technical evaluation fields while preserving original fields
            requisition.technical_compliance = compliance
            requisition.technical_evaluation_remarks = remarks
            requisition.technical_recommendation = recommendation
            requisition.technical_evaluated_at = timezone.now()
            if supporting_doc:
                requisition.technical_document = supporting_doc

            # Workflow state transitions (Exactly 2 outcomes)
            if recommendation == TechnicalEvaluation.RecommendationChoices.SUITABLE:
                # Outcome 1: Technically Suitable (Approve) -> Forward to Procurement Committee review
                requisition.status = Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW
                requisition.review_comments = remarks
                requisition.assign_committee_member()
                approval_status = Approval.StatusChoices.APPROVED
                audit_action = 'Technical Evaluation Completed - Technically Suitable'
                stage_desc = 'Requisition approved as Technically Suitable and forwarded to Procurement Committee review.'
            else:
                # Outcome 2: Return for Clarification -> Return to previous stage for clarification & resubmission
                requisition.status = Requisition.StatusChoices.RETURNED
                requisition.review_comments = remarks
                approval_status = None
                audit_action = 'Technical Evaluation Completed - Clarification Required'
                stage_desc = 'Requisition returned for specification clarification.'

            requisition.save(update_fields=[
                'technical_compliance', 'technical_evaluation_remarks',
                'technical_recommendation', 'technical_evaluated_at',
                'technical_document', 'status', 'review_comments',
                'assigned_committee_member', 'committee_assigned_at',
                'updated_at'
            ])

            # Audit and approval logging
            if approval_status:
                Approval.objects.create(
                    requisition=requisition,
                    approved_by=user,
                    stage='Technical Evaluation',
                    status=approval_status,
                    comments=f"Technical Evaluation: Technically Suitable. Remarks: {remarks}"
                )

            officer_name = user.get_full_name() or user.username
            AuditLog.objects.create(
                user=user,
                action=audit_action,
                module='Purchase Requisition',
                description=(
                    f"Technical Officer @{user.username} ({officer_name}) evaluated requisition "
                    f"{requisition.req_number} ('{requisition.title}'). "
                    f"Outcome: {recommendation}. {stage_desc} Remarks: {remarks}"
                )
            )

        serializer = self.get_serializer(requisition)
        return Response({
            'status': f"Technical evaluation submitted successfully. {stage_desc}",
            'requisition': serializer.data,
            'evaluation': TechnicalEvaluationSerializer(eval_instance, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='quotation-review-requests', permission_classes=[IsAuthenticated])
    def quotation_review_requests(self, request):
        """
        Returns all purchase requests for which vendor quotations have been received
        and are awaiting committee review or have vendor selections.
        Only displays quotations associated with the relevant purchase request.
        """
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_committee = 'committee' in r_name
        is_admin = user.is_superuser or user.is_staff or 'admin' in r_name

        if not (is_committee or is_admin):
            return Response(
                {'detail': 'Only Procurement Committee members and Administrators can access this queue.'},
                status=status.HTTP_403_FORBIDDEN
            )

        qs = Requisition.objects.filter(
            quotation_requests__quotations__isnull=False
        ).distinct().select_related(
            'department', 'requested_by', 'assigned_purchase_officer',
            'assigned_committee_member', 'selected_vendor', 'selected_quotation', 'vendor_selected_by'
        ).prefetch_related(
            'items', 'quotation_requests__quotations__vendor', 'quotation_requests__quotations__items',
            'technical_evaluations'
        )

        if not is_admin:
            qs = qs.filter(Q(assigned_committee_member=user) | Q(assigned_committee_member__isnull=True))

        serializer = RequisitionSerializer(qs.order_by('-updated_at'), many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='approved-vendor-selections', permission_classes=[IsAuthenticated])
    def approved_vendor_selections(self, request):
        """
        Returns all purchase requests where the Procurement Committee has confirmed vendor selection
        and are awaiting Purchase Order creation (or have recently been ordered).
        Accessible by Purchase Officers and Admins.
        """
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_po = ('purchase' in r_name or 'purchase officer' in r_name) and not ('staff' in r_name)
        is_admin = user.is_superuser or user.is_staff or 'admin' in r_name

        if not (is_po or is_admin):
            return Response(
                {'detail': 'Only Purchase Officers and Administrators can access approved vendor selections.'},
                status=status.HTTP_403_FORBIDDEN
            )

        qs = Requisition.objects.filter(
            selected_vendor__isnull=False
        ).select_related(
            'department', 'requested_by', 'assigned_purchase_officer',
            'selected_vendor', 'selected_quotation', 'vendor_selected_by'
        ).prefetch_related(
            'items', 'selected_quotation__items', 'purchase_orders'
        ).order_by('-vendor_selected_at', '-updated_at')

        status_param = request.query_params.get('status')
        if status_param == 'AWAITING_PO':
            qs = qs.filter(purchase_orders__isnull=True)
        elif status_param == 'PO_CREATED':
            qs = qs.filter(purchase_orders__isnull=False)

        serializer = RequisitionSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class QuotationRequestViewSet(viewsets.ModelViewSet):
    queryset = QuotationRequest.objects.select_related(
        'requisition', 'created_by', 'cancelled_by', 'requisition__department', 'requisition__assigned_committee_member'
    ).prefetch_related('items', 'vendor_invitations', 'vendor_invitations__vendor', 'quotations').all()
    serializer_class = QuotationRequestSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = QuotationRequestFilter
    search_fields = ['rfq_number', 'title', 'terms_and_conditions', 'requisition__req_number', 'requisition__title']
    ordering_fields = ['created_at', 'issue_date', 'due_date', 'status', 'rfq_number']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return QuotationRequest.objects.none()

        role_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name
        is_committee = 'committee' in role_name
        is_purchase = 'purchase' in role_name or 'technical' in role_name
        is_vendor = 'vendor' in role_name or hasattr(user, 'vendor_profile')

        qs = QuotationRequest.objects.select_related(
            'requisition', 'created_by', 'cancelled_by', 'requisition__department', 'requisition__assigned_committee_member'
        ).prefetch_related('items', 'vendor_invitations', 'vendor_invitations__vendor', 'quotations')

        # Auto-update status for expired RFQs
        today = timezone.now().date()
        expired_qs = qs.filter(
            status__in=[QuotationRequest.StatusChoices.OPEN, QuotationRequest.StatusChoices.SENT],
            due_date__lt=today
        )
        if expired_qs.exists():
            expired_qs.update(status=QuotationRequest.StatusChoices.EXPIRED)

        # Scoping permissions
        if is_vendor:
            from vendors.models import Vendor
            vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
            if not vendor:
                return QuotationRequest.objects.none()
            # Vendors can ONLY see RFQs to which they were specifically invited
            return qs.filter(vendor_invitations__vendor=vendor).distinct().order_by('-created_at')
        elif is_committee and not is_admin:
            # Committee members see RFQs created by them or linked to requisitions assigned to them
            qs = qs.filter(
                Q(created_by=user) |
                Q(requisition__assigned_committee_member=user)
            )
        elif not is_admin and not is_purchase:
            # Department staff or other users only see RFQs for their department's requisitions
            qs = qs.filter(requisition__requested_by=user)

        return qs.order_by('-created_at')

    def retrieve(self, request, *args, **kwargs):
        """
        Retrieve RFQ details. If the requesting user is a vendor, automatically
        update their invitation status from INVITED to VIEWED.
        """
        instance = self.get_object()
        user = request.user
        role_name = user.role.name.lower() if user.role else ''
        is_vendor = 'vendor' in role_name or hasattr(user, 'vendor_profile')
        if is_vendor:
            from vendors.models import Vendor
            vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
            if vendor:
                inv = instance.vendor_invitations.filter(vendor=vendor).first()
                if inv and inv.status == RFQVendorInvitation.InvitationStatus.INVITED:
                    inv.status = RFQVendorInvitation.InvitationStatus.VIEWED
                    inv.save(update_fields=['status'])
                    AuditLog.objects.create(
                        user=user,
                        action='Vendor Viewed RFQ',
                        module='Vendor Portal',
                        description=f"Vendor '{vendor.company_name}' viewed quotation request {instance.rfq_number}."
                    )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """
        Create and Send RFQ exclusively for Procurement Committee members and Admins.
        Enforces validation:
        1. Role check: Committee member or Admin.
        2. Requisition check: Must exist, be purchase-ready, and assigned to this member.
        3. Vendor category matching: Every selected vendor must be active and supply the requested item's category.
        4. Due date: Must be valid and in the future.
        5. Duplicate prevention: Checks for duplicate open RFQ.
        6. Creates RFQ, RFQItem snapshots, and RFQVendorInvitations atomically.
        7. Transitions Requisition status to RFQ_ISSUED and records AuditLog.
        """
        user = request.user
        role_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name
        is_committee = 'committee' in role_name

        if not is_admin and not is_committee:
            return Response(
                {'detail': 'Only Procurement Committee members or administrators can issue RFQs.'},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data
        req_id = data.get('requisition') or data.get('requisition_id')
        if not req_id:
            return Response({'requisition': 'Purchase request ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            requisition = Requisition.objects.select_related('department', 'assigned_committee_member').prefetch_related('items').get(id=req_id)
        except Requisition.DoesNotExist:
            return Response({'requisition': 'Purchase request not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Ownership / Assignment check
        if not is_admin and requisition.assigned_committee_member_id and requisition.assigned_committee_member_id != user.id:
            return Response(
                {'detail': 'You are only authorized to issue RFQs for purchase requests assigned to your queue.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Eligible status check
        allowed_statuses = [
            Requisition.StatusChoices.APPROVED,
            Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
            Requisition.StatusChoices.RFQ_ISSUED
        ]
        if requisition.status not in allowed_statuses:
            return Response(
                {'detail': f"Purchase request {requisition.req_number} is in status '{requisition.get_status_display()}' and is not eligible for vendor sourcing."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Title
        title = data.get('title', '').strip()
        if not title:
            title = f"Request for Quotation: {requisition.title}"

        # Due date
        due_date_str = data.get('due_date')
        if not due_date_str:
            return Response({'due_date': 'Quotation submission deadline is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from datetime import datetime
            if isinstance(due_date_str, str):
                parsed_due_date = datetime.strptime(due_date_str.strip()[:10], '%Y-%m-%d').date()
            else:
                parsed_due_date = due_date_str
        except Exception:
            return Response({'due_date': 'Invalid deadline date format. Expected YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        if parsed_due_date <= timezone.now().date():
            return Response({'due_date': 'Quotation submission deadline must be a future date.'}, status=status.HTTP_400_BAD_REQUEST)

        # Vendor IDs
        raw_vendor_ids = data.get('vendor_ids', [])
        if not raw_vendor_ids or not isinstance(raw_vendor_ids, list):
            return Response({'vendor_ids': 'At least one eligible vendor must be selected (2 to 4 recommended).'}, status=status.HTTP_400_BAD_REQUEST)

        # Deduplicate while preserving order
        vendor_ids = list(dict.fromkeys(raw_vendor_ids))

        # Enforce maximum 4 vendors
        if len(vendor_ids) > 4:
            return Response({'vendor_ids': 'A maximum of 4 vendors can be selected for an RFQ.'}, status=status.HTTP_400_BAD_REQUEST)

        # Collect requisition categories
        match_categories = set()
        for it in requisition.items.all():
            if it.category and it.category.strip():
                match_categories.add(it.category.strip().lower())
        if requisition.category and requisition.category.strip():
            match_categories.add(requisition.category.strip().lower())

        if not match_categories:
            return Response(
                {'detail': 'Cannot issue RFQ: This purchase request has no assigned supply category.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check total active matching vendors available for competitive quotation
        from vendors.models import Vendor
        all_active_vendors = list(Vendor.objects.filter(
            is_active=True,
            status=Vendor.StatusChoices.ACTIVE
        ).prefetch_related('supplier_categories', 'application__supplier_categories'))

        matching_vendors_dict = {}
        for cand in all_active_vendors:
            c_cats = set(c.name.strip().lower() for c in cand.supplier_categories.all() if c.name)
            if cand.application:
                for ac in cand.application.supplier_categories.all():
                    if ac.name:
                        c_cats.add(ac.name.strip().lower())
            if match_categories.intersection(c_cats):
                matching_vendors_dict[cand.id] = cand

        min_required = 2 if len(matching_vendors_dict) >= 2 else 1
        if len(vendor_ids) < min_required:
            return Response(
                {'vendor_ids': f'Competitive hospital procurement requires selecting between 2 and 4 eligible vendors (minimum {min_required} required).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Backend vendor validation
        validated_vendors = []
        for vid in vendor_ids:
            try:
                vid_int = int(vid)
            except (ValueError, TypeError):
                return Response({'vendor_ids': f'Invalid vendor ID: {vid}'}, status=status.HTTP_400_BAD_REQUEST)

            vendor = matching_vendors_dict.get(vid_int)
            if not vendor:
                v_obj = Vendor.objects.filter(id=vid_int).first()
                if not v_obj:
                    return Response({'vendor_ids': f'Vendor ID {vid} does not exist.'}, status=status.HTTP_400_BAD_REQUEST)
                if not v_obj.is_active or v_obj.status != Vendor.StatusChoices.ACTIVE:
                    return Response({'vendor_ids': f"Vendor '{v_obj.company_name}' is not currently active."}, status=status.HTTP_400_BAD_REQUEST)
                return Response(
                    {'vendor_ids': f"Vendor '{v_obj.company_name}' does not supply the category for this purchase request and cannot be invited."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            validated_vendors.append(vendor)

        delivery_requirements = data.get('delivery_requirements', '').strip()
        delivery_location = data.get('delivery_location', '').strip() or (requisition.department.name if requisition.department else 'Hospital Central Stores')
        terms_and_conditions = data.get('terms_and_conditions', '').strip()

        # Prevent duplicate invitations to the same vendor for the same request
        active_rfqs_for_req = QuotationRequest.objects.filter(
            requisition=requisition,
            status__in=[QuotationRequest.StatusChoices.OPEN, QuotationRequest.StatusChoices.SENT]
        )
        if active_rfqs_for_req.exists():
            already_invited_names = list(
                RFQVendorInvitation.objects.filter(
                    quotation_request__in=active_rfqs_for_req,
                    vendor__in=validated_vendors
                ).values_list('vendor__company_name', flat=True)
            )
            if already_invited_names:
                return Response(
                    {'vendor_ids': f"Vendor(s) {', '.join(already_invited_names)} have already been invited to an active RFQ for {requisition.req_number}."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        items_input = data.get('items', [])

        with transaction.atomic():
            rfq = QuotationRequest.objects.create(
                requisition=requisition,
                created_by=user,
                title=title,
                due_date=parsed_due_date,
                delivery_requirements=delivery_requirements,
                delivery_location=delivery_location,
                estimated_budget=requisition.estimated_budget,
                terms_and_conditions=terms_and_conditions,
                status=QuotationRequest.StatusChoices.SENT
            )

            # Record vendor invitations
            for v in validated_vendors:
                RFQVendorInvitation.objects.get_or_create(
                    quotation_request=rfq,
                    vendor=v,
                    defaults={
                        'invited_by': user,
                        'status': RFQVendorInvitation.InvitationStatus.INVITED
                    }
                )

            # Record items
            if items_input and isinstance(items_input, list):
                for item_dict in items_input:
                    RFQItem.objects.create(
                        quotation_request=rfq,
                        item_name=item_dict.get('item_name') or requisition.title,
                        category=item_dict.get('category') or requisition.category,
                        quantity=int(item_dict.get('quantity') or 1),
                        unit_of_measurement=item_dict.get('unit_of_measurement') or 'Piece',
                        technical_specifications=item_dict.get('technical_specifications') or '',
                        estimated_unit_price=item_dict.get('estimated_unit_price') or 0.00
                    )
            else:
                req_items = list(requisition.items.all())
                if req_items:
                    for it in req_items:
                        RFQItem.objects.create(
                            quotation_request=rfq,
                            requisition_item=it,
                            item_name=it.item_name,
                            category=it.category,
                            quantity=it.quantity,
                            unit_of_measurement='Piece',
                            technical_specifications=it.specifications or '',
                            estimated_unit_price=it.estimated_unit_price or 0.00
                        )
                else:
                    RFQItem.objects.create(
                        quotation_request=rfq,
                        item_name=requisition.title,
                        category=requisition.category,
                        quantity=1,
                        unit_of_measurement='Piece',
                        technical_specifications=requisition.justification or '',
                        estimated_unit_price=requisition.estimated_budget or 0.00
                    )

            # Update requisition status to RFQ_ISSUED (Awaiting Quotations)
            if requisition.status != Requisition.StatusChoices.RFQ_ISSUED:
                requisition.status = Requisition.StatusChoices.RFQ_ISSUED
                requisition.save(update_fields=['status', 'updated_at'])

            # Record AuditLog
            creator_name = user.get_full_name() or user.username
            AuditLog.objects.create(
                user=user,
                action='RFQ Created and Sent',
                module='Procurement Committee',
                description=(
                    f"Procurement Committee member @{user.username} ({creator_name}) created and issued {rfq.rfq_number} "
                    f"('{rfq.title}') for purchase request {requisition.req_number}. "
                    f"Invited {len(validated_vendors)} eligible vendor(s). Deadline: {rfq.due_date}."
                )
            )

        serializer = QuotationRequestSerializer(rfq, context={'request': request})
        return Response({
            'message': f"RFQ {rfq.rfq_number} created and recorded successfully for {len(validated_vendors)} invited vendor(s).",
            'rfq': serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='invite-vendor', permission_classes=[IsAuthenticated])
    def invite_vendor(self, request, pk=None):
        """
        Invite an additional vendor to an open RFQ (up to 4 vendors total).
        """
        rfq = self.get_object()
        user = request.user
        is_admin = (
            user.is_superuser or
            user.is_staff or
            (hasattr(user, 'role') and user.role and user.role.name.lower() in ['admin', 'superadmin'])
        )
        if not is_admin and rfq.created_by_id and rfq.created_by_id != user.id:
            if not (rfq.requisition and rfq.requisition.assigned_committee_member_id == user.id):
                return Response({'detail': 'You are not authorized to invite vendors for this RFQ.'}, status=status.HTTP_403_FORBIDDEN)

        if rfq.status not in [QuotationRequest.StatusChoices.OPEN, QuotationRequest.StatusChoices.SENT]:
            return Response({'detail': f'Cannot invite vendors to an RFQ in status {rfq.get_status_display()}.'}, status=status.HTTP_400_BAD_REQUEST)

        current_count = rfq.vendor_invitations.count()
        if current_count >= 4:
            return Response({'detail': 'This RFQ has already reached the maximum limit of 4 invited vendors.'}, status=status.HTTP_400_BAD_REQUEST)

        vendor_id = request.data.get('vendor_id')
        if not vendor_id:
            return Response({'vendor_id': 'Vendor ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        from vendors.models import Vendor
        vendor = Vendor.objects.filter(id=vendor_id, is_active=True, status=Vendor.StatusChoices.ACTIVE).prefetch_related('supplier_categories', 'application__supplier_categories').first()
        if not vendor:
            return Response({'vendor_id': 'Vendor not found or inactive.'}, status=status.HTTP_404_NOT_FOUND)

        if RFQVendorInvitation.objects.filter(quotation_request=rfq, vendor=vendor).exists():
            return Response({'vendor_id': f"Vendor '{vendor.company_name}' has already been invited to this RFQ."}, status=status.HTTP_400_BAD_REQUEST)

        inv = RFQVendorInvitation.objects.create(
            quotation_request=rfq,
            vendor=vendor,
            invited_by=user,
            status=RFQVendorInvitation.InvitationStatus.INVITED,
            notes=request.data.get('notes', '')
        )

        AuditLog.objects.create(
            user=user,
            action='Vendor Invited to RFQ',
            module='Procurement Committee',
            description=f"Added vendor '{vendor.company_name}' to RFQ {rfq.rfq_number}."
        )

        return Response({
            'message': f"Vendor '{vendor.company_name}' has been successfully invited.",
            'rfq': QuotationRequestSerializer(rfq, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='record-quotation', permission_classes=[IsAuthenticated])
    def record_quotation(self, request, pk=None):
        """
        Record a formal quotation from an invited vendor for this RFQ.
        Updates vendor invitation status to QUOTED and transitions requisition status to QUOTATIONS_RECEIVED.
        """
        rfq = self.get_object()
        user = request.user
        vendor_id = request.data.get('vendor_id')
        if not vendor_id:
            return Response({'vendor_id': 'Vendor ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        invitation = RFQVendorInvitation.objects.filter(quotation_request=rfq, vendor_id=vendor_id).first()
        if not invitation:
            return Response({'vendor_id': 'The specified vendor was not invited to this RFQ.'}, status=status.HTTP_400_BAD_REQUEST)

        total_amount = request.data.get('total_amount')
        if total_amount is None:
            return Response({'total_amount': 'Total quotation amount is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            total_amount = float(total_amount)
            if total_amount < 0:
                raise ValueError()
        except (ValueError, TypeError):
            return Response({'total_amount': 'Invalid total amount.'}, status=status.HTTP_400_BAD_REQUEST)

        lead_time_days = request.data.get('lead_time_days')
        if lead_time_days is not None:
            try:
                lead_time_days = int(lead_time_days)
            except (ValueError, TypeError):
                lead_time_days = None

        remarks = request.data.get('remarks', '')
        valid_until = request.data.get('valid_until') or None

        with transaction.atomic():
            quotation, created = Quotation.objects.update_or_create(
                quotation_request=rfq,
                vendor_id=vendor_id,
                defaults={
                    'total_amount': total_amount,
                    'lead_time_days': lead_time_days,
                    'remarks': remarks,
                    'valid_until': valid_until,
                    'status': Quotation.StatusChoices.SUBMITTED,
                }
            )

            # Update invitation status
            invitation.status = RFQVendorInvitation.InvitationStatus.QUOTED
            invitation.save(update_fields=['status'])

            # If items provided, record them
            items_data = request.data.get('items', [])
            if items_data and isinstance(items_data, list):
                quotation.items.all().delete()
                for it in items_data:
                    QuotationItem.objects.create(
                        quotation=quotation,
                        item_name=it.get('item_name') or 'Procurement Item',
                        specification=it.get('specification') or '',
                        quantity=int(it.get('quantity') or 1),
                        unit_price=float(it.get('unit_price') or total_amount)
                    )

            # Transition requisition status from RFQ_ISSUED to QUOTATIONS_RECEIVED
            req = rfq.requisition
            if req and req.status == Requisition.StatusChoices.RFQ_ISSUED:
                req.status = Requisition.StatusChoices.QUOTATIONS_RECEIVED
                req.save(update_fields=['status', 'updated_at'])

            AuditLog.objects.create(
                user=user,
                action='Quotation Recorded',
                module='Procurement Committee',
                description=f"Recorded quotation {quotation.quotation_number} from vendor '{invitation.vendor.company_name}' for RFQ {rfq.rfq_number}."
            )

        return Response({
            'message': f"Quotation recorded successfully for {invitation.vendor.company_name}.",
            'quotation': QuotationSerializer(quotation, context={'request': request}).data,
            'rfq': QuotationRequestSerializer(rfq, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='cancel', permission_classes=[IsAuthenticated])
    def cancel(self, request, pk=None):
        """
        Cancel an issued RFQ with a recorded reason.
        Only accessible to the RFQ creator, assigned committee member, or Admin.
        """
        rfq = self.get_object()
        user = request.user
        role_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name
        is_creator = rfq.created_by_id == user.id
        is_assigned_committee = rfq.requisition.assigned_committee_member_id == user.id

        if not is_admin and not is_creator and not is_assigned_committee:
            return Response(
                {'detail': 'You do not have permission to cancel this RFQ.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if rfq.status == QuotationRequest.StatusChoices.CANCELLED:
            return Response({'detail': 'This RFQ is already cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        if rfq.status == QuotationRequest.StatusChoices.CLOSED:
            return Response({'detail': 'This RFQ has already been closed and cannot be cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response({'reason': 'A recorded cancellation reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        rfq.status = QuotationRequest.StatusChoices.CANCELLED
        rfq.cancellation_reason = reason
        rfq.cancelled_by = user
        rfq.cancelled_at = timezone.now()
        rfq.save(update_fields=['status', 'cancellation_reason', 'cancelled_by', 'cancelled_at', 'updated_at'])

        # AuditLog
        AuditLog.objects.create(
            user=user,
            action='RFQ Cancelled',
            module='Procurement Committee',
            description=f"RFQ {rfq.rfq_number} was cancelled by @{user.username}. Reason: {reason}"
        )

        serializer = QuotationRequestSerializer(rfq, context={'request': request})
        return Response({
            'message': f"RFQ {rfq.rfq_number} has been cancelled.",
            'rfq': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='submit-quotation', permission_classes=[IsAuthenticated], parser_classes=[MultiPartParser, FormParser, JSONParser])
    def submit_quotation(self, request, pk=None):
        """
        Action for a vendor to submit their formal quotation against an issued RFQ.
        Validates:
        1. User must be an active vendor invited to this RFQ.
        2. RFQ must be active and not expired/cancelled/closed.
        3. Validates required pricing and breakdown (unit price, total, taxes, shipping, lead time, remarks, document).
        4. Updates vendor invitation to QUOTED.
        5. Updates requisition status to QUOTATIONS_RECEIVED.
        6. Keeps RFQ open for comparison.
        """
        rfq = self.get_object()
        user = request.user
        from vendors.models import Vendor
        vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()

        if not vendor:
            return Response(
                {'detail': 'Only registered vendors can submit quotations.'},
                status=status.HTTP_403_FORBIDDEN
            )

        invitation = rfq.vendor_invitations.filter(vendor=vendor).first()
        if not invitation:
            return Response(
                {'detail': 'Your vendor profile was not invited to this Request for Quotation.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if rfq.status == QuotationRequest.StatusChoices.CANCELLED:
            return Response({'detail': 'This RFQ has been cancelled and cannot accept quotations.'}, status=status.HTTP_400_BAD_REQUEST)
        if rfq.status == QuotationRequest.StatusChoices.CLOSED:
            return Response({'detail': 'This RFQ has already been closed and cannot accept further quotations.'}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.now().date()
        if rfq.due_date and rfq.due_date < today:
            return Response({'detail': f'The deadline for this RFQ expired on {rfq.due_date}.'}, status=status.HTTP_400_BAD_REQUEST)

        data = request.data
        total_amount_raw = data.get('total_amount')
        if total_amount_raw is None or str(total_amount_raw).strip() == '':
            return Response({'total_amount': 'Total quotation amount is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            total_amount = float(total_amount_raw)
            if total_amount <= 0:
                raise ValueError()
        except (ValueError, TypeError):
            return Response({'total_amount': 'Please enter a valid positive quotation amount.'}, status=status.HTTP_400_BAD_REQUEST)

        tax_pct = 0.00
        if data.get('tax_percentage') is not None and str(data.get('tax_percentage')).strip():
            try:
                tax_pct = max(0.0, float(data.get('tax_percentage')))
            except (ValueError, TypeError):
                tax_pct = 0.00

        tax_amt = 0.00
        if data.get('tax_amount') is not None and str(data.get('tax_amount')).strip():
            try:
                tax_amt = max(0.0, float(data.get('tax_amount')))
            except (ValueError, TypeError):
                tax_amt = 0.00

        shipping_charges = 0.00
        if data.get('shipping_charges') is not None and str(data.get('shipping_charges')).strip():
            try:
                shipping_charges = max(0.0, float(data.get('shipping_charges')))
            except (ValueError, TypeError):
                shipping_charges = 0.00

        lead_time_days = None
        if data.get('lead_time_days') is not None and str(data.get('lead_time_days')).strip():
            try:
                lead_time_days = max(1, int(data.get('lead_time_days')))
            except (ValueError, TypeError):
                lead_time_days = None

        valid_until = data.get('valid_until') or None
        remarks = (data.get('remarks') or '').strip()
        existing_quotation = Quotation.objects.filter(quotation_request=rfq, vendor=vendor).first()
        quotation_document = request.FILES.get('quotation_document')

        # Quotation document is strictly mandatory: must be a valid PDF
        if not quotation_document and not (existing_quotation and existing_quotation.quotation_document):
            return Response({
                'quotation_document': 'Official quotation document is mandatory. Please upload a PDF file.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if quotation_document:
            # 1. Size validation: max 15MB
            max_size = 15 * 1024 * 1024
            if quotation_document.size > max_size:
                return Response({
                    'quotation_document': f'Quotation document size ({quotation_document.size / (1024*1024):.1f}MB) exceeds the 15MB limit.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 2. File extension validation: reject DOC, DOCX, images, and non-PDFs
            ext = os.path.splitext(quotation_document.name or '')[1].lower()
            if ext != '.pdf':
                return Response({
                    'quotation_document': f'Invalid file format ({ext or "unknown"}). Only PDF files (.pdf) are accepted. DOC, DOCX, images, and other formats are rejected.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 3. Content type validation
            content_type = (quotation_document.content_type or '').lower()
            if content_type and content_type not in ['application/pdf', 'application/x-pdf', 'binary/octet-stream']:
                return Response({
                    'quotation_document': f'Invalid content type ({content_type}). Only PDF documents are accepted.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # 4. Magic bytes verification: %PDF-
            header_bytes = quotation_document.read(5)
            quotation_document.seek(0)
            if header_bytes != b'%PDF-':
                return Response({
                    'quotation_document': 'The uploaded file is not a valid PDF document. Missing %PDF- header signature.'
                }, status=status.HTTP_400_BAD_REQUEST)

        # Items parsing
        import json
        items_raw = data.get('items')
        items_data = []
        if isinstance(items_raw, str):
            try:
                items_data = json.loads(items_raw)
            except Exception:
                items_data = []
        elif isinstance(items_raw, list):
            items_data = items_raw

        with transaction.atomic():
            quotation, created = Quotation.objects.update_or_create(
                quotation_request=rfq,
                vendor=vendor,
                defaults={
                    'total_amount': total_amount,
                    'tax_percentage': tax_pct,
                    'tax_amount': tax_amt,
                    'shipping_charges': shipping_charges,
                    'lead_time_days': lead_time_days,
                    'valid_until': valid_until,
                    'remarks': remarks,
                    'status': Quotation.StatusChoices.SUBMITTED,
                }
            )

            if quotation_document:
                quotation.quotation_document = quotation_document
                quotation.save(update_fields=['quotation_document'])

            # Save items
            if items_data and isinstance(items_data, list):
                quotation.items.all().delete()
                for it in items_data:
                    u_price = float(it.get('unit_price') or 0.00)
                    qty = int(it.get('quantity') or 1)
                    QuotationItem.objects.create(
                        quotation=quotation,
                        item_name=it.get('item_name') or 'Item',
                        specification=it.get('specification') or '',
                        quantity=qty,
                        unit_price=u_price,
                        total_price=float(it.get('total_price') or (u_price * qty))
                    )
            elif not quotation.items.exists():
                for r_item in rfq.items.all():
                    QuotationItem.objects.create(
                        quotation=quotation,
                        item_name=r_item.item_name,
                        specification=r_item.technical_specifications or '',
                        quantity=r_item.quantity,
                        unit_price=float(r_item.estimated_unit_price or 0.00),
                        total_price=float(r_item.total_estimated_price or 0.00)
                    )

            # Update invitation status
            invitation.status = RFQVendorInvitation.InvitationStatus.QUOTED
            invitation.save(update_fields=['status'])

            # Transition requisition status from RFQ_ISSUED to QUOTATIONS_RECEIVED
            req = rfq.requisition
            if req and req.status == Requisition.StatusChoices.RFQ_ISSUED:
                req.status = Requisition.StatusChoices.QUOTATIONS_RECEIVED
                req.save(update_fields=['status', 'updated_at'])

            AuditLog.objects.create(
                user=user,
                action='Quotation Submitted',
                module='Vendor Portal',
                description=(
                    f"Vendor '{vendor.company_name}' submitted quotation {quotation.quotation_number} "
                    f"for RFQ {rfq.rfq_number} (Total: ₹{total_amount:,.2f})."
                )
            )

        rfq_serializer = QuotationRequestSerializer(rfq, context={'request': request})
        quote_serializer = QuotationSerializer(quotation, context={'request': request})
        return Response({
            'message': f"Quotation {quotation.quotation_number} has been submitted successfully.",
            'quotation': quote_serializer.data,
            'rfq': rfq_serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='summary')
    def summary(self, request):
        """
        Statistics summary for the RFQ Management section.
        """
        qs = self.get_queryset()
        today = timezone.now().date()

        total = qs.count()
        sent_or_open = qs.filter(
            status__in=[QuotationRequest.StatusChoices.OPEN, QuotationRequest.StatusChoices.SENT],
            due_date__gte=today
        ).count()
        expired = qs.filter(
            Q(status=QuotationRequest.StatusChoices.EXPIRED) |
            Q(status__in=[QuotationRequest.StatusChoices.OPEN, QuotationRequest.StatusChoices.SENT], due_date__lt=today)
        ).count()
        cancelled = qs.filter(status=QuotationRequest.StatusChoices.CANCELLED).count()
        closed = qs.filter(status=QuotationRequest.StatusChoices.CLOSED).count()

        return Response({
            'total_rfqs': total,
            'open_rfqs': sent_or_open,
            'expired_rfqs': expired,
            'cancelled_rfqs': cancelled,
            'closed_rfqs': closed
        }, status=status.HTTP_200_OK)


class QuotationViewSet(viewsets.ModelViewSet):
    queryset = Quotation.objects.select_related(
        'quotation_request', 'quotation_request__requisition',
        'quotation_request__requisition__department', 'vendor', 'recommended_by'
    ).prefetch_related('items', 'quotation_request__requisition__items').all()
    serializer_class = QuotationSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = QuotationFilter
    search_fields = ['quotation_number', 'remarks', 'vendor__company_name', 'quotation_request__rfq_number', 'quotation_request__requisition__req_number']

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Quotation.objects.none()

        qs = Quotation.objects.select_related(
            'quotation_request', 'quotation_request__requisition',
            'quotation_request__requisition__department', 'vendor', 'recommended_by'
        ).prefetch_related('items', 'quotation_request__requisition__items')
        role_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name
        is_vendor = 'vendor' in role_name or hasattr(user, 'vendor_profile')
        is_committee = 'committee' in role_name
        is_po = 'purchase' in role_name

        if is_vendor:
            from vendors.models import Vendor
            vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
            if not vendor:
                return Quotation.objects.none()
            return qs.filter(vendor=vendor).order_by('-created_at')
        elif is_committee and not is_admin:
            # Strictly scoped to quotations for purchase requests assigned to this committee member (or RFQs created by them)
            return qs.filter(
                Q(quotation_request__requisition__assigned_committee_member=user) |
                Q(quotation_request__created_by=user)
            ).order_by('-created_at')
        elif is_po and not is_admin:
            return qs.filter(
                Q(quotation_request__requisition__assigned_purchase_officer=user) |
                Q(quotation_request__created_by=user)
            ).order_by('-created_at')
        elif not is_admin:
            return qs.filter(
                Q(quotation_request__created_by=user) |
                Q(quotation_request__requisition__assigned_committee_member=user)
            ).order_by('-created_at')

        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        quotation = serializer.save()
        rfq = quotation.quotation_request
        if rfq:
            RFQVendorInvitation.objects.filter(
                quotation_request=rfq,
                vendor=quotation.vendor
            ).update(status=RFQVendorInvitation.InvitationStatus.QUOTED)

            req = rfq.requisition
            if req and req.status == Requisition.StatusChoices.RFQ_ISSUED:
                req.status = Requisition.StatusChoices.QUOTATIONS_RECEIVED
                req.save(update_fields=['status', 'updated_at'])

    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        quotation = self.get_object()
        serializer = QuotationItemSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(quotation=quotation)
            # recalculate total amount
            total = sum(item.total_price for item in quotation.items.all())
            quotation.total_amount = total
            quotation.save()
            return Response(QuotationSerializer(quotation, context={'request': request}).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='mark-under-review', permission_classes=[IsAuthenticated])
    def mark_under_review(self, request, pk=None):
        """
        Transition quotation status to UNDER_REVIEW during committee evaluation.
        """
        quotation = self.get_object()
        user = request.user
        role_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name
        req = quotation.quotation_request.requisition if quotation.quotation_request else None

        if not is_admin and req and req.assigned_committee_member_id != user.id:
            return Response(
                {'detail': 'You can only review quotations for purchase requests assigned to you.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if quotation.status not in [Quotation.StatusChoices.SUBMITTED, Quotation.StatusChoices.UNDER_REVIEW]:
            return Response(
                {'detail': f'Cannot mark quotation in status {quotation.get_status_display()} as under review.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        quotation.status = Quotation.StatusChoices.UNDER_REVIEW
        quotation.save(update_fields=['status', 'updated_at'])

        AuditLog.objects.create(
            user=user,
            action='Quotation Under Review',
            module='Procurement Committee',
            description=f"Committee member @{user.username} initiated evaluation for quotation {quotation.quotation_number} from vendor '{quotation.vendor.company_name}'."
        )

        return Response({
            'message': f"Quotation {quotation.quotation_number} marked as Under Review.",
            'quotation': QuotationSerializer(quotation, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='evaluate', permission_classes=[IsAuthenticated])
    def evaluate(self, request, pk=None):
        """
        Record evaluation remarks for a specific quotation.
        """
        quotation = self.get_object()
        user = request.user
        role_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name
        req = quotation.quotation_request.requisition if quotation.quotation_request else None

        if not is_admin and req and req.assigned_committee_member_id != user.id:
            return Response(
                {'detail': 'You can only evaluate quotations for purchase requests assigned to you.'},
                status=status.HTTP_403_FORBIDDEN
            )

        remarks = request.data.get('evaluation_remarks', '').strip()
        if not remarks:
            return Response(
                {'evaluation_remarks': 'Evaluation remarks are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        quotation.evaluation_remarks = remarks
        if quotation.status == Quotation.StatusChoices.SUBMITTED:
            quotation.status = Quotation.StatusChoices.UNDER_REVIEW
        quotation.save(update_fields=['evaluation_remarks', 'status', 'updated_at'])

        AuditLog.objects.create(
            user=user,
            action='Quotation Evaluated',
            module='Procurement Committee',
            description=f"Committee member @{user.username} recorded evaluation remarks for quotation {quotation.quotation_number}."
        )

        return Response({
            'message': f"Evaluation remarks saved for quotation {quotation.quotation_number}.",
            'quotation': QuotationSerializer(quotation, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='recommend', permission_classes=[IsAuthenticated])
    def recommend(self, request, pk=None):
        """
        Recommend this vendor quotation for committee approval and subsequent Purchase Officer contracting.
        Enforces:
        - Only assigned committee member or Admin.
        - Evaluation remarks (justification based on price, specs, delivery) are required.
        - Sets is_recommended=True, status=RECOMMENDED, recommended_by=user, recommended_at=now.
        - Resets previously recommended quotation for the same RFQ to UNDER_REVIEW.
        - Submits recommendation approval record without prematurely marking ACCEPTED or awarding contract.
        """
        quotation = self.get_object()
        user = request.user
        role_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name
        rfq = quotation.quotation_request
        req = rfq.requisition if rfq else None

        if not is_admin and req and req.assigned_committee_member_id != user.id:
            return Response(
                {'detail': 'You can only recommend quotations for purchase requests assigned to you.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if quotation.status in [Quotation.StatusChoices.ACCEPTED, Quotation.StatusChoices.REJECTED]:
            return Response(
                {'detail': f'Cannot recommend a quotation that is already {quotation.get_status_display()}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        remarks = request.data.get('evaluation_remarks', '').strip()
        if not remarks:
            return Response(
                {'evaluation_remarks': 'Recommendation remarks are mandatory (record justification based on price, technical specifications, and delivery timeline).'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Reset any previous recommendation for this RFQ
            if rfq:
                competing_recommended = Quotation.objects.filter(
                    quotation_request=rfq,
                    is_recommended=True
                ).exclude(id=quotation.id)
                for comp in competing_recommended:
                    comp.is_recommended = False
                    comp.status = Quotation.StatusChoices.UNDER_REVIEW
                    comp.save(update_fields=['is_recommended', 'status', 'updated_at'])

            quotation.is_recommended = True
            quotation.status = Quotation.StatusChoices.RECOMMENDED
            quotation.recommended_by = user
            quotation.recommended_at = timezone.now()
            quotation.evaluation_remarks = remarks
            quotation.save(update_fields=['is_recommended', 'status', 'recommended_by', 'recommended_at', 'evaluation_remarks', 'updated_at'])

            # Record committee recommendation approval entry (pending formal committee approval)
            if req:
                committee_name = user.get_full_name() or user.username
                Approval.objects.create(
                    requisition=req,
                    approved_by=user,
                    stage='Procurement Committee Recommendation',
                    status=Approval.StatusChoices.PENDING,
                    comments=(
                        f"Committee Member @{user.username} ({committee_name}) recommended vendor "
                        f"'{quotation.vendor.company_name}' (Quotation {quotation.quotation_number}, "
                        f"Total: ₹{quotation.total_amount:,.2f}, Lead Time: {quotation.lead_time_days or 'N/A'} days). "
                        f"Justification: {remarks}"
                    )
                )

            AuditLog.objects.create(
                user=user,
                action='Vendor Quotation Recommended',
                module='Procurement Committee',
                description=(
                    f"Committee member @{user.username} recommended quotation {quotation.quotation_number} "
                    f"from vendor '{quotation.vendor.company_name}' for purchase request {req.req_number if req else 'N/A'}. "
                    f"Justification: {remarks}"
                )
            )

        return Response({
            'message': f"Quotation {quotation.quotation_number} from '{quotation.vendor.company_name}' successfully recommended for committee approval.",
            'quotation': QuotationSerializer(quotation, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='compare', permission_classes=[IsAuthenticated])
    def compare(self, request):
        """
        Compare all quotations received for a specific RFQ or Requisition side-by-side.
        Returns quote matrix, price ranking, delivery speed, and evaluation details.
        """
        rfq_id = request.query_params.get('rfq_id')
        req_id = request.query_params.get('requisition_id')
        if not rfq_id and not req_id:
            return Response({'detail': 'rfq_id or requisition_id parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        role_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name

        rfq = None
        if rfq_id:
            rfq = QuotationRequest.objects.select_related('requisition', 'requisition__department', 'created_by').prefetch_related('items', 'requisition__items').filter(id=rfq_id).first()
        elif req_id:
            rfq = QuotationRequest.objects.select_related('requisition', 'requisition__department', 'created_by').prefetch_related('items', 'requisition__items').filter(requisition_id=req_id).order_by('-created_at').first()

        if not rfq:
            return Response({'detail': 'No Request for Quotation found for the specified reference.'}, status=status.HTTP_404_NOT_FOUND)

        if not is_admin and rfq.requisition and rfq.requisition.assigned_committee_member_id != user.id and rfq.created_by_id != user.id:
            return Response({'detail': 'You can only compare quotations for purchase requests assigned to your queue.'}, status=status.HTTP_403_FORBIDDEN)

        quotations = Quotation.objects.filter(quotation_request=rfq).select_related('vendor', 'recommended_by').prefetch_related('items').order_by('total_amount')
        quote_data = QuotationSerializer(quotations, many=True, context={'request': request}).data

        lowest_price = None
        fastest_delivery = None
        recommended_id = None
        if quotations.exists():
            lowest_quote = min(quotations, key=lambda q: q.total_amount)
            lowest_price = lowest_quote.id
            valid_lead = [q for q in quotations if q.lead_time_days]
            if valid_lead:
                fastest_delivery = min(valid_lead, key=lambda q: q.lead_time_days).id
            rec_quote = quotations.filter(is_recommended=True).first()
            if rec_quote:
                recommended_id = rec_quote.id

        req = rfq.requisition
        tech_eval_info = None
        if req:
            tech_eval_info = {
                'requires_technical_evaluation': req.requires_technical_evaluation,
                'technical_compliance': req.technical_compliance,
                'technical_recommendation': req.technical_recommendation,
                'technical_evaluation_remarks': req.technical_evaluation_remarks,
                'technical_evaluated_at': req.technical_evaluated_at.isoformat() if req.technical_evaluated_at else None,
                'evaluated_by_name': (req.assigned_technical_officer.get_full_name() or req.assigned_technical_officer.username) if req.assigned_technical_officer else None,
            }

        return Response({
            'rfq': QuotationRequestSerializer(rfq, context={'request': request}).data,
            'requisition': RequisitionSerializer(req, context={'request': request}).data if req else None,
            'quotations': quote_data,
            'quotations_count': len(quote_data),
            'lowest_price_quotation_id': lowest_price,
            'fastest_delivery_quotation_id': fastest_delivery,
            'recommended_quotation_id': recommended_id,
            'selected_quotation_id': req.selected_quotation_id if req else None,
            'selected_vendor_id': req.selected_vendor_id if req else None,
            'technical_evaluation': tech_eval_info,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='select-vendor', permission_classes=[IsAuthenticated])
    def select_vendor(self, request, pk=None):
        """
        Procurement Committee confirms and finalizes vendor selection for a purchase request.
        Requires justification/decision remarks.
        Saves selected vendor and quotation on the Requisition, records decision-maker and timestamp.
        Sets Requisition status to VENDOR_SELECTED.
        Marks chosen quotation as SELECTED, and competing quotations as NOT_SELECTED without deleting them.
        Closes RFQ, creates Approval record and AuditLog.
        """
        quotation = self.get_object()
        user = request.user
        role_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name
        is_committee = 'committee' in role_name

        if not (is_admin or is_committee):
            return Response(
                {'detail': 'Only authorized Procurement Committee members can make a vendor selection.'},
                status=status.HTTP_403_FORBIDDEN
            )

        rfq = quotation.quotation_request
        req = rfq.requisition if rfq else None

        if not req:
            return Response(
                {'detail': 'No purchase request linked to this quotation.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Scoping permission check: committee member must be assigned to this requisition (unless admin)
        if not is_admin and req.assigned_committee_member_id and req.assigned_committee_member_id != user.id:
            return Response(
                {'detail': 'You can only select a vendor for purchase requests assigned to you.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Prevent modification if a Purchase Order has already been created for this requisition
        if req.purchase_orders.exists() or req.status == Requisition.StatusChoices.PO_CREATED:
            return Response(
                {'detail': 'A Purchase Order has already been created for this purchase request. The vendor selection cannot be changed.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        remarks = (request.data.get('decision_remarks') or request.data.get('justification') or request.data.get('remarks') or '').strip()
        if not remarks:
            return Response(
                {'decision_remarks': 'Decision remarks / justification are required to confirm vendor selection.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Mark winning quotation as SELECTED
            quotation.status = Quotation.StatusChoices.SELECTED
            quotation.is_recommended = True
            quotation.recommended_by = user
            quotation.recommended_at = timezone.now()
            quotation.evaluation_remarks = remarks
            quotation.save(update_fields=['status', 'is_recommended', 'recommended_by', 'recommended_at', 'evaluation_remarks', 'updated_at'])

            # Mark all other competing quotations for this RFQ as NOT_SELECTED without deleting them
            competing = Quotation.objects.filter(quotation_request=rfq).exclude(id=quotation.id)
            competing.update(status=Quotation.StatusChoices.NOT_SELECTED, is_recommended=False)

            # Update Requisition
            req.selected_vendor = quotation.vendor
            req.selected_quotation = quotation
            req.vendor_selected_by = user
            req.vendor_selected_at = timezone.now()
            req.vendor_selection_remarks = remarks
            req.status = Requisition.StatusChoices.VENDOR_SELECTED
            req.save(update_fields=[
                'selected_vendor', 'selected_quotation', 'vendor_selected_by',
                'vendor_selected_at', 'vendor_selection_remarks', 'status', 'updated_at'
            ])

            # Close RFQ
            if rfq.status != QuotationRequest.StatusChoices.CLOSED:
                rfq.status = QuotationRequest.StatusChoices.CLOSED
                rfq.save(update_fields=['status', 'updated_at'])

            # Create Approval record
            committee_name = user.get_full_name() or user.username
            Approval.objects.create(
                requisition=req,
                approved_by=user,
                stage='Procurement Committee Vendor Selection',
                status=Approval.StatusChoices.APPROVED,
                comments=(
                    f"Vendor '{quotation.vendor.company_name}' selected by Committee Member @{user.username} "
                    f"({committee_name}) with Quotation {quotation.quotation_number} "
                    f"(Total: ₹{quotation.total_amount:,.2f}). Justification: {remarks}"
                )
            )

            # Audit Log
            AuditLog.objects.create(
                user=user,
                action='Vendor Selected',
                module='Procurement Committee',
                description=(
                    f"Procurement Committee member @{user.username} confirmed vendor selection of '{quotation.vendor.company_name}' "
                    f"(Quotation: {quotation.quotation_number}, Amount: ₹{quotation.total_amount}) "
                    f"for Purchase Request {req.req_number}. Decision remarks: {remarks}"
                )
            )

        return Response({
            'message': f"Vendor '{quotation.vendor.company_name}' successfully selected and confirmed for {req.req_number}.",
            'quotation': QuotationSerializer(quotation, context={'request': request}).data,
            'requisition': RequisitionSerializer(req, context={'request': request}).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='accept', permission_classes=[IsAuthenticated])
    def accept(self, request, pk=None):
        quotation = self.get_object()
        rfq = quotation.quotation_request
        user = request.user

        with transaction.atomic():
            quotation.status = Quotation.StatusChoices.ACCEPTED
            quotation.save(update_fields=['status', 'updated_at'])

            # Reject other competing quotations for this RFQ
            competing = Quotation.objects.filter(quotation_request=rfq).exclude(id=quotation.id)
            competing.update(status=Quotation.StatusChoices.REJECTED)

            # Close RFQ
            if rfq:
                rfq.status = QuotationRequest.StatusChoices.CLOSED
                rfq.save(update_fields=['status', 'updated_at'])

                # Complete requisition quotation stage
                req = rfq.requisition
                if req:
                    req.status = Requisition.StatusChoices.COMPLETED
                    req.save(update_fields=['status', 'updated_at'])

            AuditLog.objects.create(
                user=user,
                action='Quotation Accepted',
                module='Procurement Committee',
                description=(
                    f"Procurement Committee accepted quotation {quotation.quotation_number} "
                    f"from vendor '{quotation.vendor.company_name}' (Total: ₹{quotation.total_amount}) "
                    f"for RFQ {rfq.rfq_number if rfq else 'N/A'}. Quotation stage completed."
                )
            )

        return Response({
            'message': f"Quotation {quotation.quotation_number} accepted successfully. Quotation stage completed.",
            'quotation': QuotationSerializer(quotation, context={'request': request}).data,
            'rfq': QuotationRequestSerializer(rfq, context={'request': request}).data if rfq else None
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='reject', permission_classes=[IsAuthenticated])
    def reject(self, request, pk=None):
        quotation = self.get_object()
        user = request.user
        role_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name
        req = quotation.quotation_request.requisition if quotation.quotation_request else None

        if not is_admin and req and req.assigned_committee_member_id != user.id:
            return Response(
                {'detail': 'You can only reject quotations for purchase requests assigned to you.'},
                status=status.HTTP_403_FORBIDDEN
            )

        reason = request.data.get('reason', 'Quotation evaluated and rejected by Procurement Committee.')

        quotation.status = Quotation.StatusChoices.REJECTED
        quotation.is_recommended = False
        quotation.remarks = f"{quotation.remarks or ''}\n[Rejected: {reason}]".strip()
        quotation.save(update_fields=['status', 'is_recommended', 'remarks', 'updated_at'])

        AuditLog.objects.create(
            user=user,
            action='Quotation Rejected',
            module='Procurement Committee',
            description=f"Quotation {quotation.quotation_number} from vendor '{quotation.vendor.company_name}' rejected by @{user.username}."
        )

        return Response({
            'message': f"Quotation {quotation.quotation_number} has been rejected.",
            'quotation': QuotationSerializer(quotation, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='document', permission_classes=[AllowAny])
    def document(self, request, pk=None):
        try:
            quotation = Quotation.objects.select_related('quotation_request', 'quotation_request__requisition', 'vendor__user').get(pk=pk)
        except Quotation.DoesNotExist:
            from django.http import Http404
            raise Http404("Quotation not found.")

        user = request.user
        if not user or not user.is_authenticated:
            token = request.query_params.get('token')
            if not token and 'Authorization' in request.headers:
                auth_header = request.headers['Authorization']
                if auth_header.startswith('Bearer '):
                    token = auth_header.split(' ')[1].strip()
            if token:
                try:
                    from rest_framework_simplejwt.authentication import JWTAuthentication
                    jwt_auth = JWTAuthentication()
                    validated_token = jwt_auth.get_validated_token(token)
                    user = jwt_auth.get_user(validated_token)
                except Exception:
                    pass

        if not user or not user.is_authenticated:
            from rest_framework.exceptions import NotAuthenticated
            raise NotAuthenticated("Authentication credentials were not provided.")

        role_name = user.role.name.lower() if user.role else ''
        is_admin_or_super = user.is_superuser or user.is_staff or 'admin' in role_name
        is_committee = 'committee' in role_name
        is_po = 'purchase' in role_name
        is_owner_vendor = (
            (hasattr(user, 'vendor_profile') and user.vendor_profile == quotation.vendor) or
            (quotation.vendor and quotation.vendor.user == user)
        )

        if is_committee and not is_admin_or_super:
            req = quotation.quotation_request.requisition if quotation.quotation_request else None
            is_assigned = (req and req.assigned_committee_member_id == user.id) or (quotation.quotation_request and quotation.quotation_request.created_by_id == user.id)
            if not is_assigned:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You can only access documents for quotations associated with your assigned purchase requests.")

        if not (is_admin_or_super or is_committee or is_po or is_owner_vendor):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to view or download this quotation document.")

        if not quotation.quotation_document:
            from django.http import Http404
            raise Http404("No quotation document attached to this quotation.")

        from django.http import FileResponse
        from django.conf import settings
        import os
        import io
        import mimetypes

        doc_file = quotation.quotation_document
        filename = os.path.basename(doc_file.name)
        content_type, _ = mimetypes.guess_type(filename)
        if not content_type:
            content_type = 'application/pdf'

        try:
            if doc_file.storage.exists(doc_file.name):
                response = FileResponse(doc_file.open('rb'), content_type=content_type, as_attachment=False)
                response['Content-Disposition'] = f'inline; filename="{filename}"'
                return response
        except Exception:
            pass

        local_path = os.path.join(str(settings.MEDIA_ROOT), doc_file.name)
        if os.path.exists(local_path) and os.path.isfile(local_path):
            response = FileResponse(open(local_path, 'rb'), content_type=content_type, as_attachment=False)
            response['Content-Disposition'] = f'inline; filename="{filename}"'
            return response

        from backend.views import generate_fallback_pdf
        pdf_bytes = generate_fallback_pdf(
            filename,
            f"Quotation {quotation.quotation_number} - {quotation.vendor.company_name if quotation.vendor else 'Vendor'}"
        )
        response = FileResponse(io.BytesIO(pdf_bytes), content_type='application/pdf', as_attachment=False)
        response['Content-Disposition'] = f'inline; filename="{filename}"'
        return response


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.select_related('requisition', 'quotation', 'vendor', 'created_by').prefetch_related('items').all()
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = PurchaseOrderFilter
    search_fields = ['po_number', 'terms_and_conditions']

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return PurchaseOrder.objects.none()

        qs = PurchaseOrder.objects.select_related(
            'requisition', 'requisition__department', 'quotation', 'vendor', 'created_by'
        ).prefetch_related('items', 'requisition__items')

        r_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in r_name
        is_po = ('purchase' in r_name or 'purchase officer' in r_name) and not ('staff' in r_name)
        is_vendor = 'vendor' in r_name or hasattr(user, 'vendor_profile')
        is_committee = 'committee' in r_name

        if is_admin or is_po:
            return qs.order_by('-created_at')
        elif is_vendor:
            from vendors.models import Vendor
            vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
            if not vendor:
                return PurchaseOrder.objects.none()
            return qs.filter(vendor=vendor).order_by('-created_at')
        elif is_committee:
            return qs.filter(requisition__assigned_committee_member=user).order_by('-created_at')

        return qs.filter(created_by=user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_po = ('purchase' in r_name or 'purchase officer' in r_name) and not ('staff' in r_name)
        is_admin = user.is_superuser or user.is_staff or 'admin' in r_name

        if not (is_po or is_admin):
            return Response(
                {'detail': 'Only authorized Purchase Officers and Administrators can create purchase orders.'},
                status=status.HTTP_403_FORBIDDEN
            )

        requisition_id = request.data.get('requisition')
        quotation_id = request.data.get('quotation')
        vendor_id = request.data.get('vendor')
        expected_delivery_date = request.data.get('expected_delivery_date')
        terms_and_conditions = request.data.get('terms_and_conditions', '')
        custom_total = request.data.get('total_amount')

        req = None
        if requisition_id:
            try:
                req = Requisition.objects.get(pk=requisition_id)
            except Requisition.DoesNotExist:
                return Response({'detail': f'Requisition {requisition_id} does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

            # Prevent duplicate purchase orders for the same approved procurement decision
            if PurchaseOrder.objects.filter(requisition=req).exists():
                return Response(
                    {'detail': f'A Purchase Order has already been created for purchase request {req.req_number}. Duplicate purchase orders are prevented.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate vendor selection
            if req.selected_vendor_id:
                if vendor_id and int(vendor_id) != req.selected_vendor_id:
                    return Response(
                        {'detail': f"Vendor must match the committee-approved vendor '{req.selected_vendor.company_name}'."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                vendor_id = req.selected_vendor_id

            if req.selected_quotation_id:
                if quotation_id and int(quotation_id) != req.selected_quotation_id:
                    return Response(
                        {'detail': f"Quotation must match the committee-approved quotation '{req.selected_quotation.quotation_number}'."},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                quotation_id = req.selected_quotation_id

        if not vendor_id:
            return Response({'vendor': 'Vendor is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            vendor = Vendor.objects.get(pk=vendor_id)
        except Vendor.DoesNotExist:
            return Response({'vendor': 'Vendor does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

        quote = None
        if quotation_id:
            try:
                quote = Quotation.objects.get(pk=quotation_id)
            except Quotation.DoesNotExist:
                return Response({'quotation': 'Quotation does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

        # Calculate or resolve total amount
        if custom_total is not None and str(custom_total).strip():
            total_amount = Decimal(str(custom_total))
        elif quote and quote.total_amount:
            total_amount = quote.total_amount
        elif req and req.estimated_budget:
            total_amount = req.estimated_budget
        else:
            total_amount = Decimal('0.00')

        # Resolve delivery location and delivery instructions
        delivery_location = request.data.get('delivery_location')
        if not delivery_location and quote and hasattr(quote, 'quotation_request') and quote.quotation_request:
            delivery_location = quote.quotation_request.delivery_location
        if not delivery_location and req and req.department:
            delivery_location = f"Hospital {req.department.name} Receiving Bay"
        if not delivery_location:
            delivery_location = "Hospital Central Procurement Stores"

        delivery_instructions = request.data.get('delivery_instructions') or request.data.get('remarks', '')
        if not delivery_instructions and terms_and_conditions:
            delivery_instructions = terms_and_conditions

        with transaction.atomic():
            po = PurchaseOrder.objects.create(
                requisition=req,
                quotation=quote,
                vendor=vendor,
                created_by=user,
                total_amount=total_amount,
                expected_delivery_date=expected_delivery_date if expected_delivery_date else None,
                delivery_location=delivery_location,
                delivery_instructions=delivery_instructions,
                terms_and_conditions=terms_and_conditions,
                status=PurchaseOrder.StatusChoices.ISSUED
            )

            # Populate PO items from quotation items or requisition items
            if quote and quote.items.exists():
                for q_item in quote.items.all():
                    PurchaseOrderItem.objects.create(
                        purchase_order=po,
                        item_name=q_item.item_name,
                        specification=q_item.specification or '',
                        quantity=q_item.quantity,
                        unit_price=q_item.unit_price,
                        total_price=q_item.total_price
                    )
            elif req and req.items.exists():
                for r_item in req.items.all():
                    unit_p = (total_amount / r_item.quantity) if r_item.quantity else total_amount
                    PurchaseOrderItem.objects.create(
                        purchase_order=po,
                        item_name=r_item.item_name,
                        specification=r_item.specifications or '',
                        quantity=r_item.quantity,
                        unit_price=unit_p,
                        total_price=total_amount
                    )

            # Update Requisition status so that the same selection does not continue appearing as awaiting order creation
            if req:
                req.status = Requisition.StatusChoices.PO_CREATED
                req.save(update_fields=['status', 'updated_at'])

            # Update quotation status to ACCEPTED
            if quote and quote.status != Quotation.StatusChoices.ACCEPTED:
                quote.status = Quotation.StatusChoices.ACCEPTED
                quote.save(update_fields=['status', 'updated_at'])

            # Create AuditLog
            AuditLog.objects.create(
                user=user,
                action='Purchase Order Created',
                module='Purchase Officer',
                description=(
                    f"Purchase Officer @{user.username} created Purchase Order {po.po_number} "
                    f"for Vendor '{vendor.company_name}' (Total: ₹{po.total_amount:,.2f}) "
                    f"under PR {req.req_number if req else 'N/A'}."
                )
            )

        serializer = self.get_serializer(po)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_vendor = 'vendor' in r_name or hasattr(user, 'vendor_profile')
        if is_vendor:
            from vendors.models import Vendor
            vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
            if not vendor or instance.vendor_id != vendor.id:
                return Response(
                    {'detail': 'You do not have permission to view this purchase order.'},
                    status=status.HTTP_403_FORBIDDEN
                )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_po = ('purchase' in r_name or 'purchase officer' in r_name) and not ('staff' in r_name)
        is_admin = user.is_superuser or user.is_staff or 'admin' in r_name
        if not (is_po or is_admin):
            return Response(
                {'detail': 'Only authorized Purchase Officers and Administrators can modify purchase orders.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_po = ('purchase' in r_name or 'purchase officer' in r_name) and not ('staff' in r_name)
        is_admin = user.is_superuser or user.is_staff or 'admin' in r_name
        if not (is_po or is_admin):
            return Response(
                {'detail': 'Only authorized Purchase Officers and Administrators can modify purchase orders.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_po = ('purchase' in r_name or 'purchase officer' in r_name) and not ('staff' in r_name)
        is_admin = user.is_superuser or user.is_staff or 'admin' in r_name
        if not (is_po or is_admin):
            return Response(
                {'detail': 'Only authorized Purchase Officers and Administrators can delete purchase orders.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'], url_path='acknowledge', permission_classes=[IsAuthenticated])
    def acknowledge(self, request, pk=None):
        po = self.get_object()
        user = request.user

        from vendors.models import Vendor
        vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
        r_name = user.role.name.lower() if user.role else ''
        is_vendor = 'vendor' in r_name or vendor is not None

        if not is_vendor or not vendor or po.vendor_id != vendor.id:
            return Response(
                {'detail': 'Only the assigned vendor can acknowledge this purchase order.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if po.is_acknowledged or po.status in [PurchaseOrder.StatusChoices.ACKNOWLEDGED, PurchaseOrder.StatusChoices.VENDOR_ACKNOWLEDGED]:
            return Response(
                {
                    'detail': f'Purchase Order {po.po_number} has already been acknowledged.',
                    'acknowledged_at': po.acknowledged_at.isoformat() if po.acknowledged_at else None
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        notes = request.data.get('notes', '') or request.data.get('acknowledgment_notes', '')

        with transaction.atomic():
            po.is_acknowledged = True
            po.acknowledged_at = timezone.now()
            po.acknowledged_by = user
            po.acknowledgment_notes = str(notes).strip() if notes else 'Order acknowledged by vendor partner.'
            po.status = PurchaseOrder.StatusChoices.ACKNOWLEDGED
            po.save(update_fields=[
                'is_acknowledged', 'acknowledged_at', 'acknowledged_by',
                'acknowledgment_notes', 'status', 'updated_at'
            ])

            AuditLog.objects.create(
                user=user,
                action='Purchase Order Acknowledged',
                module='Vendor Portal',
                description=(
                    f"Vendor '{vendor.company_name}' acknowledged Purchase Order {po.po_number} "
                    f"on {po.acknowledged_at.strftime('%Y-%m-%d %H:%M:%S')}."
                )
            )

        serializer = self.get_serializer(po)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='update-dispatch-status', permission_classes=[IsAuthenticated])
    def update_dispatch_status(self, request, pk=None):
        po = self.get_object()
        user = request.user

        from vendors.models import Vendor
        vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
        r_name = user.role.name.lower() if user.role else ''
        is_vendor = 'vendor' in r_name or vendor is not None
        is_admin = user.is_superuser or user.is_staff or 'admin' in r_name

        if not (is_admin or (is_vendor and vendor and po.vendor_id == vendor.id)):
            return Response(
                {'detail': 'Only the assigned vendor can update the dispatch status for this purchase order.'},
                status=status.HTTP_403_FORBIDDEN
            )

        dispatch_status = request.data.get('dispatch_status') or request.data.get('status')
        if not dispatch_status:
            return Response(
                {'detail': "Dispatch status is required ('PREPARING', 'DISPATCHED', or 'DELIVERED_TO_HOSPITAL')."},
                status=status.HTTP_400_BAD_REQUEST
            )

        normalized_status = str(dispatch_status).upper().replace(' ', '_').strip()
        valid_statuses = [
            PurchaseOrder.VendorDispatchChoices.PREPARING,
            PurchaseOrder.VendorDispatchChoices.DISPATCHED,
            PurchaseOrder.VendorDispatchChoices.DELIVERED_TO_HOSPITAL
        ]

        if normalized_status not in valid_statuses:
            return Response(
                {'detail': f"Invalid dispatch status '{dispatch_status}'. Valid choices are: PREPARING, DISPATCHED, DELIVERED_TO_HOSPITAL."},
                status=status.HTTP_400_BAD_REQUEST
            )

        tracking_number = request.data.get('tracking_number') or request.data.get('vendor_tracking_number')
        notes = request.data.get('notes') or request.data.get('vendor_dispatch_notes')

        with transaction.atomic():
            po.vendor_dispatch_status = normalized_status
            if tracking_number is not None:
                po.vendor_tracking_number = str(tracking_number).strip()
            if notes is not None:
                po.vendor_dispatch_notes = str(notes).strip()
            if normalized_status in [PurchaseOrder.VendorDispatchChoices.DISPATCHED, PurchaseOrder.VendorDispatchChoices.DELIVERED_TO_HOSPITAL] and not po.vendor_dispatched_at:
                po.vendor_dispatched_at = timezone.now()

            # Ensure hospital delivery status is strictly NOT updated by vendor
            po.save(update_fields=[
                'vendor_dispatch_status', 'vendor_tracking_number',
                'vendor_dispatch_notes', 'vendor_dispatched_at', 'updated_at'
            ])

            AuditLog.objects.create(
                user=user,
                action='Dispatch Status Updated',
                module='Vendor Portal',
                description=(
                    f"Vendor '{po.vendor.company_name}' updated dispatch status for PO {po.po_number} "
                    f"to '{po.get_vendor_dispatch_status_display()}'. Tracking: {po.vendor_tracking_number or 'N/A'}."
                )
            )

        serializer = self.get_serializer(po)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='record-delivery', permission_classes=[IsAuthenticated])
    def record_delivery(self, request, pk=None):
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_po = ('purchase' in r_name or 'purchase officer' in r_name) and not ('staff' in r_name)
        is_admin = user.is_superuser or user.is_staff or 'admin' in r_name
        if not (is_po or is_admin):
            return Response(
                {'detail': 'Only authorized Purchase Officers and Administrators can record deliveries.'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            po = PurchaseOrder.objects.get(pk=pk)
        except PurchaseOrder.DoesNotExist:
            return Response({'detail': f'Purchase Order {pk} not found.'}, status=status.HTTP_404_NOT_FOUND)

        from inventory.views import process_record_delivery
        delivery, err_response = process_record_delivery(request.user, request.data, po=po)
        if err_response:
            return err_response
        serializer = self.get_serializer(po)
        return Response(serializer.data, status=status.HTTP_200_OK)




class DepartmentStaffDashboardView(APIView):
    """
    Department Staff Dashboard API Endpoint.
    Returns authenticated department staff details, procurement summary cards,
    real filtered requisitions, progress stages, and notifications.
    """
    permission_classes = [IsAuthenticated, IsDepartmentStaff]

    def get(self, request):
        user = request.user

        user_info = {
            'id': user.id,
            'employee_id': user.employee_id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'full_name': user.get_full_name() or user.username,
            'role': user.role.name if user.role else 'Department Staff',
            'department_id': user.department.id if user.department else None,
            'department_name': user.department.name if user.department else 'Unassigned Department',
            'phone': user.phone,
            'gender': user.gender,
            'date_of_birth': user.date_of_birth,
            'date_of_joining': user.date_of_joining,
        }

        # Filter strictly by the authenticated department staff member
        user_reqs = Requisition.objects.filter(requested_by=user).select_related('department', 'requested_by', 'assigned_purchase_officer')

        total_requests = user_reqs.count()
        draft_requests = user_reqs.filter(status='DRAFT').count()
        submitted_requests = user_reqs.filter(status='SUBMITTED').count()
        pending_requests = user_reqs.filter(
            status__in=[
                Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
                Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
                Requisition.StatusChoices.PENDING_APPROVAL
            ]
        ).count()
        under_review_requests = user_reqs.filter(
            status__in=[
                'UNDER_REVIEW',
                Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
                Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
                Requisition.StatusChoices.PENDING_APPROVAL
            ]
        ).count()
        approved_requests = user_reqs.filter(status__in=['APPROVED', 'RFQ_ISSUED', 'QUOTATIONS_RECEIVED']).count()
        completed_requests = user_reqs.filter(status='COMPLETED').count()

        # Recent purchase requests (latest 10)
        recent_reqs_data = []
        for req in user_reqs.order_by('-created_at')[:10]:
            po_name = (req.assigned_purchase_officer.get_full_name() or req.assigned_purchase_officer.username) if req.assigned_purchase_officer else None
            recent_reqs_data.append({
                'id': req.id,
                'req_number': req.req_number,
                'title': req.title,
                'priority': req.priority,
                'estimated_budget': str(req.estimated_budget) if req.estimated_budget is not None else None,
                'status': req.status,
                'justification': req.justification,
                'created_at': req.created_at.isoformat(),
                'department_name': req.department.name if req.department else 'N/A',
                'requested_by_name': req.requested_by.get_full_name() or req.requested_by.username if req.requested_by else 'N/A',
                'requested_by_employee_id': req.requested_by.employee_id if req.requested_by else '',
                'assigned_purchase_officer': req.assigned_purchase_officer_id,
                'assigned_purchase_officer_name': po_name,
                'assigned_purchase_officer_employee_id': req.assigned_purchase_officer.employee_id if (req.assigned_purchase_officer and req.assigned_purchase_officer.employee_id) else None,
                'assignment_status': 'Assigned' if req.assigned_purchase_officer else 'Pending Assignment',
                'assigned_at': req.assigned_at.isoformat() if req.assigned_at else None,
            })

        # Notifications / audit events
        notifications = []
        user_dept_name = user.department.name if user.department else ''
        user_req_numbers = list(user_reqs.values_list('req_number', flat=True))

        q_filter = Q(user=user) | Q(description__icontains=f"@{user.username}")
        if user_req_numbers:
            req_q = Q()
            for rn in user_req_numbers:
                req_q |= Q(description__icontains=rn)
            q_filter |= (Q(module__icontains='requisition') & req_q)
        elif user_dept_name:
            # If user has no requisitions, do not expose other users' requisitions by department
            q_filter |= (Q(module__icontains='department') & Q(description__icontains=user_dept_name))

        logs = AuditLog.objects.filter(q_filter).order_by('-created_at')[:8]

        for log in logs:
            notifications.append({
                'id': log.id,
                'action': log.action,
                'module': log.module,
                'description': log.description,
                'created_at': log.created_at.isoformat(),
            })

        # Pipeline breakdown counts
        pipeline = {
            'submitted': submitted_requests + pending_requests,
            'under_review': under_review_requests,
            'procurement': user_reqs.filter(status__in=['RFQ_ISSUED', 'QUOTATIONS_RECEIVED']).count(),
            'approved': user_reqs.filter(status='APPROVED').count(),
            'completed': completed_requests,
        }

        return Response({
            'user': user_info,
            'stats': {
                'total_requests': total_requests,
                'draft_requests': draft_requests,
                'submitted_requests': submitted_requests,
                'pending_requests': pending_requests,
                'under_review_requests': under_review_requests,
                'approved_requests': approved_requests,
                'completed_requests': completed_requests,
            },
            'pipeline': pipeline,
            'recent_requests': recent_reqs_data,
            'notifications': notifications,
        }, status=status.HTTP_200_OK)


class PurchaseOfficerDashboardView(APIView):
    """
    Purchase Officer Dashboard API Endpoint.
    Returns authenticated Purchase Officer profile info, 8 procurement summary cards,
    procurement pipeline breakdown, pending requisitions, recent quotations,
    committee review cases, purchase orders, active deliveries, and notifications.
    Strictly scoped to requisitions assigned to the logged-in Purchase Officer.
    """
    permission_classes = [IsAuthenticated, IsPurchaseOfficer]

    def get(self, request):
        user = request.user
        is_admin_or_super = user.is_superuser or user.is_staff or (user.role and 'admin' in user.role.name.lower())

        user_info = {
            'id': user.id,
            'employee_id': user.employee_id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'full_name': user.get_full_name() or user.username,
            'role': user.role.name if user.role else 'Purchase Officer',
            'department_id': user.department.id if user.department else None,
            'department_name': user.department.name if user.department else 'Procurement Department',
            'phone': user.phone,
            'gender': user.gender,
            'date_of_birth': user.date_of_birth,
            'date_of_joining': user.date_of_joining,
        }

        # Base queryset of requisitions assigned to the logged-in Purchase Officer
        # (also including legacy requisitions reviewed by this officer for backwards compatibility)
        if is_admin_or_super:
            assigned_reqs_base = Requisition.objects.all()
        else:
            assigned_reqs_base = Requisition.objects.filter(
                Q(assigned_purchase_officer=user) |
                Q(assigned_purchase_officer__isnull=True, reviewed_by=user)
            )

        # 1. Procurement Summary Cards (8 metrics)
        pending_requisitions_count = assigned_reqs_base.filter(status=Requisition.StatusChoices.SUBMITTED).count()
        requisitions_under_processing_count = assigned_reqs_base.filter(
            status__in=[
                Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
                Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
                'UNDER_REVIEW', 'RFQ_ISSUED', 'QUOTATIONS_RECEIVED', 'PENDING_APPROVAL'
            ]
        ).count()
        quotation_requests_count = QuotationRequest.objects.filter(requisition__in=assigned_reqs_base, status='OPEN').count()
        quotations_received_count = Quotation.objects.filter(quotation_request__requisition__in=assigned_reqs_base, status__in=['SUBMITTED', 'UNDER_REVIEW']).count()
        pending_committee_review_count = Approval.objects.filter(requisition__in=assigned_reqs_base, status='PENDING', stage__icontains='Committee').count()
        if pending_committee_review_count == 0:
            pending_committee_review_count = assigned_reqs_base.filter(
                status__in=['UNDER_REVIEW', Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW]
            ).count()
        if is_admin_or_super:
            po_scope = Q()
        else:
            po_scope = Q(requisition__in=assigned_reqs_base) | Q(quotation__quotation_request__requisition__in=assigned_reqs_base) | Q(created_by=user)

        approved_pos_count = PurchaseOrder.objects.filter(po_scope).count()
        pending_deliveries_count = PurchaseOrder.objects.filter(
            po_scope,
            delivery_status__in=[
                PurchaseOrder.DeliveryStatusChoices.AWAITING_DELIVERY,
                PurchaseOrder.DeliveryStatusChoices.PARTIALLY_DELIVERED
            ]
        ).count()
        completed_procurement_count = PurchaseOrder.objects.filter(
            po_scope,
            delivery_status=PurchaseOrder.DeliveryStatusChoices.DELIVERED
        ).count() + assigned_reqs_base.filter(status='COMPLETED').count()

        # 2. Pipeline Overview (8 stages)
        tech_eval_count = Quotation.objects.filter(
            quotation_request__requisition__in=assigned_reqs_base,
            status='UNDER_REVIEW',
            quotation_request__requisition__requires_technical_evaluation=True
        ).count()
        if tech_eval_count == 0:
            tech_eval_count = assigned_reqs_base.filter(
                status__in=['UNDER_REVIEW', Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION],
                requires_technical_evaluation=True
            ).count()

        pipeline = {
            'requisition_received': assigned_reqs_base.filter(
                status__in=[
                    Requisition.StatusChoices.SUBMITTED,
                    Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
                    Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
                    'PENDING_APPROVAL', 'DRAFT'
                ]
            ).count(),
            'under_procurement': assigned_reqs_base.filter(status='UNDER_REVIEW').count(),
            'quotations': quotation_requests_count,
            'technical_evaluation': tech_eval_count,
            'committee_review': pending_committee_review_count,
            'purchase_order': PurchaseOrder.objects.filter(
                quotation__quotation_request__requisition__in=assigned_reqs_base,
                status='ISSUED'
            ).count(),
            'delivery': pending_deliveries_count,
            'completed': completed_procurement_count,
        }

        # 3. Pending Purchase Requisitions (submitted requisitions requiring PO review)
        pending_reqs_qs = assigned_reqs_base.filter(
            status=Requisition.StatusChoices.SUBMITTED
        ).select_related('department', 'requested_by', 'reviewed_by', 'assigned_purchase_officer').prefetch_related('items').order_by('-submitted_at', '-created_at')[:10]
        
        pending_requisitions = []
        for req in pending_reqs_qs:
            items_data = []
            item_req_dates = []
            for it in req.items.all():
                if it.required_date:
                    item_req_dates.append(it.required_date)
                items_data.append({
                    'id': it.id,
                    'item_name': it.item_name,
                    'category': it.category,
                    'quantity': it.quantity,
                    'specifications': it.specifications,
                    'estimated_unit_price': str(it.estimated_unit_price),
                    'total_price': str(it.total_price),
                    'required_date': it.required_date.isoformat() if it.required_date else None,
                    'technical_advisory': it.determine_technical_requirement_details(),
                })
            doc_url = None
            if req.supporting_document:
                doc_url = request.build_absolute_uri(f"/api/procurement/requisitions/{req.id}/document/")

            req_earliest_date = min(item_req_dates).isoformat() if item_req_dates else None

            pending_requisitions.append({
                'id': req.id,
                'req_number': req.req_number,
                'title': req.title,
                'department_name': req.department.name if req.department else 'N/A',
                'requested_by_name': f"{req.requested_by.employee_id} • {req.requested_by.get_full_name() or req.requested_by.username}" if (req.requested_by and req.requested_by.employee_id) else (req.requested_by.get_full_name() or req.requested_by.username if req.requested_by else 'N/A'),
                'requested_by_employee_id': req.requested_by.employee_id if req.requested_by else '',
                'requested_by_email': req.requested_by.email if req.requested_by else '',
                'assigned_purchase_officer': req.assigned_purchase_officer_id,
                'assigned_purchase_officer_name': req.assigned_purchase_officer.get_full_name() or req.assigned_purchase_officer.username if req.assigned_purchase_officer else None,
                'assigned_at': req.assigned_at.isoformat() if req.assigned_at else None,
                'priority': req.priority,
                'estimated_budget': str(req.estimated_budget) if req.estimated_budget is not None else None,
                'status': req.status,
                'created_at': req.created_at.isoformat(),
                'submitted_at': req.submitted_at.isoformat() if req.submitted_at else req.created_at.isoformat(),
                'required_date': req_earliest_date,
                'justification': req.justification,
                'supporting_document': doc_url,
                'items': items_data,
                'technical_evaluation_advisory': req.get_technical_evaluation_advisory(),
                'requires_technical_evaluation': req.requires_technical_evaluation,
                'technical_specialization': req.technical_specialization,
                'review_comments': req.review_comments,
                'reviewed_by_name': req.reviewed_by.get_full_name() or req.reviewed_by.username if req.reviewed_by else None,
                'reviewed_at': req.reviewed_at.isoformat() if req.reviewed_at else None,
            })

        # 4. Recent Quotations (latest 10)
        quotations_qs = Quotation.objects.filter(
            quotation_request__requisition__in=assigned_reqs_base
        ).select_related(
            'quotation_request', 'vendor', 'quotation_request__requisition'
        ).order_by('-submission_date')[:10]
        
        recent_quotations = []
        for q in quotations_qs:
            recent_quotations.append({
                'id': q.id,
                'quotation_number': q.quotation_number,
                'rfq_number': q.quotation_request.rfq_number if q.quotation_request else 'N/A',
                'req_number': q.quotation_request.requisition.req_number if q.quotation_request and q.quotation_request.requisition else 'N/A',
                'vendor_name': q.vendor.company_name if q.vendor else 'N/A',
                'vendor_code': q.vendor.vendor_code if q.vendor else 'N/A',
                'submission_date': q.submission_date.isoformat() if q.submission_date else None,
                'total_amount': str(q.total_amount) if q.total_amount is not None else '0.00',
                'status': q.status,
                'lead_time_days': q.lead_time_days,
                'remarks': q.remarks,
            })

        # 5. Procurement Committee Review Status (latest 10)
        committee_cases = []
        approvals_qs = Approval.objects.filter(
            stage__icontains='Committee',
            requisition__in=assigned_reqs_base
        ).select_related('requisition', 'requisition__department', 'approved_by').order_by('-created_at')[:10]
        
        for app in approvals_qs:
            committee_cases.append({
                'id': app.id,
                'req_number': app.requisition.req_number if app.requisition else 'N/A',
                'title': app.requisition.title if app.requisition else 'N/A',
                'department_name': app.requisition.department.name if app.requisition and app.requisition.department else 'N/A',
                'submission_date': app.created_at.isoformat() if app.created_at else None,
                'committee_status': app.status,
                'comments': app.comments,
            })

        # If no explicit Approval objects yet, check Requisitions in UNDER_REVIEW
        if not committee_cases:
            under_review_reqs = assigned_reqs_base.filter(
                status__in=['UNDER_REVIEW', 'APPROVED', 'REJECTED']
            ).select_related('department').order_by('-updated_at')[:10]
            for r in under_review_reqs:
                committee_status = 'Under Committee Review' if r.status == 'UNDER_REVIEW' else ('Approved' if r.status == 'APPROVED' else 'Rejected')
                committee_cases.append({
                    'id': r.id,
                    'req_number': r.req_number,
                    'title': r.title,
                    'department_name': r.department.name if r.department else 'N/A',
                    'submission_date': r.created_at.isoformat(),
                    'committee_status': committee_status,
                    'comments': r.justification,
                })

        # 6. Recent Purchase Orders (latest 10)
        pos_qs = PurchaseOrder.objects.filter(po_scope).select_related(
            'quotation', 'vendor', 'created_by'
        ).order_by('-order_date', '-created_at')[:10]
        
        recent_pos = []
        for po in pos_qs:
            recent_pos.append({
                'id': po.id,
                'po_number': po.po_number,
                'vendor_name': po.vendor.company_name if po.vendor else 'N/A',
                'vendor_code': po.vendor.vendor_code if po.vendor else 'N/A',
                'rfq_number': po.quotation.quotation_request.rfq_number if po.quotation and po.quotation.quotation_request else 'N/A',
                'order_date': po.order_date.isoformat() if po.order_date else None,
                'expected_delivery_date': po.expected_delivery_date.isoformat() if po.expected_delivery_date else None,
                'total_amount': str(po.total_amount) if po.total_amount is not None else '0.00',
                'status': po.status,
                'delivery_status': po.delivery_status,
                'delivery_status_display': po.get_delivery_status_display(),
                'vendor_dispatch_status': po.vendor_dispatch_status,
                'vendor_dispatch_status_display': po.get_vendor_dispatch_status_display(),
                'terms_and_conditions': po.terms_and_conditions,
            })

        # 7. Active Deliveries (latest 10)
        deliveries_filter = Q(purchase_order__in=PurchaseOrder.objects.filter(po_scope)) if not is_admin_or_super else Q()
        deliveries_qs = Delivery.objects.filter(deliveries_filter).select_related(
            'purchase_order', 'vendor', 'recorded_by'
        ).prefetch_related('items', 'items__po_item').order_by('-created_at')[:10]
        
        active_deliveries = []
        for deliv in deliveries_qs:
            items_summary = ", ".join([f"{it.po_item.item_name} ({it.quantity_delivered})" for it in deliv.items.all()[:3]])
            active_deliveries.append({
                'id': deliv.id,
                'delivery_number': deliv.delivery_number,
                'po_number': deliv.purchase_order.po_number if deliv.purchase_order else 'N/A',
                'po_id': deliv.purchase_order_id,
                'vendor_name': deliv.vendor.company_name if deliv.vendor else 'N/A',
                'delivery_date': deliv.delivery_date.isoformat() if deliv.delivery_date else None,
                'status': deliv.status,
                'status_display': deliv.get_status_display(),
                'inspection_result': deliv.inspection_result,
                'inspection_result_display': deliv.get_inspection_result_display(),
                'tracking_number': deliv.tracking_number,
                'items_summary': items_summary,
            })

        # 8. Notifications (latest 8)
        notifications = []
        assigned_req_numbers = list(assigned_reqs_base.values_list('req_number', flat=True))
        q_filter = Q(user=user) | Q(description__icontains=f"@{user.username}")
        if assigned_req_numbers:
            req_q = Q()
            for rn in assigned_req_numbers:
                req_q |= Q(description__icontains=rn)
            q_filter |= ((Q(module__icontains='requisition') | Q(action__icontains='requisition')) & req_q)

        logs = AuditLog.objects.filter(q_filter).order_by('-created_at')[:8]
        
        for log in logs:
            notifications.append({
                'id': log.id,
                'action': log.action,
                'module': log.module,
                'description': log.description,
                'created_at': log.created_at.isoformat(),
            })

        stats_dict = {
            'pending_requisitions': pending_requisitions_count,
            'requisitions_under_processing': requisitions_under_processing_count,
            'quotation_requests': quotation_requests_count,
            'quotations_received': quotations_received_count,
            'pending_committee_review': pending_committee_review_count,
            'approved_purchase_orders': approved_pos_count,
            'approved_pos': approved_pos_count,
            'pending_deliveries': pending_deliveries_count,
            'completed_procurement': completed_procurement_count,
        }

        return Response({
            'user': user_info,
            'stats': stats_dict,
            'summary_cards': stats_dict,
            'pipeline': pipeline,
            'pending_requisitions': pending_requisitions,
            'recent_quotations': recent_quotations,
            'committee_cases': committee_cases,
            'recent_purchase_orders': recent_pos,
            'active_deliveries': active_deliveries,
            'notifications': notifications,
        }, status=status.HTTP_200_OK)


class ProcurementCommitteeDashboardView(APIView):
    """
    Procurement Committee Dashboard API Endpoint.
    Returns authenticated Committee Member profile info, 6 decision statistics,
    procurement workflow overview pipeline, pending procurement reviews,
    committee review queue, recent committee decisions, and notifications.
    """
    permission_classes = [IsAuthenticated, IsCommitteeMember]

    def get(self, request):
        user = request.user

        user_info = {
            'id': user.id,
            'employee_id': user.employee_id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'full_name': user.get_full_name() or user.username,
            'role': user.role.name if user.role else 'Procurement Committee Member',
            'department_id': user.department.id if user.department else None,
            'department_name': user.department.name if user.department else 'Procurement Committee Board',
            'phone': user.phone,
            'gender': user.gender,
            'date_of_birth': user.date_of_birth,
            'date_of_joining': user.date_of_joining,
        }

        # 1. Genuine Requisitions Querysets
        # Displays purchase-ready requests assigned directly to THIS committee member (Requirement 2 & 5)
        # Route 1: Purchase Officer approval for requests that do not require technical evaluation (requires_technical_evaluation=False)
        # Route 2: Technical Officer approval for requests that require technical evaluation (requires_technical_evaluation=True and SUITABLE)
        pending_reviews_qs = Requisition.objects.filter(
            status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
            assigned_committee_member=user
        ).filter(
            Q(requires_technical_evaluation=False) |
            Q(requires_technical_evaluation=True, technical_recommendation=TechnicalEvaluation.RecommendationChoices.SUITABLE)
        ).select_related(
            'department', 'requested_by', 'assigned_technical_officer', 'assigned_purchase_officer', 'assigned_committee_member'
        ).prefetch_related('items', 'technical_evaluations', 'approvals').order_by('-updated_at', '-created_at')

        # Requests in purchasing/sourcing stages assigned to this committee member
        approved_requests_qs = Requisition.objects.filter(
            status__in=[
                Requisition.StatusChoices.APPROVED,
                Requisition.StatusChoices.RFQ_ISSUED,
                Requisition.StatusChoices.QUOTATIONS_RECEIVED,
                Requisition.StatusChoices.COMPLETED
            ],
            assigned_committee_member=user
        ).select_related(
            'department', 'requested_by', 'assigned_technical_officer', 'assigned_purchase_officer', 'assigned_committee_member', 'reviewed_by'
        ).prefetch_related('items', 'technical_evaluations', 'approvals').order_by('-reviewed_at', '-updated_at')

        # ALL requisitions assigned to this committee member across all stages (ensures nothing disappears)
        all_assigned_qs = Requisition.objects.filter(
            assigned_committee_member=user
        ).select_related(
            'department', 'requested_by', 'assigned_technical_officer', 'assigned_purchase_officer', 'assigned_committee_member', 'reviewed_by'
        ).prefetch_related(
            'items', 'technical_evaluations', 'approvals', 'quotation_requests',
            'quotation_requests__vendor_invitations', 'quotation_requests__vendor_invitations__vendor',
            'quotation_requests__quotations'
        ).order_by('-updated_at', '-created_at')

        # Requests returned for clarification by the committee (separate section)
        committee_returned_req_ids = Approval.objects.filter(
            stage__icontains='Committee',
            status=Approval.StatusChoices.RETURNED
        ).values_list('requisition_id', flat=True).distinct()

        returned_clarifications_qs = Requisition.objects.filter(
            assigned_committee_member=user,
            id__in=committee_returned_req_ids
        ).exclude(
            status__in=[Requisition.StatusChoices.APPROVED, Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW]
        ).select_related(
            'department', 'requested_by', 'assigned_technical_officer', 'assigned_purchase_officer', 'assigned_committee_member', 'reviewed_by'
        ).prefetch_related('items', 'technical_evaluations', 'approvals').order_by('-updated_at')

        pending_count = pending_reviews_qs.count()
        approved_count = approved_requests_qs.count()
        returned_count = returned_clarifications_qs.count()

        # Decision History for this committee member
        committee_approvals_qs = Approval.objects.filter(
            stage__icontains='Committee',
            requisition__assigned_committee_member=user
        ).select_related(
            'requisition', 'approved_by', 'requisition__department', 'requisition__requested_by'
        ).order_by('-created_at')

        decision_history = []
        for app in committee_approvals_qs:
            req = app.requisition
            decision_history.append({
                'id': app.id,
                'requisition_id': req.id if req else None,
                'req_number': req.req_number if req else 'N/A',
                'title': req.title if req else 'N/A',
                'department_name': req.department.name if req and req.department else 'N/A',
                'category': req.category if req else 'N/A',
                'estimated_budget': str(req.estimated_budget) if req and req.estimated_budget is not None else '0.00',
                'decision': 'Approved' if app.status == Approval.StatusChoices.APPROVED else ('Returned for Clarification' if app.status == Approval.StatusChoices.RETURNED else app.status),
                'decision_status': app.status,
                'remarks': app.comments or 'Formal committee decision executed.',
                'reviewer_name': (app.approved_by.get_full_name() or app.approved_by.username) if app.approved_by else 'Procurement Committee',
                'reviewer_username': app.approved_by.username if app.approved_by else '',
                'decision_date': app.created_at.isoformat() if app.created_at else None,
                'current_status': req.status if req else 'N/A',
                'current_status_display': req.get_status_display() if req else 'N/A',
                'requires_technical_evaluation': req.requires_technical_evaluation if req else False,
            })

        clarification_count = len([d for d in decision_history if d['decision_status'] == Approval.StatusChoices.RETURNED])

        # Overall workload distribution across all 5 committee members (Requirement 3)
        from django.contrib.auth import get_user_model
        UserModel = get_user_model()
        committee_members_all = list(UserModel.objects.filter(
            role__name__icontains='committee',
            is_active=True
        ).order_by('employee_id', 'id'))

        workload_overview = []
        for m in committee_members_all:
            active_cnt = Requisition.objects.filter(
                assigned_committee_member=m
            ).exclude(status__in=[Requisition.StatusChoices.COMPLETED, Requisition.StatusChoices.REJECTED, Requisition.StatusChoices.CANCELLED, 'CLOSED']).count()
            workload_overview.append({
                'id': m.id,
                'name': m.get_full_name() or m.username,
                'username': m.username,
                'employee_id': m.employee_id or f'PC{m.id}',
                'active_workload': active_cnt,
                'is_current_user': m.id == user.id
            })

        my_completed_count = Requisition.objects.filter(
            assigned_committee_member=user,
            status=Requisition.StatusChoices.COMPLETED
        ).count()
        my_total_count = all_assigned_qs.count()
        my_active_count = all_assigned_qs.exclude(
            status__in=[Requisition.StatusChoices.COMPLETED, Requisition.StatusChoices.CANCELLED, Requisition.StatusChoices.REJECTED]
        ).count()
        newly_assigned_count = all_assigned_qs.filter(status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW).count()
        vendor_sourcing_count = all_assigned_qs.filter(status=Requisition.StatusChoices.APPROVED).count()
        awaiting_quotes_count = all_assigned_qs.filter(status=Requisition.StatusChoices.RFQ_ISSUED).count()
        quotes_review_count = all_assigned_qs.filter(status=Requisition.StatusChoices.QUOTATIONS_RECEIVED).count()

        # 2. Statistics
        stats = {
            'total_assigned': my_total_count,
            'active_assigned': my_active_count,
            'newly_assigned': newly_assigned_count,
            'vendor_sourcing': vendor_sourcing_count,
            'awaiting_quotations': awaiting_quotes_count,
            'quotation_review': quotes_review_count,
            'completed_purchases': my_completed_count,
            'pending_committee_reviews': pending_count,
            'under_review': pending_count,
            'my_assigned_requests': my_total_count,
            'approved_cases': approved_count,
            'active_sourcing': approved_requests_qs.filter(status__in=[Requisition.StatusChoices.APPROVED, Requisition.StatusChoices.RFQ_ISSUED, Requisition.StatusChoices.QUOTATIONS_RECEIVED]).count(),
            'returned_clarifications': returned_count,
            'total_decisions': len(decision_history),
            'rejected_cases': 0,
            'clarification_requested': clarification_count,
            'completed_decisions': approved_count,
            'workload_overview': workload_overview,
        }

        # 3. Workflow Pipeline Stages
        committee_tech_eval_count = Requisition.objects.filter(
            status=Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION
        ).count()

        pipeline = {
            'department_staff': Requisition.objects.filter(status__in=[Requisition.StatusChoices.DRAFT, Requisition.StatusChoices.RETURNED]).count(),
            'purchase_officer': Requisition.objects.filter(status=Requisition.StatusChoices.SUBMITTED).count(),
            'technical_evaluation': committee_tech_eval_count,
            'procurement_committee': pending_count,
            'purchase_order': PurchaseOrder.objects.filter(status='ISSUED').count(),
            'vendor_delivery': Delivery.objects.filter(status__in=['DISPATCHED', 'IN_TRANSIT']).count(),
        }

        def serialize_req_for_committee(req):
            items_list = list(req.items.all())
            item_names = ', '.join([it.item_name for it in items_list]) if items_list else req.title
            total_qty = sum(it.quantity for it in items_list) if items_list else 0
            dates = [it.required_date for it in items_list if it.required_date]
            earliest_required_date = min(dates).isoformat() if dates else None

            supporting_doc_url = None
            if req.supporting_document:
                try:
                    supporting_doc_url = request.build_absolute_uri(f"/api/procurement/requisitions/{req.id}/document/")
                except Exception:
                    supporting_doc_url = req.supporting_document.url

            tech_doc_url = None
            if req.technical_document:
                try:
                    tech_doc_url = request.build_absolute_uri(req.technical_document.url)
                except Exception:
                    tech_doc_url = req.technical_document.url

            # Technical evaluation details handling
            if not req.requires_technical_evaluation:
                tech_eval_route = "Direct PO Approval (Non-Technical)"
                tech_eval_result = "Not Required"
                tech_compliance = "Not Required"
                tech_remarks = "Technical Officer evaluation not required for routine hospital supplies / consumables per workflow rules."
                to_name = "Not Applicable (Direct Route)"
                tech_eval_date = None
            else:
                tech_eval_route = "Technical Officer Evaluation"
                latest_eval = req.technical_evaluations.order_by('-created_at').first()
                tech_remarks = req.technical_evaluation_remarks or (latest_eval.remarks if latest_eval else 'Technically suitable.')
                tech_eval_result = req.technical_recommendation or (latest_eval.recommendation if latest_eval else 'Technically Suitable')
                tech_compliance = req.technical_compliance or (latest_eval.compliance if latest_eval else 'Compliant')
                to_name = None
                if req.assigned_technical_officer:
                    to_name = req.assigned_technical_officer.get_full_name() or req.assigned_technical_officer.username
                elif latest_eval and latest_eval.evaluated_by:
                    to_name = latest_eval.evaluated_by.get_full_name() or latest_eval.evaluated_by.username
                tech_eval_date = req.technical_evaluated_at.isoformat() if req.technical_evaluated_at else (latest_eval.created_at.isoformat() if latest_eval else None)

            po_name = None
            po_username = None
            po_employee_id = None
            if req.assigned_purchase_officer:
                po_name = req.assigned_purchase_officer.get_full_name() or req.assigned_purchase_officer.username
                po_username = req.assigned_purchase_officer.username
                po_employee_id = req.assigned_purchase_officer.employee_id

            reviewer_name = None
            if req.reviewed_by:
                reviewer_name = req.reviewed_by.get_full_name() or req.reviewed_by.username

            # Check if returned for clarification
            latest_return = req.approvals.filter(
                stage__icontains='Committee',
                status=Approval.StatusChoices.RETURNED
            ).order_by('-created_at').first()

            # Stage categorization and action determinations (Requirement 1, 2, 3)
            status_code = req.status
            stage_key = 'OTHER'
            workflow_stage_display = req.get_status_display()
            action_required = False
            action_label = 'View Details'

            if status_code == Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW:
                stage_key = 'NEWLY_ASSIGNED'
                workflow_stage_display = 'Newly Assigned (Pending Sanction)'
                action_required = True
                action_label = 'Review & Decide'
            elif status_code == Requisition.StatusChoices.APPROVED:
                stage_key = 'VENDOR_SOURCING'
                workflow_stage_display = 'Vendor Sourcing (Approved)'
                action_required = True
                action_label = 'Find Vendors & Quote'
            elif status_code == Requisition.StatusChoices.RFQ_ISSUED:
                stage_key = 'AWAITING_QUOTATIONS'
                workflow_stage_display = 'RFQ Sent (Awaiting Quotations)'
                action_required = False
                action_label = 'Track Quotations'
            elif status_code == Requisition.StatusChoices.QUOTATIONS_RECEIVED:
                stage_key = 'QUOTATION_REVIEW'
                workflow_stage_display = 'Quotation Review (Quotes Received)'
                action_required = True
                action_label = 'Review & Award'
            elif status_code == Requisition.StatusChoices.COMPLETED:
                stage_key = 'COMPLETED'
                workflow_stage_display = 'Completed / Closed'
                action_required = False
                action_label = 'View Summary'
            elif status_code == Requisition.StatusChoices.RETURNED:
                stage_key = 'RETURNED'
                workflow_stage_display = 'Returned for Clarification'
                action_required = False
                action_label = 'Inspect Return'
            elif status_code in [Requisition.StatusChoices.CANCELLED, Requisition.StatusChoices.REJECTED]:
                stage_key = 'CANCELLED'
                workflow_stage_display = 'Cancelled / Rejected'
                action_required = False
                action_label = 'View Record'

            # Linked RFQ data if present
            latest_rfq = req.quotation_requests.order_by('-created_at').first()
            linked_rfq = None
            if latest_rfq:
                linked_rfq = {
                    'id': latest_rfq.id,
                    'rfq_number': latest_rfq.rfq_number,
                    'title': latest_rfq.title,
                    'status': latest_rfq.status,
                    'status_display': latest_rfq.get_status_display(),
                    'due_date': latest_rfq.due_date.isoformat() if latest_rfq.due_date else None,
                    'invited_vendors_count': latest_rfq.vendor_invitations.count(),
                    'quotations_count': latest_rfq.quotations.count(),
                }

            return {
                'id': req.id,
                'req_number': req.req_number,
                'title': req.title,
                'department_name': req.department.name if req.department else 'N/A',
                'department_code': req.department.code if req.department else '',
                'category': req.category or (items_list[0].category if items_list and items_list[0].category else 'General Supplies'),
                'item_name': item_names,
                'quantity': total_qty,
                'estimated_budget': str(req.estimated_budget) if req.estimated_budget is not None else '0.00',
                'required_date': earliest_required_date,
                'priority': req.priority,
                'status': req.status,
                'status_display': req.get_status_display(),
                'stage_key': stage_key,
                'workflow_stage_display': workflow_stage_display,
                'action_required': action_required,
                'action_label': action_label,
                'is_active': status_code not in [Requisition.StatusChoices.COMPLETED, Requisition.StatusChoices.CANCELLED, Requisition.StatusChoices.REJECTED],
                'linked_rfq': linked_rfq,
                'submission_date': req.created_at.isoformat() if req.created_at else None,
                'submitted_by_name': (req.requested_by.get_full_name() or req.requested_by.username) if req.requested_by else 'N/A',
                'submitted_by_employee_id': req.requested_by.employee_id if req.requested_by else None,
                'justification': req.justification or '',
                'supporting_document_url': supporting_doc_url,
                'technical_document_url': tech_doc_url,
                'requires_technical_evaluation': req.requires_technical_evaluation,
                'technical_evaluation_route': tech_eval_route,
                'technical_evaluation_result': tech_eval_result,
                'technical_compliance': tech_compliance,
                'technical_evaluation_remarks': tech_remarks,
                'technical_evaluated_at': tech_eval_date,
                'technical_officer_name': to_name,
                'assigned_technical_officer_name': to_name,
                'assigned_purchase_officer_name': po_name,
                'assigned_purchase_officer_username': po_username,
                'assigned_purchase_officer_employee_id': po_employee_id,
                'assigned_committee_member_id': req.assigned_committee_member_id,
                'assigned_committee_member_name': req.assigned_committee_member.get_full_name() or req.assigned_committee_member.username if req.assigned_committee_member else None,
                'assigned_committee_member_employee_id': req.assigned_committee_member.employee_id if req.assigned_committee_member else None,
                'committee_assigned_at': req.committee_assigned_at.isoformat() if req.committee_assigned_at else None,
                'reviewed_by_name': reviewer_name,
                'reviewed_at': req.reviewed_at.isoformat() if req.reviewed_at else None,
                'review_comments': req.review_comments or '',
                'clarification_comments': latest_return.comments if latest_return else None,
                'clarification_returned_at': latest_return.created_at.isoformat() if latest_return else None,
                'items': [
                    {
                        'id': it.id,
                        'item_name': it.item_name,
                        'category': it.category or req.category or 'N/A',
                        'quantity': it.quantity,
                        'specifications': it.specifications or 'Standard hospital specification',
                        'estimated_unit_price': str(it.estimated_unit_price),
                        'total_price': str(it.total_price),
                        'required_date': it.required_date.isoformat() if it.required_date else None,
                    } for it in items_list
                ],
                'approvals': [
                    {
                        'id': app.id,
                        'stage': app.stage,
                        'status': app.status,
                        'comments': app.comments,
                        'approved_by': app.approved_by.get_full_name() or app.approved_by.username if app.approved_by else 'N/A',
                        'created_at': app.created_at.isoformat() if app.created_at else None,
                    } for app in req.approvals.all()
                ]
            }

        # 4. Serialized Requisitions for all Committee Sections
        assigned_requests = [serialize_req_for_committee(req) for req in all_assigned_qs]
        pending_reviews = [serialize_req_for_committee(req) for req in pending_reviews_qs]
        approved_requests = [serialize_req_for_committee(req) for req in approved_requests_qs]
        returned_clarifications = [serialize_req_for_committee(req) for req in returned_clarifications_qs]

        # Review queue summary items (first 8)
        review_queue = [
            {
                'id': r['id'],
                'req_number': r['req_number'],
                'department_name': r['department_name'],
                'item_name': r['item_name'],
                'submitted_by': r['submitted_by_name'],
                'technical_evaluation_result': r['technical_evaluation_result'],
                'requires_technical_evaluation': r['requires_technical_evaluation'],
                'priority': r['priority'],
                'status': 'Pending Committee Review',
                'estimated_budget': r['estimated_budget'],
                'required_date': r['required_date'],
            } for r in pending_reviews[:8]
        ]

        # 5. Recent Notifications (latest 8)
        notifications = []
        logs = AuditLog.objects.filter(
            Q(module__in=['approval', 'requisition', 'rfq', 'quotation', 'purchase_order', 'committee', 'Procurement Committee']) |
            Q(user=user)
        ).order_by('-created_at')[:8]

        for log in logs:
            notifications.append({
                'id': log.id,
                'action': log.action,
                'module': log.module,
                'description': log.description,
                'created_at': log.created_at.isoformat(),
            })

        return Response({
            'user': user_info,
            'stats': stats,
            'pipeline': pipeline,
            'assigned_requests': assigned_requests,
            'pending_reviews': pending_reviews,
            'approved_requests': approved_requests,
            'returned_clarifications': returned_clarifications,
            'decision_history': decision_history,
            'recent_decisions': decision_history[:8],
            'review_queue': review_queue,
            'notifications': notifications,
        }, status=status.HTTP_200_OK)


class TechnicalOfficerDashboardView(APIView):
    """
    Technical Officer Dashboard API Endpoint.
    Returns authenticated Technical Officer profile info, assigned specializations,
    evaluation statistics, workflow pipeline, assigned purchase requests for technical evaluation,
    pending technical reviews, recent recommendations, and notifications.
    """
    permission_classes = [IsAuthenticated, IsTechnicalOfficer]

    def get(self, request):
        user = request.user
        specializations = user.technical_specializations if isinstance(user.technical_specializations, list) else []

        user_info = {
            'id': user.id,
            'employee_id': user.employee_id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'full_name': user.get_full_name() or user.username,
            'role': user.role.name if user.role else 'Technical Officer',
            'department_id': user.department.id if user.department else None,
            'department_name': user.department.name if user.department else 'Biomedical & Technical Evaluation Unit',
            'phone': user.phone,
            'gender': user.gender,
            'date_of_birth': user.date_of_birth,
            'date_of_joining': user.date_of_joining,
            'technical_specializations': specializations,
        }

        # 1. Technical Evaluation Statistics for this specific Technical Officer
        # Only purchase requests that have been reviewed/proceeded by a Purchase Officer
        # and assigned to THIS Technical Officer (Requirement 2 & 3)
        assigned_qs = Requisition.objects.filter(
            status=Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
            assigned_technical_officer=user
        ).select_related(
            'department', 'requested_by', 'assigned_purchase_officer', 'assigned_technical_officer'
        ).prefetch_related('items', 'approvals')

        assigned_evaluations_count = assigned_qs.count()
        pending_reviews_count = assigned_evaluations_count
        in_progress_evaluations_count = 0

        user_evals = TechnicalEvaluation.objects.filter(evaluated_by=user)

        # Collect latest technical evaluation per requisition for this Technical Officer
        # to ensure each requisition reflects its current evaluation status and cannot
        # simultaneously appear in conflicting dashboard sections.
        all_evals = user_evals.select_related(
            'requisition', 'requisition__department'
        ).order_by('-created_at')

        latest_evals_by_req = {}
        history_by_req = {}
        for te in all_evals:
            req = te.requisition
            if not req:
                continue
            req_id = req.id
            if req_id not in latest_evals_by_req:
                latest_evals_by_req[req_id] = te
                history_by_req[req_id] = []
            else:
                history_by_req[req_id].append({
                    'id': te.id,
                    'evaluation_ref': f"TE-{req.req_number}" if req else f"TE-{te.id}",
                    'compliance': te.compliance,
                    'recommendation': te.recommendation,
                    'remarks': te.remarks,
                    'evaluation_date': te.created_at.isoformat(),
                    'created_at': te.created_at.isoformat(),
                })

        completed_evaluations_count = len(latest_evals_by_req)
        compliance_approved_count = sum(
            1 for te in latest_evals_by_req.values()
            if te.recommendation == TechnicalEvaluation.RecommendationChoices.SUITABLE
        )
        compliance_rejected_count = sum(
            1 for te in latest_evals_by_req.values()
            if te.recommendation == TechnicalEvaluation.RecommendationChoices.NOT_SUITABLE
        )

        # 2. Workflow Pipeline Stages
        pipeline = {
            'purchase_requisition': Requisition.objects.filter(status__in=[Requisition.StatusChoices.SUBMITTED, Requisition.StatusChoices.PENDING_APPROVAL]).count(),
            'quotation_collection': QuotationRequest.objects.filter(status='OPEN').count(),
            'technical_evaluation': Requisition.objects.filter(status=Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION).count(),
            'procurement_committee': Requisition.objects.filter(status=Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW).count(),
            'purchase_order': PurchaseOrder.objects.filter(status='ISSUED').count(),
        }

        # 3. Assigned Technical Evaluations queue (Requirements 2 & 3)
        # Each Technical Officer sees ONLY purchase requests assigned to them
        assigned_evaluations = []
        for r in assigned_qs.order_by('-technical_assigned_at', '-created_at'):
            items_data = [
                {
                    'id': it.id,
                    'item_name': it.item_name,
                    'category': it.category or r.category or 'N/A',
                    'quantity': it.quantity,
                    'specifications': it.specifications or '',
                    'estimated_unit_price': str(it.estimated_unit_price),
                    'total_price': str(it.total_price),
                    'required_date': it.required_date.isoformat() if it.required_date else None,
                }
                for it in r.items.all()
            ]

            first_req_date = None
            for it in r.items.all():
                if it.required_date:
                    first_req_date = it.required_date.isoformat()
                    break

            primary_item_name = r.items.first().item_name if r.items.exists() else r.title
            total_qty = sum(it.quantity for it in r.items.all()) if r.items.exists() else 1
            calculated_amount = str(r.estimated_budget) if r.estimated_budget is not None else str(sum(it.total_price for it in r.items.all()))

            doc_url = None
            actual_doc_url = None
            api_doc_url = None
            if r.supporting_document:
                try:
                    actual_doc_url = request.build_absolute_uri(r.supporting_document.url)
                except Exception:
                    actual_doc_url = None
                api_doc_url = request.build_absolute_uri(f"/api/procurement/requisitions/{r.id}/document/")
                doc_url = actual_doc_url or api_doc_url

            spec_category = r.technical_specialization or (specializations[0] if specializations else 'Biomedical Equipment')

            assigned_evaluations.append({
                'id': r.id,
                'evaluation_ref': f"TE-{r.req_number}",
                'procurement_ref': r.req_number,
                'req_number': r.req_number,
                'title': r.title,
                'department_id': r.department.id if r.department else None,
                'department_name': r.department.name if r.department else 'N/A',
                'category': r.category or 'N/A',
                'primary_item': primary_item_name,
                'total_quantity': total_qty,
                'estimated_price': calculated_amount,
                'total_amount': calculated_amount,
                'required_date': first_req_date,
                'assigned_date': r.technical_assigned_at.isoformat() if r.technical_assigned_at else r.created_at.isoformat(),
                'specialization_category': spec_category,
                'status': 'Pending Review',
                'raw_status': r.status,
                'status_display': r.get_status_display(),
                'priority': r.priority,
                'justification': r.justification or '',
                'supporting_document': actual_doc_url,
                'actual_document_url': actual_doc_url,
                'supporting_document_url': doc_url,
                'api_document_url': api_doc_url,
                'items': items_data,
                'assigned_purchase_officer_name': r.assigned_purchase_officer.get_full_name() if r.assigned_purchase_officer else None,
                'assigned_purchase_officer_employee_id': r.assigned_purchase_officer.employee_id if r.assigned_purchase_officer else None,
                'review_comments': r.review_comments or '',
                'clarification_reason': r.review_comments or '',
                'technical_evaluation_remarks': r.technical_evaluation_remarks or '',
                'technical_recommendation': r.technical_recommendation or '',
                'is_resubmitted_clarification': r.is_returned_for_technical_clarification() or (r.technical_recommendation in ['Requires Clarification', 'Return for Clarification']),
            })

        # 4. Pending Technical Reviews widget
        pending_reviews = []
        for item in assigned_evaluations[:8]:
            pending_reviews.append({
                'id': item['id'],
                'ref_number': item['evaluation_ref'],
                'procurement_requirement': item['title'],
                'department_name': item['department_name'],
                'evaluation_due_date': item['required_date'] or item['assigned_date'],
                'priority': item['priority'],
                'status': item['status'],
                'estimated_budget': item['estimated_price'],
            })

        # 5. Recent Technical Recommendations widget
        # Presents the latest evaluation outcome per requisition, with historical clarification cycles attached
        recent_recommendations = []
        for te in list(latest_evals_by_req.values())[:8]:
            req = te.requisition
            actual_doc_url = None
            api_doc_url = None
            if req and req.supporting_document:
                try:
                    actual_doc_url = request.build_absolute_uri(req.supporting_document.url)
                except Exception:
                    actual_doc_url = None
                api_doc_url = request.build_absolute_uri(f"/api/procurement/requisitions/{req.id}/document/")

            te_doc_url = None
            if te.supporting_document:
                try:
                    te_doc_url = request.build_absolute_uri(te.supporting_document.url)
                except Exception:
                    te_doc_url = None

            effective_doc_url = actual_doc_url or te_doc_url or api_doc_url

            recent_recommendations.append({
                'id': te.id,
                'requisition_id': req.id if req else None,
                'evaluation_ref': f"TE-{req.req_number}" if req else f"TE-{te.id}",
                'procurement_ref': req.req_number if req else 'N/A',
                'req_number': req.req_number if req else 'N/A',
                'title': req.title if req else 'Evaluation',
                'vendor_name': req.title if req else 'Evaluation',
                'department_name': req.department.name if req and req.department else 'N/A',
                'category': req.category if req else 'N/A',
                'evaluation_date': te.created_at.isoformat(),
                'compliance': te.compliance,
                'recommendation': te.recommendation,
                'status': 'Completed',
                'current_requisition_status': req.status if req else 'Completed',
                'current_technical_recommendation': req.technical_recommendation or te.recommendation,
                'remarks': te.remarks,
                'clarification_history': history_by_req.get(req.id, []) if req else [],
                'supporting_document': effective_doc_url,
                'actual_document_url': actual_doc_url,
                'supporting_document_url': effective_doc_url,
                'api_document_url': api_doc_url,
            })

        # 6. Notifications
        notifications = []
        logs = AuditLog.objects.filter(
            Q(user=user) | Q(module='Purchase Requisition', action__icontains='Technical')
        ).order_by('-created_at')[:8]

        for log in logs:
            notifications.append({
                'id': log.id,
                'action': log.action,
                'module': log.module,
                'description': log.description,
                'created_at': log.created_at.isoformat(),
            })

        return Response({
            'user': user_info,
            'stats': {
                'assigned_evaluations': assigned_evaluations_count,
                'pending_reviews': pending_reviews_count,
                'in_progress_evaluations': in_progress_evaluations_count,
                'completed_evaluations': completed_evaluations_count,
                'compliance_approved': compliance_approved_count,
                'compliance_rejected': compliance_rejected_count,
            },
            'pipeline': pipeline,
            'specializations': specializations,
            'assigned_evaluations': assigned_evaluations,
            'pending_reviews': pending_reviews,
            'recent_recommendations': recent_recommendations,
            'notifications': notifications,
        }, status=status.HTTP_200_OK)
