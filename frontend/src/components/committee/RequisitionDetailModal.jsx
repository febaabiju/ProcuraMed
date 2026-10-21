import React from 'react';
import { motion } from 'framer-motion';
import {
  HiX,
  HiClock,
  HiShieldCheck,
  HiUser,
  HiDocumentText,
  HiDownload,
  HiInformationCircle,
  HiSearch,
  HiCheckCircle,
  HiOutlineSparkles,
  HiUserGroup
} from 'react-icons/hi';
import Button from '../common/Button';

const RequisitionDetailModal = ({
  requisition,
  isOpen,
  onClose,
  onFindVendors,
}) => {
  if (!isOpen || !requisition) return null;

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

  const getPriorityBadge = (priority) => {
    switch (priority?.toUpperCase()) {
      case 'URGENT':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MEDIUM':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'LOW':
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-6 my-8 max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-100 text-violet-800 border border-violet-200">
                {requisition.req_number}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityBadge(requisition.priority)}`}>
                {requisition.priority} Priority
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <HiCheckCircle className="w-3 h-3 text-emerald-600" />
                Purchase Ready
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 leading-snug">
              {requisition.title}
            </h3>
            <p className="text-xs text-slate-500">
              Department: <strong className="text-slate-800">{requisition.department_name}</strong> • Category: <strong className="text-slate-800">{requisition.category}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Request Overview Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs">
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Submitted By</p>
            <p className="font-bold text-slate-800 mt-0.5">
              {requisition.submitted_by_name}
            </p>
            {requisition.submitted_by_employee_id && (
              <span className="font-mono text-[10px] text-slate-500">
                ID: {requisition.submitted_by_employee_id}
              </span>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Submission Date</p>
            <p className="font-bold text-slate-800 mt-0.5">
              {formatDate(requisition.submission_date)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Required Delivery</p>
            <p className="font-bold text-slate-800 mt-0.5">
              {formatDate(requisition.required_date)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-slate-400">Estimated Budget</p>
            <p className="font-extrabold text-violet-900 mt-0.5 text-sm">
              {formatCurrency(requisition.estimated_budget)}
            </p>
          </div>
        </div>

        {/* Committee Assignment & Officer Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Assigned Committee Member Card */}
          <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-100 flex items-center gap-2.5 text-xs">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold flex-shrink-0">
              <HiUserGroup className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-indigo-700 block">Assigned Committee Member</span>
              <p className="font-bold text-indigo-950 truncate">
                {requisition.assigned_committee_member_name || 'Procurement Committee Member'}
              </p>
              <span className="text-[10px] text-indigo-600 font-mono">
                {requisition.assigned_committee_member_employee_id || 'PC101'} • Equal Workload Allocation
              </span>
            </div>
          </div>

          {/* Assigned Purchase Officer Card */}
          <div className="p-3.5 bg-violet-50/60 rounded-2xl border border-violet-100 flex items-center gap-2.5 text-xs">
            <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold flex-shrink-0">
              <HiUser className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-violet-700 block">Assigned Purchase Officer</span>
              <p className="font-bold text-slate-800 truncate">
                {requisition.assigned_purchase_officer_name || 'Assigned Purchase Officer'}
              </p>
              <span className="text-[10px] text-slate-400">
                {requisition.assigned_purchase_officer_employee_id ? `ID: ${requisition.assigned_purchase_officer_employee_id}` : 'Procurement Department'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Detailed Items & Specifications Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase font-bold text-slate-400">
              Requested Items & Specifications ({requisition.items?.length || 0})
            </p>
            <span className="text-[11px] font-bold text-violet-700">
              Total Budget: {formatCurrency(requisition.estimated_budget)}
            </span>
          </div>

          <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5">Item Name</th>
                  <th className="px-3.5 py-2.5">Specifications</th>
                  <th className="px-3.5 py-2.5 text-center">Qty</th>
                  <th className="px-3.5 py-2.5 text-right">Est. Unit Price</th>
                  <th className="px-3.5 py-2.5 text-right">Total Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requisition.items?.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-3.5 py-2.5 font-bold text-slate-800">
                      {it.item_name}
                      <span className="block text-[10px] font-normal text-slate-400">
                        Category: {it.category}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600 max-w-xs leading-relaxed text-[11px]">
                      {it.specifications || 'Standard specifications'}
                    </td>
                    <td className="px-3.5 py-2.5 text-center font-bold text-slate-800">
                      {it.quantity}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-slate-700 font-medium">
                      {formatCurrency(it.estimated_unit_price)}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-slate-900">
                      {formatCurrency(it.total_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Departmental Justification */}
        {requisition.justification && (
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1">
            <p className="text-[10px] uppercase font-bold text-slate-400">Departmental Justification</p>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {requisition.justification}
            </p>
          </div>
        )}

        {/* 4. Supporting Documents */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold text-slate-400">Supporting Documents</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {requisition.supporting_document_url ? (
              <a
                href={requisition.supporting_document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-2xl border border-violet-100 bg-violet-50/50 hover:bg-violet-100/60 transition-colors flex items-center justify-between text-xs group shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                    <HiDocumentText className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 group-hover:text-violet-800">
                      Original Requisition Document
                    </p>
                    <p className="text-[10px] text-slate-400">Click to view/download attached document</p>
                  </div>
                </div>
                <HiDownload className="w-4 h-4 text-violet-500 group-hover:scale-110 transition-transform" />
              </a>
            ) : (
              <div className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50 text-xs text-slate-400 flex items-center gap-2.5">
                <HiDocumentText className="w-5 h-5 text-slate-300" />
                <span>No original supporting document attached</span>
              </div>
            )}

            {requisition.technical_document_url ? (
              <a
                href={requisition.technical_document_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-100/60 transition-colors flex items-center justify-between text-xs group shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <HiDocumentText className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 group-hover:text-emerald-800">
                      Technical Inspection Report
                    </p>
                    <p className="text-[10px] text-slate-400">Uploaded by Technical Officer</p>
                  </div>
                </div>
                <HiDownload className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
              </a>
            ) : null}
          </div>
        </div>

        {/* 5. Technical Evaluation Section */}
        {requisition.requires_technical_evaluation ? (
          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-2">
              <div className="flex items-center gap-2">
                <HiShieldCheck className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-900">
                  Technical Officer Evaluation
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {requisition.technical_evaluation_result || 'Technically Suitable'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Evaluated By</span>
                <strong className="text-slate-800">
                  {requisition.technical_officer_name || 'Assigned Technical Officer'}
                </strong>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Evaluation Date</span>
                <strong className="text-slate-800">
                  {formatDate(requisition.technical_evaluated_at)}
                </strong>
              </div>
            </div>

            <div className="pt-1">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">
                Technical Assessment Remarks
              </span>
              <p className="text-xs text-slate-800 leading-relaxed font-medium mt-0.5 bg-white p-3 rounded-xl border border-emerald-100">
                {requisition.technical_evaluation_remarks || 'Specifications verified and found technically suitable.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
              <div className="flex items-center gap-2">
                <HiInformationCircle className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-800">
                  Technical Officer Evaluation
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-300">
                Not Required (Direct PO Route)
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Technical evaluation was <strong>not required</strong> for this purchase request according to hospital procurement rules.
              The requested items represent standard routine consumables or general supplies verified directly by the assigned Purchase Officer.
            </p>
          </div>
        )}

        {/* 6. Purchasing Next Step: Find Vendors */}
        <div className="p-5 bg-gradient-to-r from-violet-50 to-indigo-50/70 rounded-2xl border border-violet-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <HiOutlineSparkles className="w-5 h-5 text-violet-700" />
              <h4 className="text-xs uppercase font-extrabold text-violet-900 tracking-wider">
                Next Purchasing Step: Vendor Sourcing
              </h4>
            </div>
            <p className="text-xs text-slate-600 max-w-lg">
              This purchase request is verified and ready for purchasing. Search and source suitable registered hospital vendors based on requested items and category specifications.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              onClose();
              if (onFindVendors) {
                onFindVendors(requisition);
              }
            }}
            className="w-full sm:w-auto text-xs font-bold gap-2 px-5 py-2.5 shadow-md shadow-violet-500/20 bg-violet-600 hover:bg-violet-700 text-white flex-shrink-0"
          >
            <HiSearch className="w-4 h-4" />
            <span>Find Vendors</span>
          </Button>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">
            Requisition {requisition.req_number} • Procurement Committee Member Assignment
          </span>
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            className="border-slate-200 text-slate-700 text-xs"
          >
            Close
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default RequisitionDetailModal;
