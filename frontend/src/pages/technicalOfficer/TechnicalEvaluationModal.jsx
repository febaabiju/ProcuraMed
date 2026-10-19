import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import Button from '../../components/common/Button';
import {
  HiX,
  HiBeaker,
  HiCheckCircle,
  HiXCircle,
  HiQuestionMarkCircle,
  HiShieldCheck,
  HiUpload,
  HiDocumentText,
  HiDownload,
  HiInformationCircle,
  HiTag,
  HiUser,
  HiCalendar,
  HiCurrencyDollar,
  HiOfficeBuilding,
  HiRefresh
} from 'react-icons/hi';

const COMPLIANCE_CHOICES = [
  {
    value: 'Compliant',
    label: 'Compliant',
    description: 'Fully satisfies technical and hospital safety requirements',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 peer-checked:border-emerald-600 peer-checked:bg-emerald-100/70',
    icon: HiCheckCircle,
    color: 'emerald'
  },
  {
    value: 'Partially Compliant',
    label: 'Partially Compliant',
    description: 'Minor specification deviations or missing non-critical features',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 peer-checked:border-amber-600 peer-checked:bg-amber-100/70',
    icon: HiInformationCircle,
    color: 'amber'
  },
  {
    value: 'Not Compliant',
    label: 'Not Compliant',
    description: 'Fails mandatory clinical, technical, or electrical safety specs',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 peer-checked:border-rose-600 peer-checked:bg-rose-100/70',
    icon: HiXCircle,
    color: 'rose'
  }
];

const RECOMMENDATION_CHOICES = [
  {
    value: 'Technically Suitable',
    label: 'Technically Suitable',
    actionDesc: 'Moves request to Procurement Committee review stage',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 peer-checked:border-emerald-600 peer-checked:bg-emerald-100/70',
    tag: 'Procurement Committee',
    color: 'emerald'
  },
  {
    value: 'Technically Not Suitable',
    label: 'Technically Not Suitable',
    actionDesc: 'Rejects request due to technical non-compliance',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200 peer-checked:border-rose-600 peer-checked:bg-rose-100/70',
    tag: 'Rejection',
    color: 'rose'
  },
  {
    value: 'Requires Clarification',
    label: 'Requires Clarification',
    actionDesc: 'Returns request for specification clarification',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200 peer-checked:border-sky-600 peer-checked:bg-sky-100/70',
    tag: 'Clarification / Return',
    color: 'sky'
  }
];

