from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.utils import timezone
from django.db import transaction
from django.contrib.auth import get_user_model

from .models import SupplierCategory, VendorApplication, Vendor
from .serializers import (
    SupplierCategorySerializer,
    VendorApplicationSerializer,
    VendorApplicationReviewSerializer,
    AssignVendorCredentialsSerializer,
    VendorSerializer
)
from .filters import VendorApplicationFilter, VendorFilter
from accounts.models import Role
from accounts.permissions import IsAdminRole, IsVendorUser
from accounts.views import StandardResultsSetPagination

User = get_user_model()


class SupplierCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SupplierCategory.objects.all().order_by('name')
    serializer_class = SupplierCategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None
    search_fields = ['name']
    ordering_fields = ['name']


class VendorApplicationViewSet(viewsets.ModelViewSet):
    queryset = VendorApplication.objects.select_related('reviewed_by').prefetch_related('supplier_categories').all().order_by('id')
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

            # 3. Create or get Vendor record
            vendor, created = Vendor.objects.get_or_create(
                email=application.email,
                defaults={
                    'application': application,
                    'company_name': application.company_name,
                    'contact_person': application.contact_person,
                    'phone': application.phone,
                    'status': Vendor.StatusChoices.ACTIVE,
                    'is_active': True,
                }
            )
            if not created:
                vendor.application = application
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
        response_data = {
            'message': f"Vendor application approved and portal access created for {application.company_name}.",
            'application': app_serializer.data,
            'vendor_credentials': {
                'username': assigned_user.username,
                'email': assigned_user.email,
                'temporary_password': initial_password,
                'company_name': application.company_name
            }
        }

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
            vendor = getattr(application, 'approved_vendor', None) or Vendor.objects.filter(email=application.email).first()
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

        return Response({
            'message': f"Login credentials successfully assigned for {vendor.company_name}.",
            'username': username,
            'portal_access_active': True,
            'vendor_id': vendor.id
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

        app_serializer = VendorApplicationSerializer(application)
        return Response({
            'message': 'Vendor application rejected.',
            'application': app_serializer.data
        }, status=status.HTTP_200_OK)


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
        if user.is_superuser or user.is_staff or (user.role and user.role.name.lower() in [
            'admin', 'system administrator', 'procurement officer', 'committee member', 'technical officer', 'finance officer'
        ]):
            return super().get_queryset()
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
        open_opportunities_count = QuotationRequest.objects.filter(status='OPEN').count()
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

        # 3. Procurement Opportunities (Open RFQs)
        open_rfqs = QuotationRequest.objects.filter(status='OPEN').select_related('requisition', 'requisition__department').order_by('-created_at')[:6]
        opportunities = []
        for rfq in open_rfqs:
            dept_name = rfq.requisition.department.name if (rfq.requisition and rfq.requisition.department) else 'General Medical'
            opportunities.append({
                'id': rfq.id,
                'rfq_number': rfq.rfq_number,
                'title': rfq.title,
                'category': dept_name,
                'issue_date': rfq.issue_date,
                'due_date': rfq.due_date,
                'status': rfq.status,
                'terms_and_conditions': rfq.terms_and_conditions,
                'has_quoted': Quotation.objects.filter(quotation_request=rfq, vendor=vendor).exists(),
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
