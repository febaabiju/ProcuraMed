import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PurchaseOfficerLayout from '../../components/layout/PurchaseOfficerLayout';
import Button from '../../components/common/Button';
import axiosClient from '../../api/axiosClient';
import { openSecureDocument } from '../../utils/documentViewer';
import {
  HiBadgeCheck,
  HiShoppingBag,
  HiClipboardList,
  HiDocumentText,
  HiSearch,
  HiRefresh,
  HiInformationCircle,
  HiClock,
  HiTruck,
  HiCurrencyDollar,
  HiExternalLink,
  HiUser,
  HiMail,
  HiPhone,
  HiCheckCircle,
  HiX,
  HiExclamationCircle,
  HiCalendar,
  HiOfficeBuilding,
  HiTag
} from 'react-icons/hi';

const PurchaseOfficerApprovedSelectionsPage = () => {
  const [selections, setSelections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('AWAITING_PO'); // 'ALL' | 'AWAITING_PO' | 'PO_CREATED'

  // Create PO Modal state
  const [selectedForPO, setSelectedForPO] = useState(null);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [customTotalAmount, setCustomTotalAmount] = useState('');
  const [submittingPO, setSubmittingPO] = useState(false);
  const [poModalError, setPoModalError] = useState('');
  const [poSuccessMessage, setPoSuccessMessage] = useState('');

  const fetchSelections = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/requisitions/approved-vendor-selections/');
      const data = res.data.results || res.data || [];
      setSelections(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load approved vendor selections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSelections();
  }, []);

  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = selections.length;
    const awaitingPO = selections.filter(s => !s.has_purchase_order && s.status !== 'PO_CREATED').length;
    const poCreated = selections.filter(s => s.has_purchase_order || s.status === 'PO_CREATED').length;
    const totalAmount = selections.reduce((acc, s) => {
      const amt = parseFloat(s.selected_quotation_details?.total_amount || 0);
      return acc + (isNaN(amt) ? 0 : amt);
    }, 0);

    return { total, awaitingPO, poCreated, totalAmount };
  }, [selections]);

  // Filtered selections
  const filteredSelections = useMemo(() => {
    return selections.filter((sel) => {
      const isPOCreated = sel.has_purchase_order || sel.status === 'PO_CREATED';

      if (statusFilter === 'AWAITING_PO' && isPOCreated) return false;
      if (statusFilter === 'PO_CREATED' && !isPOCreated) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const reqNum = (sel.req_number || '').toLowerCase();
        const vendorName = (sel.selected_vendor_details?.company_name || '').toLowerCase();
        const quoteNum = (sel.selected_quotation_details?.quotation_number || '').toLowerCase();
        const dept = (sel.department_details?.name || '').toLowerCase();
        const title = (sel.title || '').toLowerCase();

        return (
          reqNum.includes(query) ||
          vendorName.includes(query) ||
          quoteNum.includes(query) ||
          dept.includes(query) ||
          title.includes(query)
        );
      }

      return true;
    });
  }, [selections, statusFilter, searchQuery]);

  const handleOpenCreatePO = (sel) => {
    setSelectedForPO(sel);
    setPoModalError('');
    setPoSuccessMessage('');

    // Pre-calculate expected delivery date if lead time is present
    const leadDays = sel.selected_quotation_details?.lead_time_days;
    if (leadDays && Number(leadDays) > 0) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + Number(leadDays));
      setExpectedDeliveryDate(targetDate.toISOString().split('T')[0]);
    } else {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 14);
      setExpectedDeliveryDate(defaultDate.toISOString().split('T')[0]);
    }

    // Default terms & conditions
    setTermsAndConditions(
      `1. Delivery Location: Central Hospital Biomedical Store, Receiving Bay A.\n` +
      `2. Inspection: Supplies are subject to physical inspection and technical acceptance.\n` +
      `3. Payment Terms: Payment within 30 days of complete delivery and certification of satisfactory installation.\n` +
      `4. Warranty & Support: Supplier shall honor full comprehensive warranty per approved quotation.`
    );

    setCustomTotalAmount(sel.selected_quotation_details?.total_amount || '');
  };

  const handleConfirmCreatePO = async () => {
    if (!selectedForPO) return;

    if (!expectedDeliveryDate) {
      setPoModalError('Expected delivery date is required.');
      return;
    }

    setSubmittingPO(true);
    setPoModalError('');

    try {
      const payload = {
        requisition: selectedForPO.id,
        quotation: selectedForPO.selected_quotation,
        vendor: selectedForPO.selected_vendor,
        expected_delivery_date: expectedDeliveryDate,
        terms_and_conditions: termsAndConditions.trim(),
        total_amount: customTotalAmount
      };

      const res = await axiosClient.post('/procurement/purchase-orders/', payload);

      setPoSuccessMessage(
        `Purchase Order ${res.data.po_number} created successfully! Procurement workflow updated.`
      );
      setSelectedForPO(null);
      await fetchSelections();
    } catch (err) {
      setPoModalError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to generate Purchase Order. Please review the inputs and retry.'
      );
    } finally {
      setSubmittingPO(false);
    }
  };

  return (
    <PurchaseOfficerLayout
      title="Approved Vendor Selections"
      subtitle="Review Procurement Committee approved vendor selections and generate official Purchase Orders."
      onRefresh={fetchSelections}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Error notification */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchSelections}
              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Global Success Banner */}
        {poSuccessMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{poSuccessMessage}</span>
            </div>
            <button
              onClick={() => setPoSuccessMessage('')}
              className="text-xs text-emerald-600 hover:text-emerald-800 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 1. Header Banner */}
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-violet-950 via-purple-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                  <HiBadgeCheck className="w-3.5 h-3.5" />
                  Committee Approved Selections
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-violet-500/30 text-violet-200 border border-violet-400/30 flex items-center gap-1.5">
                  <HiShoppingBag className="w-3.5 h-3.5" />
                  PO Issuance Queue
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Approved Vendor Selections
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Review vendor selections officially approved and justified by the Procurement Committee.
                Access original signed quotation documents and generate formal Purchase Orders to proceed with procurement contracting.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={fetchSelections}
                disabled={loading}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold gap-2 backdrop-blur-xs"
              >
                <HiRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Selections</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Selections
              </span>
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                <HiBadgeCheck className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900">{metrics.total}</h3>
              <p className="text-xs text-violet-600 font-semibold mt-0.5">
                Committee approved bids
              </p>
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Awaiting Purchase Order
              </span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <HiClock className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-amber-600">{metrics.awaitingPO}</h3>
              <p className="text-xs text-amber-700 font-semibold mt-0.5">
                Ready for PO creation
              </p>
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Purchase Orders Created
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <HiShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-emerald-600">{metrics.poCreated}</h3>
              <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                Contracted and ordered
              </p>
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Approved Value
              </span>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <HiCurrencyDollar className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 font-mono">
                {formatCurrency(metrics.totalAmount)}
              </h3>
              <p className="text-xs text-purple-700 font-semibold mt-0.5">
                Cumulative selected amount
              </p>
            </div>
          </div>
        </div>

        {/* 3. Search & Filter Bar */}
        <div className="p-4 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <HiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vendor, PR #, quotation #, or item..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {[
              { id: 'AWAITING_PO', label: `Awaiting PO (${metrics.awaitingPO})` },
              { id: 'PO_CREATED', label: `PO Created (${metrics.poCreated})` },
              { id: 'ALL', label: `All Approved (${metrics.total})` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-violet-700 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Approved Vendor Selections List */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-3 bg-white rounded-3xl border border-violet-100">
            <HiRefresh className="w-8 h-8 animate-spin text-violet-600" />
            <span>Loading approved vendor selections from database...</span>
          </div>
        ) : filteredSelections.length === 0 ? (
          <div className="p-12 text-center space-y-3 bg-white rounded-3xl border border-violet-100 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-400 flex items-center justify-center mx-auto">
              <HiBadgeCheck className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Approved Vendor Selections Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery || statusFilter !== 'ALL'
                ? 'No vendor selections match your current filter and search query.'
                : 'There are currently no approved vendor selections awaiting purchase order creation.'}
            </p>
            {(searchQuery || statusFilter !== 'ALL') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
                className="text-xs"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredSelections.map((sel) => {
              const vendor = sel.selected_vendor_details || {};
              const quote = sel.selected_quotation_details || {};
              const isPOCreated = sel.has_purchase_order || sel.status === 'PO_CREATED';

              return (
                <div
                  key={sel.id}
                  className="bg-white rounded-3xl border border-violet-100 shadow-sm overflow-hidden transition-all hover:shadow-md"
                >
                  {/* Card Header */}
                  <div className="px-6 py-4 bg-gradient-to-r from-violet-50/80 via-purple-50/30 to-white border-b border-violet-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-900 text-white">
                          PR ID: #{sel.id}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-violet-100 text-violet-800 border border-violet-200">
                          Ref: {sel.req_number}
                        </span>
                        {sel.department_details?.name && (
                          <span className="text-xs text-slate-600 font-bold">
                            • Dept: {sel.department_details.name}
                          </span>
                        )}
                        {sel.category && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                            <HiTag className="w-3.5 h-3.5 text-violet-500" />
                            {sel.category}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                        {sel.title}
                      </h3>
                    </div>

                    {/* Status Badge & Create PO Action */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {isPOCreated ? (
                        <div className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 shadow-xs">
                          <HiCheckCircle className="w-4 h-4 text-emerald-600" />
                          <span>PO Created: {sel.purchase_order_number || 'Issued'}</span>
                        </div>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenCreatePO(sel)}
                          className="bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs gap-1.5 py-2 px-4 shadow-sm"
                        >
                          <HiShoppingBag className="w-4 h-4" />
                          <span>Create Purchase Order</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Card Body Grid */}
                  <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Selected Vendor & Contact Details */}
                    <div className="space-y-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Selected Vendor</span>
                        <HiOfficeBuilding className="w-4 h-4 text-violet-600" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">
                          {vendor.company_name || 'Vendor Company'}
                        </h4>
                        <span className="font-mono text-[10px] text-slate-500">
                          Code: {vendor.vendor_code || 'VEN-CODE'}
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-1 text-[11px] text-slate-600">
                        {vendor.contact_person && (
                          <div className="flex items-center gap-2 truncate">
                            <HiUser className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="font-medium truncate">{vendor.contact_person}</span>
                          </div>
                        )}
                        {vendor.email && (
                          <div className="flex items-center gap-2 truncate">
                            <HiMail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{vendor.email}</span>
                          </div>
                        )}
                        {vendor.phone && (
                          <div className="flex items-center gap-2 truncate">
                            <HiPhone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{vendor.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Center: Approved Quotation & Quoted Amount */}
                    <div className="space-y-3 p-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-xs flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between pb-2 border-b border-purple-200/60">
                          <span className="text-[10px] font-bold text-purple-700 uppercase">
                            Approved Quotation &amp; Pricing
                          </span>
                          <span className="font-mono font-bold text-purple-900 text-xs">
                            {quote.quotation_number || 'QT-REFERENCE'}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">
                            Approved Total Amount
                          </span>
                          <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                            {formatCurrency(quote.total_amount)}
                          </div>
                          <span className="text-[11px] text-slate-500 block pt-0.5">
                            Lead Time: <strong>{quote.lead_time_days ? `${quote.lead_time_days} Days` : 'N/A'}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Quotation PDF Link */}
                      {quote.quotation_document_url ? (
                        <button
                          type="button"
                          onClick={() => openSecureDocument(quote.quotation_document_url, `Quotation_${quote.quotation_number}.pdf`)}
                          className="w-full py-2 px-3 rounded-xl bg-white hover:bg-violet-50 text-violet-700 font-bold text-xs border border-violet-200 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                        >
                          <HiDocumentText className="w-4 h-4" />
                          <span>View Original Signed Quotation PDF</span>
                          <HiExternalLink className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic block text-center py-1">
                          No quotation PDF attached
                        </span>
                      )}
                    </div>

                    {/* Right: Committee Decision Remarks & Authorized Approver */}
                    <div className="space-y-3 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 text-xs flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Committee Decision Audit</span>
                          <HiBadgeCheck className="w-4 h-4 text-emerald-600" />
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Decision Remarks / Justification</span>
                          <p className="text-slate-800 text-[11px] italic bg-white p-2.5 rounded-xl border border-slate-200/60 leading-relaxed mt-0.5">
                            "{sel.vendor_selection_remarks || 'Vendor evaluated and approved by Procurement Committee.'}"
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 pt-1 border-t border-slate-200">
                        <div>
                          <span className="font-bold block uppercase text-slate-400">Decision Date</span>
                          <span className="font-semibold text-slate-700">{formatDate(sel.vendor_selected_at)}</span>
                        </div>
                        <div>
                          <span className="font-bold block uppercase text-slate-400">Decision-Maker</span>
                          <span className="font-semibold text-slate-700 truncate block">
                            {sel.vendor_selected_by_name || 'Committee Lead'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: Line Items & Requisition Justification */}
                  <div className="px-6 py-3.5 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-600">
                    <div className="flex flex-wrap items-center gap-3">
                      <span>
                        Department Justification: <strong className="text-slate-800">{sel.justification || 'Hospital requirement.'}</strong>
                      </span>
                    </div>
                    {sel.items && sel.items.length > 0 && (
                      <div className="text-[11px] text-slate-500">
                        Items: {sel.items.map(it => `${it.item_name} (Qty: ${it.quantity})`).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. Create Purchase Order Modal */}
        <AnimatePresence>
          {selectedForPO && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-violet-100 overflow-hidden my-auto"
              >
                {/* Modal Header */}
                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-violet-900 to-purple-900 text-white flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-violet-200 block">
                      Purchase Order Management
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      Create Official Purchase Order
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedForPO(null)}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Form Body */}
                <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                  {poModalError && (
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <HiExclamationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                      <span>{poModalError}</span>
                    </div>
                  )}

                  {/* Summary of Approved Selection */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Purchase Requisition</span>
                        <span className="font-bold text-slate-900 font-mono text-sm">
                          {selectedForPO.req_number}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate block">{selectedForPO.title}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Selected Vendor</span>
                        <span className="font-bold text-slate-900 text-sm truncate block">
                          {selectedForPO.selected_vendor_details?.company_name}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {selectedForPO.selected_vendor_details?.vendor_code}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Approved Quotation</span>
                        <span className="font-bold text-violet-800 font-mono">
                          {selectedForPO.selected_quotation_details?.quotation_number}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Committee Decision By</span>
                        <span className="font-semibold text-slate-700">
                          {selectedForPO.vendor_selected_by_name || 'Committee'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Decision Date</span>
                        <span className="font-semibold text-slate-700">
                          {formatDate(selectedForPO.vendor_selected_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expected Delivery Date Field */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 block">
                      Expected Delivery Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                    />
                  </div>

                  {/* Order Total Amount Field */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 block">
                      Total Order Amount (₹) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={customTotalAmount}
                      onChange={(e) => setCustomTotalAmount(e.target.value)}
                      placeholder="Enter verified total order amount"
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:ring-2 focus:ring-violet-500 focus:outline-none"
                    />
                  </div>

                  {/* Terms and Conditions Field */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 block">
                      Purchase Order Terms &amp; Conditions
                    </label>
                    <textarea
                      rows={4}
                      value={termsAndConditions}
                      onChange={(e) => setTermsAndConditions(e.target.value)}
                      placeholder="Specify contractual terms, delivery point, payment conditions..."
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>

                  {/* Warning Notice */}
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                    <HiInformationCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>
                      Generating this Purchase Order will lock this procurement decision and update the purchase request status to <strong>PO Created</strong>.
                      Duplicate POs for this requisition are strictly prevented.
                    </span>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedForPO(null)}
                    disabled={submittingPO}
                    className="text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleConfirmCreatePO}
                    disabled={submittingPO}
                    className="bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs gap-1.5 shadow-sm"
                  >
                    {submittingPO ? (
                      <>
                        <HiRefresh className="w-4 h-4 animate-spin" />
                        <span>Generating PO...</span>
                      </>
                    ) : (
                      <>
                        <HiShoppingBag className="w-4 h-4" />
                        <span>Generate Purchase Order</span>
                      </>
                    )}
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

export default PurchaseOfficerApprovedSelectionsPage;
