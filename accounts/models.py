from django.db import models
from django.contrib.auth.models import AbstractUser


class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_role'
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'
        ordering = ['id']

    def __str__(self):
        return self.name


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_department'
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'
        ordering = ['id']

    def __str__(self):
        return self.name


class User(AbstractUser):
    employee_id = models.CharField(
        max_length=50, unique=True, null=True, blank=True,
        help_text="Unique employee identification code assigned by Admin"
    )
    role = models.ForeignKey(
        Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='users'
    )
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='users'
    )
    phone = models.CharField(max_length=20, blank=True, null=True)
    date_of_birth = models.DateField(null=True, blank=True, verbose_name="Date of Birth")
    gender = models.CharField(
        max_length=10,
        choices=[('Male', 'Male'), ('Female', 'Female')],
        null=True,
        blank=True,
        verbose_name="Gender"
    )
    date_of_joining = models.DateField(null=True, blank=True, verbose_name="Date of Joining")
    technical_specializations = models.JSONField(default=list, blank=True, null=True, verbose_name="Technical Specializations")
    is_active = models.BooleanField(default=True)
    first_login = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_users'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tbl_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
        ordering = ['id']

    def __str__(self):
        emp_prefix = f"[{self.employee_id}] " if self.employee_id else ""
        if self.first_name or self.last_name:
            return f"{emp_prefix}{self.get_full_name()} ({self.username})"
        return f"{emp_prefix}{self.username}"


class AuditLog(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs'
    )
    action = models.CharField(max_length=255)
    module = models.CharField(max_length=100)
    description = models.TextField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tbl_audit_log'
        verbose_name = 'Audit Log'
        verbose_name_plural = 'Audit Logs'
        ordering = ['-created_at']

    def __str__(self):
        user_str = self.user.username if self.user else "System"
        return f"{user_str} - {self.action} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"


class SystemSetting(models.Model):
    # 1. General Settings (initially empty string where not yet configured)
    hospital_name = models.CharField(max_length=255, blank=True, default='')
    hospital_email = models.EmailField(blank=True, default='')
    hospital_phone = models.CharField(max_length=50, blank=True, default='')
    hospital_address = models.TextField(blank=True, default='')

    # 2. Security Settings
    min_password_length = models.IntegerField(default=6)
    session_timeout = models.IntegerField(default=60, help_text="Session timeout in minutes")
    require_password_change = models.BooleanField(default=True, help_text="Require newly created users to change password on first login")

    # 3. Notification Settings
    email_notifications = models.BooleanField(default=True, help_text="Master toggle for email notifications")
    vendor_approval_emails = models.BooleanField(default=True)
    vendor_rejection_emails = models.BooleanField(default=True)
    new_user_credential_emails = models.BooleanField(default=True)

    # 4. Procurement Settings
    enable_purchase_requisition = models.BooleanField(default=True)
    enable_vendor_quotations = models.BooleanField(default=True)
    enable_purchase_order_processing = models.BooleanField(default=True)

    # Metadata
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='updated_settings')

    class Meta:
        db_table = 'tbl_system_setting'
        verbose_name = 'System Setting'
        verbose_name_plural = 'System Settings'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_settings(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"System Settings ({self.hospital_name or 'Not Configured'})"

