import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import Button from '../../components/common/Button';
import {
  HiX,
  HiBeaker,
  HiCheckCircle,
  HiXCircle,
  HiShieldCheck,
  HiDocumentText,
  HiDownload,
  HiInformationCircle,
  HiUser,
  HiRefresh
} from 'react-icons/hi';

const EVALUATION_OUTCOMES = [
  {
    value: 'Technically Suitable',
    label: 'Technically Suitable (Approve)',
    shortLabel: 'Technically Suitable',
    actionDesc: 'Confirms equipment meets required technical specifications. On submission, forwards the request to Procurement Committee review.',
    tag: 'Procurement Committee Review',
    color: 'emerald',
    icon: HiCheckCircle,
    activeBorder: 'border-emerald-600 bg-emerald-50/70 text-emerald-900',
    tagClass: 'bg-emerald-100 text-emerald-800'
  },
  {
    value: 'Requires Clarification',
    label: 'Return for Clarification',
    shortLabel: 'Return for Clarification',
    actionDesc: 'Identifies unclear specifications or missing information. Returns request for clarification and resubmission.',
    tag: 'Return for Clarification',
    color: 'amber',
    icon: HiRefresh,
    activeBorder: 'border-amber-600 bg-amber-50/70 text-amber-900',
    tagClass: 'bg-amber-100 text-amber-800'
  }
];

