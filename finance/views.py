from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Invoice, Payment
from .serializers import InvoiceSerializer, PaymentSerializer
from .permissions import IsFinanceOfficerOrAdmin
from .filters import InvoiceFilter, PaymentFilter


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.select_related('purchase_order', 'vendor').prefetch_related('payments').all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = InvoiceFilter
    search_fields = ['invoice_number', 'remarks']
    ordering_fields = ['invoice_date', 'total_amount', 'created_at']


class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.select_related('invoice', 'processed_by').all()
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, IsFinanceOfficerOrAdmin]
    filterset_class = PaymentFilter
    search_fields = ['payment_number', 'transaction_reference', 'notes']
    ordering_fields = ['payment_date', 'amount_paid', 'created_at']

    def perform_create(self, serializer):
        serializer.save(processed_by=self.request.user)
