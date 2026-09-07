from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsRequisitionOwnerOrOfficer(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        if request.user.role and request.user.role.name.lower() in ['admin', 'purchase officer', 'committee']:
            return True
        return obj.requested_by == request.user


class IsCommitteeOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        return bool(
            request.user.role and request.user.role.name.lower() in ['admin', 'committee', 'procurement committee']
        )


class IsPurchaseOfficerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        return bool(
            request.user.role and request.user.role.name.lower() in ['admin', 'purchase officer', 'purchase']
        )
