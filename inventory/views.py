from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import InventoryItem, Delivery, DeliveryItem, Verification, StockTransaction
from .serializers import (
    InventoryItemSerializer, DeliverySerializer, DeliveryItemSerializer,
    VerificationSerializer, StockTransactionSerializer
)
from .permissions import IsTechnicalOfficerOrAdmin
from .filters import InventoryItemFilter, DeliveryFilter, VerificationFilter, StockTransactionFilter


class InventoryItemViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.all()
    serializer_class = InventoryItemSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = InventoryItemFilter
    search_fields = ['item_code', 'name', 'category']
    ordering_fields = ['name', 'current_stock', 'unit_price', 'created_at']


class DeliveryViewSet(viewsets.ModelViewSet):
    queryset = Delivery.objects.select_related('purchase_order', 'vendor').prefetch_related('items').all()
    serializer_class = DeliverySerializer
    permission_classes = [IsAuthenticated]
    filterset_class = DeliveryFilter
    search_fields = ['delivery_number', 'tracking_number', 'remarks']
    ordering_fields = ['delivery_date', 'created_at']


class VerificationViewSet(viewsets.ModelViewSet):
    queryset = Verification.objects.select_related('delivery_item', 'verified_by').all()
    serializer_class = VerificationSerializer
    permission_classes = [IsAuthenticated, IsTechnicalOfficerOrAdmin]
    filterset_class = VerificationFilter
    search_fields = ['inspection_notes']
    ordering_fields = ['inspection_date', 'created_at']

    def perform_create(self, serializer):
        serializer.save(verified_by=self.request.user)


class StockTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = StockTransaction.objects.select_related('inventory_item', 'created_by').all()
    serializer_class = StockTransactionSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = StockTransactionFilter
    search_fields = ['inventory_item__name', 'notes']
    ordering_fields = ['created_at']
