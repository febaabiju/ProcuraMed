from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdminRole(BasePermission):
    """
    Allows access only to Admin users or Django Superusers/Staff.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        return bool(request.user.role and request.user.role.name.lower() in ['admin', 'system administrator'])



class IsDepartmentStaff(BasePermission):
    """
    Allows access to Department Staff users.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return bool(
            request.user.role and 
            ('staff' in request.user.role.name.lower() or 'department' in request.user.role.name.lower())
        )


class IsPurchaseOfficer(BasePermission):
    """
    Allows access to Purchase Officers.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        if not request.user.role:
            return False
        r_name = request.user.role.name.lower()
        return 'purchase' in r_name or 'procurement officer' in r_name


class IsVendorUser(BasePermission):
    """
    Allows access to Vendor user accounts.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return bool(
            request.user.role and 'vendor' in request.user.role.name.lower()
        )


class IsCommitteeMember(BasePermission):
    """
    Allows access to Procurement Committee members.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return bool(
            request.user.role and 'committee' in request.user.role.name.lower()
        )


class IsTechnicalOfficer(BasePermission):
    """
    Allows access to Technical Inspection Officers.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return bool(
            request.user.role and 'technical' in request.user.role.name.lower()
        )


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(
            request.user and request.user.is_authenticated and 
            (request.user.is_superuser or (request.user.role and request.user.role.name.lower() == 'admin'))
        )
