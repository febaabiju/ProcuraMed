import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiReceiptTax,
  HiSearch,
  HiFilter,
  HiRefresh,
  HiCalendar,
  HiCash,
  HiCreditCard,
  HiCheckCircle,
  HiClock,
  HiEye,
  HiX,
  HiExclamationCircle,
  HiOfficeBuilding,
  HiDocumentText,
  HiCheck,
  HiPlus,
  HiShieldCheck,
  HiChevronRight,
  HiArrowRight,
  HiTruck,
  HiShoppingBag,
  HiUserGroup,
  HiClipboardList
} from 'react-icons/hi';
import axiosClient from '../../api/axiosClient';
import PurchaseOfficerLayout from '../../components/layout/PurchaseOfficerLayout';
import Button from '../../components/common/Button';

const PurchaseOfficerInvoicesPage = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, AWAITING_INVOICE, PENDING_VERIFICATION, PARTIALLY_PAID, PAID, COMPLETED
  const [activeTab, setActiveTab] = useState('POS'); // 'POS' | 'INVOICES'

  // Modals
  const [recordInvoicePO, setRecordInvoicePO] = useState(null);
  const [verifyInvoiceModal, setVerifyInvoiceModal] = useState(null);
  const [recordPaymentModal, setRecordPaymentModal] = useState(null);
  const [lifecycleModal, setLifecycleModal] = useState(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleData, setLifecycleData] = useState(null);

  // Record Invoice Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('0.00');
  const [initialVerificationStatus, setInitialVerificationStatus] = useState('PENDING_VERIFICATION');
  const [invoiceRemarks, setInvoiceRemarks] = useState('');
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [formError, setFormError] = useState('');

  // Verify Invoice Form State
  const [verificationStatus, setVerificationStatus] = useState('VERIFIED');
  const [verificationRemarks, setVerificationRemarks] = useState('');
  const [submittingVerify, setSubmittingVerify] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  // Record Payment Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('BANK_TRANSFER');
  const [transactionRef, setTransactionRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [posRes, invsRes] = await Promise.all([
        axiosClient.get('/procurement/purchase-orders/'),
        axiosClient.get('/finance/invoices/')
      ]);
      const posData = posRes.data.results || posRes.data || [];
      const invsData = invsRes.data.results || invsRes.data || [];
      setPurchaseOrders(Array.isArray(posData) ? posData : []);
      setInvoices(Array.isArray(invsData) ? invsData : []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to load invoice and purchase order records. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Metrics
  const metrics = useMemo(() => {
    const totalPOs = purchaseOrders.length;
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;
    let pendingVerificationCount = 0;
    let completedProcurementCount = 0;

    purchaseOrders.forEach(po => {
      const invAmt = parseFloat(po.total_invoiced_amount || 0);
      const paidAmt = parseFloat(po.total_paid_amount || 0);
      const balAmt = parseFloat(po.outstanding_balance || 0);

      totalInvoiced += invAmt;
      totalPaid += paidAmt;
      totalOutstanding += balAmt;

      if (po.invoice_status === 'PENDING_VERIFICATION') {
        pendingVerificationCount += 1;
      }
      if (po.procurement_stage === 'COMPLETED') {
        completedProcurementCount += 1;
      }
    });

    return {
      totalPOs,
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      pendingVerificationCount,
      completedProcurementCount
    };
  }, [purchaseOrders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'COMPLETED' && po.procurement_stage !== 'COMPLETED') return false;
        if (statusFilter === 'AWAITING_INVOICE' && po.invoice_status !== 'NO_INVOICE') return false;
        if (statusFilter === 'PENDING_VERIFICATION' && po.invoice_status !== 'PENDING_VERIFICATION') return false;
        if (statusFilter === 'PARTIALLY_PAID' && po.invoice_status !== 'PARTIALLY_PAID') return false;
        if (statusFilter === 'PAID' && po.invoice_status !== 'PAID') return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const poNum = (po.po_number || '').toLowerCase();
        const reqNum = (po.requisition_details?.req_number || '').toLowerCase();
        const vendorName = (po.vendor_details?.company_name || '').toLowerCase();
        const invNumbers = (po.invoices || []).map(i => (i.invoice_number || '').toLowerCase()).join(' ');

        const match =
          poNum.includes(q) ||
          reqNum.includes(q) ||
          vendorName.includes(q) ||
          invNumbers.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [purchaseOrders, statusFilter, searchQuery]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING_VERIFICATION' && inv.verification_status !== 'PENDING_VERIFICATION') return false;
        if (statusFilter === 'VERIFIED' && inv.verification_status !== 'VERIFIED') return false;
        if (statusFilter === 'PARTIALLY_PAID' && inv.payment_status !== 'PARTIALLY_PAID') return false;
        if (statusFilter === 'PAID' && inv.payment_status !== 'PAID') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const invNum = (inv.invoice_number || '').toLowerCase();
        const poNum = (inv.po_number || '').toLowerCase();
        const vendorName = (inv.vendor_name || '').toLowerCase();

        const match =
          invNum.includes(q) ||
          poNum.includes(q) ||
          vendorName.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  // Open Record Invoice Modal
  const handleOpenRecordInvoice = (po) => {
    setRecordInvoicePO(po);
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    setInvoiceNumber(`INV-${year}-${rand}`);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    const remaining = Math.max(0, parseFloat(po.outstanding_balance || po.total_amount || 0));
    setInvoiceAmount(remaining > 0 ? remaining.toFixed(2) : '');
    setTaxAmount('0.00');
    setInitialVerificationStatus('PENDING_VERIFICATION');
    setInvoiceRemarks('');
    setFormError('');
  };

  // Submit Record Invoice
  const handleSubmitInvoice = async (e) => {
    e.preventDefault();
    if (!recordInvoicePO) return;
    setFormError('');

    const amt = parseFloat(invoiceAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Please enter a valid invoice amount greater than zero.');
      return;
    }

    const remainingBalance = parseFloat(recordInvoicePO.total_amount) - parseFloat(recordInvoicePO.total_invoiced_amount || 0);
    const tax = parseFloat(taxAmount || 0);
    const totalAmt = amt + tax;

    if (totalAmt > remainingBalance + 0.01) {
      setFormError(
        `Invoice amount (${formatCurrency(totalAmt)}) exceeds the remaining purchase order balance (${formatCurrency(remainingBalance)}). Purchase order total is ${formatCurrency(recordInvoicePO.total_amount)}.`
      );
      return;
    }

    setSubmittingInvoice(true);
    try {
      await axiosClient.post('/finance/invoices/', {
        purchase_order: recordInvoicePO.id,
        invoice_number: invoiceNumber.trim(),
        invoice_date: invoiceDate,
        due_date: dueDate || null,
        amount: amt.toFixed(2),
        tax_amount: tax.toFixed(2),
        verification_status: initialVerificationStatus,
        remarks: invoiceRemarks
      });

      setSuccessMessage(`Invoice ${invoiceNumber} recorded successfully for PO ${recordInvoicePO.po_number}.`);
      setRecordInvoicePO(null);
      await fetchData();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setFormError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to record invoice. Please verify invoice number and amounts.'
      );
    } finally {
      setSubmittingInvoice(false);
    }
  };

  // Open Verify Invoice Modal
  const handleOpenVerify = (invoice) => {
    setVerifyInvoiceModal(invoice);
    setVerificationStatus('VERIFIED');
    setVerificationRemarks('');
    setVerifyError('');
  };

  // Submit Verify Invoice
  const handleSubmitVerify = async (e) => {
    e.preventDefault();
    if (!verifyInvoiceModal) return;
    setVerifyError('');
    setSubmittingVerify(true);

    try {
      await axiosClient.post(`/finance/invoices/${verifyInvoiceModal.id}/verify/`, {
        verification_status: verificationStatus,
        verification_remarks: verificationRemarks
      });

      setSuccessMessage(
        `Invoice ${verifyInvoiceModal.invoice_number} has been ${verificationStatus === 'VERIFIED' ? 'verified' : 'rejected'}.`
      );
      setVerifyInvoiceModal(null);
      await fetchData();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setVerifyError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to update verification status. Please check delivery records consistency.'
      );
    } finally {
      setSubmittingVerify(false);
    }
  };

  // Open Record Payment Modal
  const handleOpenRecordPayment = (invoice) => {
    setRecordPaymentModal(invoice);
    const outstanding = parseFloat(invoice.outstanding_balance || invoice.total_amount || 0);
    setPaymentAmount(outstanding > 0 ? outstanding.toFixed(2) : '');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('BANK_TRANSFER');
    setTransactionRef('');
    setPaymentNotes('');
    setPaymentError('');
  };

  // Submit Record Payment
  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!recordPaymentModal) return;
    setPaymentError('');

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }

    const outstanding = parseFloat(recordPaymentModal.outstanding_balance || 0);
    if (amt > outstanding + 0.01) {
      setPaymentError(`Payment amount cannot exceed the outstanding balance of ${formatCurrency(outstanding)}.`);
      return;
    }

    setSubmittingPayment(true);
    try {
      await axiosClient.post(`/finance/invoices/${recordPaymentModal.id}/record-payment/`, {
        amount_paid: amt.toFixed(2),
        payment_date: paymentDate,
        payment_mode: paymentMode,
        transaction_reference: transactionRef.trim(),
        notes: paymentNotes
      });

      setSuccessMessage(`Payment of ${formatCurrency(amt)} recorded for invoice ${recordPaymentModal.invoice_number}.`);
      setRecordPaymentModal(null);
      await fetchData();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setPaymentError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to record payment. Please check amount and invoice verification status.'
      );
    } finally {
      setSubmittingPayment(false);
    }
  };

  // View Procurement Lifecycle History
  const handleOpenLifecycle = async (po) => {
    setLifecycleModal(po);
    setLifecycleLoading(true);
    setLifecycleData(null);
    try {
      const res = await axiosClient.get(`/procurement/purchase-orders/${po.id}/procurement-history/`);
      setLifecycleData(res.data);
    } catch (err) {
      setLifecycleData(null);
    } finally {
      setLifecycleLoading(false);
    }
  };

  // Helper Badge Renderers
  const renderDeliveryBadge = (status) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <HiCheck className="w-3.5 h-3.5" /> Delivered
          </span>
        );
      case 'PARTIALLY_DELIVERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <HiClock className="w-3.5 h-3.5" /> Partially Delivered
          </span>
        );
      case 'DELIVERY_ISSUE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <HiExclamationCircle className="w-3.5 h-3.5" /> Delivery Issue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <HiClock className="w-3.5 h-3.5" /> Awaiting Delivery
          </span>
        );
    }
  };

  const renderInvoiceBadge = (status, paymentStatus) => {
    if (paymentStatus === 'PAID') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <HiCheckCircle className="w-3.5 h-3.5" /> Paid in Full
        </span>
      );
    }
    if (paymentStatus === 'PARTIALLY_PAID') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <HiCash className="w-3.5 h-3.5" /> Partially Paid
        </span>
      );
    }
    if (status === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
          <HiShieldCheck className="w-3.5 h-3.5" /> Verified (Payment Pending)
        </span>
      );
    }
    if (status === 'PENDING_VERIFICATION') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <HiClock className="w-3.5 h-3.5" /> Pending Verification
        </span>
      );
    }
    if (status === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <HiX className="w-3.5 h-3.5" /> Rejected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <HiDocumentText className="w-3.5 h-3.5" /> No Invoice
      </span>
    );
  };

  const renderProcurementStageBadge = (stage) => {
    switch (stage) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm">
            <HiCheckCircle className="w-4 h-4 text-emerald-600" /> Completed
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <HiCash className="w-4 h-4 text-indigo-500" /> Partially Paid
          </span>
        );
      case 'PAYMENT_PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <HiClock className="w-4 h-4 text-amber-500" /> Payment Pending
          </span>
        );
      case 'INVOICE_PENDING_VERIFICATION':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <HiClock className="w-4 h-4 text-amber-500" /> Invoice Verification Pending
          </span>
        );
      case 'AWAITING_INVOICE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <HiDocumentText className="w-4 h-4 text-blue-500" /> Awaiting Invoice
          </span>
        );
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            <HiTruck className="w-4 h-4 text-teal-500" /> Goods Delivered
          </span>
        );
      case 'PARTIALLY_DELIVERED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <HiTruck className="w-4 h-4 text-amber-500" /> In Partial Delivery
          </span>
        );
      case 'DELIVERY_ISSUE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <HiExclamationCircle className="w-4 h-4 text-rose-500" /> Delivery Issue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <HiClock className="w-4 h-4 text-slate-500" /> In Progress
          </span>
        );
    }
  };

  return (
    <PurchaseOfficerLayout
      title="Invoice & Payment Tracking"
      subtitle="Record vendor invoices, perform 3-way matching with deliveries, verify payment clearances, and monitor end-to-end procurement settlement."
      onRefresh={fetchData}
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Success Alert */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3">
              <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-medium text-emerald-800">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage('')}
              className="text-emerald-500 hover:text-emerald-700 p-1"
            >
              <HiX className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Error Alert */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3">
              <HiExclamationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <p className="text-sm font-medium text-rose-800">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="text-rose-500 hover:text-rose-700 p-1"
            >
              <HiX className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* 6 Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Purchase Orders</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <HiShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800">{metrics.totalPOs}</div>
            <p className="text-xs text-slate-400 mt-1">Active Procurement POs</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Invoiced</span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <HiReceiptTax className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-800">{formatCurrency(metrics.totalInvoiced)}</div>
            <p className="text-xs text-slate-400 mt-1">Recorded Vendor Invoices</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Paid</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <HiCreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-emerald-600">{formatCurrency(metrics.totalPaid)}</div>
            <p className="text-xs text-slate-400 mt-1">Processed Payments</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding Balance</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <HiCash className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-rose-600">{formatCurrency(metrics.totalOutstanding)}</div>
            <p className="text-xs text-slate-400 mt-1">Remaining to Settle</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Verification Pending</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <HiClock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600">{metrics.pendingVerificationCount}</div>
            <p className="text-xs text-slate-400 mt-1">Requires 3-Way Match</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Completed Lifecycle</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <HiCheckCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-indigo-600">{metrics.completedProcurementCount}</div>
            <p className="text-xs text-slate-400 mt-1">Delivered & Fully Settled</p>
          </div>
        </div>

        {/* View Switcher Tabs & Filters */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-lg w-full md:w-auto">
              <button
                onClick={() => setActiveTab('POS')}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'POS'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HiShoppingBag className="w-4 h-4" />
                Purchase Orders & Settlement ({purchaseOrders.length})
              </button>
              <button
                onClick={() => setActiveTab('INVOICES')}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'INVOICES'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HiReceiptTax className="w-4 h-4" />
                Individual Vendor Invoices ({invoices.length})
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                icon={HiRefresh}
              >
                Refresh
              </Button>
            </div>
          </div>

          {/* Search Bar & Status Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100">
            <div className="relative flex-1 w-full">
              <HiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder={
                  activeTab === 'POS'
                    ? 'Search by PO number, requisition reference, vendor name, or invoice numbers...'
                    : 'Search by invoice number, PO number, or vendor name...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <HiFilter className="text-slate-400 w-4 h-4 flex-shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="AWAITING_INVOICE">Awaiting Invoice</option>
                <option value="PENDING_VERIFICATION">Pending Verification</option>
                <option value="VERIFIED">Verified</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid in Full</option>
                <option value="COMPLETED">Procurement Completed</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600">Loading invoice and payment tracking data...</p>
          </div>
        ) : activeTab === 'POS' ? (
          /* SECTION 1: Purchase Orders Table */
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Purchase Orders & Settlement Overview</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track vendor invoicing status, 3-way inspection match, payments, and outstanding balances.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                Showing {filteredOrders.length} of {purchaseOrders.length}
              </span>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center">
                <HiReceiptTax className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-semibold text-slate-700 mb-1">No Purchase Orders Found</h4>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'No purchase orders match your search and filter criteria.'
                    : 'No approved purchase orders are currently awaiting invoicing or payment.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4">Purchase Order</th>
                      <th className="py-3.5 px-4">Vendor</th>
                      <th className="py-3.5 px-4">Delivery Status</th>
                      <th className="py-3.5 px-4">Invoice Status</th>
                      <th className="py-3.5 px-4 text-right">PO Total</th>
                      <th className="py-3.5 px-4 text-right">Amount Paid</th>
                      <th className="py-3.5 px-4 text-right">Outstanding Balance</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((po) => {
                      const outstanding = parseFloat(po.outstanding_balance || 0);
                      const isFullySettled = po.procurement_stage === 'COMPLETED' || (outstanding === 0 && parseFloat(po.total_invoiced_amount || 0) > 0);

                      return (
                        <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* PO Number */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">{po.po_number}</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Ordered: {formatDate(po.order_date)}
                            </div>
                            {po.requisition_details?.req_number && (
                              <div className="text-xs text-blue-600 font-mono mt-0.5">
                                Ref: {po.requisition_details.req_number}
                              </div>
                            )}
                          </td>

                          {/* Vendor */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800">
                              {po.vendor_details?.company_name || 'N/A'}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {po.vendor_details?.contact_person || ''}
                            </div>
                            <div className="text-xs text-slate-400">
                              {po.vendor_details?.phone || po.vendor_details?.email || ''}
                            </div>
                          </td>

                          {/* Delivery Status */}
                          <td className="py-3.5 px-4">
                            {renderDeliveryBadge(po.delivery_status)}
                          </td>

                          {/* Invoice Status */}
                          <td className="py-3.5 px-4">
                            {renderInvoiceBadge(po.invoice_status, po.invoice_status === 'PAID' ? 'PAID' : (po.total_paid_amount > 0 ? 'PARTIALLY_PAID' : 'PENDING'))}
                            <div className="mt-1">
                              {renderProcurementStageBadge(po.procurement_stage)}
                            </div>
                          </td>

                          {/* PO Total */}
                          <td className="py-3.5 px-4 text-right font-semibold text-slate-800">
                            {formatCurrency(po.total_amount)}
                          </td>

                          {/* Total Paid */}
                          <td className="py-3.5 px-4 text-right font-semibold text-emerald-600">
                            {formatCurrency(po.total_paid_amount)}
                          </td>

                          {/* Outstanding Balance */}
                          <td className="py-3.5 px-4 text-right">
                            <span
                              className={`font-bold ${
                                outstanding > 0 ? 'text-amber-600' : 'text-slate-400'
                              }`}
                            >
                              {formatCurrency(outstanding)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-2">
                              {/* Record Invoice Action */}
                              <button
                                onClick={() => handleOpenRecordInvoice(po)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1.5 shadow-sm"
                                title="Record Vendor Invoice"
                              >
                                <HiPlus className="w-3.5 h-3.5" />
                                Record Invoice
                              </button>

                              {/* View Details Action (Full Procurement Lifecycle History) */}
                              <button
                                onClick={() => handleOpenLifecycle(po)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors flex items-center gap-1.5"
                                title="View 7-Step Procurement Lifecycle"
                              >
                                <HiEye className="w-3.5 h-3.5 text-slate-500" />
                                View Details
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* SECTION 2: Individual Invoices Table */
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Vendor Invoices Ledger</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verify invoices against delivered stock, record installment payments, and view payment histories.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                Showing {filteredInvoices.length} of {invoices.length}
              </span>
            </div>

            {filteredInvoices.length === 0 ? (
              <div className="p-12 text-center">
                <HiReceiptTax className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="text-base font-semibold text-slate-700 mb-1">No Invoices Found</h4>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'No vendor invoices match your filters.'
                    : 'No invoices have been recorded yet. Click "Record Invoice" on a Purchase Order above.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4">Invoice #</th>
                      <th className="py-3.5 px-4">PO & Vendor</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4 text-right">Invoice Amount</th>
                      <th className="py-3.5 px-4">Verification</th>
                      <th className="py-3.5 px-4">Payment Status</th>
                      <th className="py-3.5 px-4 text-right">Paid / Balance</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.map((inv) => {
                      const outstanding = parseFloat(inv.outstanding_balance || 0);
                      const isVerified = inv.verification_status === 'VERIFIED';
                      const isPaid = inv.payment_status === 'PAID';

                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Invoice Number */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800">{inv.invoice_number}</div>
                            {inv.remarks && (
                              <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                                {inv.remarks}
                              </div>
                            )}
                          </td>

                          {/* PO & Vendor */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-blue-700 font-mono text-xs">
                              {inv.po_number || `PO #${inv.purchase_order}`}
                            </div>
                            <div className="text-xs text-slate-700 font-medium mt-0.5">
                              {inv.vendor_name || 'N/A'}
                            </div>
                          </td>

                          {/* Date */}
                          <td className="py-3.5 px-4 text-xs text-slate-600">
                            <div>{formatDate(inv.invoice_date)}</div>
                            {inv.due_date && (
                              <div className="text-[11px] text-slate-400">Due: {formatDate(inv.due_date)}</div>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                            {formatCurrency(inv.total_amount || inv.amount)}
                          </td>

                          {/* Verification Status */}
                          <td className="py-3.5 px-4">
                            {inv.verification_status === 'VERIFIED' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <HiCheckCircle className="w-3.5 h-3.5" /> Verified
                                </span>
                                {inv.verified_by_details && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    by {inv.verified_by_details.first_name || inv.verified_by_details.username}
                                  </div>
                                )}
                              </div>
                            ) : inv.verification_status === 'REJECTED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                <HiX className="w-3.5 h-3.5" /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <HiClock className="w-3.5 h-3.5" /> Pending Verification
                              </span>
                            )}
                          </td>

                          {/* Payment Status */}
                          <td className="py-3.5 px-4">
                            {inv.payment_status === 'PAID' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <HiCheck className="w-3.5 h-3.5" /> Paid
                              </span>
                            ) : inv.payment_status === 'PARTIALLY_PAID' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                <HiCash className="w-3.5 h-3.5" /> Partially Paid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                <HiClock className="w-3.5 h-3.5" /> Unpaid
                              </span>
                            )}
                          </td>

                          {/* Paid / Outstanding */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="font-semibold text-emerald-600 text-xs">
                              {formatCurrency(inv.total_amount_paid)}
                            </div>
                            <div className={`text-xs font-medium ${outstanding > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                              Bal: {formatCurrency(outstanding)}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-2">
                              {/* Verify Action */}
                              {inv.verification_status === 'PENDING_VERIFICATION' && (
                                <button
                                  onClick={() => handleOpenVerify(inv)}
                                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors flex items-center gap-1"
                                  title="Verify or Reject Invoice"
                                >
                                  <HiShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                                  Verify
                                </button>
                              )}

                              {/* Record Payment Action */}
                              {isVerified && !isPaid && (
                                <button
                                  onClick={() => handleOpenRecordPayment(inv)}
                                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1 shadow-sm"
                                  title="Record Payment"
                                >
                                  <HiCreditCard className="w-3.5 h-3.5 text-emerald-600" />
                                  Record Payment
                                </button>
                              )}

                              {/* View Linked PO Action */}
                              <button
                                onClick={() => {
                                  const poObj = purchaseOrders.find(p => p.id === inv.purchase_order);
                                  if (poObj) handleOpenLifecycle(poObj);
                                }}
                                className="px-2 py-1 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                                title="View History"
                              >
                                History
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MODAL 1: Record Vendor Invoice Modal */}
        <AnimatePresence>
          {recordInvoicePO && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <HiReceiptTax className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Record Vendor Invoice</h3>
                      <p className="text-xs text-slate-500">
                        Link an official invoice to Purchase Order {recordInvoicePO.po_number}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setRecordInvoicePO(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                {formError && (
                  <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                    <HiExclamationCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* PO & Vendor Context Box */}
                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Purchase Order</span>
                    <span className="font-bold text-slate-800 font-mono text-sm">{recordInvoicePO.po_number}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Vendor (Auto-Retrieved)</span>
                    <span className="font-bold text-slate-800">{recordInvoicePO.vendor_details?.company_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Delivery Status</span>
                    <span className="mt-0.5 block">{renderDeliveryBadge(recordInvoicePO.delivery_status)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">PO Contract Value</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(recordInvoicePO.total_amount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Already Invoiced</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(recordInvoicePO.total_invoiced_amount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Remaining Uninvoiced Balance</span>
                    <span className="font-bold text-blue-600">
                      {formatCurrency(
                        Math.max(0, parseFloat(recordInvoicePO.total_amount) - parseFloat(recordInvoicePO.total_invoiced_amount || 0))
                      )}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSubmitInvoice} className="mt-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Invoice Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. INV-2026-0045"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">Must be unique for this vendor</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Invoice Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Invoice Amount (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={invoiceAmount}
                        onChange={(e) => setInvoiceAmount(e.target.value)}
                        className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Tax / GST Amount (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={taxAmount}
                        onChange={(e) => setTaxAmount(e.target.value)}
                        className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Total Amount
                      </label>
                      <div className="w-full text-sm bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-bold">
                        {formatCurrency(
                          (parseFloat(invoiceAmount) || 0) + (parseFloat(taxAmount) || 0)
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Payment Due Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Initial Verification Status
                      </label>
                      <select
                        value={initialVerificationStatus}
                        onChange={(e) => setInitialVerificationStatus(e.target.value)}
                        className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="PENDING_VERIFICATION">Pending Verification (Default)</option>
                        <option value="VERIFIED">Verified (If already matched with delivery)</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Remarks / Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Enter any reference notes, bill attachments, or delivery consignment details..."
                      value={invoiceRemarks}
                      onChange={(e) => setInvoiceRemarks(e.target.value)}
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRecordInvoicePO(null)}
                      disabled={submittingInvoice}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={submittingInvoice}
                      icon={HiCheck}
                    >
                      {submittingInvoice ? 'Recording Invoice...' : 'Save & Record Invoice'}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 2: Verify Invoice Modal */}
        <AnimatePresence>
          {verifyInvoiceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 my-8"
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <HiShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Verify Vendor Invoice</h3>
                      <p className="text-xs text-slate-500">
                        Invoice {verifyInvoiceModal.invoice_number} • {verifyInvoiceModal.vendor_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setVerifyInvoiceModal(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                {verifyError && (
                  <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                    <HiExclamationCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{verifyError}</span>
                  </div>
                )}

                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice Amount:</span>
                    <span className="font-bold text-slate-900">{formatCurrency(verifyInvoiceModal.total_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Purchase Order:</span>
                    <span className="font-mono text-blue-700 font-semibold">{verifyInvoiceModal.po_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice Date:</span>
                    <span className="text-slate-800">{formatDate(verifyInvoiceModal.invoice_date)}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-200">
                    Verification performs 3-way matching with accepted hospital delivery records. Only verified invoices can be cleared for payment.
                  </p>
                </div>

                <form onSubmit={handleSubmitVerify} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                      Verification Decision <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="verificationStatus"
                          value="VERIFIED"
                          checked={verificationStatus === 'VERIFIED'}
                          onChange={() => setVerificationStatus('VERIFIED')}
                          className="text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <HiCheckCircle className="w-4 h-4 text-emerald-600" />
                          Verify & Clear for Payment
                        </div>
                      </label>

                      <label
                        className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                          verificationStatus === 'REJECTED'
                            ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="verificationStatus"
                          value="REJECTED"
                          checked={verificationStatus === 'REJECTED'}
                          onChange={() => setVerificationStatus('REJECTED')}
                          className="text-rose-600 focus:ring-rose-500"
                        />
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <HiX className="w-4 h-4 text-rose-600" />
                          Reject Invoice
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Verification Remarks / Audit Notes
                    </label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Matched against consignment note and hospital store delivery receipt. Quantities inspected and verified."
                      value={verificationRemarks}
                      onChange={(e) => setVerificationRemarks(e.target.value)}
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setVerifyInvoiceModal(null)}
                      disabled={submittingVerify}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant={verificationStatus === 'VERIFIED' ? 'primary' : 'danger'}
                      disabled={submittingVerify}
                    >
                      {submittingVerify
                        ? 'Submitting...'
                        : verificationStatus === 'VERIFIED'
                        ? 'Confirm Verification'
                        : 'Confirm Rejection'}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 3: Record Payment Modal */}
        <AnimatePresence>
          {recordPaymentModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6 my-8"
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <HiCreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Record Vendor Payment</h3>
                      <p className="text-xs text-slate-500">
                        Invoice {recordPaymentModal.invoice_number} • {recordPaymentModal.vendor_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setRecordPaymentModal(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                {paymentError && (
                  <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                    <HiExclamationCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{paymentError}</span>
                  </div>
                )}

                {/* Balances Summary */}
                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block font-medium">Invoice Total</span>
                    <span className="font-bold text-slate-800">{formatCurrency(recordPaymentModal.total_amount)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Total Paid</span>
                    <span className="font-bold text-emerald-600">{formatCurrency(recordPaymentModal.total_amount_paid)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Outstanding</span>
                    <span className="font-bold text-rose-600">{formatCurrency(recordPaymentModal.outstanding_balance)}</span>
                  </div>
                </div>

                <form onSubmit={handleSubmitPayment} className="mt-5 space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Amount Paid In This Transaction (₹) <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(parseFloat(recordPaymentModal.outstanding_balance || 0).toFixed(2))}
                        className="text-[11px] text-blue-600 font-semibold hover:underline"
                      >
                        Pay Full Balance
                      </button>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={parseFloat(recordPaymentModal.outstanding_balance || 0).toFixed(2)}
                      required
                      placeholder="0.00"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full text-base bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                      <span>Cannot exceed outstanding invoice balance</span>
                      <span>
                        Remaining after:{' '}
                        {formatCurrency(
                          Math.max(
                            0,
                            (parseFloat(recordPaymentModal.outstanding_balance) || 0) - (parseFloat(paymentAmount) || 0)
                          )
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Payment Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Payment Mode <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                        <option value="CHEQUE">Cheque / Demand Draft</option>
                        <option value="UPI">UPI</option>
                        <option value="CASH">Cash</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Payment Reference / UTR / Cheque Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. UTR-HDFC-98471203 or CHQ-001294"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Payment Remarks / Voucher Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Settlement installment cleared via hospital central treasury account."
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRecordPaymentModal(null)}
                      disabled={submittingPayment}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={submittingPayment}
                      icon={HiCheck}
                    >
                      {submittingPayment ? 'Recording Payment...' : 'Record Payment Entry'}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 4: 7-Step Procurement Lifecycle History Modal (Requirement 5) */}
        <AnimatePresence>
          {lifecycleModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full p-6 my-8 max-h-[92vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <HiClipboardList className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        Complete Procurement Lifecycle History
                      </h3>
                      <p className="text-xs text-slate-500">
                        End-to-end audit track: Requisition → RFQ & Quotations → Vendor Selection → PO → Delivery → Invoices → Payments
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLifecycleModal(null)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                {lifecycleLoading ? (
                  <div className="p-12 text-center">
                    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs text-slate-500">Loading procurement history trace...</p>
                  </div>
                ) : !lifecycleData ? (
                  <div className="p-8 text-center text-slate-500 text-sm">
                    Unable to load procurement lifecycle data.
                  </div>
                ) : (
                  <div className="mt-5 space-y-6">
                    {/* Lifecycle Summary Banner */}
                    <div className="p-4 rounded-xl bg-gradient-to-r from-slate-50 to-blue-50/40 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs uppercase font-bold tracking-wider text-slate-500">Procurement Status:</span>
                          {renderProcurementStageBadge(lifecycleData.summary?.procurement_stage)}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">
                          PO {lifecycleData.purchase_order?.po_number} • Total Value: {formatCurrency(lifecycleData.summary?.total_po_amount)}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div>
                          <span className="text-slate-400 block font-medium">Invoiced</span>
                          <span className="font-bold text-slate-800">{formatCurrency(lifecycleData.summary?.total_invoiced_amount)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Total Paid</span>
                          <span className="font-bold text-emerald-600">{formatCurrency(lifecycleData.summary?.total_paid_amount)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block font-medium">Outstanding</span>
                          <span className={`font-bold ${parseFloat(lifecycleData.summary?.outstanding_balance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {formatCurrency(lifecycleData.summary?.outstanding_balance)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 7-Step Interactive Visual Flow */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Procurement Milestone Stages (1 to 7)
                      </h4>

                      {/* Step 1: Purchase Request */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                          1
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">1. Purchase Request (Requisition)</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                              {lifecycleData.purchase_request?.status_display || lifecycleData.purchase_request?.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-slate-600">
                            <div><span className="text-slate-400">Requisition #:</span> {lifecycleData.purchase_request?.req_number}</div>
                            <div><span className="text-slate-400">Title:</span> {lifecycleData.purchase_request?.title}</div>
                            <div><span className="text-slate-400">Department:</span> {lifecycleData.purchase_request?.department}</div>
                            <div><span className="text-slate-400">Priority:</span> {lifecycleData.purchase_request?.priority}</div>
                          </div>
                        </div>
                      </div>

                      {/* Step 2: Vendor Quotations */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                          2
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">2. Vendor Quotations & RFQ Sourcing</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700">
                              {lifecycleData.rfq?.quotations_received_count || 0} Quotation(s) Received
                            </span>
                          </div>
                          {lifecycleData.rfq?.quotations?.length > 0 ? (
                            <div className="mt-2 space-y-1.5">
                              {lifecycleData.rfq.quotations.map(q => (
                                <div key={q.id} className="p-2 bg-slate-50 rounded-lg flex items-center justify-between text-[11px]">
                                  <span className="font-semibold text-slate-700">{q.vendor_name} ({q.quotation_number})</span>
                                  <span>Amount: <strong className="text-slate-900">{formatCurrency(q.total_amount)}</strong></span>
                                  <span className="text-slate-400">Lead Time: {q.lead_time_days || 'N/A'} days</span>
                                  <span className="font-medium text-blue-600">{q.status_display}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-400 mt-1 italic">Single source or direct award requisition.</p>
                          )}
                        </div>
                      </div>

                      {/* Step 3: Selected Vendor */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                          3
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">3. Selected Vendor & Committee Decision</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                              Approved Award
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-slate-600">
                            <div><span className="text-slate-400">Awarded To:</span> <strong>{lifecycleData.selected_vendor?.name}</strong></div>
                            <div><span className="text-slate-400">Contact:</span> {lifecycleData.selected_vendor?.contact_person || 'N/A'}</div>
                            <div><span className="text-slate-400">Email:</span> {lifecycleData.selected_vendor?.email || 'N/A'}</div>
                          </div>
                          {lifecycleData.selected_vendor?.selection_remarks && (
                            <div className="mt-2 p-2 bg-slate-50 rounded text-slate-600">
                              <span className="font-semibold text-slate-700">Committee Remarks:</span> {lifecycleData.selected_vendor.selection_remarks}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 4: Purchase Order */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                          4
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">4. Purchase Order Creation & Vendor Acknowledgment</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                              {lifecycleData.purchase_order?.status_display}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-slate-600">
                            <div><span className="text-slate-400">PO Number:</span> <strong className="font-mono text-slate-800">{lifecycleData.purchase_order?.po_number}</strong></div>
                            <div><span className="text-slate-400">Order Date:</span> {formatDate(lifecycleData.purchase_order?.order_date)}</div>
                            <div><span className="text-slate-400">Contract Value:</span> <strong>{formatCurrency(lifecycleData.purchase_order?.total_amount)}</strong></div>
                          </div>
                        </div>
                      </div>

                      {/* Step 5: Deliveries & Hospital Inspection */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                          5
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">5. Hospital Delivery & Physical Inspection</span>
                            {renderDeliveryBadge(lifecycleData.purchase_order?.delivery_status)}
                          </div>
                          {lifecycleData.deliveries?.length > 0 ? (
                            <div className="mt-2 space-y-2">
                              {lifecycleData.deliveries.map(d => (
                                <div key={d.id} className="p-2.5 bg-slate-50 rounded-lg text-[11px] space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-800">{d.delivery_number} (Received: {formatDate(d.delivery_date)})</span>
                                    <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      Inspection: {d.inspection_result_display || d.inspection_result}
                                    </span>
                                  </div>
                                  <div className="text-slate-500">
                                    Items: {d.items?.map(it => `${it.item_name} (Acc: ${it.quantity_accepted}, Rej: ${it.quantity_rejected})`).join('; ')}
                                  </div>
                                  {d.remarks && <div className="text-slate-400">Remarks: {d.remarks}</div>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-400 mt-1 italic">No delivery recorded yet. Awaiting hospital delivery consignment.</p>
                          )}
                        </div>
                      </div>

                      {/* Step 6: Invoices & 3-Way Match Verification */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                          6
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">6. Vendor Invoices & Verification</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                              {lifecycleData.invoices?.length || 0} Invoice(s)
                            </span>
                          </div>
                          {lifecycleData.invoices?.length > 0 ? (
                            <div className="mt-2 space-y-2">
                              {lifecycleData.invoices.map(inv => (
                                <div key={inv.id} className="p-2.5 bg-slate-50 rounded-lg text-[11px] space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-800">{inv.invoice_number} ({formatDate(inv.invoice_date)})</span>
                                    <span className="font-bold text-slate-900">{formatCurrency(inv.total_amount)}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded font-semibold ${
                                      inv.verification_status === 'VERIFIED'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : inv.verification_status === 'REJECTED'
                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                    }`}>
                                      {inv.verification_status_display}
                                    </span>
                                    {inv.verified_by && (
                                      <span className="text-slate-400">Verified by: {inv.verified_by}</span>
                                    )}
                                  </div>
                                  {inv.verification_remarks && (
                                    <div className="text-slate-500">Remarks: {inv.verification_remarks}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-400 mt-1 italic">No invoice recorded yet.</p>
                          )}
                        </div>
                      </div>

                      {/* Step 7: Payment Entries & Final Settlement */}
                      <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                          7
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">7. Payments & Final Procurement Settlement</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                              {lifecycleData.payments?.length || 0} Transaction(s)
                            </span>
                          </div>
                          {lifecycleData.payments?.length > 0 ? (
                            <div className="mt-2 space-y-1.5">
                              {lifecycleData.payments.map(p => (
                                <div key={p.id} className="p-2.5 bg-slate-50 rounded-lg text-[11px] flex items-center justify-between">
                                  <div>
                                    <span className="font-bold text-slate-800">{p.payment_number}</span>
                                    <span className="text-slate-400 ml-2">({p.payment_mode})</span>
                                    {p.transaction_reference && (
                                      <div className="text-slate-500 font-mono text-[10px]">Ref: {p.transaction_reference}</div>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-emerald-600">{formatCurrency(p.amount_paid)}</div>
                                    <div className="text-slate-400 text-[10px]">{formatDate(p.payment_date)}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-slate-400 mt-1 italic">No payment transactions recorded yet.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end">
                  <Button variant="outline" onClick={() => setLifecycleModal(null)}>
                    Close
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PurchaseOfficerLayout>
  );
};

export default PurchaseOfficerInvoicesPage;
