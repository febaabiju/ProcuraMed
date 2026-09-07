from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    InventoryItemViewSet, DeliveryViewSet, VerificationViewSet, StockTransactionViewSet
)

router = DefaultRouter()
router.register(r'items', InventoryItemViewSet, basename='inventoryitem')
router.register(r'deliveries', DeliveryViewSet, basename='delivery')
router.register(r'verifications', VerificationViewSet, basename='verification')
router.register(r'stock-transactions', StockTransactionViewSet, basename='stocktransaction')

urlpatterns = [
    path('', include(router.urls)),
]
