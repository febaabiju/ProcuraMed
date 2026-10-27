import React, { useState, useEffect, useMemo } from 'react';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import Button from '../../components/common/Button';
import axiosClient from '../../api/axiosClient';
import QuotationComparisonModal from '../../components/committee/QuotationComparisonModal';
import QuotationEvaluationModal from '../../components/committee/QuotationEvaluationModal';
import { openSecureDocument } from '../../utils/documentViewer';
import {
  HiDocumentText,
  HiSearch,
  HiRefresh,
  HiInformationCircle,
  HiBadgeCheck,
  HiClock,
  HiTruck,
  HiCurrencyDollar,
  HiExternalLink,
  HiStar,
  HiTag,
  HiClipboardList,
  HiCheckCircle,
  HiEye,
  HiAdjustments,
  HiCalendar,
  HiShieldCheck
} from 'react-icons/hi';

const ProcurementCommitteeQuotationsPage = () => {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  
  // Modals state
  const [comparisonModalData, setComparisonModalData] = useState({
    isOpen: false,
    rfqId: null,
    requisitionId: null
  });

  const [evaluationModalData, setEvaluationModalData] = useState({
    isOpen: false,
    quotation: null
  });

  const fetchQuotations = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/quotations/');
      const data = res.data.results || res.data || [];
      setQuotations(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load received quotations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
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

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = quotations.length;
    const underReview = quotations.filter(q => q.status === 'UNDER_REVIEW').length;
    const selected = quotations.filter(q => q.status === 'SELECTED' || q.status === 'ACCEPTED').length;
    const distinctReqs = new Set(
      quotations.map(q => q.requisition_details?.req_number || q.quotation_request_details?.rfq_number).filter(Boolean)
    ).size;

    return { total, underReview, selected, distinctReqs };
  }, [quotations]);

  // Filtered quotations
  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'SELECTED') {
          if (q.status !== 'SELECTED' && q.status !== 'ACCEPTED') return false;
        } else if (selectedStatus === 'RECOMMENDED') {
          if (q.status !== 'RECOMMENDED' && !q.is_recommended) return false;
        } else if (q.status !== selectedStatus) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const vendorName = (q.vendor_details?.company_name || q.vendor?.company_name || '').toLowerCase();
        const vendorCode = (q.vendor_details?.vendor_code || '').toLowerCase();
        const quoteNumber = (q.quotation_number || '').toLowerCase();
        const rfqNumber = (q.quotation_request_details?.rfq_number || '').toLowerCase();
        const reqNumber = (q.requisition_details?.req_number || '').toLowerCase();
        const itemTitle = (q.requisition_details?.title || q.quotation_request_details?.title || '').toLowerCase();

        return (
          vendorName.includes(query) ||
          vendorCode.includes(query) ||
          quoteNumber.includes(query) ||
          rfqNumber.includes(query) ||
          reqNumber.includes(query) ||
          itemTitle.includes(query)
        );
      }

      return true;
    });
  }, [quotations, selectedStatus, searchQuery]);

  // Group quotations strictly by Purchase Request / RFQ
  const groupedQuotations = useMemo(() => {
    const groups = {};
    filteredQuotations.forEach(quote => {
      const key = quote.quotation_request || quote.quotation_request_details?.id || 'unassigned';
      if (!groups[key]) {
        groups[key] = {
          rfqId: quote.quotation_request || quote.quotation_request_details?.id,
          rfqNumber: quote.quotation_request_details?.rfq_number || 'Direct RFQ',
          rfqTitle: quote.quotation_request_details?.title || 'Quotation Request',
          reqDetails: quote.requisition_details || {},
          quotations: []
        };
      }
      groups[key].quotations.push(quote);
    });
    return Object.values(groups);
  }, [filteredQuotations]);

  const handleOpenComparison = (rfqId, requisitionId) => {
    setComparisonModalData({
      isOpen: true,
      rfqId,
      requisitionId
    });
  };

  const handleOpenEvaluation = (quote) => {
    setEvaluationModalData({
      isOpen: true,
      quotation: quote
    });
  };

  return (
    <ProcurementCommitteeLayout
      title="Quotation Review & Vendor Selection"
      subtitle="Review vendor quotations, compare proposals side-by-side, and confirm vendor selection for assigned purchase requests."
      onRefresh={fetchQuotations}
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
              onClick={fetchQuotations}
              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* 1. Header Banner */}
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-violet-950 via-purple-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-violet-500/30 text-violet-200 border border-violet-400/30 flex items-center gap-1.5">
                  <HiDocumentText className="w-3.5 h-3.5" />
                  Procurement Committee Review
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                  <HiBadgeCheck className="w-3.5 h-3.5" />
                  Assigned Requests Only
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Quotation Review &amp; Vendor Selection
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Examine received vendor quotations, compare pricing, specifications, and delivery timelines, review signed PDFs,
                and record justified vendor selections to seamlessly transfer approved bids to the Purchase Officer.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={fetchQuotations}
                disabled={loading}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold gap-2 backdrop-blur-xs"
              >
                <HiRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Bids</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Received Bids
              </span>
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                <HiDocumentText className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900">{metrics.total}</h3>
              <p className="text-xs text-violet-600 font-semibold mt-0.5">
                Submitted by invited vendors
              </p>
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Under Review
              </span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <HiClock className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-blue-600">{metrics.underReview}</h3>
              <p className="text-xs text-blue-700 font-semibold mt-0.5">
                Evaluation in progress
              </p>
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Vendor Selections Confirmed
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <HiBadgeCheck className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-emerald-600">{metrics.selected}</h3>
              <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                Selected &amp; sent to Purchase Officer
              </p>
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Purchase Requests Covered
              </span>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <HiClipboardList className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-800">{metrics.distinctReqs}</h3>
              <p className="text-xs text-purple-700 font-semibold mt-0.5">
                Requests with active bids
              </p>
            </div>
          </div>
        </div>

        {/* 3. Search & Filters Bar */}
        <div className="p-4 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <HiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vendor, quote #, PR #, or item..."
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
              { id: 'ALL', label: 'All Quotations' },
              { id: 'SUBMITTED', label: 'Received' },
              { id: 'UNDER_REVIEW', label: 'Under Review' },
              { id: 'SELECTED', label: 'Vendor Selected' },
              { id: 'NOT_SELECTED', label: 'Not Selected' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedStatus === tab.id
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Quotations Display (Grouped Strictly by Purchase Request) */}
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-3 bg-white rounded-3xl border border-violet-100">
            <HiRefresh className="w-8 h-8 animate-spin text-violet-600" />
            <span>Loading received vendor quotations...</span>
          </div>
        ) : groupedQuotations.length === 0 ? (
          <div className="p-12 text-center space-y-3 bg-white rounded-3xl border border-violet-100 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-400 flex items-center justify-center mx-auto">
              <HiDocumentText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Received Quotations Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery || selectedStatus !== 'ALL'
                ? 'No vendor quotations match your current search and filter criteria.'
                : 'There are currently no vendor quotations awaiting review for the purchase requests assigned to you.'}
            </p>
            {(searchQuery || selectedStatus !== 'ALL') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedStatus('ALL');
                }}
                className="text-xs"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {groupedQuotations.map((group) => {
              const req = group.reqDetails;
              const hasVendorSelected = group.quotations.some(q => q.status === 'SELECTED' || q.status === 'ACCEPTED');
              const selectedQuote = group.quotations.find(q => q.status === 'SELECTED' || q.status === 'ACCEPTED');

              return (
                <div
                  key={group.rfqId || group.rfqNumber}
                  className="bg-white rounded-3xl border border-violet-100 shadow-sm overflow-hidden"
                >
                  {/* RFQ / Purchase Request Section Header */}
                  <div className="px-6 py-5 bg-gradient-to-r from-violet-50/90 via-purple-50/40 to-white border-b border-violet-100/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5 max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        {req.id && (
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-900 text-white">
                            PR ID: #{req.id}
                          </span>
                        )}
                        {req.req_number && (
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-violet-100 text-violet-800 border border-violet-200">
                            Ref: {req.req_number}
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-semibold bg-white border border-slate-200 text-slate-700">
                          RFQ: {group.rfqNumber}
                        </span>
                        {req.department_name && (
                          <span className="text-xs text-slate-600 font-bold">
                            Dept: {req.department_name}
                          </span>
                        )}
                        {hasVendorSelected ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                            <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            Vendor Selected: {selectedQuote?.vendor_details?.company_name || 'Confirmed'}
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
                            <HiClock className="w-3.5 h-3.5 text-purple-600" />
                            Awaiting Committee Selection
                          </span>
                        )}
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        {req.title || group.rfqTitle}
                      </h3>

                      {/* Items, Specs, Quantity, and Budget details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 text-xs text-slate-600">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Requested Items</span>
                          <span className="font-semibold text-slate-800">
                            {req.item_name || req.title} (Qty: {req.quantity || 1} units)
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Specifications</span>
                          <span className="text-slate-600 truncate block max-w-xs">
                            {req.specifications || 'Hospital standard specifications'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Estimated Budget</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatCurrency(req.estimated_budget)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Compare & Select Vendor Action */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenComparison(group.rfqId, req.id)}
                        className="bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs gap-1.5 shadow-sm py-2 px-4"
                      >
                        <HiAdjustments className="w-4 h-4" />
                        <span>Compare &amp; Select Vendor ({group.quotations.length})</span>
                      </Button>
                    </div>
                  </div>

                  {/* Individual Quotation Cards strictly for this Purchase Request */}
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {group.quotations.map((quote) => {
                      const vendor = quote.vendor_details || quote.vendor || {};
                      const isSelected = quote.status === 'SELECTED' || quote.status === 'ACCEPTED';
                      const isNotSelected = quote.status === 'NOT_SELECTED';
                      const isUnderReview = quote.status === 'UNDER_REVIEW';

                      return (
                        <div
                          key={quote.id}
                          className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                            isSelected
                              ? 'border-emerald-300 bg-emerald-50/20 ring-2 ring-emerald-400/40'
                              : isNotSelected
                              ? 'border-slate-200 bg-slate-50/50 opacity-80'
                              : isUnderReview
                              ? 'border-blue-200 bg-blue-50/10'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          {/* Card Top: Vendor info & status badge */}
                          <div className="p-5 border-b border-slate-100 bg-white space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-extrabold text-slate-900 text-sm leading-snug">
                                  {vendor.company_name || 'Vendor'}
                                </h4>
                                <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                                  {vendor.vendor_code || 'VEN-CODE'} • {quote.quotation_number}
                                </p>
                              </div>

                              {vendor.performance_rating && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 flex-shrink-0">
                                  <HiStar className="w-3 h-3 text-amber-500" />
                                  {vendor.performance_rating}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                isSelected
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : isNotSelected
                                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                                  : isUnderReview
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : 'bg-amber-100 text-amber-800 border-amber-200'
                              }`}>
                                {quote.status_display || quote.status}
                              </span>

                              {isSelected && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1 shadow-xs">
                                  <HiCheckCircle className="w-3 h-3" />
                                  Selected Winner
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Middle: Price, delivery, dates */}
                          <div className="p-5 space-y-3.5 text-xs">
                            {/* Total Price */}
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Quoted Amount</span>
                                <span className="text-lg font-black text-slate-900 font-mono">
                                  {formatCurrency(quote.total_amount)}
                                </span>
                              </div>
                              <div className="text-right text-[10px] text-slate-500 space-y-0.5">
                                <div>Lead: {quote.lead_time_days ? `${quote.lead_time_days} Days` : 'N/A'}</div>
                                <div>Tax: {quote.tax_percentage ? `${quote.tax_percentage}%` : 'Included'}</div>
                              </div>
                            </div>

                            {/* Submission Date & Lead Time */}
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Submission Date</span>
                                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                                  <HiCalendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  {formatDate(quote.submission_date || quote.created_at)}
                                </span>
                              </div>
                              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Delivery Lead Time</span>
                                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                                  <HiTruck className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                  {quote.lead_time_days ? `${quote.lead_time_days} Days` : 'Not specified'}
                                </span>
                              </div>
                            </div>

                            {/* Vendor Contact details */}
                            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 space-y-0.5">
                              {vendor.contact_person && (
                                <div className="truncate">Contact: <strong className="text-slate-800">{vendor.contact_person}</strong></div>
                              )}
                              {vendor.email && (
                                <div className="truncate">Email: {vendor.email}</div>
                              )}
                              {vendor.phone && (
                                <div>Phone: {vendor.phone}</div>
                              )}
                            </div>

                            {/* Signed PDF Button */}
                            {quote.quotation_document_url ? (
                              <button
                                type="button"
                                onClick={() => openSecureDocument(quote.quotation_document_url, `Quotation_${quote.quotation_number}.pdf`)}
                                className="w-full py-2 px-3 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold text-xs border border-violet-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                              >
                                <HiDocumentText className="w-4 h-4" />
                                <span>Open Signed Quotation PDF</span>
                                <HiExternalLink className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic block text-center py-1">
                                No signed PDF attached
                              </span>
                            )}
                          </div>

                          {/* Card Footer: Compare & Evaluate */}
                          <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenEvaluation(quote)}
                              className="w-1/2 text-xs font-semibold gap-1"
                            >
                              <HiEye className="w-3.5 h-3.5" />
                              <span>Evaluate</span>
                            </Button>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenComparison(group.rfqId, req.id)}
                              className="w-1/2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs gap-1"
                            >
                              <HiCheckCircle className="w-3.5 h-3.5" />
                              <span>Select Vendor</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 5. Modals */}
        <QuotationComparisonModal
          isOpen={comparisonModalData.isOpen}
          onClose={() => setComparisonModalData({ isOpen: false, rfqId: null, requisitionId: null })}
          rfqId={comparisonModalData.rfqId}
          requisitionId={comparisonModalData.requisitionId}
          onVendorSelected={fetchQuotations}
        />

        <QuotationEvaluationModal
          isOpen={evaluationModalData.isOpen}
          onClose={() => setEvaluationModalData({ isOpen: false, quotation: null })}
          quotation={evaluationModalData.quotation}
          onQuotationUpdated={fetchQuotations}
        />
      </div>
    </ProcurementCommitteeLayout>
  );
};

export default ProcurementCommitteeQuotationsPage;
