from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
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
        import secrets
        import string
        from .emails import send_user_credentials_email

        request = self.context.get('request')
        password = validated_data.pop('password', None)
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user

        # When password is not provided (Admin Add User flow), automatically generate a secure temporary password
        temp_password = None
        if not password:
            chars_upper = string.ascii_uppercase
            chars_lower = string.ascii_lowercase
            chars_digits = string.digits
            specials = '@#$%'
            temp_password = (
                secrets.choice(chars_upper) +
                secrets.choice(chars_lower) +
                secrets.choice(chars_digits) +
                secrets.choice(specials) +
                ''.join(secrets.choice(chars_upper + chars_lower + chars_digits) for _ in range(6))
            )
            password = temp_password
            validated_data['first_login'] = True

        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()

        # Dispatch credentials email to the user's registered email
        if temp_password and user.email:
            send_user_credentials_email(user, temp_password)

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
        raw_username = (attrs.get(self.username_field) or '').strip()
        password = attrs.get('password', '')

        if not raw_username:
            raise AuthenticationFailed("No account found with the given username or email.")

        # Identify candidate user(s) by username or email
        user = None
        if '@' in raw_username:
            matching_users = list(User.objects.filter(email__iexact=raw_username))
            if not matching_users:
                user = User.objects.filter(username__iexact=raw_username).first()
            elif len(matching_users) == 1:
                user = matching_users[0]
            else:
                # Check active user with matching password
                for u in matching_users:
                    if u.is_active and u.check_password(password):
                        user = u
                        break
                if not user:
                    # Check inactive user with matching password
                    for u in matching_users:
                        if not u.is_active and u.check_password(password):
                            user = u
                            break
                if not user:
                    # Fallback to an inactive account if all are inactive, otherwise first active account
                    if all(not u.is_active for u in matching_users):
                        user = matching_users[0]
                    else:
                        user = next((u for u in matching_users if u.is_active), matching_users[0])
        else:
            user = User.objects.filter(username__iexact=raw_username).first()
            if not user:
                user = User.objects.filter(email__iexact=raw_username).first()

        # Check 1: Account does not exist
        if not user:
            raise AuthenticationFailed("No account found with the given username or email.")

        # Check 2: Account is inactive / deactivated
        if not user.is_active:
            raise AuthenticationFailed("Your account is inactive. Please contact the administrator.")

        # Check 3: Incorrect password
        if not user.check_password(password):
            raise AuthenticationFailed("Incorrect password. Please try again.")

        attrs[self.username_field] = user.username

        try:
            data = super().validate(attrs)
        except AuthenticationFailed:
            if not user.check_password(password):
                raise AuthenticationFailed("Incorrect password. Please try again.")
            if not user.is_active:
                raise AuthenticationFailed("Your account is inactive. Please contact the administrator.")
            raise

        is_vendor = bool(self.user.role and self.user.role.name.lower() == 'vendor')
        if is_vendor:
            from vendors.models import Vendor, VendorApplication
            vendor = getattr(self.user, 'vendor_profile', None) or Vendor.objects.filter(user=self.user).first()
            if not vendor:
                raise AuthenticationFailed("No approved vendor profile is associated with this account. Access denied.")
            if not vendor.is_active or vendor.status != Vendor.StatusChoices.ACTIVE:
                raise AuthenticationFailed("Your account is inactive. Please contact the administrator.")
            if vendor.application and vendor.application.status != VendorApplication.StatusChoices.APPROVED:
                raise AuthenticationFailed("Vendor application has not been approved. Access denied.")

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
