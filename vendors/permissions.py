from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsVendorOwnerOrOfficer(BasePermission):
    """
    Allows Vendors to access/update their own profile, while Purchase Officers and Admins have full access.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        if request.user.role and request.user.role.name.lower() in ['admin', 'purchase officer', 'purchase']:
            return True
        # Check if the user is the owner vendor
        return obj.user == request.user
