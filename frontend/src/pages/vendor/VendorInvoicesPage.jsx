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
  HiShoppingBag,
  HiDocumentText,
  HiCheck,
  HiPlus,
  HiShieldCheck,
  HiPaperClip,
  HiExternalLink,
  HiOutlineDownload,
  HiDocumentDownload,
  HiChevronRight
} from 'react-icons/hi';
import axiosClient from '../../api/axiosClient';
import VendorLayout from '../../components/layout/VendorLayout';
import Button from '../../components/common/Button';
import { openSecureDocument } from '../../utils/documentViewer';

const VendorInvoicesPage = () => {
  const [invoices, setInvoices] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, PENDING_VERIFICATION, VERIFIED, REJECTED, PARTIALLY_PAID, PAID

  // Modals
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [selectedInvoiceDetails, setSelectedInvoiceDetails] = useState(null);

  // Submit Invoice Form State
  const [selectedPoId, setSelectedPoId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('0.00');
  const [invoiceRemarks, setInvoiceRemarks] = useState('');
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [invsRes, posRes] = await Promise.all([
        axiosClient.get('/finance/invoices/'),
        axiosClient.get('/procurement/purchase-orders/')
      ]);
      const invsData = invsRes.data.results || invsRes.data || [];
      const posData = posRes.data.results || posRes.data || [];
      setInvoices(Array.isArray(invsData) ? invsData : []);
      setPurchaseOrders(Array.isArray(posData) ? posData : []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to load invoices and purchase orders. Please try again.'
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
    const totalCount = invoices.length;
    let totalInvoiced = 0;
    let totalReceived = 0;
    let totalOutstanding = 0;
    let pendingVerification = 0;
    let verifiedCount = 0;

    invoices.forEach(inv => {
      const amt = parseFloat(inv.total_amount || inv.amount || 0);
      const paid = parseFloat(inv.total_amount_paid || 0);
      const bal = parseFloat(inv.outstanding_balance || 0);

      totalInvoiced += amt;
      totalReceived += paid;
      totalOutstanding += bal;

      if (inv.verification_status === 'PENDING_VERIFICATION') {
        pendingVerification += 1;
      }
      if (inv.verification_status === 'VERIFIED') {
        verifiedCount += 1;
      }
    });

    return {
      totalCount,
      totalInvoiced,
      totalReceived,
      totalOutstanding,
      pendingVerification,
      verifiedCount
    };
  }, [invoices]);

  // Selected PO calculation
  const selectedPO = useMemo(() => {
    if (!selectedPoId) return null;
    return purchaseOrders.find(p => String(p.id) === String(selectedPoId)) || null;
  }, [selectedPoId, purchaseOrders]);

  const selectedPORemaining = useMemo(() => {
    if (!selectedPO) return 0;
    const contract = parseFloat(selectedPO.total_amount || 0);
    const invoiced = parseFloat(selectedPO.total_invoiced_amount || 0);
    return Math.max(0, contract - invoiced);
  }, [selectedPO]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING_VERIFICATION' && inv.verification_status !== 'PENDING_VERIFICATION') return false;
        if (statusFilter === 'VERIFIED' && inv.verification_status !== 'VERIFIED') return false;
        if (statusFilter === 'REJECTED' && inv.verification_status !== 'REJECTED') return false;
        if (statusFilter === 'PARTIALLY_PAID' && inv.payment_status !== 'PARTIALLY_PAID') return false;
        if (statusFilter === 'PAID' && inv.payment_status !== 'PAID') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const invNum = (inv.invoice_number || '').toLowerCase();
        const poNum = (inv.po_number || '').toLowerCase();
        const remarks = (inv.remarks || '').toLowerCase();

        const match = invNum.includes(q) || poNum.includes(q) || remarks.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  // Open Submit Invoice Modal
  const handleOpenSubmit = () => {
    setFormError('');
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    setInvoiceNumber(`INV-${year}-${rand}`);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setInvoiceRemarks('');
    setInvoiceFile(null);

    // Pick first active PO if available
    if (purchaseOrders.length > 0) {
      setSelectedPoId(purchaseOrders[0].id);
      const rem = Math.max(0, parseFloat(purchaseOrders[0].total_amount) - parseFloat(purchaseOrders[0].total_invoiced_amount || 0));
      setInvoiceAmount(rem > 0 ? rem.toFixed(2) : '');
    } else {
      setSelectedPoId('');
      setInvoiceAmount('');
    }
    setTaxAmount('0.00');
    setSubmitModalOpen(true);
  };

  // Change selected PO in modal
  const handlePoChange = (poId) => {
    setSelectedPoId(poId);
    const po = purchaseOrders.find(p => String(p.id) === String(poId));
    if (po) {
      const rem = Math.max(0, parseFloat(po.total_amount) - parseFloat(po.total_invoiced_amount || 0));
      setInvoiceAmount(rem > 0 ? rem.toFixed(2) : '');
    }
  };

  // Submit Invoice Form
  const handleSubmitInvoice = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedPO) {
      setFormError('Please select a valid purchase order.');
      return;
    }

    const amt = parseFloat(invoiceAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError('Invoice amount must be greater than zero.');
      return;
    }

    const tax = parseFloat(taxAmount || 0);
    const totalAmt = amt + tax;

    if (totalAmt > selectedPORemaining + 0.01) {
      setFormError(
        `Total invoice amount (${formatCurrency(totalAmt)}) exceeds your remaining contract balance of ${formatCurrency(selectedPORemaining)} on Purchase Order ${selectedPO.po_number}.`
      );
      return;
    }

    setSubmittingInvoice(true);
    try {
      const formData = new FormData();
      formData.append('purchase_order', selectedPO.id);
      formData.append('invoice_number', invoiceNumber.trim());
      formData.append('invoice_date', invoiceDate);
      if (dueDate) formData.append('due_date', dueDate);
      formData.append('amount', amt.toFixed(2));
      formData.append('tax_amount', tax.toFixed(2));
      formData.append('remarks', invoiceRemarks);
      if (invoiceFile) {
        formData.append('invoice_document', invoiceFile);
      }

      await axiosClient.post('/finance/invoices/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccessMessage(`Invoice ${invoiceNumber} submitted successfully! It is now queued for hospital verification.`);
      setSubmitModalOpen(false);
      await fetchData();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setFormError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to submit invoice. Please check the invoice number and amounts.'
      );
    } finally {
      setSubmittingInvoice(false);
    }
  };

  // Open Document Viewer
  const handleViewDocument = async (docUrl) => {
    if (!docUrl) return;
    try {
      await openSecureDocument(docUrl, 'invoice_document.pdf');
    } catch (e) {
      window.open(docUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Render Verification Badge
  const renderVerificationBadge = (status) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <HiCheckCircle className="w-3.5 h-3.5" /> Verified
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <HiX className="w-3.5 h-3.5" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <HiClock className="w-3.5 h-3.5" /> Pending Verification
          </span>
        );
    }
  };

  // Render Payment Badge
  const renderPaymentBadge = (status) => {
    switch (status) {
      case 'PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <HiCheck className="w-3.5 h-3.5" /> Paid in Full
          </span>
        );
      case 'PARTIALLY_PAID':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <HiCash className="w-3.5 h-3.5" /> Partially Paid
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <HiClock className="w-3.5 h-3.5" /> Pending Payment
          </span>
        );
    }
  };

  return (
    <VendorLayout
      title="Invoices & Settlements"
      subtitle="Submit official invoices against your awarded hospital purchase orders, upload bills, and track approval and payment statuses."
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
            <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-emerald-700 p-1">
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
            <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 p-1">
              <HiX className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Top 5 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Invoices Submitted</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <HiReceiptTax className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800">{metrics.totalCount}</div>
            <p className="text-xs text-slate-400 mt-1">Recorded Vendor Bills</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Billed</span>
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                <HiDocumentText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-slate-800">{formatCurrency(metrics.totalInvoiced)}</div>
            <p className="text-xs text-slate-400 mt-1">Gross Invoiced Value</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payments Received</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <HiCreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-emerald-600">{formatCurrency(metrics.totalReceived)}</div>
            <p className="text-xs text-slate-400 mt-1">Settled by Hospital</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Verification</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <HiClock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-amber-600">{metrics.pendingVerification}</div>
            <p className="text-xs text-slate-400 mt-1">Under Hospital Review</p>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Receivable Balance</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <HiCash className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-bold text-rose-600">{formatCurrency(metrics.totalOutstanding)}</div>
            <p className="text-xs text-slate-400 mt-1">Outstanding Hospital Payment</p>
          </div>
        </div>

        {/* Action Header & Filter Controls */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Submitted Invoices Ledger</h3>
              <p className="text-xs text-slate-500">
                View your submitted invoices, verification outcomes, payment vouchers, and outstanding balances.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button
                variant="primary"
                onClick={handleOpenSubmit}
                icon={HiPlus}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm"
              >
                Submit New Invoice
              </Button>
            </div>
          </div>

          {/* Search Bar & Status Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100">
            <div className="relative flex-1 w-full">
              <HiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by invoice number, PO number, or remarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                <option value="PENDING_VERIFICATION">Pending Verification</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid in Full</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-600">Loading your invoices...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-sm">
            <HiReceiptTax className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-semibold text-slate-700 mb-1">No Invoices Found</h4>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-5">
              {searchQuery || statusFilter !== 'ALL'
                ? 'No invoices match your selected filters.'
                : 'You have not submitted any invoices yet. Click below to submit an invoice against an issued purchase order.'}
            </p>
            {purchaseOrders.length > 0 && (
              <Button variant="primary" onClick={handleOpenSubmit} icon={HiPlus}>
                Submit Your First Invoice
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Purchase Order</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4 text-right">Invoice Amount</th>
                    <th className="py-3.5 px-4">Verification Status</th>
                    <th className="py-3.5 px-4">Payment Status</th>
                    <th className="py-3.5 px-4 text-right">Amount Received</th>
                    <th className="py-3.5 px-4 text-right">Outstanding</th>
                    <th className="py-3.5 px-4 text-center">Document & Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((inv) => {
                    const outstanding = parseFloat(inv.outstanding_balance || 0);
                    const hasDoc = Boolean(inv.invoice_document_url || inv.invoice_document);

                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Invoice Number */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 font-mono">{inv.invoice_number}</div>
                          {inv.remarks && (
                            <div className="text-xs text-slate-400 mt-0.5 line-clamp-1">{inv.remarks}</div>
                          )}
                        </td>

                        {/* PO Number */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-blue-700 font-mono text-xs">
                            {inv.po_number || `PO #${inv.purchase_order}`}
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
                          {renderVerificationBadge(inv.verification_status)}
                          {inv.verification_remarks && (
                            <div className="text-[11px] text-slate-500 mt-1 line-clamp-1 italic">
                              "{inv.verification_remarks}"
                            </div>
                          )}
                        </td>

                        {/* Payment Status */}
                        <td className="py-3.5 px-4">
                          {renderPaymentBadge(inv.payment_status)}
                        </td>

                        {/* Amount Received */}
                        <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 text-xs">
                          {formatCurrency(inv.total_amount_paid)}
                        </td>

                        {/* Outstanding */}
                        <td className="py-3.5 px-4 text-right">
                          <span className={`text-xs font-bold ${outstanding > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {formatCurrency(outstanding)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {hasDoc && (
                              <button
                                onClick={() => handleViewDocument(inv.invoice_document_url)}
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors"
                                title="View / Download Invoice Document"
                              >
                                <HiDocumentDownload className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => setSelectedInvoiceDetails(inv)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors flex items-center gap-1"
                            >
                              <HiEye className="w-3.5 h-3.5 text-slate-500" />
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL 1: Submit Invoice Modal */}
        <AnimatePresence>
          {submitModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 my-8 max-h-[92vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <HiReceiptTax className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">Submit Invoice for Hospital Order</h3>
                      <p className="text-xs text-slate-500">
                        Select an awarded purchase order and submit your official vendor invoice.
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSubmitModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                {formError && (
                  <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                    <HiExclamationCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <form onSubmit={handleSubmitInvoice} className="mt-4 space-y-4">
                  {/* Select Purchase Order */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Linked Purchase Order <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={selectedPoId}
                      onChange={(e) => handlePoChange(e.target.value)}
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Select an Issued Purchase Order</option>
                      {purchaseOrders.map((po) => {
                        const rem = Math.max(0, parseFloat(po.total_amount) - parseFloat(po.total_invoiced_amount || 0));
                        return (
                          <option key={po.id} value={po.id}>
                            {po.po_number} — Total: {formatCurrency(po.total_amount)} (Available to Bill: {formatCurrency(rem)})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Selected PO Summary Card */}
                  {selectedPO && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block font-medium">Order Date</span>
                        <span className="font-semibold text-slate-800">{formatDate(selectedPO.order_date)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Contract Total</span>
                        <span className="font-bold text-slate-800">{formatCurrency(selectedPO.total_amount)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Already Invoiced</span>
                        <span className="font-semibold text-slate-800">{formatCurrency(selectedPO.total_invoiced_amount)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Available Balance</span>
                        <span className="font-bold text-blue-600">{formatCurrency(selectedPORemaining)}</span>
                      </div>
                    </div>
                  )}

                  {/* Invoice Number & Date */}
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
                        className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
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

                  {/* Amounts */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Invoice Amount (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={selectedPORemaining > 0 ? selectedPORemaining.toFixed(2) : undefined}
                        required
                        placeholder="0.00"
                        value={invoiceAmount}
                        onChange={(e) => setInvoiceAmount(e.target.value)}
                        className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Tax / GST (₹)
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
                        Total Payable (₹)
                      </label>
                      <div className="w-full text-sm bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-bold">
                        {formatCurrency(
                          (parseFloat(invoiceAmount) || 0) + (parseFloat(taxAmount) || 0)
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Due Date & File Upload */}
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
                        Upload Invoice Document (PDF / Image)
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        onChange={(e) => setInvoiceFile(e.target.files[0] || null)}
                        className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-300 rounded-lg p-1.5"
                      />
                    </div>
                  </div>

                  {/* Remarks */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Remarks / Reference Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Delivery consignment reference, courier LR number, or banking payment details..."
                      value={invoiceRemarks}
                      onChange={(e) => setInvoiceRemarks(e.target.value)}
                      className="w-full text-sm bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setSubmitModalOpen(false)} disabled={submittingInvoice}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" disabled={submittingInvoice} icon={HiCheck}>
                      {submittingInvoice ? 'Submitting Invoice...' : 'Submit Invoice to Hospital'}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL 2: View Details & Payments Modal */}
        <AnimatePresence>
          {selectedInvoiceDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 my-8"
              >
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <HiReceiptTax className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        Invoice {selectedInvoiceDetails.invoice_number}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Purchase Order {selectedInvoiceDetails.po_number}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedInvoiceDetails(null)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-4 text-xs">
                  {/* Statuses Banner */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 block font-medium">Verification Status</span>
                      <div className="mt-1">{renderVerificationBadge(selectedInvoiceDetails.verification_status)}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block font-medium">Payment Status</span>
                      <div className="mt-1">{renderPaymentBadge(selectedInvoiceDetails.payment_status)}</div>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg">
                    <div>
                      <span className="text-slate-400 block font-medium">Invoice Total</span>
                      <span className="font-bold text-slate-800 text-sm">{formatCurrency(selectedInvoiceDetails.total_amount)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Amount Received</span>
                      <span className="font-bold text-emerald-600 text-sm">{formatCurrency(selectedInvoiceDetails.total_amount_paid)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Outstanding</span>
                      <span className="font-bold text-rose-600 text-sm">{formatCurrency(selectedInvoiceDetails.outstanding_balance)}</span>
                    </div>
                  </div>

                  {/* Verification Remarks if any */}
                  {selectedInvoiceDetails.verification_remarks && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                      <span className="font-bold block">Hospital Verification Remarks:</span>
                      <p className="mt-0.5">{selectedInvoiceDetails.verification_remarks}</p>
                    </div>
                  )}

                  {/* Payment Records History */}
                  <div>
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2">
                      Payment Transaction History ({selectedInvoiceDetails.payments?.length || 0})
                    </h4>
                    {selectedInvoiceDetails.payments?.length > 0 ? (
                      <div className="space-y-2">
                        {selectedInvoiceDetails.payments.map((p) => (
                          <div key={p.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                            <div>
                              <div className="font-bold text-slate-800">{p.payment_number}</div>
                              <div className="text-slate-500 text-[11px] mt-0.5">
                                Mode: {p.payment_mode_display || p.payment_mode} {p.transaction_reference && `• Ref: ${p.transaction_reference}`}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-600">{formatCurrency(p.amount_paid)}</div>
                              <div className="text-slate-400 text-[10px]">{formatDate(p.payment_date)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">No payments have been recorded for this invoice yet.</p>
                    )}
                  </div>

                  {/* Attached Document */}
                  {selectedInvoiceDetails.invoice_document_url && (
                    <div className="pt-2">
                      <button
                        onClick={() => handleViewDocument(selectedInvoiceDetails.invoice_document_url)}
                        className="w-full py-2 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold border border-blue-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <HiDocumentDownload className="w-4 h-4" />
                        View Attached Invoice Document
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end">
                  <Button variant="outline" onClick={() => setSelectedInvoiceDetails(null)}>
                    Close
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </VendorLayout>
  );
};

export default VendorInvoicesPage;
