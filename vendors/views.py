from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied, ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import models, transaction
from django.contrib.auth import get_user_model

from .models import SupplierCategory, VendorApplication, Vendor, VendorProduct
from .serializers import (
    SupplierCategorySerializer,
    VendorApplicationSerializer,
    VendorApplicationReviewSerializer,
    AssignVendorCredentialsSerializer,
    VendorSerializer,
    VendorProductSerializer
)
from .filters import VendorApplicationFilter, VendorFilter, VendorProductFilter
from .emails import send_vendor_approval_email, send_vendor_rejection_email
from accounts.models import Role
from accounts.permissions import IsAdminRole, IsVendorUser
from accounts.views import StandardResultsSetPagination

User = get_user_model()


class SupplierCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SupplierCategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None
    search_fields = ['name']
    ordering_fields = ['name']

    def get_queryset(self):
        order_cases = [
            models.When(name=name, then=models.Value(idx))
            for idx, name in enumerate(SupplierCategory.CATEGORIES)
        ]
        qs = SupplierCategory.objects.all().annotate(
            sort_order=models.Case(*order_cases, default=models.Value(999), output_field=models.IntegerField())
        ).order_by('sort_order', 'id')

        # Filter by assigned categories for the logged-in vendor if requested
        assigned_only = self.request.query_params.get('assigned_only') or self.request.query_params.get('mine')
        if assigned_only in ['true', 'True', '1', True]:
            user = self.request.user
            if not user or not user.is_authenticated:
                return SupplierCategory.objects.none()
            vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
            if not vendor:
                return SupplierCategory.objects.none()
            cat_ids = list(vendor.supplier_categories.values_list('id', flat=True))
            if not cat_ids and vendor.application:
                cat_ids = list(vendor.application.supplier_categories.values_list('id', flat=True))
            return qs.filter(id__in=cat_ids)

        vendor_id = self.request.query_params.get('vendor_id')
        if vendor_id:
            return qs.filter(vendors__id=vendor_id)

        return qs

    @action(detail=False, methods=['get'], url_path='assigned', permission_classes=[IsAuthenticated])
    def assigned(self, request):
        """
        Returns only the supplier categories assigned to the currently logged-in vendor.
        """
        user = request.user
        vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
        if not vendor:
            return Response([], status=status.HTTP_200_OK)

        cat_ids = list(vendor.supplier_categories.values_list('id', flat=True))
        if not cat_ids and vendor.application:
            cat_ids = list(vendor.application.supplier_categories.values_list('id', flat=True))

        order_cases = [
            models.When(name=name, then=models.Value(idx))
            for idx, name in enumerate(SupplierCategory.CATEGORIES)
        ]
        assigned_cats = SupplierCategory.objects.filter(id__in=cat_ids).annotate(
            sort_order=models.Case(*order_cases, default=models.Value(999), output_field=models.IntegerField())
        ).order_by('sort_order', 'id')
        serializer = self.get_serializer(assigned_cats, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)



