import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import Button from '../common/Button';
import { useAuth } from '../../context/AuthContext';
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
  HiRefresh,
  HiOfficeBuilding,
  HiMail,
  HiPhone,
  HiUser,
  HiShieldCheck,
  HiExclamationCircle,
  HiLockClosed
} from 'react-icons/hi';

const QuotationComparisonModal = ({
  isOpen,
  onClose,
  rfqId,
  requisitionId,
  onVendorSelected
}) => {
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // Vendor selection modal state
  const [selectedQuoteForConfirm, setSelectedQuoteForConfirm] = useState(null);
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [confirmCheck, setConfirmCheck] = useState(false);
  const [submittingSelection, setSubmittingSelection] = useState(false);
  const [selectionError, setSelectionError] = useState('');
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
      setError(err.response?.data?.detail || 'Failed to load quotation comparison matrix.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchComparison();
      setSelectedQuoteForConfirm(null);
      setDecisionRemarks('');
      setConfirmCheck(false);
      setSelectionError('');
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

  const handleOpenSelectVendor = (quote) => {
    setSelectedQuoteForConfirm(quote);
    setDecisionRemarks(quote.evaluation_remarks || '');
    setConfirmCheck(false);
    setSelectionError('');
    setActionSuccess('');
  };

  const handleConfirmSelectVendor = async () => {
    if (!selectedQuoteForConfirm) return;

    if (!decisionRemarks.trim()) {
      setSelectionError('Decision remarks / justification are mandatory to confirm vendor selection.');
      return;
    }

    if (!confirmCheck) {
      setSelectionError('Please verify and acknowledge the confirmation checkbox before saving the selection.');
      return;
    }

    setSubmittingSelection(true);
    setSelectionError('');

    try {
      const res = await axiosClient.post(
        `/procurement/quotations/${selectedQuoteForConfirm.id}/select-vendor/`,
        {
          decision_remarks: decisionRemarks.trim()
        }
      );

      setActionSuccess(
        res.data.message ||
        `Vendor '${selectedQuoteForConfirm.vendor_details?.company_name || 'Vendor'}' confirmed successfully! Transferred to Purchase Officer.`
      );
      setSelectedQuoteForConfirm(null);
      await fetchComparison();

      if (onVendorSelected) {
        onVendorSelected();
      }
    } catch (err) {
      setSelectionError(
        err.response?.data?.decision_remarks ||
        err.response?.data?.detail ||
        'Failed to confirm vendor selection.'
      );
    } finally {
      setSubmittingSelection(false);
    }
  };

  const rfq = data?.rfq;
  const req = data?.requisition || rfq?.requisition_details || {};
  const quotations = data?.quotations || [];
  const lowestPriceId = data?.lowest_price_quotation_id;
  const fastestDeliveryId = data?.fastest_delivery_quotation_id;
  const selectedQuotationId = data?.selected_quotation_id || (quotations.find(q => q.status === 'SELECTED')?.id);
  const selectedVendorId = data?.selected_vendor_id;
  const techEval = data?.technical_evaluation;

  const isSelectionFinalized = Boolean(
    selectedQuotationId ||
    req.status === 'VENDOR_SELECTED' ||
    req.status === 'PO_CREATED' ||
    req.has_purchase_order
  );

  const decisionMakerName = authUser?.full_name || authUser?.username || 'Committee Member';
  const decisionMakerEmpId = authUser?.employee_id || 'PC-MEMBER';

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
                {rfq?.rfq_number || 'RFQ Quotation Review'}
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
              {isSelectionFinalized && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Vendor Selection Confirmed
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Quotation Comparison &amp; Vendor Selection
            </h3>
            <p className="text-xs text-slate-500">
              Comparative matrix of {quotations.length} received quotation{quotations.length === 1 ? '' : 's'} strictly associated with purchase request {req?.req_number || 'N/A'}.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition"
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* Global Action Success Banner */}
        {actionSuccess && (
          <div className="mx-6 mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-3">
              <HiRefresh className="w-8 h-8 animate-spin text-violet-600" />
              <span>Loading quotation comparison matrix and vendor evaluations...</span>
            </div>
          ) : error ? (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          ) : quotations.length === 0 ? (
            <div className="p-12 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-100">
              <HiInformationCircle className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">No Quotations Received</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No formal quotations have been submitted by invited vendors for this purchase request yet.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Purchase Request & Technical Evaluation Header Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* PR Overview */}
                <div className="lg:col-span-2 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Scope / Requested Items</span>
                    <span className="font-bold text-slate-900 block truncate">{req.title || rfq.title}</span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Qty: {req.item_quantity || (req.items && req.items[0]?.quantity) || 1} units
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Department &amp; Budget</span>
                    <span className="font-bold text-slate-800 block truncate">{req.department_name || 'Hospital Department'}</span>
                    <span className="font-black text-slate-900 font-mono">
                      Budget: {formatCurrency(req.estimated_budget || rfq.estimated_budget)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Selection Status</span>
                    {isSelectionFinalized ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                        <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        Vendor Confirmed
                      </span>
                    ) : (
                      <span className="font-bold text-violet-700">
                        {quotations.length} Bids Awaiting Decision
                      </span>
                    )}
                  </div>
                </div>

                {/* Technical Evaluation Summary Card */}
                <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 text-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-purple-700 uppercase">Technical Suitability</span>
                      <HiShieldCheck className="w-4 h-4 text-purple-600" />
                    </div>
                    {techEval?.requires_technical_evaluation ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-purple-900">
                          <span className="px-1.5 py-0.5 rounded bg-purple-200 text-purple-900 text-[10px] uppercase">
                            {techEval.technical_compliance || 'COMPLIANT'}
                          </span>
                          <span className="text-[11px] text-purple-800">
                            {techEval.technical_recommendation || 'Technically Approved'}
                          </span>
                        </div>
                        {techEval.technical_evaluation_remarks && (
                          <p className="text-[11px] text-purple-700 italic line-clamp-2">
                            "{techEval.technical_evaluation_remarks}"
                          </p>
                        )}
                        {techEval.evaluated_by_name && (
                          <span className="text-[10px] text-purple-500 block">
                            Evaluated by {techEval.evaluated_by_name}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 space-y-1">
                        <span className="font-semibold text-slate-700 block">Standard Commercial Item</span>
                        <p className="text-[10px] text-slate-500">
                          Routine supply item — technical officer evaluation not required.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Side-by-Side Comparison Matrix */}
              <div className="overflow-x-auto pb-4">
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(quotations.length, 1)}, minmax(320px, 1fr))`
                  }}
                >
                  {quotations.map((quote) => {
                    const vendor = quote.vendor_details || quote.vendor || {};
                    const isLowest = quote.id === lowestPriceId && quotations.length > 1;
                    const isFastest = quote.id === fastestDeliveryId && quotations.length > 1;
                    const isSelected = quote.status === 'SELECTED' || quote.id === selectedQuotationId;
                    const isNotSelected = quote.status === 'NOT_SELECTED';
                    const isRecommended = quote.status === 'RECOMMENDED' || quote.is_recommended;

                    return (
                      <div
                        key={quote.id}
                        className={`rounded-3xl border transition-all flex flex-col justify-between overflow-hidden shadow-sm ${
                          isSelected
                            ? 'border-emerald-400 bg-emerald-50/20 ring-2 ring-emerald-500/40'
                            : isRecommended
                            ? 'border-purple-300 bg-purple-50/30'
                            : isLowest
                            ? 'border-violet-200 bg-violet-50/20'
                            : isNotSelected
                            ? 'border-slate-200 bg-slate-50/50 opacity-80'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        {/* 1. Vendor & Contact Info */}
                        <div className="p-5 border-b border-slate-100 bg-white space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-extrabold text-slate-900 text-sm leading-snug">
                                {vendor.company_name || 'Vendor'}
                              </h4>
                              <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                                {vendor.vendor_code || 'VEN-CODE'} • Quote: {quote.quotation_number}
                              </p>
                            </div>

                            {vendor.performance_rating && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 flex-shrink-0">
                                <HiStar className="w-3 h-3 text-amber-500" />
                                {vendor.performance_rating}
                              </span>
                            )}
                          </div>

                          {/* Contact Details */}
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 space-y-1">
                            {vendor.contact_person && (
                              <div className="flex items-center gap-1.5 truncate">
                                <HiUser className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="font-medium truncate">{vendor.contact_person}</span>
                              </div>
                            )}
                            {vendor.email && (
                              <div className="flex items-center gap-1.5 truncate">
                                <HiMail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{vendor.email}</span>
                              </div>
                            )}
                            {vendor.phone && (
                              <div className="flex items-center gap-1.5 truncate">
                                <HiPhone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span>{vendor.phone}</span>
                              </div>
                            )}
                          </div>

                          {/* Status Badges */}
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {isSelected && (
                              <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black flex items-center gap-1 shadow-xs">
                                <HiCheckCircle className="w-3.5 h-3.5" />
                                Selected Vendor
                              </span>
                            )}
                            {isNotSelected && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200">
                                Not Selected
                              </span>
                            )}
                            {isRecommended && !isSelected && (
                              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black border border-purple-200 flex items-center gap-1">
                                <HiBadgeCheck className="w-3.5 h-3.5 text-purple-600" />
                                Recommended Bid
                              </span>
                            )}
                            {isLowest && !isSelected && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                                <HiCurrencyDollar className="w-3 h-3 text-emerald-600" />
                                Lowest Price
                              </span>
                            )}
                            {isFastest && !isSelected && (
                              <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold border border-sky-200 flex items-center gap-1">
                                <HiTruck className="w-3 h-3 text-sky-600" />
                                Fastest Delivery
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. Commercial Quotation Details */}
                        <div className="p-5 space-y-4 text-xs">
                          {/* Total Quoted Amount */}
                          <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              Total Quoted Amount
                            </span>
                            <div className="text-xl font-black text-slate-900 tracking-tight font-mono">
                              {formatCurrency(quote.total_amount)}
                            </div>
                            <div className="text-[10px] text-slate-500 pt-1 space-y-0.5 border-t border-slate-100 mt-1">
                              <div className="flex justify-between">
                                <span>Taxes:</span>
                                <span>
                                  {parseFloat(quote.tax_amount || 0) > 0
                                    ? `+${formatCurrency(quote.tax_amount)} (${quote.tax_percentage || 0}%)`
                                    : 'Included in price / N/A'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Shipping &amp; Logistics:</span>
                                <span>
                                  {parseFloat(quote.shipping_charges || 0) > 0
                                    ? `+${formatCurrency(quote.shipping_charges)}`
                                    : 'Free / None recorded'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Delivery Lead Time & Offer Validity */}
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Delivery Period</span>
                              <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                                <HiTruck className="w-3.5 h-3.5 text-slate-400" />
                                {quote.lead_time_days ? `${quote.lead_time_days} Days` : 'Not specified'}
                              </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase block">Offer Validity</span>
                              <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                                <HiClock className="w-3.5 h-3.5 text-slate-400" />
                                {formatDate(quote.valid_until)}
                              </span>
                            </div>
                          </div>

                          {/* Quoted Items Breakdown */}
                          {quote.items && quote.items.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase block">Quoted Items</span>
                              <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100 max-h-32 overflow-y-auto text-[11px]">
                                {quote.items.map((it, idx) => (
                                  <div key={idx} className="flex justify-between items-start text-slate-700">
                                    <div className="truncate pr-2">
                                      <span className="font-semibold block truncate">{it.item_name}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        Qty: {it.quantity} @ {formatCurrency(it.unit_price)}
                                      </span>
                                    </div>
                                    <span className="font-bold font-mono text-slate-900 flex-shrink-0">
                                      {formatCurrency(it.total_price)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Warranty & Terms / Vendor Remarks */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              Warranty &amp; Vendor Terms
                            </span>
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                              {quote.remarks ? (
                                <p className="italic leading-relaxed">"{quote.remarks}"</p>
                              ) : (
                                <span className="text-slate-400 italic">No special terms recorded</span>
                              )}
                            </div>
                          </div>

                          {/* Original Signed PDF Option */}
                          {quote.quotation_document_url ? (
                            <button
                              type="button"
                              onClick={() => openSecureDocument(quote.quotation_document_url, `Quotation_${quote.quotation_number}.pdf`)}
                              className="w-full py-2.5 px-3 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold text-xs border border-violet-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                            >
                              <HiDocumentText className="w-4 h-4" />
                              <span>View Original Quotation PDF</span>
                              <HiExternalLink className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic block text-center py-1">
                              No signed PDF attached
                            </span>
                          )}

                          {/* Existing Evaluation Remarks */}
                          {quote.evaluation_remarks && (
                            <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100 text-[11px] space-y-0.5">
                              <span className="text-[9px] font-bold text-purple-700 uppercase block">Committee Remarks</span>
                              <p className="text-purple-900 font-medium leading-relaxed">{quote.evaluation_remarks}</p>
                            </div>
                          )}
                        </div>

                        {/* 3. Action Footer: Select Vendor */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100">
                          {isSelected ? (
                            <div className="p-2 rounded-xl bg-emerald-100 border border-emerald-200 text-center">
                              <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800">
                                <HiCheckCircle className="w-4 h-4 text-emerald-600" />
                                Vendor Confirmed for PR
                              </span>
                            </div>
                          ) : isSelectionFinalized ? (
                            <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-center text-slate-500 text-xs font-semibold flex items-center justify-center gap-1">
                              <HiLockClosed className="w-3.5 h-3.5" />
                              <span>Selection finalized for another vendor</span>
                            </div>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenSelectVendor(quote)}
                              className="w-full bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs gap-1.5 py-2.5 shadow-xs"
                            >
                              <HiCheckCircle className="w-4 h-4" />
                              <span>Select Vendor</span>
                            </Button>
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
            Comparing quotations side-by-side enables the Procurement Committee to evaluate technical, commercial, and warranty factors without automated lowest-bid selection.
          </p>
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs px-5 font-bold">
            Close
          </Button>
        </div>
      </motion.div>

      {/* Confirmation Modal for Selecting Vendor */}
      <AnimatePresence>
        {selectedQuoteForConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-violet-100 overflow-hidden my-auto"
            >
              {/* Confirm Header */}
              <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-violet-900 to-purple-900 text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-violet-200 block">
                    Committee Decision
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    Confirm Vendor Selection &amp; Procurement Award
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedQuoteForConfirm(null)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              {/* Confirm Body Form */}
              <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
                {selectionError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <HiExclamationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                    <span>{selectionError}</span>
                  </div>
                )}

                {/* Decision Summary Grid */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Purchase Request</span>
                      <span className="font-bold text-slate-900 text-sm font-mono">
                        {req.req_number || 'PR'}
                      </span>
                      <span className="text-[11px] text-slate-500 block truncate">{req.title || rfq.title}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Selected Vendor</span>
                      <span className="font-bold text-slate-900 text-sm block truncate">
                        {selectedQuoteForConfirm.vendor_details?.company_name || selectedQuoteForConfirm.vendor?.company_name}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {selectedQuoteForConfirm.vendor_details?.vendor_code || 'VEN-CODE'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Quotation Reference</span>
                      <span className="font-bold text-violet-800 font-mono">
                        {selectedQuoteForConfirm.quotation_number}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Quoted Amount</span>
                      <span className="font-black text-slate-900 font-mono text-sm">
                        {formatCurrency(selectedQuoteForConfirm.total_amount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Delivery Lead Time</span>
                      <span className="font-bold text-slate-800">
                        {selectedQuoteForConfirm.lead_time_days ? `${selectedQuoteForConfirm.lead_time_days} Days` : 'Not specified'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Selected Items and Quantities */}
                {selectedQuoteForConfirm.items && selectedQuoteForConfirm.items.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Selected Items &amp; Quantities</span>
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 max-h-28 overflow-y-auto">
                      {selectedQuoteForConfirm.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-slate-700">
                          <span className="font-semibold">{it.item_name} (x{it.quantity})</span>
                          <span className="font-mono font-bold">{formatCurrency(it.total_price)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Decision Metadata: Date & Decision-Maker */}
                <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100">
                  <div>
                    <span className="text-[10px] font-bold text-purple-700 uppercase block">Decision Date</span>
                    <span className="font-bold text-slate-800">
                      {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-purple-700 uppercase block">Authorized Decision-Maker</span>
                    <span className="font-bold text-slate-800 truncate block">
                      {decisionMakerName} ({decisionMakerEmpId})
                    </span>
                  </div>
                </div>

                {/* Decision Remarks / Justification (Mandatory) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800 block">
                    Decision Remarks / Justification <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-500">
                    State the technical, quality, commercial, and delivery justifications for selecting this vendor.
                  </p>
                  <textarea
                    rows={4}
                    value={decisionRemarks}
                    onChange={(e) => setDecisionRemarks(e.target.value)}
                    placeholder="E.g., Selected MedTech Diagnostics after comprehensive review: compliant with technical specifications, lowest total evaluated commercial bid, includes 2-year hospital warranty, acceptable 10-day lead time..."
                    className="w-full p-3 rounded-xl border border-violet-200 text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* Mandatory Confirmation Checkbox */}
                <label className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmCheck}
                    onChange={(e) => setConfirmCheck(e.target.checked)}
                    className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-slate-300 mt-0.5"
                  />
                  <div className="text-[11px] text-amber-900 leading-snug">
                    <span className="font-bold block">Final Confirmation &amp; Audit Acknowledgment:</span>
                    I confirm that this vendor selection has been verified by the Procurement Committee and is ready to be transferred to the Purchase Officer for Purchase Order creation.
                  </div>
                </label>
              </div>

              {/* Confirm Actions */}
              <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedQuoteForConfirm(null)}
                  disabled={submittingSelection}
                  className="text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmSelectVendor}
                  disabled={submittingSelection}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm"
                >
                  {submittingSelection ? (
                    <>
                      <HiRefresh className="w-4 h-4 animate-spin" />
                      <span>Saving Selection...</span>
                    </>
                  ) : (
                    <>
                      <HiCheckCircle className="w-4 h-4" />
                      <span>Confirm &amp; Save Vendor Selection</span>
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuotationComparisonModal;
