from decimal import Decimal
from rest_framework import serializers
from .models import Invoice, Payment
from procurement.serializers import PurchaseOrderSerializer
from vendors.serializers import VendorSerializer
from accounts.serializers import UserSerializer
from vendors.models import Vendor


class PaymentSerializer(serializers.ModelSerializer):
    processed_by_details = UserSerializer(source='processed_by', read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    purchase_order_number = serializers.CharField(source='invoice.purchase_order.po_number', read_only=True)
    vendor_name = serializers.CharField(source='invoice.vendor.company_name', read_only=True)
    payment_mode_display = serializers.CharField(source='get_payment_mode_display', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'payment_number', 'invoice', 'invoice_number',
            'purchase_order_number', 'vendor_name', 'amount_paid',
            'payment_mode', 'payment_mode_display', 'transaction_reference',
            'payment_date', 'processed_by', 'processed_by_details',
            'status', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'payment_number', 'processed_by', 'created_at', 'updated_at']


class InvoiceSerializer(serializers.ModelSerializer):
    po_details = PurchaseOrderSerializer(source='purchase_order', read_only=True)
    vendor = serializers.PrimaryKeyRelatedField(queryset=Vendor.objects.all(), required=False, allow_null=True)
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    vendor_name = serializers.CharField(source='vendor.company_name', read_only=True)
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    verification_status_display = serializers.CharField(source='get_verification_status_display', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)
    verified_by_details = UserSerializer(source='verified_by', read_only=True)
    recorded_by_details = UserSerializer(source='recorded_by', read_only=True)
    total_amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    outstanding_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'purchase_order', 'po_number', 'po_details',
            'vendor', 'vendor_name', 'vendor_details', 'amount', 'tax_amount', 'total_amount',
            'invoice_date', 'due_date', 'status', 'verification_status', 'verification_status_display',
            'payment_status', 'payment_status_display', 'verification_remarks',
            'verified_by', 'verified_by_details', 'verified_at',
            'recorded_by', 'recorded_by_details',
            'remarks', 'total_amount_paid', 'outstanding_balance', 'payments',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'total_amount', 'status', 'payment_status',
            'verified_by', 'verified_at', 'recorded_by', 'created_at', 'updated_at'
        ]
