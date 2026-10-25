import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import Button from '../common/Button';
import {
  HiX,
  HiCheckCircle,
  HiClock,
  HiTruck,
  HiMail,
  HiPhone,
  HiCalendar,
  HiInformationCircle,
  HiPlusCircle,
  HiRefresh,
  HiDocumentText,
  HiExternalLink
} from 'react-icons/hi';

const RFQTrackingModal = ({ isOpen, onClose, requisition, onRFQUpdated }) => {
  const [recordingVendorId, setRecordingVendorId] = useState(null);
  const [quotationForm, setQuotationForm] = useState({
    total_amount: '',
    lead_time_days: '',
    remarks: ''
  });
  const [submittingQuotation, setSubmittingQuotation] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  if (!isOpen || !requisition) return null;

  const rfq = requisition.latest_rfq;

  if (!rfq) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
        <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-violet-100 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-100">
            <HiInformationCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No Active RFQ</h3>
            <p className="text-xs text-slate-500 mt-1">
              There is currently no Request for Quotation recorded for {requisition.req_number}.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onClose} className="w-full text-xs font-semibold">
            Close
          </Button>
        </div>
      </div>
    );
  }

  const vendors = rfq.vendor_tracking || [];
  const invitedCount = rfq.invited_vendors_count || vendors.length;
  const quotesCount = rfq.quotations_count || vendors.filter(v => v.has_quoted).length;
  const pendingCount = Math.max(0, invitedCount - quotesCount);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
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

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '₹0.00';
    const num = Number(amount);
    return isNaN(num) ? '₹0.00' : `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const handleOpenRecordForm = (vendor) => {
    setRecordingVendorId(vendor.vendor_id);
    setQuotationForm({
      total_amount: vendor.total_amount ? String(vendor.total_amount) : '',
      lead_time_days: vendor.lead_time_days ? String(vendor.lead_time_days) : '',
      remarks: ''
    });
    setFormError('');
    setFormSuccess('');
  };

  const handleRecordQuotationSubmit = async (e) => {
    e.preventDefault();
    if (!quotationForm.total_amount || isNaN(Number(quotationForm.total_amount)) || Number(quotationForm.total_amount) <= 0) {
      setFormError('Please enter a valid positive total quotation amount.');
      return;
    }

    setSubmittingQuotation(true);
    setFormError('');
    setFormSuccess('');

    try {
      const payload = {
        vendor_id: recordingVendorId,
        total_amount: Number(quotationForm.total_amount),
        lead_time_days: quotationForm.lead_time_days ? Number(quotationForm.lead_time_days) : null,
        remarks: quotationForm.remarks.trim()
      };

      const res = await axiosClient.post(`/procurement/rfqs/${rfq.id}/record-quotation/`, payload);
      setFormSuccess(res.data?.message || 'Quotation recorded successfully!');
      
      setTimeout(() => {
        setRecordingVendorId(null);
        setFormSuccess('');
        if (onRFQUpdated) {
          onRFQUpdated();
        }
      }, 1000);
    } catch (err) {
      const detail = err.response?.data?.total_amount || err.response?.data?.vendor_id || err.response?.data?.detail || 'Failed to record quotation.';
      setFormError(Array.isArray(detail) ? detail.join(', ') : detail);
    } finally {
      setSubmittingQuotation(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-3xl shadow-2xl border border-violet-100 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-violet-50/80 via-white to-indigo-50/40 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-violet-700 bg-violet-100 px-2.5 py-0.5 rounded-lg border border-violet-200">
                {rfq.rfq_number || 'RFQ Track'}
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                Req: {requisition.req_number}
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <HiCalendar className="w-3.5 h-3.5 text-slate-400" />
                Due: {formatDate(rfq.due_date)}
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              {rfq.title || `RFQ for ${requisition.title}`}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Status Metrics Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Metric 1: Overall RFQ Status */}
            <div className="p-3.5 rounded-2xl bg-violet-50/70 border border-violet-100 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 block">
                Workflow Status
              </span>
              <div className="flex items-center gap-1.5 font-bold text-xs text-violet-900">
                <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse" />
                <span>{rfq.quotation_workflow_status_display || rfq.status_display || 'Awaiting Quotations'}</span>
              </div>
              <p className="text-[10px] text-violet-700/80">
                {requisition.status === 'RFQ_ISSUED' ? 'Awaiting Quotations' : (requisition.status_display || 'In Progress')}
              </p>
            </div>

            {/* Metric 2: Invited Vendors */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Invited Vendors
              </span>
              <p className="text-lg font-black text-slate-900">
                {invitedCount} <span className="text-xs font-semibold text-slate-500">Vendors</span>
              </p>
              <p className="text-[10px] text-slate-500">2-4 vendors comparison quota</p>
            </div>

            {/* Metric 3: Quotations Received */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                Quotations Received
              </span>
              <p className="text-lg font-black text-emerald-800">
                {quotesCount} <span className="text-xs font-semibold text-emerald-600">/ {invitedCount}</span>
              </p>
              <p className="text-[10px] text-emerald-700">
                {quotesCount > 0 ? `${quotesCount} formal bids submitted` : 'Pending vendor responses'}
              </p>
            </div>

            {/* Metric 4: Pending Submissions */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block">
                Awaiting Response
              </span>
              <p className="text-lg font-black text-amber-800">
                {pendingCount} <span className="text-xs font-semibold text-amber-600">Pending</span>
              </p>
              <p className="text-[10px] text-amber-700">Tracked until RFQ closes</p>
            </div>
          </div>

          {/* Vendors Tracking List (Requirement 4) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Individual Vendor Quotation Status ({vendors.length})
                </h4>
                <p className="text-[11px] text-slate-400">
                  Tracking sent date, quotation submission, pricing, and committee review for each invited vendor.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {vendors.map((vendor) => {
                const isFormOpen = recordingVendorId === vendor.vendor_id;

                return (
                  <div
                    key={vendor.vendor_id}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white hover:border-violet-200 transition space-y-3"
                  >
                    {/* Top line of vendor card */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm border border-violet-200 flex-shrink-0">
                          {vendor.vendor_name ? vendor.vendor_name.charAt(0) : 'V'}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="font-bold text-slate-900 text-sm">{vendor.vendor_name}</h5>
                            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {vendor.vendor_code || 'VENDOR'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                            {vendor.email && (
                              <span className="flex items-center gap-1">
                                <HiMail className="w-3.5 h-3.5 text-slate-400" />
                                {vendor.email}
                              </span>
                            )}
                            {vendor.phone && (
                              <span className="flex items-center gap-1">
                                <HiPhone className="w-3.5 h-3.5 text-slate-400" />
                                {vendor.phone}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <HiClock className="w-3.5 h-3.5 text-slate-400" />
                              RFQ Sent: {formatDate(vendor.invited_at)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                        {/* Invitation Status */}
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {vendor.invitation_status_display || vendor.invitation_status}
                        </span>

                        {/* Quotation Submission Status */}
                        {vendor.has_quoted ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            Quotation Submitted ({vendor.quotation_number})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <HiClock className="w-3.5 h-3.5 text-amber-600" />
                            Awaiting Submission
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quotation Details (if submitted) */}
                    {vendor.has_quoted ? (
                      <div className="space-y-2">
                        <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Quoted Amount
                            </span>
                            <span className="font-black text-slate-900 text-sm">
                              {formatCurrency(vendor.total_amount)}
                            </span>
                            {(parseFloat(vendor.tax_amount || 0) > 0 || parseFloat(vendor.shipping_charges || 0) > 0) && (
                              <span className="text-[10px] text-slate-500 block mt-0.5">
                                Incl. {parseFloat(vendor.tax_percentage || 0) > 0 ? `${vendor.tax_percentage}% Tax` : 'Tax'} ({formatCurrency(vendor.tax_amount)})
                                {parseFloat(vendor.shipping_charges || 0) > 0 && ` + Shipping (${formatCurrency(vendor.shipping_charges)})`}
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Delivery Lead Time
                            </span>
                            <span className="font-bold text-slate-800 flex items-center gap-1">
                              <HiTruck className="w-3.5 h-3.5 text-slate-400" />
                              {vendor.lead_time_days ? `${vendor.lead_time_days} Days` : 'Not specified'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Submission Date
                            </span>
                            <span className="font-medium text-slate-700">
                              {formatDate(vendor.submission_date)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Review Status
                            </span>
                            <span className="font-bold text-indigo-700">
                              {vendor.quotation_status_display || 'Submitted for Review'}
                            </span>
                          </div>
                        </div>

                        {/* Extra details: remarks and document attachment */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px]">
                          {vendor.remarks ? (
                            <span className="text-slate-600 italic">
                              Remarks: {vendor.remarks}
                            </span>
                          ) : <span />}
                          {vendor.quotation_document_url && (
                            <a
                              href={vendor.quotation_document_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-violet-700 hover:text-violet-900 font-bold bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-lg border border-violet-200 transition"
                            >
                              <HiDocumentText className="w-3.5 h-3.5" />
                              <span>View Quotation Document</span>
                              <HiExternalLink className="w-3 h-3 ml-0.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-amber-50/40 border border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 text-amber-800">
                          <HiClock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span>Pending response from vendor. Quotation has not been submitted yet.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenRecordForm(vendor)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold text-[11px] hover:bg-amber-100 transition flex items-center gap-1 self-start sm:self-auto shadow-xs"
                        >
                          <HiPlusCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Record Received Quotation</span>
                        </button>
                      </div>
                    )}

                    {/* Inline Record Quotation Form for this Vendor */}
                    <AnimatePresence>
                      {isFormOpen && (
                        <motion.form
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          onSubmit={handleRecordQuotationSubmit}
                          className="pt-3 border-t border-slate-100 space-y-3"
                        >
                          <div className="p-4 rounded-2xl bg-violet-50/60 border border-violet-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <h6 className="font-bold text-violet-950 text-xs">
                                Record Formal Quotation for {vendor.vendor_name}
                              </h6>
                              <button
                                type="button"
                                onClick={() => setRecordingVendorId(null)}
                                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                              >
                                Cancel
                              </button>
                            </div>

                            {formError && (
                              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                                <HiInformationCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                <span>{formError}</span>
                              </div>
                            )}

                            {formSuccess && (
                              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                                <HiCheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                <span>{formSuccess}</span>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div>
                                <label className="font-bold text-slate-700 block mb-1">
                                  Total Quoted Amount (₹) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  required
                                  value={quotationForm.total_amount}
                                  onChange={(e) => setQuotationForm({ ...quotationForm, total_amount: e.target.value })}
                                  placeholder="e.g. 45000.00"
                                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                />
                              </div>

                              <div>
                                <label className="font-bold text-slate-700 block mb-1">
                                  Delivery Lead Time (Days)
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={quotationForm.lead_time_days}
                                  onChange={(e) => setQuotationForm({ ...quotationForm, lead_time_days: e.target.value })}
                                  placeholder="e.g. 7"
                                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="font-bold text-slate-700 block mb-1 text-xs">
                                Remarks / Warranty / Payment Terms
                              </label>
                              <textarea
                                rows={2}
                                value={quotationForm.remarks}
                                onChange={(e) => setQuotationForm({ ...quotationForm, remarks: e.target.value })}
                                placeholder="Vendor notes, warranty details, payment conditions..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setRecordingVendorId(null)}
                                className="text-xs font-semibold"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                disabled={submittingQuotation}
                                className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs gap-1.5"
                              >
                                {submittingQuotation ? (
                                  <>
                                    <HiRefresh className="w-3.5 h-3.5 animate-spin" />
                                    <span>Saving...</span>
                                  </>
                                ) : (
                                  <>
                                    <HiCheckCircle className="w-3.5 h-3.5" />
                                    <span>Save Vendor Quotation</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <p className="text-[11px] text-slate-500 hidden sm:block">
            RFQs remain in "Awaiting Quotations" until quotations are received or the deadline passes.
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs font-semibold px-5"
            >
              Close
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default RFQTrackingModal;
