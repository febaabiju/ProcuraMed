from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    RequisitionViewSet, QuotationRequestViewSet, QuotationViewSet, PurchaseOrderViewSet,
    DepartmentStaffDashboardView, PurchaseOfficerDashboardView, ProcurementCommitteeDashboardView,
    TechnicalOfficerDashboardView
)

router = DefaultRouter()
router.register(r'requisitions', RequisitionViewSet, basename='requisition')
router.register(r'rfqs', QuotationRequestViewSet, basename='quotationrequest')
router.register(r'quotations', QuotationViewSet, basename='quotation')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchaseorder')

urlpatterns = [
    path('staff-dashboard/', DepartmentStaffDashboardView.as_view(), name='staff_dashboard'),
    path('purchase-officer-dashboard/', PurchaseOfficerDashboardView.as_view(), name='purchase_officer_dashboard'),
    path('committee-dashboard/', ProcurementCommitteeDashboardView.as_view(), name='committee_dashboard'),
    path('technical-officer-dashboard/', TechnicalOfficerDashboardView.as_view(), name='technical_officer_dashboard'),
    path('', include(router.urls)),
]

