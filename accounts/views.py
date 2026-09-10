from rest_framework import viewsets, status, views
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from rest_framework.pagination import PageNumberPagination

from .models import Role, Department, User, AuditLog, SystemSetting
from .validators import validate_password_complexity
from rest_framework.exceptions import ValidationError
from .serializers import (
    RoleSerializer, DepartmentSerializer, UserSerializer, 
    UserCreateUpdateSerializer, AuditLogSerializer, CustomTokenObtainPairSerializer,
    ChangePasswordSerializer, SystemSettingSerializer
)
from .permissions import IsAdminRole, IsAdminOrReadOnly
from .filters import UserFilter, RoleFilter, DepartmentFilter, AuditLogFilter


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 200
    page_size_query_param = 'page_size'
    max_page_size = 1000


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filterset_class = RoleFilter
    search_fields = ['name', 'description']
    ordering_fields = ['id', 'name', 'created_at']


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = StandardResultsSetPagination
    filterset_class = DepartmentFilter
    search_fields = ['name', 'code', 'description']
    ordering_fields = ['id', 'name', 'code', 'created_at']


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('role', 'department').all().order_by('id')
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filterset_class = UserFilter
    search_fields = ['employee_id', 'username', 'email', 'first_name', 'last_name', 'phone']
    ordering_fields = ['id', 'employee_id', 'username', 'email', 'created_at']
    ordering = ['id']

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return UserCreateUpdateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'list', 'toggle_status']:
            return [IsAdminRole()]
        return super().get_permissions()

    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            user=self.request.user if self.request.user.is_authenticated else None,
            action='User Account Created',
            module='User Management',
            description=f"Administrator created account for user '@{user.username}' ({user.role.name if user.role else 'Staff'}). Temporary password generated and credentials emailed."
        )

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def me(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        old_password = serializer.validated_data['old_password']
        new_password = serializer.validated_data['new_password']

        if not user.check_password(old_password):
            return Response({'error': 'Incorrect current password'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        if user.first_login:
            user.first_login = False
        user.save()
        return Response({'message': 'Password changed successfully', 'first_login': False}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def force_change_password(self, request):
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not new_password:
            return Response({'error': 'New password is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_password_complexity(new_password)
        except ValidationError as exc:
            msg = exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)
            return Response({'error': msg}, status=status.HTTP_400_BAD_REQUEST)

        if not confirm_password:
            return Response({'error': 'Please confirm your new password.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_password != confirm_password:
            return Response({'error': 'Passwords do not match. Please verify and re-enter.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.set_password(new_password)
        user.first_login = False
        user.save()

        AuditLog.objects.create(
            user=user,
            action='Temporary Password Updated',
            module='Authentication',
            description=f"User '@{user.username}' updated their temporary password. First login restriction cleared."
        )

        return Response({
            'message': 'Password updated successfully.',
            'first_login': False
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAdminRole])
    def toggle_status(self, request, pk=None):
        user = self.get_object()
        user.is_active = not user.is_active
        user.save()
        return Response({'status': 'status updated', 'is_active': user.is_active}, status=status.HTTP_200_OK)


from rest_framework.views import APIView
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.conf import settings
from vendors.emails import send_password_reset_email


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip()

        if not username or not email:
            return Response(
                {'error': 'Please enter both your username and registered email address.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Look up active user matching both username and email
        user = User.objects.select_related('role').filter(
            username__iexact=username, email__iexact=email, is_active=True
        ).first()

        if not user:
            return Response(
                {'error': 'No active account was found matching the provided username and email address.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Admin accounts MUST NOT have access to Forgot Password
        role_name = user.role.name.lower() if user.role else ''
        is_admin = bool(
            user.is_superuser or 
            user.is_staff or 
            role_name in ['admin', 'system administrator']
        )
        if is_admin:
            return Response(
                {'error': 'Password reset is not available for Administrator accounts. Please contact system security or server administration.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Verify the user belongs to one of the supported non-admin roles:
        # Vendor, Department Staff, Purchase Officer, Procurement Committee, Technical Officer
        is_vendor = 'vendor' in role_name
        is_department_staff = 'staff' in role_name or 'department' in role_name
        is_purchase_officer = 'purchase' in role_name or 'procurement officer' in role_name
        is_committee = 'committee' in role_name
        is_technical_officer = 'technical' in role_name

        if not (is_vendor or is_department_staff or is_purchase_officer or is_committee or is_technical_officer):
            return Response(
                {'error': 'Self-service password reset is not supported for this account role. Please contact an administrator.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        vendor = None
        if is_vendor:
            from vendors.models import Vendor
            vendor = Vendor.objects.filter(user=user, is_active=True).first()
            if not vendor or vendor.status != Vendor.StatusChoices.ACTIVE:
                return Response(
                    {'error': 'No active vendor account was found matching the provided username and email address.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Generate secure Django password reset token
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        # Construct reset URL
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        reset_url = f"{frontend_url}/reset-password?uid={uid}&token={token}"

        # Send password reset email via Gmail SMTP
        email_sent, email_msg = send_password_reset_email(
            user=user,
            reset_url=reset_url,
            expires_in_minutes=30,
            vendor=vendor
        )

        role_label = user.role.name if user.role else 'User'

        if not email_sent:
            AuditLog.objects.create(
                user=user,
                action='Password Reset Failed',
                module='Authentication',
                description=f"Failed to deliver password reset email to '{user.email}' for user '@{user.username}' ({role_label}): {email_msg}"
            )
            return Response(
                {
                    'error': f"Failed to send password reset email: {email_msg}",
                    'email_sent': False
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        AuditLog.objects.create(
            user=user,
            action='Password Reset Requested',
            module='Authentication',
            description=f"Password reset link successfully sent to '{user.email}' for user '@{user.username}' ({role_label})."
        )

        return Response({
            'message': f"A secure password reset link has been sent to your registered email ({user.email}). Please check your inbox.",
            'success': True,
            'email_sent': True
        }, status=status.HTTP_200_OK)


class ResetPasswordValidateView(APIView):
    """
    Validates whether the provided uid and token are still valid before showing the form.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        uid = request.query_params.get('uid', '').strip()
        token = request.query_params.get('token', '').strip()

        if not uid or not token:
            return Response(
                {'valid': False, 'error': 'Invalid reset link. Missing security token parameters.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.filter(pk=user_id, is_active=True).first()
        except (TypeError, ValueError, OverflowError):
            user = None

        if not user or not default_token_generator.check_token(user, token):
            return Response(
                {'valid': False, 'error': 'This password reset link is invalid or has expired. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'valid': True,
            'username': user.username,
            'email': user.email
        }, status=status.HTTP_200_OK)


class ResetPasswordConfirmView(APIView):
    """
    Validates token and updates vendor password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        uid = request.data.get('uid', '').strip()
        token = request.data.get('token', '').strip()
        new_password = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')

        if not uid or not token:
            return Response(
                {'error': 'Invalid reset request. Missing security tokens.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not new_password:
            return Response(
                {'error': 'New password is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            validate_password_complexity(new_password)
        except ValidationError as exc:
            msg = exc.detail[0] if isinstance(exc.detail, list) else str(exc.detail)
            return Response(
                {'error': msg},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not confirm_password:
            return Response(
                {'error': 'Please confirm your new password.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_password != confirm_password:
            return Response(
                {'error': 'New password and confirmation password do not match.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.filter(pk=user_id, is_active=True).first()
        except (TypeError, ValueError, OverflowError):
            user = None

        if not user:
            return Response(
                {'error': 'User account not found or is no longer active.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not default_token_generator.check_token(user, token):
            return Response(
                {'error': 'This password reset link is invalid or has expired. Please request a new one.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Set new password and mark first_login as False
        user.set_password(new_password)
        user.first_login = False
        user.save()

        role_str = user.role.name if user.role else 'User'
        AuditLog.objects.create(
            user=user,
            action='Password Reset Completed',
            module='Authentication',
            description=f"User '@{user.username}' ({role_str}) successfully reset their password via secure email link."
        )

        return Response({
            'message': 'Your password has been reset successfully. You can now log in with your new password.',
            'success': True
        }, status=status.HTTP_200_OK)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related('user').all().order_by('-created_at', '-id')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminRole]
    pagination_class = StandardResultsSetPagination
    filterset_class = AuditLogFilter
    search_fields = ['action', 'module', 'description', 'ip_address', 'user__username']
    ordering_fields = ['id', 'created_at']
    ordering = ['-created_at', '-id']


class SystemSettingsView(views.APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        settings_obj = SystemSetting.get_settings()
        serializer = SystemSettingSerializer(settings_obj)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        settings_obj = SystemSetting.get_settings()
        serializer = SystemSettingSerializer(settings_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            # Create audit log record
            AuditLog.objects.create(
                user=request.user,
                action='System Settings Updated',
                module='System Management',
                description=f"System administrator '{request.user.username}' updated global system settings.",
                ip_address=request.META.get('REMOTE_ADDR')
            )
            return Response({
                'message': 'System settings saved successfully.',
                'settings': serializer.data
            }, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        return self.put(request)

