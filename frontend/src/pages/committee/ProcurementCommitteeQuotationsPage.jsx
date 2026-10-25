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
  HiViewGrid,
  HiViewList
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
    const recommended = quotations.filter(q => q.status === 'RECOMMENDED' || q.is_recommended).length;
    const distinctReqs = new Set(
      quotations.map(q => q.requisition_details?.req_number || q.quotation_request_details?.rfq_number).filter(Boolean)
    ).size;

    return { total, underReview, recommended, distinctReqs };
  }, [quotations]);

  // Filtered quotations
  const filteredQuotations = useMemo(() => {
    return quotations.filter(q => {
      // Status filter
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'RECOMMENDED') {
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

  // Group quotations by RFQ / Purchase Request for structured comparison
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
      title="Received Vendor Quotations"
      subtitle="Review, analyze, and recommend vendor bids for purchase requests assigned to you."
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
                  Committee Bid Review
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                  <HiBadgeCheck className="w-3.5 h-3.5" />
                  Assigned Requests Only
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Vendor Quotations Evaluation
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                Examine technical compliance, commercial offers, delivery lead times, and official vendor documents.
                Compare bids side-by-side and submit recommendations for committee approval without automated contract awards.
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
                <span>Refresh Quotations</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Quotations
              </span>
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                <HiDocumentText className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900">{metrics.total}</h3>
              <p className="text-xs text-violet-600 font-semibold mt-0.5">
                Received across assigned PRs
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
                Recommended Bids
              </span>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <HiBadgeCheck className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-purple-700">{metrics.recommended}</h3>
              <p className="text-xs text-purple-700 font-semibold mt-0.5">
                Endorsed for committee sanction
              </p>
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Covered Requests
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <HiClipboardList className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-800">{metrics.distinctReqs}</h3>
              <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                Assigned PRs with quotes
              </p>
            </div>
          </div>
        </div>

        {/* 3. Search and Filter Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-violet-100 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
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
              { id: 'RECOMMENDED', label: 'Recommended' },
              { id: 'ACCEPTED', label: 'Accepted' },
              { id: 'REJECTED', label: 'Rejected' }
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

        {/* 4. Quotations Display (Grouped by RFQ / PR) */}
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
                : 'There are currently no vendor quotations submitted for the purchase requests assigned to you.'}
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
              return (
                <div
                  key={group.rfqId || group.rfqNumber}
                  className="bg-white rounded-3xl border border-violet-100 shadow-sm overflow-hidden"
                >
                  {/* RFQ / Purchase Request Section Header */}
                  <div className="px-6 py-4 bg-gradient-to-r from-violet-50/90 via-purple-50/40 to-white border-b border-violet-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-violet-600 text-white">
                          RFQ: {group.rfqNumber}
                        </span>
                        {req.req_number && (
                          <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-semibold bg-white border border-violet-200 text-violet-800">
                            PR: {req.req_number}
                          </span>
                        )}
                        {req.category && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                            <HiTag className="w-3.5 h-3.5 text-violet-500" />
                            {req.category}
                          </span>
                        )}
                        {req.department_name && (
                          <span className="text-xs text-slate-500 font-medium">
                            • {req.department_name}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                        {req.title || group.rfqTitle}
                      </h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-0.5">
                        {req.estimated_budget && (
                          <span>
                            Est. Budget: <strong className="text-slate-800">{formatCurrency(req.estimated_budget)}</strong>
                          </span>
                        )}
                        {req.item_name && (
                          <span>
                            Item: <strong className="text-slate-800">{req.item_name}</strong> (Qty: {req.quantity || 1})
                          </span>
                        )}
                        <span className="text-violet-700 font-bold">
                          {group.quotations.length} Quotation{group.quotations.length === 1 ? '' : 's'} Received
                        </span>
                      </div>
                    </div>

                    {/* Compare Bids Button for this RFQ */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenComparison(group.rfqId, req.id)}
                        className="bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs gap-1.5 shadow-xs"
                      >
                        <HiAdjustments className="w-4 h-4" />
                        <span>Compare Bids ({group.quotations.length})</span>
                      </Button>
                    </div>
                  </div>

                  {/* Individual Quotation Cards inside this Group */}
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {group.quotations.map((quote) => {
                      const vendor = quote.vendor_details || quote.vendor || {};
                      const isRecommended = quote.is_recommended || quote.status === 'RECOMMENDED';

                      return (
                        <div
                          key={quote.id}
                          className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                            isRecommended
                              ? 'border-purple-300 bg-purple-50/20 ring-2 ring-purple-400/40'
                              : quote.status === 'ACCEPTED'
                              ? 'border-emerald-200 bg-emerald-50/10'
                              : quote.status === 'REJECTED'
                              ? 'border-rose-200 bg-rose-50/10 opacity-80'
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
                                quote.status === 'RECOMMENDED'
                                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                                  : quote.status === 'ACCEPTED'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : quote.status === 'UNDER_REVIEW'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : quote.status === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                                  : 'bg-amber-100 text-amber-800 border-amber-200'
                              }`}>
                                {quote.status_display || quote.status}
                              </span>

                              {isRecommended && (
                                <span className="px-2 py-0.5 rounded-full bg-purple-700 text-white text-[10px] font-black flex items-center gap-1">
                                  <HiBadgeCheck className="w-3 h-3" />
                                  Recommended Bid
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Middle: Price, delivery, dates */}
                          <div className="p-5 space-y-3.5 text-xs">
                            {/* Total Price */}
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Quoted</span>
                                <span className="text-lg font-black text-slate-900 font-mono">
                                  {formatCurrency(quote.total_amount)}
                                </span>
                              </div>
                              <div className="text-right text-[10px] text-slate-500 space-y-0.5">
                                <div>Subtotal: {formatCurrency(quote.subtotal)}</div>
                                <div>Tax: {formatCurrency(quote.tax_amount)} ({quote.tax_percentage || 0}%)</div>
                              </div>
                            </div>

                            {/* Delivery & Validity Grid */}
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Delivery Lead Time</span>
                                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                                  <HiTruck className="w-3 h-3 text-slate-400" />
                                  {quote.lead_time_days ? `${quote.lead_time_days} Days` : 'N/A'}
                                </span>
                              </div>
                              <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">Validity Date</span>
                                <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                                  <HiClock className="w-3 h-3 text-slate-400" />
                                  {formatDate(quote.valid_until)}
                                </span>
                              </div>
                            </div>

                            {/* Remarks preview if present */}
                            {quote.remarks && (
                              <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100 line-clamp-2 italic">
                                "{quote.remarks}"
                              </p>
                            )}

                            {/* Evaluation Remarks preview */}
                            {quote.evaluation_remarks && (
                              <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-[11px] space-y-0.5">
                                <span className="text-[9px] font-bold text-purple-700 uppercase block">Committee Remarks</span>
                                <p className="text-purple-900 font-medium line-clamp-2">{quote.evaluation_remarks}</p>
                              </div>
                            )}

                            {/* Signed Quotation PDF Button */}
                            {quote.quotation_document_url ? (
                              <button
                                type="button"
                                onClick={() => openSecureDocument(quote.quotation_document_url, `Quotation_${quote.quotation_number}.pdf`)}
                                className="w-full py-2 px-3 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold text-xs border border-violet-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                              >
                                <HiDocumentText className="w-4 h-4" />
                                <span>View Attached PDF</span>
                                <HiExternalLink className="w-3 h-3" />
                              </button>
                            ) : (
                              <div className="text-[11px] text-slate-400 italic text-center py-1">
                                No PDF document attached
                              </div>
                            )}
                          </div>

                          {/* Card Footer: Action buttons */}
                          <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenEvaluation(quote)}
                              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs gap-1"
                            >
                              <HiEye className="w-3.5 h-3.5" />
                              <span>Evaluate &amp; Remarks</span>
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
          onRecommendationSubmitted={fetchQuotations}
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
