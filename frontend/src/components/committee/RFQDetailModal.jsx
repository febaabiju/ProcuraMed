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
  HiOutlineSparkles
} from 'react-icons/hi';
import Button from '../common/Button';
import CancelRFQModal from './CancelRFQModal';

const RFQDetailModal = ({
  rfq,
  isOpen,
  onClose,
  onRFQUpdated
}) => {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

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

  const getStatusBadge = () => {
    if (isCancelled) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
          <HiBan className="w-3.5 h-3.5" />
          Cancelled
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
    if (isClosed) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 flex items-center gap-1">
          <HiCheckCircle className="w-3.5 h-3.5" />
          Closed
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
        <HiShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        Sent / Open
      </span>
    );
  };

  const req = rfq.requisition_details || {};
  const creator = rfq.created_by_details || {};
  const items = rfq.items || [];
  const invitations = rfq.vendor_invitations || [];

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
                {getStatusBadge()}
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  Procurement Committee Issued
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
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <HiX className="w-5 h-5" />
            </button>
          </div>

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

          {/* Invited Vendors Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                  <HiOfficeBuilding className="w-4 h-4 text-violet-600" />
                  Invited Registered Suppliers ({invitations.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Suppliers eligible under the requested category who have been invited to quote.
                </p>
              </div>
            </div>

            {invitations.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-50 text-center text-slate-400">
                No vendor invitation records found.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {invitations.map((inv) => {
                  const v = inv.vendor_details || {};
                  const categories = v.supplier_categories || [];

                  return (
                    <div
                      key={inv.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2 flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
                              {v.vendor_code || `VEN-${v.id}`}
                            </span>
                            <h5 className="font-bold text-slate-900 text-xs mt-1">
                              {v.company_name || v.name || 'Vendor'}
                            </h5>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                            <HiMail className="w-3 h-3" />
                            {inv.status || 'Invited'}
                          </span>
                        </div>

                        {/* Categories */}
                        <div className="flex flex-wrap gap-1">
                          {categories.map((c, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] text-slate-600 font-medium"
                            >
                              {typeof c === 'string' ? c : c.name}
                            </span>
                          ))}
                        </div>

                        {/* Contact details */}
                        <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-600 space-y-0.5">
                          {v.contact_person && (
                            <div className="flex items-center gap-1.5">
                              <HiUser className="w-3 h-3 text-slate-400" />
                              <span className="truncate">{v.contact_person}</span>
                            </div>
                          )}
                          {v.email && (
                            <div className="flex items-center gap-1.5">
                              <HiMail className="w-3 h-3 text-slate-400" />
                              <span className="truncate">{v.email}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quotation Status Banner */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">
                          Invited: {formatDate(inv.invited_at)}
                        </span>
                        <span className="font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Awaiting Quote
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
