from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsFinanceOfficerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        return bool(
            request.user.role and 
            ('finance' in request.user.role.name.lower() or 'admin' in request.user.role.name.lower() or 'accounts' in request.user.role.name.lower())
        )
