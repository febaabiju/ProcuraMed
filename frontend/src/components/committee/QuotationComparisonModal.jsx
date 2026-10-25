import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import Button from '../common/Button';
import { openSecureDocument } from '../../utils/documentViewer';
import {
  HiX,
  HiCheckCircle,
  HiClock,
  HiTruck,
  HiDocumentText,
  HiExternalLink,
  HiInformationCircle,
  HiStar,
  HiTag,
  HiCurrencyDollar,
  HiBadgeCheck,
  HiRefresh
} from 'react-icons/hi';

const QuotationComparisonModal = ({
  isOpen,
  onClose,
  rfqId,
  requisitionId,
  onRecommendationSubmitted
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  
  // Recommending inline state
  const [recommendingQuoteId, setRecommendingQuoteId] = useState(null);
  const [evaluationRemarks, setEvaluationRemarks] = useState('');
  const [submittingRecommend, setSubmittingRecommend] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchComparison = async () => {
    if (!rfqId && !requisitionId) return;
    setLoading(true);
    setError('');
    try {
      const param = rfqId ? `rfq_id=${rfqId}` : `requisition_id=${requisitionId}`;
      const res = await axiosClient.get(`/procurement/quotations/compare/?${param}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load quotation comparison.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchComparison();
      setRecommendingQuoteId(null);
      setEvaluationRemarks('');
      setActionSuccess('');
    }
  }, [isOpen, rfqId, requisitionId]);

  if (!isOpen) return null;

  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not specified';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handleOpenRecommend = (quote) => {
    setRecommendingQuoteId(quote.id);
    setEvaluationRemarks(quote.evaluation_remarks || '');
    setActionSuccess('');
  };

  const handleRecommendSubmit = async (quoteId) => {
    if (!evaluationRemarks.trim()) {
      alert('Please enter evaluation and recommendation justification remarks (price, technical suitability, lead time).');
      return;
    }

    setSubmittingRecommend(true);
    try {
      await axiosClient.post(`/procurement/quotations/${quoteId}/recommend/`, {
        evaluation_remarks: evaluationRemarks.trim()
      });
      setActionSuccess('Quotation recommended successfully for Procurement Committee approval!');
      setRecommendingQuoteId(null);
      await fetchComparison();
      if (onRecommendationSubmitted) {
        onRecommendationSubmitted();
      }
    } catch (err) {
      alert(err.response?.data?.evaluation_remarks || err.response?.data?.detail || 'Failed to recommend quotation.');
    } finally {
      setSubmittingRecommend(false);
    }
  };

  const rfq = data?.rfq;
  const req = rfq?.requisition_details || {};
  const quotations = data?.quotations || [];
  const lowestPriceId = data?.lowest_price_quotation_id;
  const fastestDeliveryId = data?.fastest_delivery_quotation_id;
  const recommendedId = data?.recommended_quotation_id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl max-w-6xl w-full shadow-2xl border border-violet-100 overflow-hidden flex flex-col max-h-[92vh] my-auto"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-violet-50/80 via-white to-purple-50/40 flex items-center justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-violet-100 text-violet-800 border border-violet-200">
                {rfq?.rfq_number || 'RFQ Comparison'}
              </span>
              {req?.req_number && (
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-semibold bg-slate-100 text-slate-700">
                  PR: {req.req_number}
                </span>
              )}
              {req?.department_name && (
                <span className="text-xs text-slate-500 font-medium">
                  • {req.department_name}
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Quotation Comparison &amp; Vendor Bid Analysis
            </h3>
            <p className="text-xs text-slate-500">
              Comparative evaluation of {quotations.length} received vendor quotation{quotations.length === 1 ? '' : 's'} for purchase decision.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition"
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* Action feedback */}
        {actionSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <HiCheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
              <HiRefresh className="w-6 h-6 animate-spin text-violet-500" />
              <span>Loading quotation comparison matrix...</span>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : quotations.length === 0 ? (
            <div className="p-8 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-100">
              <HiInformationCircle className="w-8 h-8 text-slate-300 mx-auto" />
              <h4 className="text-xs font-bold text-slate-700">No Quotations Received Yet</h4>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                Invited vendors have not submitted formal quotations for this RFQ yet.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Purchase Request Overview Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Purchase Item / Scope</span>
                  <span className="font-bold text-slate-900">{req.title || rfq.title}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Category</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                    <HiTag className="w-3 h-3 text-violet-500" />
                    {req.category || 'General Medical'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Estimated Budget</span>
                  <span className="font-black text-slate-900">{formatCurrency(req.estimated_budget || rfq.estimated_budget)}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Quotations Status</span>
                  <span className="font-bold text-violet-700">
                    {quotations.length} Bids Evaluated
                  </span>
                </div>
              </div>

              {/* Side-by-Side Comparison Matrix */}
              <div className="overflow-x-auto pb-2">
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.max(quotations.length, 1)}, minmax(280px, 1fr))` }}>
                  {quotations.map((quote) => {
                    const isLowest = quote.id === lowestPriceId;
                    const isFastest = quote.id === fastestDeliveryId && quotations.length > 1;
                    const isRecommended = quote.is_recommended || quote.id === recommendedId || quote.status === 'RECOMMENDED';
                    const isRecommendingThis = recommendingQuoteId === quote.id;

                    return (
                      <div
                        key={quote.id}
                        className={`rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-sm ${
                          isRecommended
                            ? 'border-purple-300 bg-purple-50/30 ring-2 ring-purple-400/40'
                            : isLowest
                            ? 'border-emerald-200 bg-emerald-50/20'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        {/* Vendor Header */}
                        <div className="p-5 border-b border-slate-100 bg-white space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h4 className="font-extrabold text-slate-900 text-sm">
                                  {quote.vendor_details?.company_name || quote.vendor?.company_name || 'Vendor'}
                                </h4>
                              </div>
                              <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                                {quote.vendor_details?.vendor_code || 'VEN-CODE'} • {quote.quotation_number}
                              </p>
                            </div>
                            
                            {quote.vendor_details?.performance_rating && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 flex-shrink-0">
                                <HiStar className="w-3 h-3 text-amber-500" />
                                {quote.vendor_details.performance_rating}
                              </span>
                            )}
                          </div>

                          {/* Badges Ribbon */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {isRecommended && (
                              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black border border-purple-200 flex items-center gap-1">
                                <HiBadgeCheck className="w-3.5 h-3.5 text-purple-600" />
                                Recommended Vendor
                              </span>
                            )}
                            {isLowest && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                                <HiCurrencyDollar className="w-3 h-3 text-emerald-600" />
                                Lowest Bidder
                              </span>
                            )}
                            {isFastest && (
                              <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold border border-sky-200 flex items-center gap-1">
                                <HiTruck className="w-3 h-3 text-sky-600" />
                                Fastest Delivery
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price Details */}
                        <div className="p-5 space-y-4 text-xs">
                          {/* Total Quoted Price Card */}
                          <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              Total Contract Price
                            </span>
                            <div className="text-xl font-black text-slate-900 tracking-tight">
                              {formatCurrency(quote.total_amount)}
                            </div>
                            {(parseFloat(quote.tax_amount || 0) > 0 || parseFloat(quote.shipping_charges || 0) > 0) && (
                              <div className="text-[10px] text-slate-500 pt-0.5 space-y-0.5 border-t border-slate-100 mt-1">
                                {parseFloat(quote.tax_amount || 0) > 0 && (
                                  <div className="flex justify-between">
                                    <span>Taxes ({quote.tax_percentage || 0}%):</span>
                                    <span>+{formatCurrency(quote.tax_amount)}</span>
                                  </div>
                                )}
                                {parseFloat(quote.shipping_charges || 0) > 0 && (
                                  <div className="flex justify-between">
                                    <span>Shipping &amp; Logistics:</span>
                                    <span>+{formatCurrency(quote.shipping_charges)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Delivery Lead Time & Validity */}
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Delivery Period</span>
                              <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                                <HiTruck className="w-3 h-3 text-slate-400" />
                                {quote.lead_time_days ? `${quote.lead_time_days} Days` : 'N/A'}
                              </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Offer Validity</span>
                              <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                                <HiClock className="w-3 h-3 text-slate-400" />
                                {formatDate(quote.valid_until)}
                              </span>
                            </div>
                          </div>

                          {/* Line Items breakdown if present */}
                          {quote.items && quote.items.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Quoted Items</span>
                              <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100 max-h-28 overflow-y-auto text-[11px]">
                                {quote.items.map((it, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-slate-700">
                                    <span className="truncate max-w-[150px] font-medium">{it.item_name} (x{it.quantity})</span>
                                    <span className="font-bold font-mono">{formatCurrency(it.total_price)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Remarks & Technical Notes */}
                          {quote.remarks && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Vendor Notes</span>
                              <p className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 italic leading-relaxed">
                                "{quote.remarks}"
                              </p>
                            </div>
                          )}

                          {/* Quotation PDF */}
                          {quote.quotation_document_url ? (
                            <button
                              type="button"
                              onClick={() => openSecureDocument(quote.quotation_document_url, `Quotation_${quote.quotation_number}.pdf`)}
                              className="w-full py-2 px-3 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold text-xs border border-violet-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                            >
                              <HiDocumentText className="w-4 h-4" />
                              <span>View Signed Quotation PDF</span>
                              <HiExternalLink className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic block text-center">
                              No PDF document attached
                            </span>
                          )}

                          {/* Evaluation Remarks Display */}
                          {quote.evaluation_remarks && (
                            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-100 space-y-1 text-[11px]">
                              <span className="text-[9px] font-bold text-purple-700 uppercase block">Committee Evaluation</span>
                              <p className="text-purple-900 leading-relaxed font-medium">{quote.evaluation_remarks}</p>
                              {quote.recommended_by_name && (
                                <p className="text-[10px] text-purple-600 font-semibold pt-0.5">
                                  — Evaluated by {quote.recommended_by_name}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Recommendation Action Footer */}
                        <div className="p-4 bg-slate-50/80 border-t border-slate-100 space-y-3">
                          {isRecommendingThis ? (
                            <div className="space-y-2.5">
                              <label className="text-[11px] font-bold text-slate-700 block">
                                Recommendation Justification Remarks <span className="text-rose-500">*</span>
                              </label>
                              <textarea
                                rows={3}
                                value={evaluationRemarks}
                                onChange={(e) => setEvaluationRemarks(e.target.value)}
                                placeholder="State why this vendor is recommended (e.g. lowest compliant bid, meets required ISO medical specifications, earliest delivery)..."
                                className="w-full p-2.5 rounded-xl border border-violet-300 text-xs bg-white focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                              />
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setRecommendingQuoteId(null)}
                                  className="w-1/2 text-xs"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  disabled={submittingRecommend}
                                  onClick={() => handleRecommendSubmit(quote.id)}
                                  className="w-1/2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                                >
                                  {submittingRecommend ? 'Submitting...' : 'Confirm'}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {isRecommended ? (
                                <div className="text-center py-1">
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700">
                                    <HiBadgeCheck className="w-4 h-4 text-purple-600" />
                                    Currently Recommended Bid
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRecommend(quote)}
                                    className="text-[11px] text-purple-600 hover:text-purple-800 underline block mx-auto mt-0.5 cursor-pointer font-medium"
                                  >
                                    Update evaluation remarks
                                  </button>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenRecommend(quote)}
                                  className="w-full border-purple-200 text-purple-700 hover:bg-purple-50 font-bold text-xs gap-1"
                                >
                                  <HiBadgeCheck className="w-4 h-4 text-purple-600" />
                                  <span>Recommend This Vendor</span>
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/70">
          <p className="text-[11px] text-slate-500 max-w-xl">
            Recommending a vendor quotation submits it for formal Procurement Committee approval and subsequent Purchase Officer contract award.
          </p>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs px-5 font-bold">
            Close
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default QuotationComparisonModal;