class VendorApplicationViewSet(viewsets.ModelViewSet):
    queryset = VendorApplication.objects.select_related('reviewed_by', 'approved_vendor', 'approved_vendor__user').prefetch_related('supplier_categories').all().order_by('id')
    serializer_class = VendorApplicationSerializer
    pagination_class = StandardResultsSetPagination
    filterset_class = VendorApplicationFilter
    search_fields = ['company_name', 'contact_person', 'email', 'products_services_offered']
    ordering_fields = ['id', 'submitted_at', 'company_name']
    ordering = ['id']

    def get_permissions(self):
        if self.action in ['create']:
            return [AllowAny()]
        return [IsAdminRole()]

    @action(detail=True, methods=['post'], permission_classes=[IsAdminRole])
    def approve(self, request, pk=None):
        application = self.get_object()

        if application.status == VendorApplication.StatusChoices.APPROVED:
            return Response({'error': 'Application is already approved'}, status=status.HTTP_400_BAD_REQUEST)

        review_serializer = VendorApplicationReviewSerializer(data=request.data)
        if not review_serializer.is_valid():
            return Response(review_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        admin_remarks = review_serializer.validated_data.get('admin_remarks', 'Approved by System Administrator')
        initial_password = review_serializer.validated_data.get('password') or review_serializer.validated_data.get('initial_password')
        custom_username = review_serializer.validated_data.get('username')

        with transaction.atomic():
            # 1. Update application status
            application.status = VendorApplication.StatusChoices.APPROVED
            application.admin_remarks = admin_remarks
            application.reviewed_at = timezone.now()
            application.reviewed_by = request.user
            application.save()

            # 2. Get or create Vendor Role
            vendor_role, _ = Role.objects.get_or_create(
                name='Vendor',
                defaults={'description': 'Approved Supplier Vendor Account', 'is_active': True}
            )

            # 3. Create or get Vendor record linked to this application
            vendor, created = Vendor.objects.get_or_create(
                application=application,
                defaults={
                    'company_name': application.company_name,
                    'contact_person': application.contact_person,
                    'email': application.email,
                    'phone': application.phone,
                    'status': Vendor.StatusChoices.ACTIVE,
                    'is_active': True,
                }
            )
            if not created:
                vendor.company_name = application.company_name
                vendor.contact_person = application.contact_person
                vendor.email = application.email
                vendor.phone = application.phone
                vendor.status = Vendor.StatusChoices.ACTIVE
                vendor.is_active = True
                vendor.save()

            # Copy supplier categories to vendor
            vendor.supplier_categories.set(application.supplier_categories.all())

            # 4. Automatically create and assign Vendor Portal User Account
            if not initial_password:
                initial_password = 'ProcuraMed@2026'

            if custom_username:
                username = custom_username.strip()
                if User.objects.filter(username=username).exclude(id=getattr(vendor.user, 'id', None)).exists():
                    return Response({'error': f"Username '{username}' is already taken. Please choose another username."}, status=status.HTTP_400_BAD_REQUEST)
            else:
                base_username = application.email.split('@')[0]
                username = base_username
                counter = 1
                while User.objects.filter(username=username).exclude(id=getattr(vendor.user, 'id', None)).exists():
                    username = f"{base_username}_{counter}"
                    counter += 1

            if vendor.user:
                vendor.user.username = username
                vendor.user.set_password(initial_password)
                vendor.user.is_active = True
                vendor.user.first_login = True
                vendor.user.save()
                assigned_user = vendor.user
            else:
                assigned_user = User.objects.create_user(
                    username=username,
                    email=application.email,
                    password=initial_password,
                    first_name=application.contact_person,
                    role=vendor_role,
                    phone=application.phone,
                    is_active=True,
                    first_login=True,
                    created_by=request.user
                )
                vendor.user = assigned_user
                vendor.save()

        app_serializer = VendorApplicationSerializer(application)

        # Send approval notification email to vendor
        email_sent, email_msg = send_vendor_approval_email(
            application=application,
            username=assigned_user.username,
            temporary_password=initial_password
        )

        response_data = {
            'message': f"Vendor application approved and portal access created for {application.company_name}.",
            'application': app_serializer.data,
            'vendor_credentials': {
                'username': assigned_user.username,
                'email': assigned_user.email,
                'temporary_password': initial_password,
                'company_name': application.company_name
            },
            'email_notification_sent': email_sent
        }
        if not email_sent:
            response_data['email_warning'] = email_msg

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminRole])
    def assign_credentials(self, request, pk=None):
        application = self.get_object()

        if application.status != VendorApplication.StatusChoices.APPROVED:
            return Response({'error': 'Credentials can only be assigned to approved vendor applications.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AssignVendorCredentialsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        username = serializer.validated_data['username'].strip()
        password = serializer.validated_data['password']

        with transaction.atomic():
            # Get or create vendor
            vendor = getattr(application, 'approved_vendor', None) or Vendor.objects.filter(application=application).first()
            if not vendor:
                vendor = Vendor.objects.create(
                    application=application,
                    company_name=application.company_name,
                    contact_person=application.contact_person,
                    email=application.email,
                    phone=application.phone,
                    status=Vendor.StatusChoices.ACTIVE,
                    is_active=True,
                )
                vendor.supplier_categories.set(application.supplier_categories.all())

            # Check if username is taken by another user
            existing_user_with_username = User.objects.filter(username=username).first()
            if existing_user_with_username and (not vendor.user or existing_user_with_username.id != vendor.user.id):
                return Response({'username': 'This username is already taken. Please choose a unique username.'}, status=status.HTTP_400_BAD_REQUEST)

            vendor_role, _ = Role.objects.get_or_create(
                name='Vendor',
                defaults={'description': 'Approved Supplier Vendor Account', 'is_active': True}
            )

            if vendor.user:
                vendor.user.username = username
                vendor.user.set_password(password)
                vendor.user.is_active = True
                vendor.user.save()
                user = vendor.user
            else:
                user = User.objects.create_user(
                    username=username,
                    email=vendor.email,
                    password=password,
                    first_name=vendor.contact_person,
                    role=vendor_role,
                    phone=vendor.phone,
                    is_active=True,
                    first_login=True,
                    created_by=request.user
                )
                vendor.user = user

            vendor.is_active = True
            vendor.status = Vendor.StatusChoices.ACTIVE
            vendor.save()

        # Send approval/credentials email notification to vendor
        email_sent, email_msg = send_vendor_approval_email(
            application=application,
            username=username,
            temporary_password=password
        )

        res_data = {
            'message': f"Login credentials successfully assigned for {vendor.company_name}.",
            'username': username,
            'portal_access_active': True,
            'vendor_id': vendor.id,
            'email_notification_sent': email_sent
        }
        if not email_sent:
            res_data['email_warning'] = email_msg

        return Response(res_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminRole])
    def toggle_status(self, request, pk=None):
        application = self.get_object()
        vendor = getattr(application, 'approved_vendor', None)
        if not vendor:
            vendor = Vendor.objects.create(
                application=application,
                company_name=application.company_name,
                contact_person=application.contact_person,
                email=application.email,
                phone=application.phone,
                status=Vendor.StatusChoices.ACTIVE,
                is_active=True,
            )
            vendor.supplier_categories.set(application.supplier_categories.all())

        vendor.is_active = not vendor.is_active
        vendor.status = Vendor.StatusChoices.ACTIVE if vendor.is_active else Vendor.StatusChoices.INACTIVE
        vendor.save()
        if vendor.user:
            vendor.user.is_active = vendor.is_active
            vendor.user.save()

        AuditLog.objects.create(
            user=request.user,
            action='Vendor Status Toggle',
            module='Vendor Management',
            description=f"Administrator toggled status for vendor '{vendor.company_name}' to {'ACTIVE' if vendor.is_active else 'INACTIVE'}."
        )

        return Response({
            'status': 'Vendor status updated',
            'is_active': vendor.is_active,
            'vendor_status': vendor.status,
            'portal_access_active': bool(vendor.is_active and vendor.user and vendor.user.is_active)
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminRole])
    def reject(self, request, pk=None):
        application = self.get_object()

        admin_remarks = request.data.get('admin_remarks', 'Application rejected after review')
        application.status = VendorApplication.StatusChoices.REJECTED
        application.admin_remarks = admin_remarks
        application.reviewed_at = timezone.now()
        application.reviewed_by = request.user
        application.save()

        # If a vendor record or user exists, disable them
        if hasattr(application, 'approved_vendor') and application.approved_vendor:
            vendor = application.approved_vendor
            vendor.is_active = False
            vendor.status = Vendor.StatusChoices.INACTIVE
            vendor.save()
            if vendor.user:
                vendor.user.is_active = False
                vendor.user.save()

        # Send rejection notification email to vendor
        email_sent, email_msg = send_vendor_rejection_email(
            application=application,
            rejection_reason=admin_remarks
        )

        app_serializer = VendorApplicationSerializer(application)
        response_data = {
            'message': 'Vendor application rejected.',
            'application': app_serializer.data,
            'email_notification_sent': email_sent
        }
        if not email_sent:
            response_data['email_warning'] = email_msg

        return Response(response_data, status=status.HTTP_200_OK)


class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.select_related('user', 'application').prefetch_related('supplier_categories').all().order_by('id')
    serializer_class = VendorSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filterset_class = VendorFilter
    search_fields = ['vendor_code', 'company_name', 'contact_person', 'email', 'phone']
    ordering_fields = ['id', 'vendor_code', 'company_name', 'performance_rating', 'created_at']
    ordering = ['id']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Vendor.objects.none()
        if user.is_superuser or user.is_staff or (user.role and any(r in user.role.name.lower() for r in [
            'admin', 'system administrator', 'procurement officer', 'committee', 'technical', 'finance', 'purchase'
        ])):
            return super().get_queryset().exclude(
                application__status__in=[VendorApplication.StatusChoices.REJECTED, VendorApplication.StatusChoices.PENDING]
            )
        # If user is vendor, filter to own profile
        return Vendor.objects.filter(user=user)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_profile(self, request):
        user = request.user
        vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).select_related('user', 'application').prefetch_related('supplier_categories').first()
        if not vendor:
            return Response({'error': 'Vendor profile not found.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(vendor)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=True, methods=['post'], permission_classes=[IsAdminRole])
    def reset_password(self, request, pk=None):
        import secrets
        import string
        vendor = self.get_object()

        if not vendor.is_active or (vendor.user and not vendor.user.is_active):
            return Response(
                {'error': 'Cannot reset password for a deactivated vendor account. Please activate the account first.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate a clean, secure temporary password (e.g. X7mP@29K format)
        chars_upper = string.ascii_uppercase
        chars_lower = string.ascii_lowercase
        chars_digits = string.digits
        specials = '@#$%'

        part1 = secrets.choice(chars_upper) + secrets.choice(chars_digits) + secrets.choice(chars_lower)
        part2 = secrets.choice(chars_upper) + secrets.choice(specials) + secrets.choice(chars_digits) + secrets.choice(chars_digits) + secrets.choice(chars_upper)
        temp_password = f"{part1}{part2}"

        with transaction.atomic():
            if not vendor.user:
                vendor_role, _ = Role.objects.get_or_create(
                    name='Vendor',
                    defaults={'description': 'Approved Supplier Vendor Account', 'is_active': True}
                )
                base_username = vendor.email.split('@')[0]
                username = base_username
                counter = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}_{counter}"
                    counter += 1

                user = User.objects.create_user(
                    username=username,
                    email=vendor.email,
                    password=temp_password,
                    first_name=vendor.contact_person,
                    role=vendor_role,
                    phone=vendor.phone,
                    is_active=True,
                    first_login=True,
                    created_by=request.user
                )
                vendor.user = user
                vendor.save()
            else:
                vendor.user.set_password(temp_password)
                vendor.user.first_login = True
                vendor.user.save()

            AuditLog.objects.create(
                user=request.user,
                action='Vendor Password Reset',
                module='Vendor Management',
                description=f"Administrator reset password for vendor '{vendor.company_name}' (@{vendor.user.username}). Force password change enabled."
            )

        return Response({
            'message': f"Temporary password generated successfully for {vendor.company_name}.",
            'username': vendor.user.username,
            'temporary_password': temp_password,
            'company_name': vendor.company_name
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminRole])
    def toggle_status(self, request, pk=None):
        vendor = self.get_object()
        vendor.is_active = not vendor.is_active
        vendor.status = Vendor.StatusChoices.ACTIVE if vendor.is_active else Vendor.StatusChoices.INACTIVE
        vendor.save()
        if vendor.user:
            vendor.user.is_active = vendor.is_active
            vendor.user.save()
        return Response({
            'status': 'Vendor status updated',
            'is_active': vendor.is_active,
            'vendor_status': vendor.status,
            'portal_access_active': bool(vendor.is_active and vendor.user and vendor.user.is_active)
        }, status=status.HTTP_200_OK)


from rest_framework.views import APIView
from django.db.models import Q
from procurement.models import QuotationRequest, Quotation, PurchaseOrder
from inventory.models import Delivery
from accounts.models import AuditLog


class VendorDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsVendorUser]

    def get(self, request):
        user = request.user
        vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
        if not vendor:
            return Response({'error': 'No vendor profile associated with this account.'}, status=status.HTTP_404_NOT_FOUND)

        if not vendor.is_active or vendor.status != Vendor.StatusChoices.ACTIVE:
            return Response({'error': 'Vendor portal access is currently disabled or inactive.'}, status=status.HTTP_403_FORBIDDEN)

        # 1. Vendor info
        vendor_data = VendorSerializer(vendor).data
        if vendor.application:
            vendor_data['address'] = vendor.application.address
            vendor_data['products_services_offered'] = vendor.application.products_services_offered
            vendor_data['certificate_file'] = vendor.application.certificate_file.url if vendor.application.certificate_file else None

        # 2. Real stats from database
        open_opportunities_count = QuotationRequest.objects.filter(
            vendor_invitations__vendor=vendor,
            status__in=['SENT', 'OPEN']
        ).distinct().count()
        quotations_submitted_count = Quotation.objects.filter(vendor=vendor).count()
        pending_quotations_count = Quotation.objects.filter(vendor=vendor, status__in=['SUBMITTED', 'UNDER_REVIEW']).count()
        approved_pos_count = PurchaseOrder.objects.filter(vendor=vendor).count()
        pending_deliveries_count = Delivery.objects.filter(vendor=vendor, status__in=['DISPATCHED', 'IN_TRANSIT']).count()
        completed_orders_count = PurchaseOrder.objects.filter(vendor=vendor, status__in=['CLOSED', 'DELIVERED']).count()

        stats = {
            'open_opportunities': open_opportunities_count,
            'quotations_submitted': quotations_submitted_count,
            'pending_quotations': pending_quotations_count,
            'approved_pos': approved_pos_count,
            'pending_deliveries': pending_deliveries_count,
            'completed_orders': completed_orders_count,
        }

        # 3. Procurement Opportunities (Open RFQs specifically invited to this vendor)
        open_rfqs = QuotationRequest.objects.filter(
            vendor_invitations__vendor=vendor,
            status__in=['SENT', 'OPEN']
        ).distinct().select_related('requisition', 'requisition__department').prefetch_related('vendor_invitations').order_by('-created_at')[:6]
        opportunities = []
        for rfq in open_rfqs:
            dept_name = rfq.requisition.department.name if (rfq.requisition and rfq.requisition.department) else 'General Medical'
            invitation = rfq.vendor_invitations.filter(vendor=vendor).first()
            opportunities.append({
                'id': rfq.id,
                'rfq_number': rfq.rfq_number,
                'title': rfq.title,
                'category': dept_name,
                'department': dept_name,
                'issue_date': rfq.issue_date,
                'due_date': rfq.due_date,
                'status': rfq.status,
                'invitation_status': invitation.status if invitation else 'INVITED',
                'invitation_status_display': invitation.get_status_display() if invitation else 'Invited',
                'terms_and_conditions': rfq.terms_and_conditions,
                'has_quoted': Quotation.objects.filter(quotation_request=rfq, vendor=vendor).exists(),
                'requisition_number': rfq.requisition.requisition_number if rfq.requisition else None,
                'item_name': rfq.requisition.item_name if rfq.requisition else rfq.title,
                'quantity': rfq.requisition.quantity if rfq.requisition else None,
                'unit': rfq.requisition.unit if rfq.requisition else 'Units',
            })

        # 4. Recent Quotations
        recent_quotes_qs = Quotation.objects.filter(vendor=vendor).select_related('quotation_request').order_by('-created_at')[:5]
        recent_quotations = []
        for q in recent_quotes_qs:
            recent_quotations.append({
                'id': q.id,
                'quotation_number': q.quotation_number,
                'rfq_number': q.quotation_request.rfq_number if q.quotation_request else 'N/A',
                'rfq_title': q.quotation_request.title if q.quotation_request else 'N/A',
                'submission_date': q.submission_date,
                'total_amount': q.total_amount,
                'status': q.status,
                'lead_time_days': q.lead_time_days,
            })

        # 5. Recent Purchase Orders
        recent_pos_qs = PurchaseOrder.objects.filter(vendor=vendor).select_related('quotation').order_by('-created_at')[:5]
        recent_purchase_orders = []
        for po in recent_pos_qs:
            recent_purchase_orders.append({
                'id': po.id,
                'po_number': po.po_number,
                'quotation_number': po.quotation.quotation_number if po.quotation else 'N/A',
                'order_date': po.order_date,
                'expected_delivery_date': po.expected_delivery_date,
                'total_amount': po.total_amount,
                'status': po.status,
            })

        # 6. Active Deliveries
        recent_deliveries_qs = Delivery.objects.filter(vendor=vendor).select_related('purchase_order').order_by('-created_at')[:5]
        recent_deliveries = []
        for d in recent_deliveries_qs:
            recent_deliveries.append({
                'id': d.id,
                'delivery_number': d.delivery_number,
                'po_number': d.purchase_order.po_number if d.purchase_order else 'N/A',
                'delivery_date': d.delivery_date,
                'tracking_number': d.tracking_number,
                'status': d.status,
            })

        # 7. Notifications
        vendor_logs = AuditLog.objects.filter(
            Q(user=user) | Q(description__icontains=vendor.company_name)
        ).order_by('-created_at')[:5]
        notifications = []
        for log in vendor_logs:
            notifications.append({
                'id': log.id,
                'action': log.action,
                'description': log.description,
                'created_at': log.created_at,
            })

        return Response({
            'vendor': vendor_data,
            'stats': stats,
            'opportunities': opportunities,
            'recent_quotations': recent_quotations,
            'recent_purchase_orders': recent_purchase_orders,
            'recent_deliveries': recent_deliveries,
            'notifications': notifications,
        }, status=status.HTTP_200_OK)


class VendorProfileView(APIView):
    permission_classes = [IsAuthenticated, IsVendorUser]

    def get(self, request):
        user = request.user
        vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
        if not vendor:
            return Response({'error': 'Vendor profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        vendor_data = VendorSerializer(vendor).data
        if vendor.application:
            vendor_data['address'] = vendor.application.address
            vendor_data['products_services_offered'] = vendor.application.products_services_offered
            vendor_data['certificate_file'] = vendor.application.certificate_file.url if vendor.application.certificate_file else None
            vendor_data['submitted_at'] = vendor.application.submitted_at
            vendor_data['reviewed_at'] = vendor.application.reviewed_at

        return Response(vendor_data, status=status.HTTP_200_OK)


class VendorProductViewSet(viewsets.ModelViewSet):
    serializer_class = VendorProductSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = VendorProductFilter
    search_fields = ['name', 'brand', 'model_number', 'description', 'technical_specifications', 'product_code']
    ordering_fields = ['name', 'indicative_price', 'created_at', 'category__name']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return VendorProduct.objects.none()

        role_name = user.role.name.lower() if user.role else ''
        is_vendor = 'vendor' in role_name or hasattr(user, 'vendor_profile')
        is_committee = 'committee' in role_name
        is_officer = 'purchase' in role_name or 'technical' in role_name
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name

        # 1. Vendor view: strictly only their own products
        if is_vendor and not is_admin:
            vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
            if not vendor:
                return VendorProduct.objects.none()
            return VendorProduct.objects.filter(vendor=vendor).select_related('vendor', 'category')

        # 2. Committee / Officer / Admin view:
        # Access active products catalogue across active approved vendors
        if is_committee or is_officer or is_admin:
            qs = VendorProduct.objects.select_related('vendor', 'category')
            vendor_id = self.request.query_params.get('vendor_id')
            if vendor_id:
                qs = qs.filter(vendor_id=vendor_id)
            if not is_admin or self.request.query_params.get('active_only') == 'true':
                qs = qs.filter(
                    is_active=True,
                    vendor__is_active=True,
                    vendor__status=Vendor.StatusChoices.ACTIVE
                )
            return qs

        return VendorProduct.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
        if not vendor:
            raise PermissionDenied("Only registered and approved vendors can create product catalogue listings.")
        if not vendor.is_active or vendor.status != Vendor.StatusChoices.ACTIVE:
            raise ValidationError({"detail": "Your vendor portal account is inactive. You cannot add products."})

        # Validate that category belongs to vendor's assigned categories
        category = serializer.validated_data.get('category')
        if category:
            is_assigned = vendor.supplier_categories.filter(id=category.id).exists()
            if not is_assigned and vendor.application:
                is_assigned = vendor.application.supplier_categories.filter(id=category.id).exists()
            if not is_assigned:
                raise ValidationError({
                    "category": f"Selected category '{category.name}' is not assigned to your vendor profile. You can only add products under your assigned supply categories."
                })

        serializer.save(vendor=vendor)

    def perform_update(self, serializer):
        product = self.get_object()
        user = self.request.user
        role_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name

        # Ownership check: vendors can only update their own products
        if not is_admin:
            if not product.vendor.user or product.vendor.user != user:
                raise PermissionDenied("You do not have permission to edit another vendor's product.")

            category = serializer.validated_data.get('category')
            if category:
                vendor = product.vendor
                is_assigned = vendor.supplier_categories.filter(id=category.id).exists()
                if not is_assigned and vendor.application:
                    is_assigned = vendor.application.supplier_categories.filter(id=category.id).exists()
                if not is_assigned:
                    raise ValidationError({
                        "category": f"Selected category '{category.name}' is not assigned to your vendor profile. You can only manage products under your assigned supply categories."
                    })

        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        role_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name

        # Ownership check: vendors can only delete their own products
        if not is_admin:
            if not instance.vendor.user or instance.vendor.user != user:
                raise PermissionDenied("You do not have permission to delete another vendor's product.")
        instance.delete()

    @action(detail=True, methods=['post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        """Toggle active status (activate / deactivate) of a vendor product."""
        product = self.get_object()
        user = request.user
        role_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in role_name

        if not is_admin:
            if not product.vendor.user or product.vendor.user != user:
                raise PermissionDenied("You do not have permission to modify this product's status.")

        product.is_active = not product.is_active
        product.save(update_fields=['is_active', 'updated_at'])
        status_label = "activated" if product.is_active else "deactivated"
        return Response({
            'detail': f"Product '{product.name}' has been {status_label}.",
            'product': VendorProductSerializer(product, context={'request': request}).data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='catalogue')
    def catalogue(self, request):
        """
        Global product catalogue search available to Procurement Committee, Officers, and Admins
        when researching available hospital supplies and potential suppliers.
        Returns only active products from active approved vendors with non-binding indicative pricing.
        """
        user = request.user
        role_name = user.role.name.lower() if user.role else ''
        is_allowed = user.is_superuser or user.is_staff or any(
            r in role_name for r in ['committee', 'purchase', 'technical', 'admin']
        )
        if not is_allowed:
            raise PermissionDenied("Only procurement committee members and officers can access the cross-vendor product catalogue.")

        qs = VendorProduct.objects.filter(
            is_active=True,
            vendor__is_active=True,
            vendor__status=Vendor.StatusChoices.ACTIVE
        ).select_related('vendor', 'category')

        # Filter by search
        search_q = request.query_params.get('search', '').strip()
        if search_q:
            qs = qs.filter(
                models.Q(name__icontains=search_q) |
                models.Q(brand__icontains=search_q) |
                models.Q(model_number__icontains=search_q) |
                models.Q(description__icontains=search_q) |
                models.Q(technical_specifications__icontains=search_q) |
                models.Q(category__name__icontains=search_q) |
                models.Q(vendor__company_name__icontains=search_q)
            )

        # Filter by category
        cat_id = request.query_params.get('category')
        if cat_id:
            qs = qs.filter(category_id=cat_id)

        # Filter by vendor
        vendor_id = request.query_params.get('vendor_id')
        if vendor_id:
            qs = qs.filter(vendor_id=vendor_id)

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
