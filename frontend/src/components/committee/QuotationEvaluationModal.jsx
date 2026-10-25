import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  HiEye,
  HiExclamationCircle,
  HiXCircle
} from 'react-icons/hi';

const QuotationEvaluationModal = ({
  isOpen,
  onClose,
  quotation,
  onQuotationUpdated
}) => {
  const [evaluationRemarks, setEvaluationRemarks] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (quotation) {
      setEvaluationRemarks(quotation.evaluation_remarks || '');
      setRejectionReason('');
      setShowRejectInput(false);
      setSuccessMessage('');
      setErrorMessage('');
    }
  }, [quotation, isOpen]);

  if (!isOpen || !quotation) return null;

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

  const handleMarkUnderReview = async () => {
    setLoadingAction(true);
    setErrorMessage('');
    try {
      await axiosClient.post(`/procurement/quotations/${quotation.id}/mark-under-review/`);
      setSuccessMessage('Quotation marked as Under Review.');
      if (onQuotationUpdated) onQuotationUpdated();
    } catch (err) {
      setErrorMessage(err.response?.data?.detail || 'Failed to mark quotation under review.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSaveEvaluation = async () => {
    if (!evaluationRemarks.trim()) {
      setErrorMessage('Please enter evaluation remarks before saving.');
      return;
    }
    setLoadingAction(true);
    setErrorMessage('');
    try {
      await axiosClient.post(`/procurement/quotations/${quotation.id}/evaluate/`, {
        evaluation_remarks: evaluationRemarks.trim()
      });
      setSuccessMessage('Evaluation remarks saved successfully.');
      if (onQuotationUpdated) onQuotationUpdated();
    } catch (err) {
      setErrorMessage(err.response?.data?.detail || 'Failed to save evaluation remarks.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleRecommend = async () => {
    if (!evaluationRemarks.trim()) {
      setErrorMessage('Please provide justification remarks (pricing, compliance, delivery) to recommend this vendor.');
      return;
    }
    setLoadingAction(true);
    setErrorMessage('');
    try {
      await axiosClient.post(`/procurement/quotations/${quotation.id}/recommend/`, {
        evaluation_remarks: evaluationRemarks.trim()
      });
      setSuccessMessage('Quotation successfully recommended for Committee approval!');
      if (onQuotationUpdated) onQuotationUpdated();
    } catch (err) {
      setErrorMessage(err.response?.data?.detail || err.response?.data?.evaluation_remarks || 'Failed to recommend quotation.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setErrorMessage('Please state the specific reason for rejecting this quotation.');
      return;
    }
    setLoadingAction(true);
    setErrorMessage('');
    try {
      await axiosClient.post(`/procurement/quotations/${quotation.id}/reject/`, {
        rejection_reason: rejectionReason.trim()
      });
      setSuccessMessage('Quotation rejected.');
      setShowRejectInput(false);
      if (onQuotationUpdated) onQuotationUpdated();
    } catch (err) {
      setErrorMessage(err.response?.data?.detail || err.response?.data?.rejection_reason || 'Failed to reject quotation.');
    } finally {
      setLoadingAction(false);
    }
  };

  const vendor = quotation.vendor_details || quotation.vendor || {};
  const rfq = quotation.quotation_request_details || {};
  const req = quotation.requisition_details || {};

  const isRecommended = quotation.is_recommended || quotation.status === 'RECOMMENDED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-violet-100 overflow-hidden flex flex-col max-h-[92vh] my-auto"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-violet-50/80 via-white to-purple-50/40 flex items-center justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-violet-100 text-violet-800 border border-violet-200">
                {quotation.quotation_number}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                quotation.status === 'RECOMMENDED'
                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                  : quotation.status === 'ACCEPTED'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : quotation.status === 'UNDER_REVIEW'
                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                  : quotation.status === 'REJECTED'
                  ? 'bg-rose-100 text-rose-800 border-rose-200'
                  : 'bg-amber-100 text-amber-800 border-amber-200'
              }`}>
                {quotation.status_display || quotation.status}
              </span>
              {isRecommended && (
                <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-black flex items-center gap-1">
                  <HiBadgeCheck className="w-3.5 h-3.5" />
                  Recommended Bid
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Quotation Evaluation: {vendor.company_name || 'Vendor'}
            </h3>
            <p className="text-xs text-slate-500">
              For RFQ {rfq.rfq_number || 'N/A'} • Purchase Request {req.req_number || 'N/A'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition"
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback banners */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <HiCheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <HiExclamationCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Top Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Vendor Profile Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vendor Details</span>
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">{vendor.company_name}</h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{vendor.vendor_code}</p>
                </div>
                {vendor.performance_rating && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                    <HiStar className="w-3.5 h-3.5 text-amber-500" />
                    Rating: {vendor.performance_rating}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600 space-y-0.5 pt-1 border-t border-slate-200/60">
                <p><span className="text-slate-400">Email:</span> {vendor.contact_email || 'N/A'}</p>
                <p><span className="text-slate-400">Phone:</span> {vendor.contact_phone || 'N/A'}</p>
                <p><span className="text-slate-400">Submitted On:</span> {formatDate(quotation.created_at)}</p>
              </div>
            </div>

            {/* Purchase Request Details Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Requisition &amp; Scope</span>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{req.title || rfq.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-violet-100 text-violet-800 text-[11px] font-semibold">
                    <HiTag className="w-3 h-3 text-violet-600" />
                    {req.category || 'Medical Supplies'}
                  </span>
                  <span className="text-xs text-slate-500">{req.department_name}</span>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-0.5 pt-1 border-t border-slate-200/60">
                <p><span className="text-slate-400">Estimated Budget:</span> <span className="font-bold text-slate-800">{formatCurrency(req.estimated_budget)}</span></p>
                {req.item_name && (
                  <p><span className="text-slate-400">Item:</span> {req.item_name} (Qty: {req.quantity || 1})</p>
                )}
                {req.specifications && (
                  <p><span className="text-slate-400">Req Specs:</span> {req.specifications}</p>
                )}
              </div>
            </div>
          </div>

          {/* Pricing Breakdown Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <HiCurrencyDollar className="w-5 h-5 text-emerald-600" />
                Commercial Offer &amp; Price Breakdown
              </h4>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Quoted Amount</span>
                <span className="text-xl font-black text-slate-900 font-mono">
                  {formatCurrency(quotation.total_amount)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Subtotal</span>
                <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(quotation.subtotal)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Tax ({quotation.tax_percentage || 0}%)</span>
                <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(quotation.tax_amount)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Shipping / Logistics</span>
                <span className="font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(quotation.shipping_charges)}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Delivery Lead Time</span>
                <span className="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                  <HiTruck className="w-3.5 h-3.5 text-slate-400" />
                  {quotation.lead_time_days ? `${quotation.lead_time_days} Days` : 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 gap-2">
              <span className="flex items-center gap-1">
                <HiClock className="w-4 h-4 text-slate-400" />
                Quotation Valid Until: <strong className="text-slate-700">{formatDate(quotation.valid_until)}</strong>
              </span>
              {quotation.payment_terms && (
                <span>
                  Payment Terms: <strong className="text-slate-700">{quotation.payment_terms}</strong>
                </span>
              )}
            </div>
          </div>

          {/* Line Items Table if present */}
          {quotation.items && quotation.items.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Itemized Line Items</h4>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quotation.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-800">{it.item_name}</span>
                          {it.specifications && (
                            <span className="block text-[11px] text-slate-400">{it.specifications}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">{it.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(it.unit_price)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(it.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Vendor Remarks */}
          {quotation.remarks && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vendor Submission Remarks</span>
              <p className="text-xs text-slate-700 leading-relaxed italic">"{quotation.remarks}"</p>
            </div>
          )}

          {/* Quotation Document PDF Viewer Action */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-50 via-white to-purple-50 border border-violet-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center flex-shrink-0">
                <HiDocumentText className="w-5 h-5" />
              </div>
              <div>
                <h5 className="font-bold text-slate-900 text-xs">Official Quotation Document (PDF)</h5>
                <p className="text-[11px] text-slate-500">
                  {quotation.quotation_document_url
                    ? 'Review vendor-signed quotation and verified attachments.'
                    : 'No PDF was attached by vendor.'}
                </p>
              </div>
            </div>

            {quotation.quotation_document_url ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => openSecureDocument(quotation.quotation_document_url, `Quotation_${quotation.quotation_number}.pdf`)}
                className="bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs gap-1.5 flex-shrink-0"
              >
                <HiEye className="w-4 h-4" />
                <span>Open Secure PDF</span>
                <HiExternalLink className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <span className="text-xs text-slate-400 italic">No document available</span>
            )}
          </div>

          {/* Committee Evaluation Remarks Input */}
          <div className="space-y-2 p-4 rounded-2xl bg-purple-50/40 border border-purple-200/70">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <HiBadgeCheck className="w-4 h-4 text-purple-600" />
                Committee Evaluation &amp; Recommendation Remarks
              </label>
              {quotation.recommended_by_name && (
                <span className="text-[10px] text-purple-700 font-semibold">
                  Evaluated by {quotation.recommended_by_name} ({formatDate(quotation.recommended_at)})
                </span>
              )}
            </div>
            <textarea
              rows={3}
              value={evaluationRemarks}
              onChange={(e) => setEvaluationRemarks(e.target.value)}
              placeholder="Record evaluation notes on technical specifications compliance, pricing competitiveness, delivery lead time, and warranty/support..."
              className="w-full p-3 rounded-xl border border-purple-200 text-xs bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none resize-none leading-relaxed text-slate-800"
            />
            <div className="flex justify-end gap-2 pt-1">
              {quotation.status === 'SUBMITTED' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loadingAction}
                  onClick={handleMarkUnderReview}
                  className="text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                >
                  Mark Under Review
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={loadingAction}
                onClick={handleSaveEvaluation}
                className="text-xs border-purple-300 text-purple-800 hover:bg-purple-100/50"
              >
                Save Evaluation Remarks
              </Button>
            </div>
          </div>

          {/* Rejection UI */}
          {showRejectInput && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-rose-800 flex items-center gap-1">
                  <HiXCircle className="w-4 h-4 text-rose-600" />
                  Reject Quotation
                </h5>
                <button
                  type="button"
                  onClick={() => setShowRejectInput(false)}
                  className="text-xs text-rose-500 hover:underline"
                >
                  Cancel
                </button>
              </div>
              <textarea
                rows={2}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="State reason for rejection (e.g. non-compliant specs, exorbitant price, validity expired)..."
                className="w-full p-2.5 rounded-xl border border-rose-300 text-xs bg-white focus:ring-2 focus:ring-rose-400 focus:outline-none resize-none"
              />
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={loadingAction}
                  onClick={handleReject}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                >
                  Confirm Rejection
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Action Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            {!showRejectInput && quotation.status !== 'REJECTED' && (
              <Button
                variant="outline"
                size="sm"
                disabled={loadingAction}
                onClick={() => setShowRejectInput(true)}
                className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 font-semibold"
              >
                Reject Quotation
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs px-4">
              Close
            </Button>
            {isRecommended ? (
              <Button
                variant="primary"
                size="sm"
                disabled={loadingAction}
                onClick={handleRecommend}
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs gap-1.5"
              >
                <HiBadgeCheck className="w-4 h-4" />
                <span>Update Recommendation</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                disabled={loadingAction || quotation.status === 'REJECTED'}
                onClick={handleRecommend}
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs gap-1.5"
              >
                <HiBadgeCheck className="w-4 h-4" />
                <span>Recommend This Vendor</span>
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default QuotationEvaluationModal;
