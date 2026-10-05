from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from accounts.models import AuditLog
from accounts.permissions import IsDepartmentStaff, IsPurchaseOfficer, IsCommitteeMember, IsTechnicalOfficer
from inventory.models import Delivery
from .models import (
    Requisition, Approval, QuotationRequest, Quotation, QuotationItem, PurchaseOrder, PurchaseOrderItem
)
from .serializers import (
    RequisitionSerializer, ApprovalSerializer, QuotationRequestSerializer,
    QuotationSerializer, QuotationItemSerializer, PurchaseOrderSerializer, PurchaseOrderItemSerializer
)
from .permissions import IsRequisitionOwnerOrOfficer, IsCommitteeOrAdmin, IsPurchaseOfficerOrAdmin
from .filters import RequisitionFilter, QuotationRequestFilter, QuotationFilter, PurchaseOrderFilter
from .constants import DEPARTMENT_CATEGORY_MAP, get_allowed_categories_for_department


class RequisitionViewSet(viewsets.ModelViewSet):
    queryset = Requisition.objects.select_related('department', 'requested_by').prefetch_related('approvals', 'items').all()
    serializer_class = RequisitionSerializer
    permission_classes = [IsAuthenticated, IsRequisitionOwnerOrOfficer]
    filterset_class = RequisitionFilter
    search_fields = ['req_number', 'title', 'justification']
    ordering_fields = ['id', 'created_at', 'priority', 'status']

    def get_permissions(self):
        if self.action == 'review':
            return [IsAuthenticated(), IsPurchaseOfficerOrAdmin()]
        elif self.action == 'approve':
            return [IsAuthenticated(), IsCommitteeOrAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Requisition.objects.none()

        r_name = user.role.name.lower() if user.role else ''
        is_staff_role = 'staff' in r_name or 'department' in r_name
        is_privileged = (
            user.is_superuser or user.is_staff or
            any(role in r_name for role in ['admin', 'purchase', 'committee', 'technical'])
        )

        qs = Requisition.objects.select_related('department', 'requested_by').prefetch_related('approvals', 'items')

        if (is_staff_role and not is_privileged) or not is_privileged:
            return qs.filter(requested_by=user)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        r_name = user.role.name.lower() if user.role else ''
        is_staff_role = 'staff' in r_name or 'department' in r_name

        # Department Staff must automatically and strictly use their assigned department
        if is_staff_role or user.department:
            if not user.department:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'department': 'Department Staff must have an assigned department to create a purchase requisition.'})
            serializer.save(requested_by=user, department=user.department)
        else:
            serializer.save(requested_by=user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_staff_role = 'staff' in r_name or 'department' in r_name
        is_po = any(x in r_name for x in ['purchase', 'officer']) and ('staff' not in r_name)

        # Purchase Officers cannot directly edit submitted requisition details
        if is_po and not (user.is_superuser or user.is_staff):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Purchase Officers cannot directly edit submitted requisitions. Requisitions are strictly read-only during review.')

        # Once submitted, Department Staff cannot edit submitted data unless returned for correction
        if is_staff_role and instance.status not in [Requisition.StatusChoices.DRAFT, Requisition.StatusChoices.RETURNED]:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'Submitted requisitions cannot be edited unless returned for correction.'})

        prev_status = instance.status
        response = super().update(request, *args, **kwargs)
        new_status = request.data.get('status')
        if prev_status == Requisition.StatusChoices.RETURNED and new_status == Requisition.StatusChoices.SUBMITTED:
            instance.submitted_at = timezone.now()
            instance.save(update_fields=['submitted_at'])
            AuditLog.objects.create(
                user=request.user,
                action='Requisition Resubmitted',
                module='Purchase Requisition',
                description=f"Department staff @{request.user.username} corrected and resubmitted requisition {instance.req_number} ('{instance.title}')."
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

        # Once submitted, Department Staff cannot edit submitted data unless returned for correction
        if is_staff_role and instance.status not in [Requisition.StatusChoices.DRAFT, Requisition.StatusChoices.RETURNED]:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'Submitted requisitions cannot be edited unless returned for correction.'})

        prev_status = instance.status
        response = super().partial_update(request, *args, **kwargs)
        new_status = request.data.get('status')
        if prev_status == Requisition.StatusChoices.RETURNED and new_status == Requisition.StatusChoices.SUBMITTED:
            instance.submitted_at = timezone.now()
            instance.save(update_fields=['submitted_at'])
            AuditLog.objects.create(
                user=request.user,
                action='Requisition Resubmitted',
                module='Purchase Requisition',
                description=f"Department staff @{request.user.username} corrected and resubmitted requisition {instance.req_number} ('{instance.title}')."
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
        requisition.status = Requisition.StatusChoices.SUBMITTED
        requisition.submitted_at = timezone.now()
        # Ensure technical evaluation decision is fresh for Purchase Officer review
        requisition.requires_technical_evaluation = False
        requisition.technical_specialization = None
        requisition.save()

        # Record submission / resubmission in AuditLog
        action_name = 'Requisition Resubmitted' if previous_status == Requisition.StatusChoices.RETURNED else 'Requisition Submitted'
        AuditLog.objects.create(
            user=request.user,
            action=action_name,
            module='Purchase Requisition',
            description=f"Department staff @{request.user.username} submitted requisition {requisition.req_number} ('{requisition.title}') with {requisition.items.count()} items (Est. budget: ₹{requisition.estimated_budget or 0})."
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

        reviewer_name = user.get_full_name() or user.username

        with transaction.atomic():
            if action_type in ['APPROVE', 'PROCEED']:
                if requires_tech:
                    # PROCEED WITH TECHNICAL EVALUATION:
                    # Set status to PENDING_TECHNICAL_EVALUATION, requires_technical_evaluation=True,
                    # set appropriate technical_specialization, and route to Technical Officer.
                    spec = request.data.get('technical_specialization')
                    if not spec or not str(spec).strip():
                        advisory = requisition.get_technical_evaluation_advisory()
                        spec = advisory.get('suggested_specialization') or 'Biomedical Equipment'

                    requisition.requires_technical_evaluation = True
                    requisition.technical_specialization = spec
                    requisition.status = Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION
                    next_stage = f"Technical Officer Evaluation ({spec})"

                    Approval.objects.create(
                        requisition=requisition,
                        approved_by=user,
                        stage='Purchase Officer Review',
                        status=Approval.StatusChoices.APPROVED,
                        comments=reason or f"Purchase Officer proceeded requisition for Technical Officer Evaluation ({spec})."
                    )
                    AuditLog.objects.create(
                        user=user,
                        action='Purchase Officer proceeded requisition for Technical Officer Evaluation',
                        module='Purchase Requisition',
                        description=f"Purchase Officer @{user.username} ({reviewer_name}) proceeded requisition {requisition.req_number} ('{requisition.title}') for Technical Officer Evaluation ({spec}). Remarks: {reason or 'Proceeded for Technical Officer Evaluation.'}"
                    )
                    action_result = 'Requisition Proceeded for Technical Officer Evaluation'

                else:
                    # PROCEED WITHOUT TECHNICAL EVALUATION:
                    # Set status to PENDING_COMMITTEE_REVIEW, requires_technical_evaluation=False,
                    # technical_specialization=None, and route directly to Procurement Committee.
                    requisition.requires_technical_evaluation = False
                    requisition.technical_specialization = None
                    requisition.status = Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW
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

    @action(detail=True, methods=['get'], url_path='document', permission_classes=[IsAuthenticated])
    def document(self, request, pk=None):
        try:
            requisition = Requisition.objects.get(pk=pk)
        except Requisition.DoesNotExist:
            from django.http import Http404
            raise Http404("Requisition not found.")

        user = request.user
        r_name = user.role.name.lower() if user.role else ''
        is_privileged = (
            user.is_superuser or user.is_staff or
            any(role in r_name for role in ['admin', 'purchase', 'committee', 'technical'])
        )

        if not is_privileged and requisition.requested_by != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to access this supporting document.")

        if not requisition.supporting_document or not requisition.supporting_document.storage.exists(requisition.supporting_document.name):
            from django.http import Http404
            raise Http404("Supporting document not found on storage.")

        from django.http import FileResponse
        import os
        filename = os.path.basename(requisition.supporting_document.name)
        return FileResponse(
            requisition.supporting_document.open('rb'),
            content_type='application/pdf',
            as_attachment=False,
            filename=filename
        )

    @action(detail=True, methods=['post'], permission_classes=[IsCommitteeOrAdmin])
    def approve(self, request, pk=None):
        requisition = self.get_object()
        comments = request.data.get('comments', '')
        stage = request.data.get('stage', 'Committee Approval')
        
        with transaction.atomic():
            Approval.objects.create(
                requisition=requisition,
                approved_by=request.user,
                stage=stage,
                status=Approval.StatusChoices.APPROVED,
                comments=comments
            )
            requisition.status = Requisition.StatusChoices.APPROVED
            requisition.save()
        return Response({'status': 'Requisition Approved Successfully'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsCommitteeOrAdmin])
    def reject(self, request, pk=None):
        requisition = self.get_object()
        comments = request.data.get('comments', '')
        stage = request.data.get('stage', 'Committee Rejection')

        with transaction.atomic():
            Approval.objects.create(
                requisition=requisition,
                approved_by=request.user,
                stage=stage,
                status=Approval.StatusChoices.REJECTED,
                comments=comments
            )
            requisition.status = Requisition.StatusChoices.REJECTED
            requisition.save()
        return Response({'status': 'Requisition Rejected'}, status=status.HTTP_200_OK)


class QuotationRequestViewSet(viewsets.ModelViewSet):
    queryset = QuotationRequest.objects.select_related('requisition', 'created_by').prefetch_related('quotations').all()
    serializer_class = QuotationRequestSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = QuotationRequestFilter
    search_fields = ['rfq_number', 'title', 'terms_and_conditions']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class QuotationViewSet(viewsets.ModelViewSet):
    queryset = Quotation.objects.select_related('quotation_request', 'vendor').prefetch_related('items').all()
    serializer_class = QuotationSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = QuotationFilter
    search_fields = ['quotation_number', 'remarks']

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
            return Response(QuotationSerializer(quotation).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.select_related('quotation', 'vendor', 'created_by').prefetch_related('items').all()
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = PurchaseOrderFilter
    search_fields = ['po_number', 'terms_and_conditions']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


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
        user_reqs = Requisition.objects.filter(requested_by=user).select_related('department', 'requested_by')

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
        approved_requests = user_reqs.filter(status__in=['APPROVED', 'RFQ_ISSUED']).count()
        completed_requests = user_reqs.filter(status='COMPLETED').count()

        # Recent purchase requests (latest 10)
        recent_reqs_data = []
        for req in user_reqs.order_by('-created_at')[:10]:
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
            })

        # Notifications / audit events
        notifications = []
        user_dept_name = user.department.name if user.department else ''
        q_filter = Q(user=user) | Q(description__icontains=user.username)
        if user_dept_name:
            q_filter |= (Q(module__icontains='requisition') & Q(description__icontains=user_dept_name))

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
            'procurement': user_reqs.filter(status='RFQ_ISSUED').count(),
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
    """
    permission_classes = [IsAuthenticated, IsPurchaseOfficer]

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
            'role': user.role.name if user.role else 'Purchase Officer',
            'department_id': user.department.id if user.department else None,
            'department_name': user.department.name if user.department else 'Procurement Department',
            'phone': user.phone,
            'gender': user.gender,
            'date_of_birth': user.date_of_birth,
            'date_of_joining': user.date_of_joining,
        }

        # 1. Procurement Summary Cards (8 metrics)
        pending_requisitions_count = Requisition.objects.filter(status=Requisition.StatusChoices.SUBMITTED).count()
        requisitions_under_processing_count = Requisition.objects.filter(
            status__in=[
                Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
                Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
                'UNDER_REVIEW', 'RFQ_ISSUED', 'PENDING_APPROVAL'
            ]
        ).count()
        quotation_requests_count = QuotationRequest.objects.filter(status='OPEN').count()
        quotations_received_count = Quotation.objects.filter(status__in=['SUBMITTED', 'UNDER_REVIEW']).count()
        pending_committee_review_count = Approval.objects.filter(status='PENDING', stage__icontains='Committee').count()
        if pending_committee_review_count == 0:
            pending_committee_review_count = Requisition.objects.filter(
                status__in=['UNDER_REVIEW', Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW]
            ).count()
        approved_pos_count = PurchaseOrder.objects.filter(status__in=['ISSUED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INSPECTED', 'CLOSED']).count()
        pending_deliveries_count = Delivery.objects.filter(status__in=['DISPATCHED', 'IN_TRANSIT']).count()
        if pending_deliveries_count == 0:
            pending_deliveries_count = PurchaseOrder.objects.filter(status__in=['ISSUED', 'PARTIALLY_DELIVERED']).count()
        completed_procurement_count = PurchaseOrder.objects.filter(status='CLOSED').count() + Requisition.objects.filter(status='COMPLETED').count()

        # 2. Pipeline Overview (8 stages)
        tech_eval_count = Quotation.objects.filter(
            status='UNDER_REVIEW',
            quotation_request__requisition__requires_technical_evaluation=True
        ).count()
        if tech_eval_count == 0:
            tech_eval_count = Requisition.objects.filter(
                status__in=['UNDER_REVIEW', Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION],
                requires_technical_evaluation=True
            ).count()

        pipeline = {
            'requisition_received': Requisition.objects.filter(
                status__in=[
                    Requisition.StatusChoices.SUBMITTED,
                    Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
                    Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW,
                    'PENDING_APPROVAL', 'DRAFT'
                ]
            ).count(),
            'under_procurement': Requisition.objects.filter(status='UNDER_REVIEW').count(),
            'quotations': QuotationRequest.objects.filter(status='OPEN').count(),
            'technical_evaluation': tech_eval_count,
            'committee_review': pending_committee_review_count,
            'purchase_order': PurchaseOrder.objects.filter(status='ISSUED').count(),
            'delivery': pending_deliveries_count,
            'completed': completed_procurement_count,
        }

        # 3. Pending Purchase Requisitions (submitted requisitions requiring PO review)
        pending_reqs_qs = Requisition.objects.filter(
            status=Requisition.StatusChoices.SUBMITTED
        ).select_related('department', 'requested_by', 'reviewed_by').prefetch_related('items').order_by('-submitted_at', '-created_at')[:10]
        
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
                'requested_by_name': req.requested_by.get_full_name() or req.requested_by.username if req.requested_by else 'N/A',
                'requested_by_email': req.requested_by.email if req.requested_by else '',
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
        quotations_qs = Quotation.objects.select_related(
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
            stage__icontains='Committee'
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
            under_review_reqs = Requisition.objects.filter(
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
        pos_qs = PurchaseOrder.objects.select_related(
            'quotation', 'vendor', 'created_by'
        ).order_by('-order_date')[:10]
        
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
                'terms_and_conditions': po.terms_and_conditions,
            })

        # 7. Active Deliveries (latest 10)
        deliveries_qs = Delivery.objects.select_related(
            'purchase_order', 'vendor'
        ).order_by('-created_at')[:10]
        
        active_deliveries = []
        for deliv in deliveries_qs:
            active_deliveries.append({
                'id': deliv.id,
                'delivery_number': deliv.delivery_number,
                'po_number': deliv.purchase_order.po_number if deliv.purchase_order else 'N/A',
                'vendor_name': deliv.vendor.company_name if deliv.vendor else 'N/A',
                'delivery_date': deliv.delivery_date.isoformat() if deliv.delivery_date else None,
                'status': deliv.status,
                'tracking_number': deliv.tracking_number,
            })

        # 8. Notifications (latest 8)
        notifications = []
        logs = AuditLog.objects.filter(
            Q(module__in=['requisition', 'quotation', 'purchase_order', 'delivery', 'rfq', 'vendor', 'approval']) |
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
            'stats': {
                'pending_requisitions': pending_requisitions_count,
                'requisitions_under_processing': requisitions_under_processing_count,
                'quotation_requests': quotation_requests_count,
                'quotations_received': quotations_received_count,
                'pending_committee_review': pending_committee_review_count,
                'approved_purchase_orders': approved_pos_count,
                'pending_deliveries': pending_deliveries_count,
                'completed_procurement': completed_procurement_count,
            },
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

        # 1. Statistics (6 decision-related metrics)
        under_review_reqs = Requisition.objects.filter(
            status__in=['UNDER_REVIEW', Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW]
        ).count()
        pending_committee_reviews_count = Approval.objects.filter(stage__icontains='Committee', status='PENDING').count()
        if pending_committee_reviews_count == 0:
            pending_committee_reviews_count = under_review_reqs

        under_review_count = under_review_reqs
        approved_cases_count = Approval.objects.filter(stage__icontains='Committee', status='APPROVED').count()
        if approved_cases_count == 0:
            approved_cases_count = Requisition.objects.filter(status__in=['APPROVED', 'RFQ_ISSUED', 'COMPLETED']).count()

        rejected_cases_count = Approval.objects.filter(stage__icontains='Committee', status='REJECTED').count()
        if rejected_cases_count == 0:
            rejected_cases_count = Requisition.objects.filter(status='REJECTED').count()

        clarification_requested_count = Approval.objects.filter(stage__icontains='Committee', status='CLARIFICATION_REQUESTED').count()
        completed_decisions_count = approved_cases_count + rejected_cases_count

        # 2. Workflow Pipeline Stages
        committee_tech_eval_count = Quotation.objects.filter(
            status='UNDER_REVIEW',
            quotation_request__requisition__requires_technical_evaluation=True
        ).count()
        if committee_tech_eval_count == 0:
            committee_tech_eval_count = Requisition.objects.filter(
                status='UNDER_REVIEW',
                requires_technical_evaluation=True
            ).count()

        pipeline = {
            'department_staff': Requisition.objects.filter(status__in=['DRAFT', 'PENDING_APPROVAL']).count(),
            'purchase_officer': QuotationRequest.objects.filter(status='OPEN').count(),
            'technical_evaluation': committee_tech_eval_count,
            'procurement_committee': pending_committee_reviews_count,
            'purchase_order': PurchaseOrder.objects.filter(status='ISSUED').count(),
            'vendor_delivery': Delivery.objects.filter(status__in=['DISPATCHED', 'IN_TRANSIT']).count(),
        }

        # 3. Pending Procurement Reviews (Main Table - latest 10)
        pending_reviews_qs = Requisition.objects.filter(
            status__in=['UNDER_REVIEW', 'PENDING_APPROVAL', Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW]
        ).select_related('department', 'requested_by').order_by('-created_at')[:10]

        pending_reviews = []
        review_queue = []
        for req in pending_reviews_qs:
            # Check if technical evaluation is required based on item complexity
            if not req.requires_technical_evaluation:
                tech_eval_status = 'Not Required'
                tech_eval_result = 'Not Required'
            else:
                tech_eval_status = 'Pending Evaluation'
                tech_eval_result = 'Pending Technical Review'
                if req.quotation_requests.exists():
                    first_rfq = req.quotation_requests.first()
                    if first_rfq.quotations.filter(status='APPROVED').exists():
                        tech_eval_status = 'Technically Compliant'
                        tech_eval_result = 'Recommended for Approval'
                    elif first_rfq.quotations.filter(status='UNDER_REVIEW').exists():
                        tech_eval_status = 'Under Evaluation'
                        tech_eval_result = 'Under Evaluation'
                    elif first_rfq.quotations.exists():
                        tech_eval_status = 'Bids Received'
                        tech_eval_result = 'Bids Received'

            pending_reviews.append({
                'id': req.id,
                'req_number': req.req_number,
                'title': req.title,
                'department_name': req.department.name if req.department else 'N/A',
                'category': req.category or (req.department.name if req.department else 'General Supplies'),
                'submitted_by_name': req.requested_by.get_full_name() or req.requested_by.username if req.requested_by else 'N/A',
                'submission_date': req.created_at.isoformat(),
                'priority': req.priority,
                'estimated_budget': str(req.estimated_budget) if req.estimated_budget is not None else None,
                'technical_evaluation_status': tech_eval_status,
                'current_status': 'Awaiting Committee Review' if req.status in ['UNDER_REVIEW', Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW] else 'Requisition Submitted',
                'justification': req.justification,
            })

            # Add to review queue (up to 8 items)
            if len(review_queue) < 8:
                review_queue.append({
                    'id': req.id,
                    'req_number': req.req_number,
                    'department_name': req.department.name if req.department else 'N/A',
                    'submitted_by': req.requested_by.get_full_name() or req.requested_by.username if req.requested_by else 'N/A',
                    'technical_evaluation_result': tech_eval_result,
                    'priority': req.priority,
                    'status': 'Pending Committee Review' if req.status in ['UNDER_REVIEW', Requisition.StatusChoices.PENDING_COMMITTEE_REVIEW] else 'Pending Procurement Review',
                    'estimated_budget': str(req.estimated_budget) if req.estimated_budget is not None else None,
                })

        # 5. Recent Committee Decisions (latest 8)
        recent_decisions = []
        approvals_qs = Approval.objects.filter(
            stage__icontains='Committee'
        ).select_related('requisition', 'approved_by', 'requisition__department').order_by('-created_at')[:8]

        for app in approvals_qs:
            recent_decisions.append({
                'id': app.id,
                'req_number': app.requisition.req_number if app.requisition else 'N/A',
                'title': app.requisition.title if app.requisition else 'N/A',
                'department_name': app.requisition.department.name if app.requisition and app.requisition.department else 'N/A',
                'decision_date': app.created_at.isoformat() if app.created_at else None,
                'decision': app.status,
                'status': app.status,
                'decision_by': app.approved_by.get_full_name() or app.approved_by.username if app.approved_by else 'N/A',
                'comments': app.comments or 'Formal review decision executed.',
            })

        # If no explicit Approval objects yet, check approved/rejected Requisitions
        if not recent_decisions:
            decided_reqs = Requisition.objects.filter(
                status__in=['APPROVED', 'REJECTED']
            ).select_related('department', 'requested_by').order_by('-updated_at')[:8]
            for r in decided_reqs:
                recent_decisions.append({
                    'id': r.id,
                    'req_number': r.req_number,
                    'title': r.title,
                    'department_name': r.department.name if r.department else 'N/A',
                    'decision_date': r.updated_at.isoformat(),
                    'decision': 'Approved' if r.status == 'APPROVED' else 'Rejected',
                    'status': 'Approved' if r.status == 'APPROVED' else 'Rejected',
                    'decision_by': 'Procurement Committee',
                    'comments': r.justification or 'Committee review finalized.',
                })

        # 6. Recent Notifications (latest 8)
        notifications = []
        logs = AuditLog.objects.filter(
            Q(module__in=['approval', 'requisition', 'rfq', 'quotation', 'purchase_order', 'committee']) |
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
            'stats': {
                'pending_committee_reviews': pending_committee_reviews_count,
                'under_review': under_review_count,
                'approved_cases': approved_cases_count,
                'rejected_cases': rejected_cases_count,
                'clarification_requested': clarification_requested_count,
                'completed_decisions': completed_decisions_count,
            },
            'pipeline': pipeline,
            'pending_reviews': pending_reviews,
            'review_queue': review_queue,
            'recent_decisions': recent_decisions,
            'notifications': notifications,
        }, status=status.HTTP_200_OK)


class TechnicalOfficerDashboardView(APIView):
    """
    Technical Officer Dashboard API Endpoint.
    Returns authenticated Technical Officer profile info, assigned specializations,
    6 technical evaluation statistics, workflow pipeline, assigned technical evaluations,
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

        # 1. Technical Evaluation Statistics (6 cards) - Only for technical procurements
        assigned_evaluations_count = Quotation.objects.filter(
            status='UNDER_REVIEW',
            quotation_request__requisition__requires_technical_evaluation=True
        ).count()
        if assigned_evaluations_count == 0:
            assigned_evaluations_count = Requisition.objects.filter(
                status='UNDER_REVIEW',
                requires_technical_evaluation=True
            ).count()

        pending_reviews_count = Quotation.objects.filter(
            status='SUBMITTED',
            quotation_request__requisition__requires_technical_evaluation=True
        ).count()
        if pending_reviews_count == 0:
            pending_reviews_count = Requisition.objects.filter(
                status__in=[
                    Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
                    Requisition.StatusChoices.PENDING_APPROVAL
                ],
                requires_technical_evaluation=True
            ).count()

        in_progress_evaluations_count = assigned_evaluations_count
        compliance_approved_count = Quotation.objects.filter(
            status='APPROVED',
            quotation_request__requisition__requires_technical_evaluation=True
        ).count()
        compliance_rejected_count = Quotation.objects.filter(
            status='REJECTED',
            quotation_request__requisition__requires_technical_evaluation=True
        ).count()
        completed_evaluations_count = compliance_approved_count + compliance_rejected_count

        # 2. Workflow Pipeline Stages
        pipeline = {
            'purchase_requisition': Requisition.objects.filter(status__in=['DRAFT', 'PENDING_APPROVAL']).count(),
            'quotation_collection': QuotationRequest.objects.filter(status='OPEN').count(),
            'technical_evaluation': assigned_evaluations_count,
            'procurement_committee': Approval.objects.filter(stage__icontains='Committee', status='PENDING').count(),
            'purchase_order': PurchaseOrder.objects.filter(status='ISSUED').count(),
        }

        # 3. Assigned Technical Evaluations (Primary Dashboard Table - latest 10)
        # Pull from quotations in review or open requisitions that require technical expertise
        quotes_qs = Quotation.objects.filter(
            status__in=['UNDER_REVIEW', 'SUBMITTED'],
            quotation_request__requisition__requires_technical_evaluation=True
        ).select_related(
            'quotation_request', 'vendor', 'quotation_request__requisition', 'quotation_request__requisition__department'
        ).order_by('-created_at')

        # If officer has specific specializations, prioritize evaluations matching those specializations
        if specializations:
            filtered_quotes = quotes_qs.filter(
                quotation_request__requisition__technical_specialization__in=specializations
            )
            if filtered_quotes.exists():
                quotes_qs = filtered_quotes

        quotes_qs = quotes_qs[:10]

        assigned_evaluations = []
        for q in quotes_qs:
            req = q.quotation_request.requisition if q.quotation_request else None
            spec_category = req.technical_specialization if req and req.technical_specialization else (
                specializations[0] if specializations else 'Biomedical Equipment'
            )
            assigned_evaluations.append({
                'id': q.id,
                'evaluation_ref': f"TE-{q.quotation_number}",
                'procurement_ref': q.quotation_request.rfq_number if q.quotation_request else (req.req_number if req else 'N/A'),
                'department_name': req.department.name if req and req.department else 'General Medical',
                'category': req.title if req else (q.quotation_request.title if q.quotation_request else 'Medical Equipment'),
                'assigned_date': q.created_at.isoformat(),
                'specialization_category': spec_category,
                'status': 'In Progress' if q.status == 'UNDER_REVIEW' else 'Pending Review',
                'vendor_name': q.vendor.company_name if q.vendor else 'N/A',
                'total_amount': str(q.total_amount),
                'lead_time_days': q.lead_time_days,
                'justification': req.justification if req else None,
            })

        # If no explicit quotation in review yet, check Requisitions in review that require technical expertise
        if not assigned_evaluations:
            reqs_qs = Requisition.objects.filter(
                status__in=[
                    'UNDER_REVIEW',
                    Requisition.StatusChoices.PENDING_TECHNICAL_EVALUATION,
                    Requisition.StatusChoices.PENDING_APPROVAL
                ],
                requires_technical_evaluation=True
            ).select_related('department', 'requested_by').order_by('-created_at')

            if specializations:
                filtered_reqs = reqs_qs.filter(technical_specialization__in=specializations)
                if filtered_reqs.exists():
                    reqs_qs = filtered_reqs

            reqs_qs = reqs_qs[:10]
            for r in reqs_qs:
                spec_category = r.technical_specialization or (specializations[0] if specializations else 'Biomedical Equipment')
                assigned_evaluations.append({
                    'id': r.id,
                    'evaluation_ref': f"TE-{r.req_number}",
                    'procurement_ref': r.req_number,
                    'department_name': r.department.name if r.department else 'N/A',
                    'category': r.title,
                    'assigned_date': r.created_at.isoformat(),
                    'specialization_category': spec_category,
                    'status': 'In Progress' if r.status == 'UNDER_REVIEW' else 'Pending Review',
                    'vendor_name': 'Vendor Bidding Stage',
                    'total_amount': str(r.estimated_budget) if r.estimated_budget is not None else None,
                    'lead_time_days': None,
                    'justification': r.justification,
                })

        # 4. Pending Technical Reviews Widget (latest 8)
        pending_reviews = []
        for item in assigned_evaluations[:8]:
            pending_reviews.append({
                'id': item['id'],
                'ref_number': item['evaluation_ref'],
                'procurement_requirement': item['category'],
                'department_name': item['department_name'],
                'evaluation_due_date': item['assigned_date'],
                'priority': 'HIGH',
                'status': item['status'],
                'estimated_budget': item['total_amount'],
            })

        # 5. Recent Technical Recommendations (latest 8)
        recent_recommendations = []
        evaluated_quotes = Quotation.objects.filter(
            status__in=['APPROVED', 'REJECTED']
        ).select_related('quotation_request', 'vendor').order_by('-updated_at')[:8]

        for eq in evaluated_quotes:
            recommendation = 'Technically Compliant' if eq.status == 'APPROVED' else 'Technically Non-Compliant'
            recent_recommendations.append({
                'id': eq.id,
                'evaluation_ref': f"TE-{eq.quotation_number}",
                'vendor_name': eq.vendor.company_name if eq.vendor else 'N/A',
                'evaluation_date': eq.updated_at.isoformat(),
                'recommendation': recommendation,
                'status': 'Completed',
                'remarks': eq.remarks or 'Technical specifications verified against clinical compliance criteria.',
            })

        # 6. Recent Notifications (latest 8)
        notifications = []
        logs = AuditLog.objects.filter(
            Q(module__in=['technical', 'quotation', 'rfq', 'requisition', 'evaluation']) |
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



