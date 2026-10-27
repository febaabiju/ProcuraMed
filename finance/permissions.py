from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsPurchaseOfficerOrFinanceOrAdmin(BasePermission):
    """
    Allows access to Purchase Officers, Finance Officers, and Administrators.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        if not request.user.role:
            return False
        r_name = request.user.role.name.lower()
        return any(k in r_name for k in ['purchase', 'procurement officer', 'finance', 'accounts', 'admin', 'system administrator'])


class IsFinanceOfficerOrAdmin(IsPurchaseOfficerOrFinanceOrAdmin):
    pass
