import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import Button from '../common/Button';
import {
  HiX,
  HiShieldCheck,
  HiCheckCircle,
  HiInformationCircle,
  HiClock,
  HiRefresh,
  HiCheck,
  HiChevronDown,
  HiChevronUp,
  HiPaperAirplane
} from 'react-icons/hi';

const VendorMatchingModal = ({ isOpen, onClose, requisition, onRFQCreated }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Selected vendors (array of vendor IDs)
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);

  // RFQ parameters
  const [dueDate, setDueDate] = useState('');
  const [rfqTitle, setRfqTitle] = useState('');
  const [deliveryRequirements, setDeliveryRequirements] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState(
    '1. Quotations must include all taxes, shipping, and handling charges.\n2. Delivery must be made to Hospital Central Stores within the specified lead time.\n3. All medical supplies and equipment must carry valid manufacturer warranty and ISO/CE certifications.\n4. Standard hospital payment terms: 30 days after clinical inspection and acceptance.'
  );

  // Expanded product lists for vendors
  const [expandedVendorProducts, setExpandedVendorProducts] = useState({});

  useEffect(() => {
    if (!isOpen || !requisition) return;

    // Set default due date to 14 days in future
    const d = new Date();
    d.setDate(d.getDate() + 14);
    const defaultDate = d.toISOString().split('T')[0];
    setDueDate(defaultDate);

    setRfqTitle(`Request for Quotation: ${requisition.title}`);
    setDeliveryRequirements(
      `Delivery within 14 calendar days from Purchase Order confirmation to ${requisition.department_details?.name || 'Hospital Central Stores'}.`
    );

    setSelectedVendorIds([]);
    setError('');
    setSubmitError('');
    fetchMatchingVendors();
  }, [isOpen, requisition]);

  const fetchMatchingVendors = async () => {
    if (!requisition?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get(`/procurement/requisitions/${requisition.id}/find-vendors/`);
      setData(res.data);

      // Auto-preselect available matching vendors up to 3 (if not already invited)
      const available = (res.data?.matched_vendors || []).filter(v => !v.already_invited);
      if (available.length >= 2) {
        setSelectedVendorIds(available.slice(0, Math.min(3, available.length)).map(v => v.id));
      } else if (available.length === 1) {
        setSelectedVendorIds([available[0].id]);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch matching vendors for this purchase request.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !requisition) return null;

  const matchedVendors = data?.matched_vendors || [];
  const totalAvailable = matchedVendors.filter(v => !v.already_invited).length;
  const minRequired = totalAvailable >= 2 ? 2 : (totalAvailable === 1 ? 1 : 0);
  const selectedCount = selectedVendorIds.length;
  const isValidSelection = selectedCount >= minRequired && selectedCount <= 4;

  const toggleVendorSelection = (vendorId, isAlreadyInvited) => {
    if (isAlreadyInvited) return;
    setSubmitError('');

    if (selectedVendorIds.includes(vendorId)) {
      setSelectedVendorIds(prev => prev.filter(id => id !== vendorId));
    } else {
      if (selectedVendorIds.length >= 4) {
        setSubmitError('A maximum of 4 vendors can be selected for comparison.');
        return;
      }
      setSelectedVendorIds(prev => [...prev, vendorId]);
    }
  };

  const toggleProductsExpansion = (vendorId) => {
    setExpandedVendorProducts(prev => ({
      ...prev,
      [vendorId]: !prev[vendorId]
    }));
  };

  const handleSendRFQ = async (e) => {
    e.preventDefault();
    if (!isValidSelection) {
      setSubmitError(
        totalAvailable >= 2
          ? 'Please select between 2 and 4 eligible vendors for competitive comparison.'
          : 'Please select an eligible vendor.'
      );
      return;
    }

    if (!dueDate) {
      setSubmitError('Quotation submission deadline date is required.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        requisition_id: requisition.id,
        title: rfqTitle.trim() || `Request for Quotation: ${requisition.title}`,
        due_date: dueDate,
        vendor_ids: selectedVendorIds,
        delivery_requirements: deliveryRequirements.trim(),
        terms_and_conditions: termsAndConditions.trim()
      };

      const res = await axiosClient.post('/procurement/rfqs/', payload);
      if (onRFQCreated) {
        onRFQCreated(res.data);
      }
      onClose();
    } catch (err) {
      const errData = err.response?.data;
      let msg = 'Failed to issue RFQs to selected vendors.';
      if (typeof errData?.detail === 'string') msg = errData.detail;
      else if (typeof errData?.vendor_ids === 'string') msg = errData.vendor_ids;
      else if (Array.isArray(errData?.vendor_ids)) msg = errData.vendor_ids.join(' ');
      else if (typeof errData?.due_date === 'string') msg = errData.due_date;
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '₹0.00';
    const num = Number(amount);
    return isNaN(num) ? '₹0.00' : `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl shadow-2xl border border-violet-100 max-w-4xl w-full my-auto flex flex-col max-h-[92vh] overflow-hidden"
        >
          {/* 1. Modal Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-50/70 via-indigo-50/40 to-white">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-black text-violet-700 bg-violet-100 px-2.5 py-0.5 rounded-lg">
                  {requisition.req_number}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-violet-100 text-violet-800 border border-violet-200">
                  Vendor Matching & RFQ
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs font-semibold text-slate-600">
                  {requisition.department_details?.name || 'Department'}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Find Vendors & Issue Quotation Request
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            >
              <HiX className="w-5 h-5" />
            </button>
          </div>

          {/* 2. Modal Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs">
            {/* Error Banners */}
            {error && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  onClick={fetchMatchingVendors}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] hover:bg-rose-700"
                >
                  Retry
                </button>
              </div>
            )}

            {submitError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2.5">
                <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                <span className="font-semibold">{submitError}</span>
              </div>
            )}

            {/* Request Summary Card */}
            <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{requisition.title}</h3>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Category: <strong className="text-violet-700">{requisition.category || 'General Supplies'}</strong>
                  </p>
                </div>
                {requisition.estimated_budget && (
                  <div className="sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Estimated Budget</span>
                    <span className="text-sm font-black text-slate-900">
                      {formatCurrency(requisition.estimated_budget)}
                    </span>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                  Requested Items & Specifications
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(requisition.items || []).map((it, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200 text-[11px] space-y-1">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span className="truncate">{it.item_name}</span>
                        <span className="font-mono text-violet-700 ml-2">Qty: {it.quantity}</span>
                      </div>
                      {it.specifications && (
                        <p className="text-slate-500 text-[10px] line-clamp-2 leading-relaxed">
                          {it.specifications}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Suitable Vendors Matching Section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                    <HiShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">
                      Matching Eligible Vendors ({matchedVendors.length})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Filtered by supply category, items, and hospital vendor registration.
                    </p>
                  </div>
                </div>

                {/* Selection Counter Pill */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                      isValidSelection
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    <span>Selected: {selectedCount} of 4</span>
                    {isValidSelection ? (
                      <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <HiClock className="w-3.5 h-3.5 text-amber-600" />
                    )}
                  </span>
                </div>
              </div>

              {/* Guidance Notice */}
              <div className="p-3 rounded-xl bg-violet-50/70 border border-violet-100 text-[11px] text-violet-900 flex items-start gap-2">
                <HiInformationCircle className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  {totalAvailable >= 2 ? (
                    <>
                      <strong>Multi-Vendor Sourcing:</strong> Select <strong>2 to 4 vendors</strong> to solicit competing formal quotations for this purchase request.
                    </>
                  ) : totalAvailable === 1 ? (
                    <>
                      <strong>Single-Source Sourcing:</strong> Only 1 eligible registered supplier is currently available for this category. Single-vendor RFQ permitted.
                    </>
                  ) : (
                    <>
                      <strong>Notice:</strong> No registered vendors currently supply this category or match specifications.
                    </>
                  )}
                </p>
              </div>

              {/* Vendors List Cards */}
              {loading ? (
                <div className="p-8 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                  <HiRefresh className="w-6 h-6 animate-spin text-violet-600 mx-auto" />
                  <p className="font-semibold text-xs">Finding and matching verified vendors...</p>
                </div>
              ) : matchedVendors.length === 0 ? (
                <div className="p-8 text-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                    <HiInformationCircle className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-sm">No Suitable Vendors Found</h4>
                  <p className="text-slate-500 max-w-md mx-auto text-xs leading-relaxed">
                    No active vendors currently match the required supply category (
                    <strong className="text-slate-700">{requisition.category || 'General'}</strong>
                    ) and item specifications. Please register or onboard eligible suppliers before issuing an RFQ.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchedVendors.map((vendor) => {
                    const isSelected = selectedVendorIds.includes(vendor.id);
                    const isAlreadyInvited = vendor.already_invited;
                    const products = vendor.matching_products || [];
                    const isProductsExpanded = Boolean(expandedVendorProducts[vendor.id]);

                    return (
                      <div
                        key={vendor.id}
                        onClick={() => toggleVendorSelection(vendor.id, isAlreadyInvited)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                          isAlreadyInvited
                            ? 'bg-slate-50 border-slate-200 opacity-70 cursor-not-allowed'
                            : isSelected
                            ? 'bg-violet-50/50 border-violet-400 shadow-sm ring-1 ring-violet-400'
                            : 'bg-white border-slate-200 hover:border-violet-300'
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          {/* Selection Checkbox */}
                          <div className="pt-0.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isAlreadyInvited}
                              onChange={() => {}} // handled by parent div click
                              className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 border-slate-300 pointer-events-none"
                            />
                          </div>

                          <div className="flex-1 min-w-0 space-y-2">
                            {/* Vendor Title & Badges */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-slate-900 text-sm">
                                  {vendor.company_name}
                                </h4>
                                <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                  {vendor.vendor_code || `VEN-2026-${vendor.id}`}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {isAlreadyInvited ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                    Already Invited
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                    <HiCheck className="w-3 h-3" />
                                    Eligible Supplier
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Contact & Category Info */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600">
                              <div>
                                <span className="text-slate-400 font-medium">Contact: </span>
                                <span className="font-semibold text-slate-800">{vendor.contact_person || 'Representative'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-medium">Email: </span>
                                <span className="font-semibold text-slate-800 truncate block">{vendor.email}</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-medium">Phone: </span>
                                <span className="font-semibold text-slate-800">{vendor.phone || 'N/A'}</span>
                              </div>
                            </div>

                            {/* Suitability Badges */}
                            {vendor.suitability_reasons && vendor.suitability_reasons.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {vendor.suitability_reasons.map((reason, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-violet-100/60 text-violet-800 border border-violet-200/60"
                                  >
                                    ✓ {reason}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Matching Products Preview */}
                            {products.length > 0 && (
                              <div className="pt-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleProductsExpansion(vendor.id);
                                  }}
                                  className="text-[10px] font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1"
                                >
                                  <span>{products.length} Matching Catalog Item(s)</span>
                                  {isProductsExpanded ? <HiChevronUp className="w-3 h-3" /> : <HiChevronDown className="w-3 h-3" />}
                                </button>

                                {isProductsExpanded && (
                                  <div className="mt-2 space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                                    {products.map((p, pIdx) => (
                                      <div key={pIdx} className="flex items-center justify-between text-[11px]">
                                        <div className="space-y-0.5">
                                          <span className="font-bold text-slate-800">{p.name}</span>
                                          {p.model_number && (
                                            <span className="text-slate-400 font-mono text-[10px] block">
                                              Model: {p.model_number}
                                            </span>
                                          )}
                                        </div>
                                        {p.indicative_price && (
                                          <span className="font-semibold text-violet-700">
                                            {formatCurrency(p.indicative_price)}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. RFQ Terms & Configuration Form */}
            {matchedVendors.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <HiPaperAirplane className="w-4 h-4 text-violet-600" />
                  <span>Quotation Request Parameters</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      RFQ Title
                    </label>
                    <input
                      type="text"
                      value={rfqTitle}
                      onChange={(e) => setRfqTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                      placeholder="e.g. RFQ for Nitrile Gloves"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                      Quotation Submission Deadline <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Delivery Timeline & Location Requirements
                  </label>
                  <input
                    type="text"
                    value={deliveryRequirements}
                    onChange={(e) => setDeliveryRequirements(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                    placeholder="e.g. Delivery within 14 days to Hospital Central Stores"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Terms & Conditions
                  </label>
                  <textarea
                    rows={3}
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white leading-relaxed"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. Modal Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70">
            <div className="text-slate-500 text-[11px]">
              {selectedCount > 0 ? (
                <span>
                  Ready to invite <strong>{selectedCount}</strong> supplier{selectedCount > 1 ? 's' : ''}.
                </span>
              ) : (
                <span>Select eligible suppliers from above.</span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={submitting}
                className="w-full sm:w-auto text-xs text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendRFQ}
                disabled={!isValidSelection || submitting}
                className="w-full sm:w-auto text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20 gap-2"
              >
                {submitting ? (
                  <>
                    <HiRefresh className="w-3.5 h-3.5 animate-spin" />
                    <span>Issuing RFQ...</span>
                  </>
                ) : (
                  <>
                    <HiPaperAirplane className="w-3.5 h-3.5 rotate-90" />
                    <span>Send RFQ to Selected Vendors ({selectedCount})</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default VendorMatchingModal;
