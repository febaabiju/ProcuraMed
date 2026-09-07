from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Role, Department, User, AuditLog


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'code', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class UserSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    department = DepartmentSerializer(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'employee_id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'department', 'phone', 'date_of_birth', 'gender', 'date_of_joining',
            'technical_specializations', 'is_active', 'first_login',
            'is_staff', 'is_superuser', 'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'is_staff', 'is_superuser', 'created_at', 'updated_at']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class UserCreateUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=6)
    role = serializers.PrimaryKeyRelatedField(queryset=Role.objects.all(), required=False, allow_null=True)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.all(), required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id', 'employee_id', 'username', 'email', 'password', 'first_name', 'last_name',
            'role', 'department', 'phone', 'date_of_birth', 'gender', 'date_of_joining',
            'technical_specializations', 'is_active', 'first_login'
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        password = validated_data.pop('password', None)
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user

        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'user_name', 'action', 'module', 'description', 'ip_address', 'created_at']
        read_only_fields = ['id', 'created_at']


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=6)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        username = attrs.get(self.username_field)
        if username and '@' in username:
            user_by_email = User.objects.filter(email__iexact=username).first()
            if user_by_email:
                attrs[self.username_field] = user_by_email.username

        data = super().validate(attrs)
        
        is_vendor = bool(self.user.role and self.user.role.name.lower() == 'vendor')
        if is_vendor:
            from vendors.models import Vendor, VendorApplication
            vendor = getattr(self.user, 'vendor_profile', None) or Vendor.objects.filter(user=self.user).first()
            if not vendor:
                raise serializers.ValidationError({"detail": "No approved vendor profile is associated with this account. Access denied."})
            if not vendor.is_active or vendor.status != Vendor.StatusChoices.ACTIVE:
                raise serializers.ValidationError({"detail": "Vendor portal access has been disabled or revoked. Please contact the administrator."})
            if vendor.application and vendor.application.status != VendorApplication.StatusChoices.APPROVED:
                raise serializers.ValidationError({"detail": "Vendor application has not been approved. Access denied."})

        data['user'] = {
            'id': self.user.id,
            'employee_id': self.user.employee_id,
            'username': self.user.username,
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'date_of_birth': self.user.date_of_birth,
            'gender': self.user.gender,
            'date_of_joining': self.user.date_of_joining,
            'technical_specializations': self.user.technical_specializations,
            'role': self.user.role.name if self.user.role else None,
            'role_id': self.user.role.id if self.user.role else None,
            'department': self.user.department.name if self.user.department else None,
            'department_id': self.user.department.id if self.user.department else None,
            'first_login': self.user.first_login,
            'is_vendor': is_vendor,
            'is_staff': self.user.is_staff,
            'is_superuser': self.user.is_superuser,
        }
        return data
