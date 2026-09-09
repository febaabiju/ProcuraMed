from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import Role, Department, User, AuditLog, SystemSetting


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'is_active', 'created_at', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'description')
    ordering = ('id',)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'code', 'is_active', 'created_at', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'code', 'description')
    ordering = ('id',)


@admin.register(User)
class CustomUserAdmin(BaseUserAdmin):
    list_display = ('id', 'employee_id', 'username', 'email', 'first_name', 'last_name', 'role', 'department', 'is_active', 'first_login')
    list_filter = ('is_active', 'is_staff', 'role', 'department')
    search_fields = ('employee_id', 'username', 'email', 'first_name', 'last_name', 'phone')
    ordering = ('id',)
    
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Custom Profile Fields', {
            'fields': ('employee_id', 'role', 'department', 'phone', 'first_login', 'created_by')
        }),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Custom Profile Fields', {
            'fields': ('employee_id', 'email', 'first_name', 'last_name', 'role', 'department', 'phone', 'first_login')
        }),
    )


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'action', 'module', 'ip_address', 'created_at')
    list_filter = ('module', 'created_at')
    search_fields = ('action', 'module', 'description', 'ip_address', 'user__username')
    readonly_fields = ('user', 'action', 'module', 'description', 'ip_address', 'created_at')
    ordering = ('-created_at',)


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ('id', 'hospital_name', 'hospital_email', 'hospital_phone', 'updated_at', 'updated_by')
    readonly_fields = ('updated_at',)
