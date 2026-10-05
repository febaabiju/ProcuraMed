from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsRequisitionOwnerOrOfficer(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        r_name = request.user.role.name.lower() if request.user.role else ''
        if any(role in r_name for role in ['admin', 'committee']):
            return True
        if 'technical' in r_name and getattr(obj, 'requires_technical_evaluation', False):
            return True
        if 'purchase' in r_name or 'procurement officer' in r_name:
            # If assigned to a Purchase Officer, only THAT Purchase Officer (or requester) has access
            if getattr(obj, 'assigned_purchase_officer_id', None):
                return obj.assigned_purchase_officer_id == request.user.id or obj.requested_by_id == request.user.id
            if getattr(obj, 'reviewed_by_id', None):
                return obj.reviewed_by_id == request.user.id or obj.requested_by_id == request.user.id
            return True
        return obj.requested_by == request.user


class IsCommitteeOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        r_name = request.user.role.name.lower() if request.user.role else ''
        return any(role in r_name for role in ['admin', 'committee'])


class IsPurchaseOfficerOrAdmin(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        r_name = request.user.role.name.lower() if request.user.role else ''
        return any(role in r_name for role in ['admin', 'purchase', 'procurement officer'])

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        r_name = request.user.role.name.lower() if request.user.role else ''
        if 'admin' in r_name:
            return True
        if getattr(obj, 'assigned_purchase_officer_id', None):
            return obj.assigned_purchase_officer_id == request.user.id
        if getattr(obj, 'reviewed_by_id', None):
            return obj.reviewed_by_id == request.user.id
        return True
