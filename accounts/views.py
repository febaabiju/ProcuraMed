from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from rest_framework.pagination import PageNumberPagination

from .models import Role, Department, User, AuditLog
from .serializers import (
    RoleSerializer, DepartmentSerializer, UserSerializer, 
    UserCreateUpdateSerializer, AuditLogSerializer, CustomTokenObtainPairSerializer,
    ChangePasswordSerializer
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

        if not new_password or len(new_password) < 6:
            return Response({'error': 'New password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        if confirm_password and new_password != confirm_password:
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


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip()

        safe_message = 'Password reset request submitted successfully. Please contact the system administrator to reset your password.'

        if username and email:
            user = User.objects.filter(username__iexact=username, email__iexact=email, is_active=True).first()
            if user:
                from vendors.models import Vendor
                vendor = Vendor.objects.filter(user=user).first()
                if vendor and vendor.is_active and vendor.status == Vendor.StatusChoices.ACTIVE:
                    AuditLog.objects.create(
                        user=user,
                        action='Vendor Password Reset Requested',
                        module='Authentication',
                        description=f"Vendor '@{user.username}' ({vendor.company_name}) submitted a forgot password reset request."
                    )

        return Response({
            'message': safe_message,
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
