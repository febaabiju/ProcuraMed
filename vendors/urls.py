from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SupplierCategoryViewSet,
    VendorApplicationViewSet,
    VendorViewSet,
    VendorDashboardView,
    VendorProfileView
)

router = DefaultRouter()
router.register(r'categories', SupplierCategoryViewSet, basename='supplier-category')
router.register(r'applications', VendorApplicationViewSet, basename='vendor-application')
router.register(r'vendors', VendorViewSet, basename='vendor')

urlpatterns = [
    path('dashboard-stats/', VendorDashboardView.as_view(), name='vendor-dashboard-stats'),
    path('my-profile/', VendorProfileView.as_view(), name='vendor-my-profile'),
    path('', include(router.urls)),
]
