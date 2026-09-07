from rest_framework import serializers
from .models import Invoice, Payment
from procurement.serializers import PurchaseOrderSerializer
from vendors.serializers import VendorSerializer
from accounts.serializers import UserSerializer


class PaymentSerializer(serializers.ModelSerializer):
    processed_by_details = UserSerializer(source='processed_by', read_only=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'payment_number', 'invoice', 'amount_paid', 'payment_mode',
            'transaction_reference', 'payment_date', 'processed_by',
            'processed_by_details', 'status', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'payment_number', 'processed_by', 'created_at', 'updated_at']


class InvoiceSerializer(serializers.ModelSerializer):
    po_details = PurchaseOrderSerializer(source='purchase_order', read_only=True)
    vendor_details = VendorSerializer(source='vendor', read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'purchase_order', 'po_details',
            'vendor', 'vendor_details', 'amount', 'tax_amount', 'total_amount',
            'invoice_date', 'due_date', 'status', 'remarks', 'payments',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'invoice_number', 'created_at', 'updated_at']
