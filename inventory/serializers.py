from rest_framework import serializers
from .models import InventoryItem, Delivery, DeliveryItem, Verification, StockTransaction
from procurement.serializers import PurchaseOrderSerializer, PurchaseOrderItemSerializer
from vendors.serializers import VendorSerializer
from accounts.serializers import UserSerializer


class InventoryItemSerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(source='is_low_stock', read_only=True)

    class Meta:
        model = InventoryItem
        fields = [
            'id', 'item_code', 'name', 'category', 'unit_of_measure',
            'current_stock', 'reorder_level', 'unit_price', 'is_low_stock',
            'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class DeliveryItemSerializer(serializers.ModelSerializer):
    po_item_details = PurchaseOrderItemSerializer(source='po_item', read_only=True)

    class Meta:
        model = DeliveryItem
        fields = ['id', 'delivery', 'po_item', 'po_item_details', 'quantity_delivered', 'remarks', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class DeliverySerializer(serializers.ModelSerializer):
    po_details = PurchaseOrderSerializer(source='purchase_order', read_only=True)
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    items = DeliveryItemSerializer(many=True, read_only=True)

    class Meta:
        model = Delivery
        fields = [
            'id', 'delivery_number', 'purchase_order', 'po_details',
            'vendor', 'vendor_details', 'tracking_number', 'delivery_date',
            'status', 'remarks', 'items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'delivery_number', 'created_at', 'updated_at']


class VerificationSerializer(serializers.ModelSerializer):
    verified_by_details = UserSerializer(source='verified_by', read_only=True)
    delivery_item_details = DeliveryItemSerializer(source='delivery_item', read_only=True)

    class Meta:
        model = Verification
        fields = [
            'id', 'delivery_item', 'delivery_item_details', 'verified_by',
            'verified_by_details', 'accepted_quantity', 'rejected_quantity',
            'status', 'inspection_notes', 'inspection_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'verified_by', 'created_at', 'updated_at']


class StockTransactionSerializer(serializers.ModelSerializer):
    inventory_item_details = InventoryItemSerializer(source='inventory_item', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)

    class Meta:
        model = StockTransaction
        fields = [
            'id', 'inventory_item', 'inventory_item_details', 'transaction_type',
            'quantity', 'reference_type', 'reference_id', 'created_by',
            'created_by_details', 'notes', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']