const TechnicalEvaluationModal = ({
  requisition,
  isOpen,
  onClose,
  onEvaluationSubmitted
}) => {
  const [outcome, setOutcome] = useState('');
  const [remarks, setRemarks] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setOutcome('');
      setRemarks('');
      setErrorMsg('');
      setSuccessMsg('');
      setDocLoading(false);
    }
  }, [isOpen, requisition]);

  if (!isOpen || !requisition) return null;

  const handleOpenDocument = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const actualUrl = requisition.actual_document_url || requisition.supporting_document;
    const directTarget = actualUrl || requisition.supporting_document_url;

    // If direct actual URL points to media file (e.g. /media/ or http), open it in a new window/tab
    if (actualUrl && (actualUrl.includes('/media/') || actualUrl.startsWith('blob:') || actualUrl.startsWith('data:'))) {
      window.open(actualUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setDocLoading(true);
    try {
      const res = await axiosClient.get(`/procurement/requisitions/${requisition.id}/document/`, {
        responseType: 'blob'
      });
      const contentType = res.headers['content-type'] || 'application/pdf';
      const blob = new Blob([res.data], { type: contentType });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank', 'noopener,noreferrer');
    } catch (err) {
      if (directTarget) {
        window.open(directTarget, '_blank', 'noopener,noreferrer');
      } else {
        alert(err.response?.data?.detail || 'Failed to open supporting document.');
      }
    } finally {
      setDocLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Strict validation
    if (!outcome) {
      setErrorMsg('Please select an Evaluation Outcome: "Technically Suitable (Approve)" or "Return for Clarification".');
      return;
    }

    if (!remarks.trim()) {
      if (outcome === 'Requires Clarification') {
        setErrorMsg('Please provide a clarification reason explaining what technical specifications or information are required.');
      } else {
        setErrorMsg('Technical Assessment Remarks are required to submit an evaluation.');
      }
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        recommendation: outcome,
        remarks: remarks.trim()
      };

      const res = await axiosClient.post(
        `/procurement/requisitions/${requisition.id}/evaluate/`,
        payload
      );

      setSuccessMsg(res.data.status || 'Technical evaluation successfully recorded.');
      if (onEvaluationSubmitted) {
        onEvaluationSubmitted(res.data);
      }

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const respData = err.response?.data;
      if (typeof respData === 'object' && respData !== null) {
        const firstErr = respData.detail || respData.remarks || respData.recommendation || JSON.stringify(respData);
        setErrorMsg(firstErr);
      } else {
        setErrorMsg('Failed to submit technical evaluation. Please check your inputs and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not Specified';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const itemsList = requisition.items || [];
  const reqNumber = requisition.req_number || requisition.procurement_ref || 'REQ-XXXX';
  const docUrl = requisition.actual_document_url || requisition.supporting_document || requisition.supporting_document_url;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-violet-100 flex flex-col max-h-[92vh] overflow-hidden my-auto"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-violet-900 via-indigo-900 to-purple-900 text-white flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-teal-300 shadow-inner">
                <HiBeaker className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-violet-200">{reqNumber}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/15 border border-white/20 text-[10px] font-bold text-white">
                    {requisition.specialization_category || requisition.technical_specialization || 'Technical'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/30 text-[10px] font-bold text-amber-200 uppercase">
                    Pending Evaluation
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5 truncate max-w-md sm:max-w-xl">
                  {requisition.title}
                </h2>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Close"
            >
              <HiX className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1 text-slate-700 text-xs">
            {/* Feedback Alerts */}
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
                <HiXCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <span className="flex-1">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
                <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span className="flex-1">{successMsg}</span>
              </div>
            )}

            {/* SECTION 1: ORIGINAL PURCHASE REQUEST DETAILS (READ-ONLY) */}
            <div className="bg-slate-50/90 rounded-2xl p-4 sm:p-5 border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <HiInformationCircle className="w-4 h-4 text-violet-600" />
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Purchase Request Information (Read-Only)
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  Non-Editable
                </span>
              </div>

              {/* Top metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Department</span>
                  <p className="font-extrabold text-slate-800 mt-0.5 truncate">{requisition.department_name || 'N/A'}</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Category</span>
                  <p className="font-extrabold text-slate-800 mt-0.5 truncate">{requisition.category || 'N/A'}</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Required Date</span>
                  <p className="font-extrabold text-slate-800 mt-0.5">{formatDate(requisition.required_date)}</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Estimated Budget</span>
                  <p className="font-extrabold text-violet-700 mt-0.5">{formatCurrency(requisition.total_amount || requisition.estimated_price || requisition.estimated_budget)}</p>
                </div>
              </div>

              {/* Assigned Purchase Officer info */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-violet-50/60 rounded-xl border border-violet-100 text-[11px]">
                <div className="flex items-center gap-2">
                  <HiUser className="w-4 h-4 text-violet-600" />
                  <span className="font-medium text-slate-600">Reviewing Purchase Officer:</span>
                  <strong className="text-slate-900 font-bold">
                    {requisition.assigned_purchase_officer_name || 'Assigned Officer'}
                  </strong>
                  {requisition.assigned_purchase_officer_employee_id && (
                    <span className="px-1.5 py-0.5 rounded-md bg-white text-violet-700 border border-violet-200 font-mono text-[10px] font-bold">
                      {requisition.assigned_purchase_officer_employee_id}
                    </span>
                  )}
                </div>
                {requisition.assigned_date && (
                  <span className="text-slate-400 text-[10px]">
                    Assigned: {formatDate(requisition.assigned_date)}
                  </span>
                )}
              </div>

              {/* Justification */}
              {requisition.justification && (
                <div className="bg-white p-3 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Clinical Justification &amp; Purpose</span>
                  <p className="text-slate-700 leading-relaxed font-medium">
                    {requisition.justification}
                  </p>
                </div>
              )}

              {/* Previous Clarification Request (if resubmitted) */}
              {(requisition.clarification_reason || requisition.review_comments) && (
                <div className="bg-amber-50/90 p-3.5 rounded-xl border border-amber-200/90 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-[11px] uppercase tracking-wider">
                    <HiRefresh className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>Clarification Reason Requested by Technical Officer</span>
                  </div>
                  <p className="text-amber-950 text-xs leading-relaxed font-medium bg-white/70 p-2.5 rounded-lg border border-amber-200/50">
                    {requisition.clarification_reason || requisition.review_comments}
                  </p>
                </div>
              )}

              {/* Items Table with Specifications */}
              <div className="space-y-2">
                <span className="text-[10px] font-extrabold text-slate-600 uppercase tracking-wider block">
                  Requested Items &amp; Detailed Specifications ({itemsList.length})
                </span>
                {itemsList.length === 0 ? (
                  <p className="text-slate-400 italic">No individual line items listed.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[10px] uppercase">
                        <tr>
                          <th className="px-3 py-2">Item / Product</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-right">Unit Price</th>
                          <th className="px-3 py-2 text-right">Total Price</th>
                          <th className="px-3 py-2">Detailed Specifications</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {itemsList.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50/60">
                            <td className="px-3 py-2.5 font-bold text-slate-900 whitespace-nowrap">
                              {item.item_name}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">
                              {item.category || requisition.category || 'N/A'}
                            </td>
                            <td className="px-3 py-2.5 text-center font-bold text-slate-800">
                              {item.quantity}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                              {formatCurrency(item.estimated_unit_price)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                              {formatCurrency(item.total_price)}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600 max-w-xs break-words font-medium">
                              {item.specifications || <span className="text-slate-300 italic">No custom specs</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Existing Supporting Document Link */}
              {docUrl && (
                <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <HiDocumentText className="w-5 h-5 text-violet-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-slate-800">Existing Requisition Supporting Document</p>
                      <p className="text-[10px] text-slate-400">Attached clinical / procurement documentation</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenDocument}
                    disabled={docLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 hover:border-violet-300 font-bold text-xs transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <HiDocumentText className="w-3.5 h-3.5 text-violet-600" />
                    <span>{docLoading ? 'Opening...' : 'View Document'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* SECTION 2: TECHNICAL EVALUATION FORM */}
            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              <div className="border-b border-slate-200 pb-2">
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <HiShieldCheck className="w-5 h-5 text-violet-600" />
                  <span>Technical Officer Evaluation Form</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Confirm equipment specification compliance or return for clarification. Technical documents are not required.
                </p>
              </div>

              {/* 1. Evaluation Outcome (Exactly 2 Choices) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800 text-xs">
                    1. Evaluation Outcome <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Select one outcome</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {EVALUATION_OUTCOMES.map((opt) => {
                    const isSelected = outcome === opt.value;
                    const Icon = opt.icon;
                    return (
                      <div
                        key={opt.value}
                        onClick={() => setOutcome(opt.value)}
                        className={`cursor-pointer p-4 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                          isSelected
                            ? `${opt.activeBorder} shadow-sm`
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-extrabold text-slate-900 text-xs">{opt.label}</span>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${opt.tagClass}`}>
                            {opt.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug mb-2">{opt.actionDesc}</p>
                        <div className="flex items-center gap-1.5 text-[11px] font-bold mt-auto pt-2 border-t border-slate-100/80">
                          <Icon className={`w-4 h-4 ${opt.color === 'emerald' ? 'text-emerald-600' : 'text-amber-500'}`} />
                          <span className={opt.color === 'emerald' ? 'text-emerald-700' : 'text-amber-700'}>
                            {isSelected ? 'Selected' : 'Select this outcome'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Technical Assessment Remarks / Clarification Reason (Required) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="tech-remarks" className="block font-bold text-slate-800 text-xs">
                    {outcome === 'Requires Clarification'
                      ? '2. Clarification Reason / Missing Specifications'
                      : outcome === 'Technically Suitable'
                      ? '2. Technical Assessment & Approval Remarks'
                      : '2. Technical Assessment / Remarks'} <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">
                    {remarks.length} characters (Mandatory)
                  </span>
                </div>
                <textarea
                  id="tech-remarks"
                  rows={4}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={
                    outcome === 'Requires Clarification'
                      ? 'Detail the specific technical parameters, missing documentation, or unclear specifications that the department must clarify before approval...'
                      : outcome === 'Technically Suitable'
                      ? 'Confirm that specifications, safety standards, and clinical requirements are met, and provide basis for forwarding to Procurement Committee...'
                      : 'Provide your technical evaluation remarks or clarification requirements...'
                  }
                  className="w-full p-3.5 rounded-2xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent font-medium"
                  required
                />
                <p className="text-[10px] text-slate-400">
                  {outcome === 'Requires Clarification'
                    ? 'This clarification reason will be returned directly to the requisition originator for resubmission.'
                    : outcome === 'Technically Suitable'
                    ? 'These remarks will accompany the purchase request for Procurement Committee review.'
                    : 'Mandatory technical assessment notes.'}
                </p>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={onClose}
                  disabled={submitting}
                  className="border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={submitting}
                  className={`text-white font-bold text-xs gap-2 shadow-md ${
                    outcome === 'Requires Clarification'
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                      : outcome === 'Technically Suitable'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-violet-700 hover:bg-violet-800 shadow-violet-700/20'
                  }`}
                >
                  {submitting ? (
                    <>
                      <HiRefresh className="w-4 h-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : outcome === 'Requires Clarification' ? (
                    <>
                      <HiRefresh className="w-4 h-4" />
                      <span>Return for Clarification</span>
                    </>
                  ) : outcome === 'Technically Suitable' ? (
                    <>
                      <HiCheckCircle className="w-4 h-4" />
                      <span>Approve &amp; Forward to Committee</span>
                    </>
                  ) : (
                    <>
                      <HiShieldCheck className="w-4 h-4" />
                      <span>Submit Evaluation</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default TechnicalEvaluationModal;
