from rest_framework import serializers
from .models import (
    Requisition, Approval, QuotationRequest, Quotation, QuotationItem, PurchaseOrder, PurchaseOrderItem
)
from accounts.serializers import UserSerializer, DepartmentSerializer
from vendors.models import Vendor
from vendors.serializers import VendorSerializer


class ApprovalSerializer(serializers.ModelSerializer):
    approved_by_details = UserSerializer(source='approved_by', read_only=True)

    class Meta:
        model = Approval
        fields = ['id', 'requisition', 'approved_by', 'approved_by_details', 'stage', 'status', 'comments', 'created_at', 'updated_at']
        read_only_fields = ['id', 'approved_by', 'created_at', 'updated_at']


class RequisitionSerializer(serializers.ModelSerializer):
    department_details = DepartmentSerializer(source='department', read_only=True)
    requested_by_details = UserSerializer(source='requested_by', read_only=True)
    approvals = ApprovalSerializer(many=True, read_only=True)

    class Meta:
        model = Requisition
        fields = [
            'id', 'req_number', 'title', 'category', 'requires_technical_evaluation',
            'technical_specialization', 'department', 'department_details',
            'requested_by', 'requested_by_details', 'priority', 'estimated_budget',
            'status', 'justification', 'approvals', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'req_number', 'requested_by', 'created_at', 'updated_at']


class QuotationItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotationItem
        fields = ['id', 'quotation', 'item_name', 'specification', 'quantity', 'unit_price', 'total_price', 'created_at', 'updated_at']
        read_only_fields = ['id', 'total_price', 'created_at', 'updated_at']


class QuotationSerializer(serializers.ModelSerializer):
    vendor = serializers.PrimaryKeyRelatedField(
        queryset=Vendor.objects.filter(status=Vendor.StatusChoices.ACTIVE, is_active=True)
    )
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    items = QuotationItemSerializer(many=True, read_only=True)

    class Meta:
        model = Quotation
        fields = [
            'id', 'quotation_number', 'quotation_request', 'vendor', 'vendor_details',
            'submission_date', 'valid_until', 'total_amount', 'lead_time_days',
            'status', 'remarks', 'items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'quotation_number', 'total_amount', 'created_at', 'updated_at']


class QuotationRequestSerializer(serializers.ModelSerializer):
    requisition_details = RequisitionSerializer(source='requisition', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)
    quotations = QuotationSerializer(many=True, read_only=True)

    class Meta:
        model = QuotationRequest
        fields = [
            'id', 'rfq_number', 'requisition', 'requisition_details', 'created_by',
            'created_by_details', 'title', 'issue_date', 'due_date',
            'terms_and_conditions', 'status', 'quotations', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'rfq_number', 'created_by', 'created_at', 'updated_at']


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PurchaseOrderItem
        fields = ['id', 'purchase_order', 'item_name', 'specification', 'quantity', 'unit_price', 'total_price', 'created_at', 'updated_at']
        read_only_fields = ['id', 'total_price', 'created_at', 'updated_at']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    vendor = serializers.PrimaryKeyRelatedField(
        queryset=Vendor.objects.filter(status=Vendor.StatusChoices.ACTIVE, is_active=True)
    )
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)
    items = PurchaseOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'quotation', 'vendor', 'vendor_details',
            'created_by', 'created_by_details', 'total_amount', 'order_date',
            'expected_delivery_date', 'terms_and_conditions', 'status',
            'items', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'po_number', 'created_by', 'created_at', 'updated_at']
