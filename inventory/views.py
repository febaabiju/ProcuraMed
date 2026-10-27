from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from accounts.models import AuditLog
from procurement.models import PurchaseOrder, PurchaseOrderItem
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


def process_record_delivery(user, data, po=None):
    """
    Core business logic to record a delivery batch for a Purchase Order.
    Enforces Purchase Officer / Admin permissions, verifies item remaining quantities,
    detects damages/rejections as DELIVERY_ISSUE, creates Delivery and DeliveryItem records atomically,
    and updates the Purchase Order delivery status.
    """
    # 1. Permission check: Only authorized Purchase Officers or Admins can record hospital receipt
    r_name = user.role.name.lower() if user.role else ''
    is_po = ('purchase' in r_name or 'purchase officer' in r_name) and not ('staff' in r_name)
    is_admin = user.is_superuser or user.is_staff or 'admin' in r_name
    if not (is_po or is_admin):
        return None, Response(
            {'detail': 'Only authorized Purchase Officers and Administrators can record deliveries.'},
            status=status.HTTP_403_FORBIDDEN
        )

    # 2. Resolve Purchase Order
    if po is None:
        po_id = data.get('purchase_order') or data.get('purchase_order_id') or data.get('po_id')
        if not po_id:
            return None, Response(
                {'detail': 'Purchase Order ID is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            po = PurchaseOrder.objects.get(pk=po_id)
        except PurchaseOrder.DoesNotExist:
            return None, Response(
                {'detail': f'Purchase Order {po_id} does not exist.'},
                status=status.HTTP_404_NOT_FOUND
            )

    # 3. Validate items
    items_data = data.get('items', [])
    if not items_data or not isinstance(items_data, list):
        return None, Response(
            {'detail': 'At least one delivery item must be provided with positive received quantity.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    validated_items = []
    has_damage_or_rejection = False

    for idx, item_input in enumerate(items_data):
        po_item_id = item_input.get('po_item') or item_input.get('po_item_id') or item_input.get('id')
        if not po_item_id:
            return None, Response(
                {'detail': f'Item at index {idx} is missing purchase order item reference.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            po_item = po.items.get(pk=po_item_id)
        except PurchaseOrderItem.DoesNotExist:
            return None, Response(
                {'detail': f"Purchase Order item ID {po_item_id} does not belong to PO {po.po_number}."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            qty_delivered = int(item_input.get('quantity_delivered') or item_input.get('quantity') or 0)
        except (ValueError, TypeError):
            return None, Response(
                {'detail': f"Received quantity for '{po_item.item_name}' must be a valid integer."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if qty_delivered <= 0:
            return None, Response(
                {'detail': f"Received quantity for '{po_item.item_name}' must be greater than zero. Negative or zero quantities are not permitted."},
                status=status.HTTP_400_BAD_REQUEST
            )

        remaining = po_item.remaining_quantity
        if qty_delivered > remaining:
            return None, Response(
                {'detail': f"Received quantity ({qty_delivered}) exceeds remaining order quantity ({remaining}) for item '{po_item.item_name}'. Excessive quantities are not permitted."},
                status=status.HTTP_400_BAD_REQUEST
            )

        cond = str(item_input.get('condition', 'SATISFACTORY')).upper().strip()
        if cond not in ['SATISFACTORY', 'DAMAGED', 'REJECTED', 'INCOMPLETE']:
            cond = 'SATISFACTORY'

        qty_accepted = item_input.get('quantity_accepted')
        qty_rejected = item_input.get('quantity_rejected')

        if cond in ['DAMAGED', 'REJECTED']:
            has_damage_or_rejection = True
            qty_rejected = qty_delivered if qty_rejected is None else int(qty_rejected)
            qty_accepted = 0 if qty_accepted is None else int(qty_accepted)
        else:
            qty_accepted = qty_delivered if qty_accepted is None else int(qty_accepted)
            qty_rejected = 0 if qty_rejected is None else int(qty_rejected)
            if qty_rejected > 0:
                has_damage_or_rejection = True

        item_remarks = item_input.get('remarks', '')

        validated_items.append({
            'po_item': po_item,
            'quantity_delivered': qty_delivered,
            'quantity_accepted': qty_accepted,
            'quantity_rejected': qty_rejected,
            'condition': cond,
            'remarks': item_remarks,
        })

    # 4. Resolve delivery inspection result & status
    input_inspection = str(data.get('inspection_result', 'PASSED')).upper().strip()
    if input_inspection not in ['PASSED', 'PARTIALLY_ACCEPTED', 'DAMAGED', 'REJECTED', 'DELIVERY_ISSUE']:
        input_inspection = 'PASSED'

    if has_damage_or_rejection:
        final_inspection = 'DELIVERY_ISSUE' if input_inspection in ['PASSED', 'PARTIALLY_ACCEPTED'] else input_inspection
        delivery_status = Delivery.StatusChoices.DELIVERY_ISSUE
    else:
        final_inspection = input_inspection
        delivery_status = Delivery.StatusChoices.DELIVERED

    delivery_date = data.get('delivery_date') or timezone.now().date()
    tracking_number = data.get('tracking_number') or po.vendor_tracking_number or ''
    inspection_notes = data.get('inspection_notes', '')
    delivery_issue_details = data.get('delivery_issue_details', '')
    if has_damage_or_rejection and not delivery_issue_details:
        delivery_issue_details = f"Issue recorded on {delivery_date}: damaged or rejected items received."
    remarks = data.get('remarks', '')

    with transaction.atomic():
        delivery = Delivery.objects.create(
            purchase_order=po,
            vendor=po.vendor,
            delivery_date=delivery_date,
            status=delivery_status,
            recorded_by=user,
            inspection_result=final_inspection,
            inspection_notes=inspection_notes,
            delivery_issue_details=delivery_issue_details,
            tracking_number=tracking_number,
            remarks=remarks
        )

        for vit in validated_items:
            DeliveryItem.objects.create(
                delivery=delivery,
                po_item=vit['po_item'],
                quantity_delivered=vit['quantity_delivered'],
                quantity_accepted=vit['quantity_accepted'],
                quantity_rejected=vit['quantity_rejected'],
                condition=vit['condition'],
                remarks=vit['remarks']
            )

        po.update_delivery_status()

        AuditLog.objects.create(
            user=user,
            action='Delivery Recorded',
            module='Purchase Officer',
            description=(
                f"Purchase Officer @{user.username} recorded delivery {delivery.delivery_number} "
                f"for PO {po.po_number}. Result: {final_inspection}. PO delivery status updated to {po.delivery_status}."
            )
        )

    return delivery, None


class DeliveryViewSet(viewsets.ModelViewSet):
    queryset = Delivery.objects.select_related('purchase_order', 'vendor', 'recorded_by').prefetch_related('items', 'items__po_item').all()
    serializer_class = DeliverySerializer
    permission_classes = [IsAuthenticated]
    filterset_class = DeliveryFilter
    search_fields = ['delivery_number', 'tracking_number', 'remarks']
    ordering_fields = ['delivery_date', 'created_at']

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Delivery.objects.none()

        qs = Delivery.objects.select_related(
            'purchase_order', 'vendor', 'recorded_by'
        ).prefetch_related('items', 'items__po_item')

        r_name = user.role.name.lower() if user.role else ''
        is_admin = user.is_superuser or user.is_staff or 'admin' in r_name
        is_po = ('purchase' in r_name or 'purchase officer' in r_name) and not ('staff' in r_name)
        is_vendor = 'vendor' in r_name or hasattr(user, 'vendor_profile')

        if is_admin or is_po:
            return qs.order_by('-created_at')
        elif is_vendor:
            from vendors.models import Vendor
            vendor = getattr(user, 'vendor_profile', None) or Vendor.objects.filter(user=user).first()
            if not vendor:
                return Delivery.objects.none()
            return qs.filter(vendor=vendor).order_by('-created_at')

        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        delivery, err_response = process_record_delivery(request.user, request.data)
        if err_response:
            return err_response
        serializer = self.get_serializer(delivery)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


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
