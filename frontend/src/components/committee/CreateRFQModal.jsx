import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  HiX,
  HiCheckCircle,
  HiExclamation,
  HiCalendar,
  HiOfficeBuilding,
  HiTruck,
  HiDocumentText,
  HiTag,
  HiCube,
  HiInformationCircle,
  HiShieldCheck,
  HiArrowRight,
  HiRefresh
} from 'react-icons/hi';
import axiosClient from '../../api/axiosClient';
import Button from '../common/Button';

const CreateRFQModal = ({
  requisition,
  selectedVendors = [],
  isOpen,
  onClose,
  onSuccess
}) => {
  const navigate = useNavigate();

  // Tomorrow's date formatted as YYYY-MM-DD for min date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDateStr = tomorrow.toISOString().split('T')[0];

  // Default 7 days from now
  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 7);
  const defaultDueDateStr = defaultDueDate.toISOString().split('T')[0];

  // Form State
  const [title, setTitle] = useState(
    requisition?.title ? `Request for Quotation: ${requisition.title}` : 'Request for Quotation'
  );
  const [dueDate, setDueDate] = useState(defaultDueDateStr);
  const [deliveryRequirements, setDeliveryRequirements] = useState(
    'Delivery within 14 calendar days from Purchase Order issuance. All goods must be delivered intact with standard manufacturer warranty to Hospital Central Stores.'
  );
  const [deliveryLocation, setDeliveryLocation] = useState(
    requisition?.department_name
      ? `ProcuraMed Central Hospital Stores - ${requisition.department_name}`
      : 'ProcuraMed Central Hospital Receiving Dock, Central Medical Complex'
  );
  const [unitOfMeasurement, setUnitOfMeasurement] = useState('Piece');
  const [technicalSpecifications, setTechnicalSpecifications] = useState(
    requisition?.technical_specifications ||
    requisition?.technical_evaluation_remarks ||
    requisition?.justification ||
    'Standard medical grade compliance and hospital specifications apply.'
  );
  const [termsAndConditions, setTermsAndConditions] = useState(
    '1. Formal written quotation must be submitted before the specified due date.\n2. Indicative catalogue prices are non-binding; this RFQ requires binding formal pricing.\n3. Quoted prices must be inclusive of all applicable taxes, shipping, handling, and warranty.\n4. ProcuraMed Procurement Committee reserves the right to accept or reject any quotation.'
  );

  const [recipients, setRecipients] = useState(selectedVendors);
  const [step, setStep] = useState(1); // 1 = Form & Review, 2 = Final Confirmation, 3 = Success
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [createdRFQ, setCreatedRFQ] = useState(null);

  if (!isOpen || !requisition) return null;

  const handleRemoveRecipient = (vendorId) => {
    setRecipients((prev) => prev.filter((v) => v.id !== vendorId));
  };

  const validateForm = () => {
    if (!title.trim()) {
      setError('Please enter a descriptive RFQ title.');
      return false;
    }
    if (!dueDate) {
      setError('Quotation submission deadline date is required.');
      return false;
    }
    if (new Date(dueDate) <= new Date()) {
      setError('Quotation submission deadline must be a future date.');
      return false;
    }
    if (recipients.length === 0) {
      setError('At least one eligible vendor must be selected as a recipient.');
      return false;
    }
    setError('');
    return true;
  };

  const handleProceedToConfirm = (e) => {
    e.preventDefault();
    if (validateForm()) {
      setStep(2);
    }
  };

  const handleConfirmAndSend = async () => {
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        requisition_id: requisition.id,
        title: title.trim(),
        due_date: dueDate,
        vendor_ids: recipients.map((v) => v.id),
        delivery_requirements: deliveryRequirements.trim(),
        delivery_location: deliveryLocation.trim(),
        terms_and_conditions: termsAndConditions.trim(),
        items: [
          {
            item_name: requisition.item_name || requisition.title,
            category: requisition.category || 'Medical Supplies',
            quantity: Number(requisition.quantity || 1),
            unit_of_measurement: unitOfMeasurement,
            technical_specifications: technicalSpecifications.trim(),
            estimated_unit_price: Number(requisition.estimated_budget || 0) / Number(requisition.quantity || 1)
          }
        ]
      };

      const res = await axiosClient.post('/procurement/rfqs/', payload);
      setCreatedRFQ(res.data.rfq);
      setStep(3); // Success step
      if (onSuccess) {
        onSuccess(res.data.rfq);
      }
    } catch (err) {
      const detail = err.response?.data?.detail ||
        (typeof err.response?.data === 'object' ? Object.values(err.response.data)[0] : null) ||
        'Failed to issue RFQ. Please verify details and try again.';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
      setStep(1);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || amount === '') return '₹0.00';
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-6 my-8 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-100 text-violet-800 border border-violet-200">
                {requisition.req_number}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <HiShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Procurement Committee Action
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900">
              {step === 3 ? 'RFQ Issued Successfully' : 'Create & Send Request for Quotation (RFQ)'}
            </h3>
            <p className="text-xs text-slate-500">
              Department: <strong className="text-slate-800">{requisition.department_name}</strong> • Category: <strong className="text-violet-700">{requisition.category}</strong>
            </p>
          </div>
          {step !== 3 && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <HiX className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
            <HiExclamation className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Main Form & Vendor Review */}
        {step === 1 && (
          <form onSubmit={handleProceedToConfirm} className="space-y-5">
            {/* Context Summary Box */}
            <div className="p-4 rounded-2xl bg-violet-50/50 border border-violet-100 text-xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-violet-100/80 pb-2">
                <span className="font-bold text-violet-900 flex items-center gap-1.5">
                  <HiInformationCircle className="w-4 h-4 text-violet-600" />
                  Pre-filled Purchase Requisition Requirements
                </span>
                <span className="font-mono text-[11px] text-violet-700 font-bold">
                  Budget: {formatCurrency(requisition.estimated_budget)}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Item Name</span>
                  <span className="font-bold text-slate-900 line-clamp-1">{requisition.item_name || requisition.title}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Category</span>
                  <span className="font-bold text-violet-700">{requisition.category || 'General'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Quantity</span>
                  <span className="font-bold text-slate-900">{requisition.quantity || 1}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Unit of Measure</span>
                  <select
                    value={unitOfMeasurement}
                    onChange={(e) => setUnitOfMeasurement(e.target.value)}
                    className="font-bold text-slate-800 bg-white border border-violet-200 rounded-md px-1.5 py-0.5 text-xs"
                  >
                    <option value="Piece">Piece</option>
                    <option value="Unit">Unit</option>
                    <option value="Box">Box</option>
                    <option value="Pack">Pack</option>
                    <option value="Set">Set</option>
                    <option value="Carton">Carton</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  RFQ Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Request for Quotation: Medical Consumables & PPE Kits"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-white font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quotation Submission Deadline <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <HiCalendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      min={minDateStr}
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-white font-medium text-slate-800"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Vendors will submit quotations before this cutoff date.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Delivery Destination / Location
                  </label>
                  <div className="relative">
                    <HiTruck className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                      placeholder="e.g. Hospital Central Receiving Dock, Building A"
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-white text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Delivery Requirements &amp; Timeline
                </label>
                <textarea
                  rows={2}
                  value={deliveryRequirements}
                  onChange={(e) => setDeliveryRequirements(e.target.value)}
                  placeholder="Specify required lead time, packaging standards, and delivery instructions..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Technical Specifications &amp; Requirements
                </label>
                <textarea
                  rows={2}
                  value={technicalSpecifications}
                  onChange={(e) => setTechnicalSpecifications(e.target.value)}
                  placeholder="Enter or refine required product specifications, standards, or certifications..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-white font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Procurement Terms &amp; Conditions
                </label>
                <textarea
                  rows={3}
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-white font-mono text-[11px]"
                />
              </div>
            </div>

            {/* Selected Recipients Section */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Invited Vendor Recipients ({recipients.length})
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Only verified vendors registered in the matching category are eligible.
                  </p>
                </div>
                {recipients.length === 0 && (
                  <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                    No Vendors Selected
                  </span>
                )}
              </div>

              {recipients.length === 0 ? (
                <div className="p-4 rounded-2xl bg-rose-50/60 border border-dashed border-rose-200 text-center text-xs text-rose-700">
                  Please return to the vendor list and select at least one eligible supplier.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                  {recipients.map((v) => (
                    <div
                      key={v.id}
                      className="p-3 rounded-2xl bg-white border border-slate-200/90 hover:border-violet-300 flex items-center justify-between text-xs transition-all shadow-2xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
                            {v.vendor_code || `VEN-${v.id}`}
                          </span>
                          <span className="font-bold text-slate-900 line-clamp-1">
                            {v.company_name || v.name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          Contact: {v.contact_person || v.portal_username || 'Representative'} • {v.email || 'N/A'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRecipient(v.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Remove from this RFQ"
                      >
                        <HiX className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                size="md"
                onClick={onClose}
                type="button"
                className="text-xs"
              >
                Back to Vendors
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                disabled={recipients.length === 0}
                className="text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-violet-500/20"
              >
                <span>Review &amp; Confirm RFQ</span>
                <HiArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: Final Confirmation Dialog */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold">
                <HiExclamation className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>Final Confirmation Before Issuing RFQ</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                You are about to issue this Request for Quotation on behalf of the Procurement Committee. This will register invitations for the {recipients.length} selected vendor(s) and update the purchase requisition to <strong>RFQ Issued</strong> stage.
              </p>
            </div>

            {/* Review Summary */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-xs space-y-3">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">RFQ Title</span>
                  <span className="font-bold text-slate-900">{title}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Submission Deadline</span>
                  <span className="font-bold text-violet-700">{dueDate}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Associated Requisition</span>
                  <span className="font-bold text-slate-900">{requisition.req_number} ({requisition.title})</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Delivery Location</span>
                  <span className="font-medium text-slate-800">{deliveryLocation}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold mb-1.5">
                  Invited Recipients ({recipients.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {recipients.map((v) => (
                    <span
                      key={v.id}
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs"
                    >
                      {v.company_name || v.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="md"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="text-xs"
              >
                ← Back to Edit
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleConfirmAndSend}
                disabled={submitting}
                className="text-xs font-bold flex items-center gap-1.5 shadow-md shadow-violet-500/20"
              >
                {submitting ? (
                  <>
                    <HiRefresh className="w-4 h-4 animate-spin" />
                    <span>Issuing RFQ...</span>
                  </>
                ) : (
                  <>
                    <HiCheckCircle className="w-4 h-4" />
                    <span>Confirm &amp; Send RFQ</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Success Confirmation Screen */}
        {step === 3 && createdRFQ && (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <HiCheckCircle className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-mono font-bold text-violet-700 bg-violet-50 px-3 py-1 rounded-full border border-violet-200">
                {createdRFQ.rfq_number}
              </span>
              <h3 className="text-lg font-black text-slate-900 mt-2">
                RFQ Created and Sent
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Invitations for <strong>{createdRFQ.invited_vendors_count || recipients.length} eligible vendor(s)</strong> have been recorded in the database. Quotation deadline is set to <strong>{createdRFQ.due_date}</strong>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-w-md mx-auto text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Requisition:</span>
                <span className="font-bold text-slate-800">{requisition.req_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Category:</span>
                <span className="font-bold text-violet-700">{requisition.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Stage:</span>
                <span className="font-bold text-emerald-700">RFQ Issued / Awaiting Quotes</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-4">
              <Button
                variant="outline"
                size="md"
                onClick={onClose}
                className="text-xs"
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  onClose();
                  navigate('/committee/rfqs');
                }}
                className="text-xs font-bold"
              >
                Go to Sent RFQs →
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CreateRFQModal;
