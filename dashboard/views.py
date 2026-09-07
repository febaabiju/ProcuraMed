from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Count, F, Q
from django.utils import timezone
from datetime import datetime, timedelta

from accounts.models import User, AuditLog, Department, Role
from vendors.models import Vendor, VendorApplication
from procurement.models import Requisition, PurchaseOrder, Approval
from inventory.models import Delivery, InventoryItem
from finance.models import Invoice, Payment
from .serializers import DashboardStatsSerializer


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        current_year = now.year
        current_month = now.month

        # User counts (excluding Vendor role from internal user counts)
        total_users = User.objects.filter(is_active=True).count()
        total_internal_users = User.objects.exclude(role__name__iexact='Vendor').exclude(Q(username='admin') | Q(role__name__iexact='System Administrator')).count()
        active_internal_users = User.objects.filter(is_active=True).exclude(role__name__iexact='Vendor').exclude(Q(username='admin') | Q(role__name__iexact='System Administrator')).count()

        # Vendor counts
        total_vendors = Vendor.objects.filter(is_active=True).count()
        pending_vendor_applications = VendorApplication.objects.filter(status='PENDING').count()
        approved_vendors = Vendor.objects.filter(status='ACTIVE', is_active=True).count()
        rejected_vendor_applications = VendorApplication.objects.filter(status='REJECTED').count()

        # Procurement counts
        total_requisitions = Requisition.objects.count()
        pending_approvals = Requisition.objects.filter(status='PENDING_APPROVAL').count()
        total_purchase_orders = PurchaseOrder.objects.count()
        pending_deliveries = Delivery.objects.filter(status__in=['DISPATCHED', 'IN_TRANSIT']).count()

        # Inventory
        current_inventory_count = InventoryItem.objects.filter(is_active=True).count()
        low_stock_items_count = InventoryItem.objects.filter(is_active=True, current_stock__lte=F('reorder_level')).count()

        # Financials
        pending_payments = Invoice.objects.filter(status='PENDING').count()
        total_payments_agg = Payment.objects.filter(status='COMPLETED').aggregate(total=Sum('amount_paid'))
        total_payments_amount = total_payments_agg['total'] or 0.00

        # Monthly procurement amount
        monthly_po_agg = PurchaseOrder.objects.filter(
            created_at__year=current_year, created_at__month=current_month
        ).aggregate(total=Sum('total_amount'))
        monthly_procurement_amount = monthly_po_agg['total'] or 0.00

        # Role Breakdown - Only the 5 managed roles (excluding Administrator)
        role_queries = [
            (
                'Department Staff',
                Q(role__name__iexact='Department Staff') |
                Q(role__name__iexact='department_staff') |
                Q(role__name__iexact='department-staff') |
                Q(role__name__icontains='department staff')
            ),
            (
                'Purchase Officer',
                Q(role__name__iexact='Purchase Officer') |
                Q(role__name__iexact='Procurement Officer') |
                Q(role__name__iexact='purchase_officer') |
                Q(role__name__iexact='purchase-officer') |
                Q(role__name__icontains='purchase')
            ),
            (
                'Vendor',
                Q(role__name__iexact='Vendor') |
                Q(role__name__icontains='vendor')
            ),
            (
                'Procurement Committee',
                Q(role__name__iexact='Procurement Committee') |
                Q(role__name__iexact='Procurement Committee Member') |
                Q(role__name__iexact='Committee Member') |
                Q(role__name__iexact='procurement_committee') |
                Q(role__name__iexact='procurement-committee') |
                Q(role__name__icontains='committee')
            ),
            (
                'Technical Officer',
                Q(role__name__iexact='Technical Officer') |
                Q(role__name__iexact='technical_officer') |
                Q(role__name__iexact='technical-officer') |
                Q(role__name__icontains='technical')
            ),
        ]

        role_counts = []
        for display_name, q_filter in role_queries:
            c = User.objects.filter(q_filter, is_active=True).count()
            role_counts.append({
                'role_name': display_name,
                'count': c
            })

        vendor_application_counts = {
            'pending': pending_vendor_applications,
            'approved': approved_vendors,
            'rejected': rejected_vendor_applications,
        }

        # Top Vendors by PO volume
        top_vendors = list(Vendor.objects.annotate(po_count=Count('purchase_orders')).order_by('-po_count')[:5].values('id', 'company_name', 'po_count'))

        # Department Wise Procurement
        dept_procurement = list(Department.objects.annotate(req_count=Count('requisitions')).values('id', 'name', 'req_count'))

        # Monthly Charts (past 6 months)
        monthly_charts = []
        for i in range(5, -1, -1):
            target_date = now - timedelta(days=i*30)
            y, m = target_date.year, target_date.month
            month_name = target_date.strftime('%b %Y')
            amount_agg = PurchaseOrder.objects.filter(created_at__year=y, created_at__month=m).aggregate(total=Sum('total_amount'))
            monthly_charts.append({
                'month': month_name,
                'total_amount': float(amount_agg['total'] or 0.00)
            })

        # Recent activities from AuditLog
        recent_logs = AuditLog.objects.select_related('user').order_by('-created_at')[:10]
        recent_activities = [
            {
                'id': log.id,
                'user': log.user.username if log.user else 'System',
                'action': log.action,
                'module': log.module,
                'description': log.description,
                'created_at': log.created_at.strftime('%Y-%m-%d %H:%M:%S')
            }
            for log in recent_logs
        ]

        data = {
            'total_users': total_users,
            'total_internal_users': total_internal_users,
            'active_internal_users': active_internal_users,
            'total_vendors': total_vendors,
            'pending_vendor_applications': pending_vendor_applications,
            'approved_vendors': approved_vendors,
            'rejected_vendor_applications': rejected_vendor_applications,
            'total_requisitions': total_requisitions,
            'pending_approvals': pending_approvals,
            'total_purchase_orders': total_purchase_orders,
            'pending_deliveries': pending_deliveries,
            'current_inventory_count': current_inventory_count,
            'low_stock_items_count': low_stock_items_count,
            'pending_payments': pending_payments,
            'total_payments_amount': total_payments_amount,
            'monthly_procurement_amount': monthly_procurement_amount,
            'role_counts': role_counts,
            'vendor_application_counts': vendor_application_counts,
            'top_vendors': top_vendors,
            'department_procurement': dept_procurement,
            'monthly_charts': monthly_charts,
            'recent_activities': recent_activities,
        }

        serializer = DashboardStatsSerializer(data)
        return Response(serializer.data)
