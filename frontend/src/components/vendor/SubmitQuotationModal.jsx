import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import Button from '../common/Button';
import {
  HiX,
  HiClipboardList,
  HiCalendar,
  HiCurrencyDollar,
  HiTruck,
  HiUpload,
  HiCheckCircle,
  HiInformationCircle,
  HiExclamation,
  HiDocumentText,
  HiRefresh
} from 'react-icons/hi';

const SubmitQuotationModal = ({
  isOpen,
  onClose,
  rfq,
  onQuotationSubmitted
}) => {
  const [items, setItems] = useState([]);
  const [taxPercentage, setTaxPercentage] = useState('18.00');
  const [shippingCharges, setShippingCharges] = useState('0.00');
  const [leadTimeDays, setLeadTimeDays] = useState('14');
  const [validUntil, setValidUntil] = useState('');
  const [remarks, setRemarks] = useState('');
  const [quotationDocument, setQuotationDocument] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Default validity date: 30 days from today
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setValidUntil(d.toISOString().split('T')[0]);
  }, []);

  // Initialize items from RFQ
  useEffect(() => {
    if (rfq) {
      if (rfq.items && rfq.items.length > 0) {
        setItems(
          rfq.items.map((it) => ({
            rfq_item_id: it.id,
            item_name: it.item_name || 'Item',
            specification: it.technical_specifications || '',
            quantity: Number(it.quantity) || 1,
            unit_price: it.estimated_unit_price ? Number(it.estimated_unit_price) : 0,
            total_price: (Number(it.quantity) || 1) * (it.estimated_unit_price ? Number(it.estimated_unit_price) : 0)
          }))
        );
      } else {
        const req = rfq.requisition_details || {};
        const qty = Number(req.quantity) || 1;
        setItems([
          {
            item_name: req.item_name || rfq.title || 'Requisition Item',
            specification: req.technical_specifications || '',
            quantity: qty,
            unit_price: 0,
            total_price: 0
          }
        ]);
      }
    }
  }, [rfq]);

  if (!isOpen || !rfq) return null;

  const handleUnitPriceChange = (index, val) => {
    const newItems = [...items];
    const uPrice = Math.max(0, parseFloat(val) || 0);
    newItems[index].unit_price = val;
    newItems[index].total_price = uPrice * newItems[index].quantity;
    setItems(newItems);
  };

  // Calculations
  const subtotal = items.reduce((acc, it) => {
    const p = parseFloat(it.unit_price) || 0;
    return acc + p * it.quantity;
  }, 0);

  const taxPct = Math.max(0, parseFloat(taxPercentage) || 0);
  const calculatedTaxAmount = (subtotal * taxPct) / 100;
  const shipping = Math.max(0, parseFloat(shippingCharges) || 0);
  const grandTotal = subtotal + calculatedTaxAmount + shipping;

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val || 0);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        setError('Attachment size cannot exceed 15MB.');
        return;
      }
      setQuotationDocument(file);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (items.some((it) => !it.unit_price || parseFloat(it.unit_price) <= 0)) {
      setError('Please provide a valid unit price greater than 0 for all items.');
      return;
    }

    if (grandTotal <= 0) {
      setError('Grand total price must be greater than 0.');
      return;
    }

    const leadDays = parseInt(leadTimeDays, 10);
    if (!leadDays || leadDays < 1) {
      setError('Please provide a valid delivery lead time (minimum 1 day).');
      return;
    }

    if (!validUntil) {
      setError('Please specify the quotation validity date.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (validUntil < todayStr) {
      setError('Quotation validity date must be in the future.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('total_amount', grandTotal.toFixed(2));
      formData.append('tax_percentage', taxPct.toFixed(2));
      formData.append('tax_amount', calculatedTaxAmount.toFixed(2));
      formData.append('shipping_charges', shipping.toFixed(2));
      formData.append('lead_time_days', leadDays);
      formData.append('valid_until', validUntil);
      formData.append('remarks', remarks.trim());

      // Prepared items payload
      const formattedItems = items.map((it) => ({
        item_name: it.item_name,
        specification: it.specification,
        quantity: it.quantity,
        unit_price: parseFloat(it.unit_price).toFixed(2),
        total_price: (parseFloat(it.unit_price) * it.quantity).toFixed(2)
      }));
      formData.append('items', JSON.stringify(formattedItems));

      if (quotationDocument) {
        formData.append('quotation_document', quotationDocument);
      }

      const res = await axiosClient.post(
        `/procurement/rfqs/${rfq.id}/submit-quotation/`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      setSuccess(`Quotation submitted successfully! (${res.data?.quotation?.quotation_number || 'Recorded'})`);

      setTimeout(() => {
        if (onQuotationSubmitted) {
          onQuotationSubmitted(res.data?.quotation, res.data?.rfq);
        }
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Submission failed:', err);
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.total_amount ||
        err.response?.data?.error ||
        'Failed to submit quotation. Please check all fields and try again.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const req = rfq.requisition_details || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-violet-100 overflow-hidden flex flex-col max-h-[92vh] my-auto"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-gradient-to-r from-violet-50/60 to-purple-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center font-bold shadow-md shadow-violet-500/20">
              <HiCurrencyDollar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                Submit Price Quotation
              </h2>
              <p className="text-xs text-slate-500">
                RFQ <strong className="text-violet-700 font-mono">{rfq.rfq_number}</strong> &bull; Purchase Request: {req.requisition_number || 'PR'}
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-grow">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2.5">
              <HiExclamation className="w-5 h-5 flex-shrink-0 text-rose-500" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2.5">
              <HiCheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
              <span className="font-bold">{success}</span>
            </div>
          )}

          {/* Quick Scope Header */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Item Name</span>
              <span className="font-bold text-slate-800 text-xs truncate block">{req.item_name || rfq.title}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Required Quantity</span>
              <span className="font-black text-violet-700 text-xs">
                {req.quantity ? `${req.quantity} ${req.unit || 'Units'}` : `${items[0]?.quantity || 1} Units`}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Submission Deadline</span>
              <span className="font-bold text-slate-800 text-xs">{rfq.due_date || 'Standard'}</span>
            </div>
          </div>

          {/* 1. Itemized Unit Pricing */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                1. Item Unit Pricing Breakdown
              </h3>
              <span className="text-[11px] text-slate-400">All prices in INR (₹)</span>
            </div>

            <div className="space-y-2.5">
              {items.map((it, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-xs">
                      {idx + 1}. {it.item_name}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-violet-50 text-violet-700 font-bold text-[10px]">
                      Qty: {it.quantity}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        Unit Price (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        placeholder="0.00"
                        value={it.unit_price}
                        onChange={(e) => handleUnitPriceChange(idx, e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 font-bold text-slate-900 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                        Calculated Subtotal (₹)
                      </label>
                      <div className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-800 text-xs flex items-center justify-between">
                        <span>{it.quantity} &times; ₹{parseFloat(it.unit_price || 0).toFixed(2)}</span>
                        <span className="text-violet-700">{formatCurrency(it.total_price)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Taxes, Shipping & Grand Total Summary */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-50/60 to-purple-50/50 border border-violet-100 space-y-3">
            <h3 className="font-extrabold text-violet-950 text-xs uppercase tracking-wider">
              2. Applicable Taxes, Shipping &amp; Final Total
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">
                  Tax / GST Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={taxPercentage}
                  onChange={(e) => setTaxPercentage(e.target.value)}
                  placeholder="18"
                  className="w-full px-3 py-2 rounded-xl border border-violet-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-bold text-slate-800 text-xs"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Tax Amount: {formatCurrency(calculatedTaxAmount)}
                </span>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">
                  Shipping / Freight (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingCharges}
                  onChange={(e) => setShippingCharges(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-xl border border-violet-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 font-bold text-slate-800 text-xs"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Delivery to hospital premises
                </span>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-600 block mb-1">
                  Grand Total Price (₹)
                </label>
                <div className="p-2.5 rounded-xl bg-white border border-violet-200 text-right shadow-xs">
                  <span className="font-mono font-black text-slate-900 text-base block">
                    {formatCurrency(grandTotal)}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-violet-700 tracking-wider">
                    All-Inclusive Total
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Delivery Timeline & Validity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Delivery Timeline (Lead Time in Days) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  required
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  placeholder="14"
                  className="w-full px-3 py-2 pr-12 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 font-bold text-slate-800 text-xs"
                />
                <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">
                  Days
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Estimated days from PO receipt to physical delivery
              </span>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Quotation Validity Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 font-bold text-slate-800 text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Date until which this quoted price remains guaranteed
              </span>
            </div>
          </div>

          {/* 4. Commercial Remarks & Document Upload */}
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Quotation Remarks / Terms of Warranty
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Specify standard warranty period, payment terms, installation scope, or batch information..."
                className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500 text-slate-800 text-xs"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Upload Quotation Proposal / Specification Sheet (Optional)
              </label>
              <div className="p-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-violet-300 transition bg-slate-50/50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 truncate">
                  <HiDocumentText className="w-5 h-5 text-violet-500 flex-shrink-0" />
                  <div className="truncate">
                    <span className="font-bold text-slate-800 block text-xs truncate">
                      {quotationDocument ? quotationDocument.name : 'Attach official quotation document'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      PDF, DOC, DOCX or image (Max 15MB)
                    </span>
                  </div>
                </div>

                <label className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-violet-700 hover:bg-violet-50 font-bold text-xs cursor-pointer shadow-xs flex-shrink-0">
                  <span>Browse</span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={submitting}
              className="border-slate-200 text-slate-700"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting || grandTotal <= 0}
              className="font-bold text-white shadow-lg shadow-violet-500/25 min-w-[170px]"
              style={{ background: 'linear-gradient(135deg, #8B7CF8, #6D5BD0)' }}
            >
              {submitting ? (
                <>
                  <HiRefresh className="w-4 h-4 animate-spin mr-1.5" />
                  <span>Submitting Quotation...</span>
                </>
              ) : (
                <>
                  <HiCheckCircle className="w-4 h-4 mr-1.5" />
                  <span>Confirm &amp; Submit Quote</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default SubmitQuotationModal;
