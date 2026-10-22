import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  HiX,
  HiExclamation,
  HiRefresh,
  HiBan
} from 'react-icons/hi';
import axiosClient from '../../api/axiosClient';
import Button from '../common/Button';

const CancelRFQModal = ({
  rfq,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !rfq) return null;

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('A formal cancellation reason is required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await axiosClient.post(`/procurement/rfqs/${rfq.id}/cancel/`, {
        reason: reason.trim()
      });
      if (onSuccess) {
        onSuccess(res.data.rfq);
      }
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail || err.response?.data?.reason || 'Failed to cancel RFQ. Please try again.';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-rose-100 space-y-4 my-8"
      >
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <HiBan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Cancel Request for Quotation
              </h3>
              <p className="text-xs font-mono font-bold text-violet-700">
                {rfq.rfq_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <HiExclamation className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 leading-relaxed space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <HiExclamation className="w-4 h-4 text-amber-600" />
              <span>Are you sure you want to cancel this RFQ?</span>
            </p>
            <p className="text-[11px] text-amber-800">
              This action will mark <strong>{rfq.rfq_number}</strong> as cancelled. Any invited suppliers will be informed that quotations are no longer accepted for this request.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Cancellation Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a clear explanation for cancelling this quotation request (e.g., changes in hospital specifications, budget reallocation, administrative revision)..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-rose-500 bg-white"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-xs"
            >
              Keep RFQ Active
            </Button>
            <Button
              variant="danger"
              size="sm"
              type="submit"
              disabled={submitting || !reason.trim()}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {submitting ? (
                <>
                  <HiRefresh className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>Cancelling...</span>
                </>
              ) : (
                'Confirm Cancellation'
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default CancelRFQModal;
