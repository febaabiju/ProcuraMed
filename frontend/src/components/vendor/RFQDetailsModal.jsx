import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import Button from '../common/Button';
import {
  HiX,
  HiClipboardList,
  HiCalendar,
  HiClock,
  HiLocationMarker,
  HiOfficeBuilding,
  HiDocumentText,
  HiDownload,
  HiExternalLink,
  HiCheckCircle,
  HiTag,
  HiInformationCircle,
  HiCurrencyDollar,
  HiTruck,
  HiExclamation,
  HiEye,
  HiRefresh
} from 'react-icons/hi';

const RFQDetailsModal = ({
  isOpen,
  onClose,
  rfqId,
  initialRfq = null,
  onSubmitQuotation,
  onViewQuotation,
  onStatusChanged
}) => {
  const [rfq, setRfq] = useState(initialRfq);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialRfq) {
      setRfq(initialRfq);
    }
  }, [initialRfq]);

  // When modal opens, fetch the full RFQ details from backend.
  // This automatically marks the vendor's invitation as VIEWED on the backend!
  useEffect(() => {
    if (isOpen && rfqId) {
      const fetchRfqDetails = async () => {
        setLoading(true);
        setError('');
        try {
          const res = await axiosClient.get(`/procurement/rfqs/${rfqId}/`);
          setRfq(res.data);
          if (onStatusChanged) {
            onStatusChanged(res.data);
          }
        } catch (err) {
          console.error('Error fetching RFQ details:', err);
          setError(err.response?.data?.detail || 'Failed to load request details.');
        } finally {
          setLoading(false);
        }
      };
      fetchRfqDetails();
    }
  }, [isOpen, rfqId]);

  if (!isOpen) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not Specified';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'Not Specified';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  const req = rfq?.requisition_details || {};
  const myInvitation = rfq?.my_invitation;
  const myQuotation = rfq?.my_quotation;
  const isQuoted = Boolean(myQuotation || myInvitation?.status === 'QUOTED');

  // Check deadline
  const isExpired = rfq?.is_expired || (rfq?.due_date && new Date(rfq.due_date) < new Date(new Date().setHours(0, 0, 0, 0)));
  const isCancelled = rfq?.status === 'CANCELLED';
  const isClosed = rfq?.status === 'CLOSED';
  const canSubmitQuote = !isQuoted && !isExpired && !isCancelled && !isClosed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-violet-100 overflow-hidden flex flex-col max-h-[92vh] my-auto"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-violet-50/50 via-white to-purple-50/30">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-violet-600 text-white flex items-center justify-center font-bold shadow-md shadow-violet-500/20 flex-shrink-0 mt-0.5">
              <HiClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {rfq?.title || req?.title || 'Quotation Request Details'}
                </h2>
                {rfq?.rfq_number && (
                  <span className="font-mono text-xs font-bold text-violet-700 bg-violet-100/80 px-2.5 py-0.5 rounded-full border border-violet-200">
                    {rfq.rfq_number}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                {req?.requisition_number && (
                  <span>
                    Purchase Request: <strong className="text-slate-800">{req.requisition_number}</strong>
                  </span>
                )}
                {rfq?.created_at && (
                  <span>
                    Issued: <strong className="text-slate-800">{formatDate(rfq.created_at)}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700 flex-grow">
          {loading && !rfq ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
              <HiRefresh className="w-6 h-6 animate-spin text-violet-600" />
              <span className="font-semibold">Loading purchase request details...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
              <HiExclamation className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Lifecycle & Status Alert Banner */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Your Response Status:
                  </span>
                  {isQuoted ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                      <HiCheckCircle className="w-4 h-4 text-emerald-600" />
                      Quotation Submitted
                      {myQuotation?.quotation_number && ` (${myQuotation.quotation_number})`}
                    </span>
                  ) : myInvitation?.status === 'VIEWED' ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5">
                      <HiEye className="w-4 h-4 text-blue-600" />
                      Viewed &bull; Awaiting Quotation Submission
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5">
                      <HiClock className="w-4 h-4 text-amber-600" />
                      New Invitation Received
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    RFQ Stage:
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      isExpired
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : isClosed
                        ? 'bg-slate-100 text-slate-700 border-slate-300'
                        : 'bg-violet-50 text-violet-700 border-violet-200'
                    }`}
                  >
                    {isExpired ? 'Deadline Expired' : isClosed ? 'Closed' : rfq?.status_display || rfq?.status || 'Open'}
                  </span>
                </div>
              </div>

              {/* Grid 1: Required Item & Quantities */}
              <div className="bg-violet-50/40 rounded-2xl p-5 border border-violet-100 space-y-3">
                <div className="flex items-center justify-between border-b border-violet-100/70 pb-2.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-violet-900 flex items-center gap-1.5">
                    <HiTag className="w-4 h-4 text-violet-600" />
                    Required Item &amp; Sourcing Specifications
                  </span>
                  {req?.category && (
                    <span className="px-2.5 py-0.5 rounded-md bg-white border border-violet-200 text-violet-800 font-bold text-[11px]">
                      {req.category}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Item Name</span>
                    <p className="text-base font-black text-slate-900">
                      {req?.item_name || rfq?.title || 'Hospital Sourced Item'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Required Quantity</span>
                    <p className="text-base font-black text-violet-700">
                      {req?.quantity ? `${req.quantity} ${req.unit || 'Units'}` : (rfq?.items?.[0]?.quantity ? `${rfq.items[0].quantity} ${rfq.items[0].unit_of_measurement || 'Units'}` : 'As specified')}
                    </p>
                  </div>
                </div>

                {/* Technical Specifications */}
                {(req?.technical_specifications || rfq?.items?.[0]?.technical_specifications) && (
                  <div className="pt-2 border-t border-violet-100/60 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Technical Specifications</span>
                    <div className="p-3 bg-white rounded-xl border border-violet-100 text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                      {req?.technical_specifications || rfq?.items?.[0]?.technical_specifications}
                    </div>
                  </div>
                )}

                {/* Justification / Description */}
                {(req?.justification || req?.description) && (
                  <div className="pt-2 border-t border-violet-100/60 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Request Description / Clinical Purpose</span>
                    <p className="text-slate-600 leading-relaxed font-medium">
                      {req?.justification || req?.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Grid 2: Delivery & Hospital Department Location */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                  <h4 className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs">
                    <HiOfficeBuilding className="w-4 h-4 text-violet-600" />
                    Department &amp; Destination
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Requesting Department</span>
                      <p className="font-bold text-slate-800 mt-0.5">
                        {req?.department_details?.name || req?.department_name || 'General Medical Ward'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivery Location</span>
                      <p className="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                        <HiLocationMarker className="w-3.5 h-3.5 text-violet-500" />
                        {rfq?.delivery_location || req?.delivery_location || 'Hospital Central Procurement Stores'}
                      </p>
                    </div>
                    {rfq?.delivery_requirements && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Special Delivery Notes</span>
                        <p className="text-slate-600 mt-0.5 font-medium">{rfq.delivery_requirements}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                  <h4 className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs">
                    <HiCalendar className="w-4 h-4 text-violet-600" />
                    Key Dates &amp; Deadlines
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Quotation Submission Deadline</span>
                      <p className={`font-black text-sm mt-0.5 ${isExpired ? 'text-rose-600' : 'text-slate-900'}`}>
                        {formatDate(rfq?.due_date)}
                      </p>
                      {isExpired && (
                        <span className="text-[10px] font-bold text-rose-500 block">
                          Bidding deadline for this RFQ has expired.
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Required Delivery Date</span>
                      <p className="font-bold text-slate-800 mt-0.5">
                        {formatDate(req?.required_date || req?.expected_delivery_date || rfq?.due_date)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Request Priority</span>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-800">
                        {req?.priority || 'Standard'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Breakdown Table (if multiple items in RFQ) */}
              {rfq?.items && rfq.items.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Detailed Item Requirements
                  </span>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                        <tr>
                          <th className="px-3.5 py-2.5">#</th>
                          <th className="px-3.5 py-2.5">Item Name</th>
                          <th className="px-3.5 py-2.5">Technical Specs</th>
                          <th className="px-3.5 py-2.5 text-center">Required Qty</th>
                          <th className="px-3.5 py-2.5">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rfq.items.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50/50">
                            <td className="px-3.5 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                            <td className="px-3.5 py-2.5 font-bold text-slate-800">{item.item_name}</td>
                            <td className="px-3.5 py-2.5 text-slate-600 max-w-xs truncate">
                              {item.technical_specifications || 'Standard Hospital Specs'}
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-bold text-violet-700">{item.quantity}</td>
                            <td className="px-3.5 py-2.5 text-slate-600">{item.unit_of_measurement || 'Pieces'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Terms & Conditions */}
              {rfq?.terms_and_conditions && (
                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/70 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-amber-800 flex items-center gap-1">
                    <HiInformationCircle className="w-4 h-4 text-amber-600" />
                    Procurement Terms &amp; Instructions
                  </span>
                  <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                    {rfq.terms_and_conditions}
                  </p>
                </div>
              )}

              {/* Supporting Attachments / Documents */}
              {(req?.supporting_document || req?.technical_evaluation_report) && (
                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Associated Documents &amp; Technical Reports
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {req?.supporting_document && (
                      <a
                        href={req.supporting_document}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-800 border border-violet-200 font-bold transition"
                      >
                        <HiDocumentText className="w-4 h-4 text-violet-600" />
                        <span>Requisition Supporting Document</span>
                        <HiExternalLink className="w-3.5 h-3.5 text-violet-400" />
                      </a>
                    )}
                    {req?.technical_evaluation_report && (
                      <a
                        href={req.technical_evaluation_report}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold transition"
                      >
                        <HiDocumentText className="w-4 h-4 text-purple-600" />
                        <span>Technical Evaluation Specifications</span>
                        <HiExternalLink className="w-3.5 h-3.5 text-purple-400" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Submitted Quotation Preview Card (if already quoted) */}
              {myQuotation && (
                <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HiCheckCircle className="w-5 h-5 text-emerald-600" />
                      <h4 className="font-bold text-emerald-900 text-xs">
                        Your Submitted Quotation: {myQuotation.quotation_number}
                      </h4>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-200 text-emerald-900">
                      {myQuotation.status_display || myQuotation.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Quoted</span>
                      <span className="font-black text-slate-900 text-sm">{formatCurrency(myQuotation.total_amount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Delivery Lead Time</span>
                      <span className="font-bold text-slate-800">
                        {myQuotation.lead_time_days ? `${myQuotation.lead_time_days} Days` : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Submitted On</span>
                      <span className="font-medium text-slate-700">{formatDate(myQuotation.submission_date)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Validity Date</span>
                      <span className="font-medium text-slate-700">{formatDate(myQuotation.valid_until)}</span>
                    </div>
                  </div>
                  {onViewQuotation && (
                    <div className="pt-2 border-t border-emerald-200/60 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onClose();
                          onViewQuotation(myQuotation);
                        }}
                        className="text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-bold text-xs"
                      >
                        <HiEye className="w-3.5 h-3.5" />
                        <span>View Full Submitted Quotation Details</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            className="border-slate-200 text-slate-700 font-semibold"
          >
            Close
          </Button>

          <div className="flex items-center gap-3">
            {canSubmitQuote && onSubmitQuotation && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  onClose();
                  onSubmitQuotation(rfq);
                }}
                className="font-bold text-white shadow-lg shadow-violet-500/20"
                style={{ background: 'linear-gradient(135deg, #8B7CF8, #6D5BD0)' }}
              >
                <HiCurrencyDollar className="w-4 h-4" />
                <span>Submit Quotation Now</span>
              </Button>
            )}

            {isQuoted && onViewQuotation && myQuotation && (
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  onClose();
                  onViewQuotation(myQuotation);
                }}
                className="font-bold text-violet-700 border-violet-200 hover:bg-violet-50"
              >
                <HiEye className="w-4 h-4" />
                <span>View Submitted Quotation</span>
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RFQDetailsModal;
