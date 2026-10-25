import React from 'react';
import { motion } from 'framer-motion';
import Button from '../common/Button';
import { openSecureDocument } from '../../utils/documentViewer';
import {
  HiX,
  HiDocumentText,
  HiCheckCircle,
  HiClock,
  HiTruck,
  HiCalendar,
  HiExternalLink,
  HiInformationCircle,
  HiCurrencyDollar
} from 'react-icons/hi';

const ViewQuotationModal = ({ isOpen, onClose, quotation }) => {
  if (!isOpen || !quotation) return null;

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

  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
            <HiCheckCircle className="w-4 h-4 text-emerald-600" />
            Accepted by Procurement Committee
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5">
            <HiX className="w-4 h-4 text-rose-600" />
            Not Selected / Rejected
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5">
            <HiClock className="w-4 h-4 text-amber-600" />
            Under Evaluation by Committee
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1.5">
            <HiCheckCircle className="w-4 h-4 text-blue-600" />
            Quotation Submitted
          </span>
        );
    }
  };

  const items = quotation.items || [];
  const taxPct = parseFloat(quotation.tax_percentage || 0);
  const taxAmt = parseFloat(quotation.tax_amount || 0);
  const shipping = parseFloat(quotation.shipping_charges || 0);
  const totalAmt = parseFloat(quotation.total_amount || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-violet-100 overflow-hidden flex flex-col max-h-[92vh] my-auto"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-violet-50/50 to-purple-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-500/20">
              <HiDocumentText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900">
                  Quotation Details
                </h2>
                <span className="font-mono text-xs font-bold text-violet-700 bg-violet-100 px-2.5 py-0.5 rounded-full border border-violet-200">
                  {quotation.quotation_number}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Submitted on {formatDate(quotation.submission_date)}
              </p>
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
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-grow">
          {/* Status banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Evaluation Status:
              </span>
              {getStatusBadge(quotation.status)}
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Amount</span>
              <span className="font-mono font-black text-base text-slate-900">{formatCurrency(totalAmt)}</span>
            </div>
          </div>

          {/* Key Timeline Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-violet-50/40 border border-violet-100">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Delivery Lead Time</span>
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1 mt-0.5">
                <HiTruck className="w-3.5 h-3.5 text-violet-600" />
                {quotation.lead_time_days ? `${quotation.lead_time_days} Days` : 'Not specified'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Valid Until</span>
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1 mt-0.5">
                <HiCalendar className="w-3.5 h-3.5 text-violet-600" />
                {formatDate(quotation.valid_until)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Submission Date</span>
              <span className="font-bold text-slate-800 text-xs mt-0.5 block">
                {formatDate(quotation.submission_date)}
              </span>
            </div>
          </div>

          {/* Item Breakdown Table */}
          {items.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                Quoted Item Pricing Breakdown
              </h3>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="px-3.5 py-2.5">#</th>
                      <th className="px-3.5 py-2.5">Item Name</th>
                      <th className="px-3.5 py-2.5 text-center">Qty</th>
                      <th className="px-3.5 py-2.5 text-right">Unit Price</th>
                      <th className="px-3.5 py-2.5 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td className="px-3.5 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-3.5 py-2.5 font-bold text-slate-800">
                          <div>{it.item_name}</div>
                          {it.specification && (
                            <div className="text-[11px] text-slate-500 font-normal">{it.specification}</div>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-bold text-slate-700">{it.quantity}</td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-slate-800">
                          {formatCurrency(it.unit_price)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-violet-700">
                          {formatCurrency(it.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pricing Summary */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Item Subtotal:</span>
              <span className="font-mono font-bold text-slate-800">
                {formatCurrency(items.reduce((acc, it) => acc + (parseFloat(it.total_price) || 0), 0) || totalAmt)}
              </span>
            </div>
            {taxAmt > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tax / GST ({taxPct}%):</span>
                <span className="font-mono font-bold text-slate-800">{formatCurrency(taxAmt)}</span>
              </div>
            )}
            {shipping > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Shipping / Logistics:</span>
                <span className="font-mono font-bold text-slate-800">{formatCurrency(shipping)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
              <span>Grand Total Quoted:</span>
              <span className="font-mono text-violet-700 text-base">{formatCurrency(totalAmt)}</span>
            </div>
          </div>

          {/* Remarks */}
          {quotation.remarks && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Vendor Remarks &amp; Commercial Terms
              </span>
              <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                {quotation.remarks}
              </p>
            </div>
          )}

          {/* Document Attachment */}
          {(quotation.quotation_document_url || quotation.quotation_document) && (
            <div className="p-3.5 rounded-2xl bg-violet-50/50 border border-violet-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <HiDocumentText className="w-5 h-5 text-violet-600" />
                <div>
                  <span className="font-bold text-slate-800 block text-xs">
                    Attached Quotation Proposal
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Official technical specifications and signed commercial proposal
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openSecureDocument(quotation.quotation_document_url || quotation.quotation_document, `Quotation_${quotation.quotation_number}.pdf`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
              >
                <span>View Attachment</span>
                <HiExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            className="border-slate-200 text-slate-700 font-semibold"
          >
            Close
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default ViewQuotationModal;