const TechnicalEvaluationModal = ({
  requisition,
  isOpen,
  onClose,
  onEvaluationSubmitted
}) => {
  const [compliance, setCompliance] = useState('');
  const [remarks, setRemarks] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCompliance('');
      setRemarks('');
      setRecommendation('');
      setFile(null);
      setFileName('');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, requisition]);

  if (!isOpen || !requisition) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.size > 15 * 1024 * 1024) {
        setErrorMsg('Attached file exceeds 15 MB limit.');
        return;
      }
      setFile(selected);
      setFileName(selected.name);
      setErrorMsg('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // Strict validation
    if (!compliance) {
      setErrorMsg('Please select a Technical Compliance decision (Compliant, Partially Compliant, or Not Compliant).');
      return;
    }

    if (!remarks.trim()) {
      setErrorMsg('Technical Assessment / Remarks is required. Please explain your technical findings.');
      return;
    }

    if (!recommendation) {
      setErrorMsg('Please select a Recommendation (Technically Suitable, Technically Not Suitable, or Requires Clarification).');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('compliance', compliance);
      formData.append('remarks', remarks.trim());
      formData.append('recommendation', recommendation);
      if (file) {
        formData.append('supporting_document', file);
      }

      const res = await axiosClient.post(
        `/procurement/requisitions/${requisition.id}/evaluate/`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
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
        const firstErr = respData.detail || respData.compliance || respData.remarks || respData.recommendation || JSON.stringify(respData);
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
  const docUrl = requisition.supporting_document_url || requisition.supporting_document;

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
                  <a
                    href={docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 font-bold text-xs transition-colors"
                  >
                    <HiDownload className="w-3.5 h-3.5" />
                    <span>View / Download</span>
                  </a>
                </div>
              )}
            </div>

            {/* SECTION 2: TECHNICAL EVALUATION FORM (REQUIREMENT 4) */}
            <form onSubmit={handleSubmit} className="space-y-5 pt-2">
              <div className="border-b border-slate-200 pb-2">
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <HiShieldCheck className="w-5 h-5 text-violet-600" />
                  <span>Technical Officer Evaluation Form</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Complete technical specification compliance check, assessment remarks, and routing recommendation.
                </p>
              </div>

              {/* 1. Technical Compliance Decision */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-800 text-xs">
                  1. Technical Compliance <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {COMPLIANCE_CHOICES.map((opt) => {
                    const isSelected = compliance === opt.value;
                    const Icon = opt.icon;
                    return (
                      <div
                        key={opt.value}
                        onClick={() => setCompliance(opt.value)}
                        className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-violet-600 bg-violet-50/70 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-extrabold text-slate-900 text-xs">{opt.label}</span>
                          <Icon className={`w-4 h-4 ${
                            opt.value === 'Compliant' ? 'text-emerald-600' :
                            opt.value === 'Partially Compliant' ? 'text-amber-500' : 'text-rose-600'
                          }`} />
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug">{opt.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Technical Assessment / Remarks (Required) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="tech-remarks" className="block font-bold text-slate-800 text-xs">
                    2. Technical Assessment / Remarks <span className="text-rose-500">*</span>
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
                  placeholder="Detail your technical findings, compliance checks against hospital specifications, electrical safety, clinical efficacy, and justification for your recommendation..."
                  className="w-full p-3.5 rounded-2xl border border-slate-300 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent font-medium"
                  required
                />
              </div>

              {/* 3. Recommendation */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-800 text-xs">
                  3. Recommendation <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {RECOMMENDATION_CHOICES.map((rec) => {
                    const isSelected = recommendation === rec.value;
                    return (
                      <div
                        key={rec.value}
                        onClick={() => setRecommendation(rec.value)}
                        className={`cursor-pointer p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-violet-600 bg-violet-50/70 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-extrabold text-slate-900 text-xs">{rec.label}</span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                            rec.color === 'emerald' ? 'bg-emerald-100 text-emerald-800' :
                            rec.color === 'rose' ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'
                          }`}>
                            {rec.tag}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-snug">{rec.actionDesc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Supporting Technical Documents (Optional Upload) */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-800 text-xs">
                  4. Supporting Technical Documents <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-violet-300 transition-colors bg-slate-50/60 flex flex-col items-center justify-center gap-2">
                  <HiUpload className="w-6 h-6 text-slate-400" />
                  <div className="text-center">
                    <label htmlFor="eval-doc-upload" className="font-bold text-violet-700 hover:text-violet-900 cursor-pointer text-xs">
                      {fileName ? 'Replace attached document' : 'Click to upload technical datasheet, inspection matrix, or certificate'}
                    </label>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      PDF, DOC, DOCX, or images up to 15 MB
                    </p>
                  </div>
                  <input
                    id="eval-doc-upload"
                    type="file"
                    className="hidden"
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  />
                  {fileName && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700 mt-1">
                      <HiDocumentText className="w-4 h-4 text-violet-600" />
                      <span>{fileName}</span>
                      <button
                        type="button"
                        onClick={() => { setFile(null); setFileName(''); }}
                        className="text-slate-400 hover:text-rose-600 ml-1"
                      >
                        <HiX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
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
                  className="bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs gap-2 shadow-md shadow-violet-700/20"
                >
                  {submitting ? (
                    <>
                      <HiRefresh className="w-4 h-4 animate-spin" />
                      <span>Submitting Evaluation...</span>
                    </>
                  ) : (
                    <>
                      <HiShieldCheck className="w-4 h-4" />
                      <span>Submit Technical Evaluation</span>
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
