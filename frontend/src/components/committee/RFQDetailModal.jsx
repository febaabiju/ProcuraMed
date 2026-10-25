import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiX,
  HiOfficeBuilding,
  HiCalendar,
  HiClock,
  HiLocationMarker,
  HiTruck,
  HiTag,
  HiDocumentText,
  HiUser,
  HiPhone,
  HiMail,
  HiCheckCircle,
  HiBan,
  HiExclamation,
  HiShieldCheck,
  HiCube,
  HiOutlineSparkles,
  HiCurrencyRupee,
  HiPlus,
  HiCheck,
  HiRefresh,
  HiTrendingUp,
  HiBadgeCheck
} from 'react-icons/hi';
import axiosClient from '../../api/axiosClient';
import Button from '../common/Button';
import CancelRFQModal from './CancelRFQModal';

const RFQDetailModal = ({
  rfq: initialRFQ,
  isOpen,
  onClose,
  onRFQUpdated
}) => {
  const [rfq, setRfq] = useState(initialRFQ);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  // Recording quotation state
  const [recordingVendor, setRecordingVendor] = useState(null);
  const [quoteAmount, setQuoteAmount] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState('7');
  const [quoteRemarks, setQuoteRemarks] = useState('');
  const [quoteValidUntil, setQuoteValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [recordingSubmitting, setRecordingSubmitting] = useState(false);
  const [recordingError, setRecordingError] = useState('');

  // Action states for accept / reject
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  // Synchronize rfq if initialRFQ prop updates
  React.useEffect(() => {
    if (initialRFQ) {
      setRfq(initialRFQ);
    }
  }, [initialRFQ]);

  if (!isOpen || !rfq) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || amount === '') return '₹0.00';
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isCancelled = rfq.status === 'CANCELLED';
  const isClosed = rfq.status === 'CLOSED';
  const isExpired = rfq.is_expired || rfq.status === 'EXPIRED';
  const isSentOrOpen = !isCancelled && !isClosed && !isExpired;

  // Use vendor_tracking data from backend serializer
  const vendorTracking = rfq.vendor_tracking || (rfq.vendor_invitations || []).map((inv) => {
    const v = inv.vendor_details || {};
    return {
      invitation_id: inv.id,
      vendor_id: inv.vendor,
      vendor_code: v.vendor_code || `VEN-${inv.vendor}`,
      company_name: v.company_name || v.name || 'Vendor',
      contact_person: v.contact_person || 'Representative',
      email: v.email || 'N/A',
      phone: v.phone || 'N/A',
      categories: (v.supplier_categories || []).map((c) => (typeof c === 'string' ? c : c.name)),
      invitation_status: inv.status || 'INVITED',
      invitation_status_display: inv.status_display || inv.status || 'Invited',
      invited_at: inv.invited_at,
      has_quoted: false,
      quotation_id: null,
      quotation_number: null,
      quotation_status: 'PENDING',
      quotation_status_display: 'Awaiting Quotation',
      total_amount: null,
      lead_time_days: null,
      valid_until: null,
      submission_date: null,
      remarks: null,
      items: []
    };
  });

  const quotedVendors = vendorTracking.filter((v) => v.has_quoted);
  const totalInvited = vendorTracking.length;
  const quotedCount = quotedVendors.length;
  const hasAcceptedQuotation = vendorTracking.some((v) => v.quotation_status === 'ACCEPTED') || rfq.has_accepted_quotation;

  // Comparative metrics
  const validAmounts = quotedVendors.map((v) => Number(v.total_amount)).filter((a) => !isNaN(a) && a > 0);
  const lowestPrice = validAmounts.length > 0 ? Math.min(...validAmounts) : null;
  const validLeadTimes = quotedVendors.map((v) => Number(v.lead_time_days)).filter((t) => !isNaN(t) && t > 0);
  const shortestLeadTime = validLeadTimes.length > 0 ? Math.min(...validLeadTimes) : null;

  const getWorkflowBadge = () => {
    if (isCancelled) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
          <HiBan className="w-3.5 h-3.5" />
          Cancelled
        </span>
      );
    }
    if (hasAcceptedQuotation || isClosed) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
          <HiBadgeCheck className="w-4 h-4 text-emerald-600" />
          Quotation Stage Complete
        </span>
      );
    }
    if (isExpired) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
          <HiClock className="w-3.5 h-3.5" />
          Expired (Past Due)
        </span>
      );
    }
    if (quotedCount > 0) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
          <HiCheckCircle className="w-3.5 h-3.5 text-indigo-600" />
          Quotations Received ({quotedCount}/{totalInvited})
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
        <HiClock className="w-3.5 h-3.5 text-amber-600" />
        Awaiting Quotations (0/{totalInvited})
      </span>
    );
  };

  const req = rfq.requisition_details || {};
  const creator = rfq.created_by_details || {};
  const items = rfq.items || [];

  const handleOpenRecordQuotation = (vendor) => {
    setRecordingVendor(vendor);
    const est = Number(req.estimated_budget || rfq.estimated_budget || 0);
    setQuoteAmount(est > 0 ? String(est) : '');
    setLeadTimeDays('7');
    setQuoteRemarks(`Formal quotation submitted by ${vendor.company_name} inclusive of taxes and warranty.`);
    setRecordingError('');
  };

  const handleSubmitRecordedQuotation = async (e) => {
    e.preventDefault();
    if (!recordingVendor) return;

    const amountNum = parseFloat(quoteAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setRecordingError('Please enter a valid positive quotation amount.');
      return;
    }

    setRecordingSubmitting(true);
    setRecordingError('');

    try {
      const payload = {
        vendor_id: recordingVendor.vendor_id,
        total_amount: amountNum,
        lead_time_days: parseInt(leadTimeDays, 10) || 7,
        valid_until: quoteValidUntil,
        remarks: quoteRemarks.trim()
      };

      const res = await axiosClient.post(`/procurement/rfqs/${rfq.id}/record-quotation/`, payload);
      const updated = res.data.rfq;
      setRfq(updated);
      setRecordingVendor(null);
      setActionMessage(`Quotation from ${recordingVendor.company_name} successfully recorded!`);
      if (onRFQUpdated) {
        onRFQUpdated(updated);
      }
    } catch (err) {
      const detail = err.response?.data?.detail ||
        (typeof err.response?.data === 'object' ? Object.values(err.response.data)[0] : null) ||
        'Failed to record quotation. Please try again.';
      setRecordingError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setRecordingSubmitting(false);
    }
  };

  const handleAcceptQuotation = async (quotationId, vendorName) => {
    if (!quotationId) return;
    if (!window.confirm(`Are you sure you want to accept the quotation from "${vendorName}" as the winning bid? Competing quotations will be marked as rejected and this RFQ will be completed.`)) {
      return;
    }

    setActionLoadingId(quotationId);
    setActionError('');
    setActionMessage('');

    try {
      const res = await axiosClient.post(`/procurement/quotations/${quotationId}/accept/`);
      const updatedRFQ = res.data.rfq;
      if (updatedRFQ) {
        setRfq(updatedRFQ);
        if (onRFQUpdated) onRFQUpdated(updatedRFQ);
      } else {
        // Refetch full RFQ
        const rfqRes = await axiosClient.get(`/procurement/rfqs/${rfq.id}/`);
        setRfq(rfqRes.data);
        if (onRFQUpdated) onRFQUpdated(rfqRes.data);
      }
      setActionMessage(`Quotation from ${vendorName} accepted! Quotation evaluation stage is now completed.`);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to accept quotation. Please try again.';
      setActionError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRejectQuotation = async (quotationId, vendorName) => {
    if (!quotationId) return;
    const reason = window.prompt(`Enter evaluation remarks/reason for rejecting quotation from "${vendorName}":`, 'Did not meet technical specifications or commercial budget requirements.');
    if (reason === null) return;

    setActionLoadingId(quotationId);
    setActionError('');
    setActionMessage('');

    try {
      await axiosClient.post(`/procurement/quotations/${quotationId}/reject/`, { reason });
      // Refetch full RFQ
      const rfqRes = await axiosClient.get(`/procurement/rfqs/${rfq.id}/`);
      setRfq(rfqRes.data);
      if (onRFQUpdated) onRFQUpdated(rfqRes.data);
      setActionMessage(`Quotation from ${vendorName} has been marked as rejected.`);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to reject quotation.';
      setActionError(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-6 my-8 max-h-[92vh] overflow-y-auto text-xs"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-100 pb-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-0.5 rounded-full text-xs font-mono font-bold bg-violet-100 text-violet-800 border border-violet-200">
                  {rfq.rfq_number}
                </span>
                {getWorkflowBadge()}
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                  {totalInvited} Invited Vendors
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-900 leading-snug">
                {rfq.title}
              </h3>
              <p className="text-slate-500 text-xs">
                Issued Date: <strong className="text-slate-800">{formatDate(rfq.issue_date || rfq.created_at)}</strong> • Quotation Cutoff Deadline: <strong className="text-rose-700">{formatDate(rfq.due_date)}</strong>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <HiX className="w-5 h-5" />
            </button>
          </div>

          {/* Action Alerts */}
          {actionMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <HiCheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{actionMessage}</span>
              </div>
              <button onClick={() => setActionMessage('')} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
            </div>
          )}

          {actionError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-semibold flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <HiBan className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
              <button onClick={() => setActionError('')} className="text-rose-600 hover:text-rose-800 font-bold">×</button>
            </div>
          )}

          {/* Cancellation Notice if Cancelled */}
          {isCancelled && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1 shadow-xs">
              <div className="flex items-center gap-2 font-bold text-xs">
                <HiBan className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>This Request for Quotation was Cancelled</span>
              </div>
              <p className="text-[11px] text-rose-800">
                <strong>Reason:</strong> {rfq.cancellation_reason || 'Administrative cancellation.'}
              </p>
              {rfq.cancelled_at && (
                <p className="text-[10px] text-rose-600">
                  Cancelled on: {formatDate(rfq.cancelled_at)}
                </p>
              )}
            </div>
          )}

          {/* Associated Requisition Context Bar */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <HiOutlineSparkles className="w-4 h-4 text-violet-600" />
                Associated Purchase Request
              </span>
              <span className="font-mono text-xs font-bold text-violet-700">
                {req.req_number || 'N/A'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                <span className="font-bold text-slate-900">{req.department_name || req.department?.name || 'General Hospital'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Supply Category</span>
                <span className="font-bold text-violet-700">{req.category || 'General Supplies'}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Requisition Budget</span>
                <span className="font-bold text-slate-900">{formatCurrency(req.estimated_budget || rfq.estimated_budget)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Issued By</span>
                <span className="font-bold text-slate-900">
                  {creator.first_name ? `${creator.first_name} ${creator.last_name}` : (creator.username || 'Committee Member')}
                </span>
              </div>
            </div>
          </div>

          {/* Quotation Evaluation & Comparison Overview */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-50/70 via-indigo-50/50 to-slate-50 border border-violet-200/70 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 pb-2.5">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <HiTrendingUp className="w-4 h-4 text-violet-600" />
                  Quotation Progress &amp; Vendor Comparison
                </h4>
                <p className="text-[11px] text-slate-500">
                  {quotedCount} of {totalInvited} invited vendors have responded with formal binding quotes.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white text-violet-800 border border-violet-200 shadow-2xs">
                  Response Rate: {totalInvited > 0 ? Math.round((quotedCount / totalInvited) * 100) : 0}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white/80 p-3 rounded-xl border border-violet-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Quotation Responses</span>
                <span className="text-base font-black text-slate-900">
                  {quotedCount} <span className="text-xs font-semibold text-slate-400">/ {totalInvited} Received</span>
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {totalInvited - quotedCount > 0 ? `${totalInvited - quotedCount} pending submission` : 'All vendors submitted'}
                </span>
              </div>

              <div className="bg-white/80 p-3 rounded-xl border border-violet-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Lowest Quoted Price</span>
                <span className="text-base font-black text-emerald-700">
                  {lowestPrice !== null ? formatCurrency(lowestPrice) : 'Pending Quotes'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {lowestPrice !== null && (req.estimated_budget || rfq.estimated_budget) ? (
                    Number(req.estimated_budget || rfq.estimated_budget) >= lowestPrice ? (
                      <span className="text-emerald-600 font-semibold">✓ Within requisition budget</span>
                    ) : (
                      <span className="text-rose-600 font-semibold">Exceeds requisition budget</span>
                    )
                  ) : 'Awaiting responses'}
                </span>
              </div>

              <div className="bg-white/80 p-3 rounded-xl border border-violet-100">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Fastest Delivery Lead Time</span>
                <span className="text-base font-black text-indigo-700">
                  {shortestLeadTime !== null ? `${shortestLeadTime} Calendar Days` : 'Pending Quotes'}
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  {shortestLeadTime !== null ? 'Earliest delivery capability' : 'Awaiting vendor lead times'}
                </span>
              </div>
            </div>
          </div>

          {/* Vendor-Wise Quotation Tracking & Review Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <HiOfficeBuilding className="w-4 h-4 text-violet-600" />
                  Vendor-Wise Quotation &amp; Review Status ({totalInvited} Invited)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Track individual vendor invitations, response statuses, and review formal quotations for competitive award.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {vendorTracking.map((vendor) => {
                const isAccepted = vendor.quotation_status === 'ACCEPTED';
                const isRejected = vendor.quotation_status === 'REJECTED';
                const isSubmitted = vendor.has_quoted && !isAccepted && !isRejected;
                const isPending = !vendor.has_quoted;

                return (
                  <div
                    key={vendor.vendor_id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isAccepted
                        ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-300 shadow-sm'
                        : isSubmitted
                        ? 'bg-white border-violet-200 hover:shadow-md'
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-violet-700 text-xs">
                            {vendor.vendor_code}
                          </span>
                          <h5 className="font-bold text-slate-900 text-sm">
                            {vendor.company_name}
                          </h5>
                          {isAccepted && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                              <HiBadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Winning Quotation Accepted
                            </span>
                          )}
                          {isRejected && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Rejected
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                          <span>Contact: <strong>{vendor.contact_person}</strong></span>
                          <span>•</span>
                          <span>Email: <strong>{vendor.email}</strong></span>
                          <span>•</span>
                          <span>Phone: <strong>{vendor.phone}</strong></span>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                          <HiMail className="w-3 h-3 text-indigo-500" />
                          Invitation: {vendor.invitation_status_display}
                        </span>

                        {isPending ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <HiClock className="w-3 h-3 text-amber-600" />
                            Awaiting Quotation
                          </span>
                        ) : (
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                            isAccepted
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : isRejected
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-violet-50 text-violet-700 border-violet-200'
                          }`}>
                            <HiDocumentText className="w-3 h-3" />
                            {vendor.quotation_status_display}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quotation Details or Pending Banner */}
                    <div className="pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {vendor.has_quoted ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs w-full sm:w-auto">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Quotation No.</span>
                            <span className="font-mono font-bold text-slate-900">{vendor.quotation_number}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Quoted Total</span>
                            <span className="font-extrabold text-violet-700 text-sm">
                              {formatCurrency(vendor.total_amount)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Lead Time</span>
                            <span className="font-bold text-slate-800">
                              {vendor.lead_time_days ? `${vendor.lead_time_days} Days` : 'Standard'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Submitted On</span>
                            <span className="font-medium text-slate-700">{formatDate(vendor.submission_date)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-500 text-xs flex items-center gap-2">
                          <HiClock className="w-4 h-4 text-amber-500" />
                          <span>Invited on <strong>{formatDate(vendor.invited_at)}</strong>. Vendor has not yet submitted formal quotation.</span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {isPending && isSentOrOpen && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenRecordQuotation(vendor)}
                            className="text-xs font-bold flex items-center gap-1 shadow-2xs"
                          >
                            <HiPlus className="w-3.5 h-3.5" />
                            <span>Record Quotation</span>
                          </Button>
                        )}

                        {isSubmitted && !hasAcceptedQuotation && isSentOrOpen && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleAcceptQuotation(vendor.quotation_id, vendor.company_name)}
                              disabled={actionLoadingId === vendor.quotation_id}
                              className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm shadow-emerald-500/20"
                            >
                              {actionLoadingId === vendor.quotation_id ? (
                                <HiRefresh className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <HiCheck className="w-3.5 h-3.5" />
                              )}
                              <span>Accept Quotation</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectQuotation(vendor.quotation_id, vendor.company_name)}
                              disabled={actionLoadingId === vendor.quotation_id}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Remarks if present */}
                    {vendor.remarks && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600 bg-slate-50/50 p-2 rounded-lg">
                        <strong>Vendor Remarks:</strong> {vendor.remarks}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Inline Modal for Recording Quotation */}
          {recordingVendor && (
            <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-violet-100 space-y-4 text-xs"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">
                      Record Quotation: {recordingVendor.company_name}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      RFQ {rfq.rfq_number} • Vendor Code: {recordingVendor.vendor_code}
                    </p>
                  </div>
                  <button
                    onClick={() => setRecordingVendor(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <HiX className="w-4 h-4" />
                  </button>
                </div>

                {recordingError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                    {recordingError}
                  </div>
                )}

                <form onSubmit={handleSubmitRecordedQuotation} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Total Quoted Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 45000.00"
                      value={quoteAmount}
                      onChange={(e) => setQuoteAmount(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 font-bold"
                    />
                    <span className="text-[10px] text-slate-400">Requisition Estimated Budget: {formatCurrency(req.estimated_budget || rfq.estimated_budget)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Delivery Lead Time (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={leadTimeDays}
                        onChange={(e) => setLeadTimeDays(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Quote Valid Until
                      </label>
                      <input
                        type="date"
                        value={quoteValidUntil}
                        onChange={(e) => setQuoteValidUntil(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Commercial Terms &amp; Quotation Remarks
                    </label>
                    <textarea
                      rows={3}
                      value={quoteRemarks}
                      onChange={(e) => setQuoteRemarks(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
                      placeholder="e.g. Price includes standard 1-year hospital warranty, transit insurance, and delivery to Central Stores."
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRecordingVendor(null)}
                      disabled={recordingSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      type="submit"
                      disabled={recordingSubmitting}
                      className="font-bold flex items-center gap-1"
                    >
                      {recordingSubmitting ? (
                        <>
                          <HiRefresh className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <HiCheck className="w-3.5 h-3.5" />
                          <span>Submit Formal Quotation</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {/* Requested Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                <HiCube className="w-4 h-4 text-violet-600" />
                Requested Items &amp; Requirements ({items.length})
              </h4>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5">Item Name</th>
                    <th className="px-3.5 py-2.5">Category</th>
                    <th className="px-3.5 py-2.5 text-center">Quantity</th>
                    <th className="px-3.5 py-2.5">UOM</th>
                    <th className="px-3.5 py-2.5">Technical Specifications</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3.5 py-4 text-center text-slate-400">
                        {req.title || rfq.title} (Quantity: {req.quantity || 1})
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/50">
                        <td className="px-3.5 py-2.5 font-bold text-slate-900">
                          {it.item_name}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600">
                          {it.category || 'Standard'}
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-bold text-slate-900">
                          {it.quantity}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600">
                          {it.unit_of_measurement || 'Piece'}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 max-w-xs font-mono text-[11px]">
                          {it.technical_specifications || 'Hospital standard specifications.'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Logistics & Procurement Terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <HiTruck className="w-3.5 h-3.5 text-violet-600" />
                Delivery Requirements &amp; Destination
              </span>
              <p className="text-slate-800 font-medium leading-relaxed">
                {rfq.delivery_requirements || 'Delivery within 14 calendar days from PO issuance.'}
              </p>
              <div className="pt-1 text-[11px] text-slate-500">
                <strong>Destination:</strong> {rfq.delivery_location || 'Central Hospital Stores'}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                <HiDocumentText className="w-3.5 h-3.5 text-violet-600" />
                Procurement Terms &amp; Conditions
              </span>
              <p className="text-slate-700 leading-relaxed font-mono text-[11px] line-clamp-4">
                {rfq.terms_and_conditions || 'Standard ProcuraMed hospital procurement guidelines apply.'}
              </p>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div>
              {isSentOrOpen && (
                <button
                  type="button"
                  onClick={() => setCancelModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1.5"
                >
                  <HiBan className="w-4 h-4 text-rose-600" />
                  <span>Cancel this RFQ</span>
                </button>
              )}
            </div>

            <Button
              variant="outline"
              size="md"
              onClick={onClose}
              className="text-xs"
            >
              Close Details
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Cancel RFQ Modal */}
      {cancelModalOpen && (
        <CancelRFQModal
          rfq={rfq}
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          onSuccess={(updatedRFQ) => {
            setCancelModalOpen(false);
            setRfq(updatedRFQ);
            if (onRFQUpdated) {
              onRFQUpdated(updatedRFQ);
            }
          }}
        />
      )}
    </>
  );
};

export default RFQDetailModal;
