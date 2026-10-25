import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiX,
  HiSearch,
  HiOfficeBuilding,
  HiStar,
  HiPhone,
  HiMail,
  HiLocationMarker,
  HiTag,
  HiCheckCircle,
  HiInformationCircle,
  HiRefresh,
  HiUser,
  HiExternalLink,
  HiDocumentText,
  HiShieldCheck,
  HiOutlineSparkles,
  HiCube,
  HiExclamation
} from 'react-icons/hi';
import axiosClient from '../../api/axiosClient';
import Button from '../common/Button';
import CreateRFQModal from './CreateRFQModal';

const VendorSourcingModal = ({
  requisition,
  isOpen,
  onClose,
  onSuccess
}) => {
  if (!isOpen || !requisition) return null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    matched_vendors: [],
    matched_count: 0,
    has_category: true,
    matched_categories: [],
    matched_products: [],
    matched_products_count: 0,
    pricing_notice: '',
    message: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('matched'); // 'matched', 'products'
  const [selectedVendorDetail, setSelectedVendorDetail] = useState(null);
  const [selectedVendorIds, setSelectedVendorIds] = useState([]);
  const [createRFQOpen, setCreateRFQOpen] = useState(false);

  const fetchVendorsForRequisition = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get(`/procurement/requisitions/${requisition.id}/find-vendors/`);
      setData({
        matched_vendors: res.data.matched_vendors || [],
        matched_count: res.data.matched_count || 0,
        has_category: res.data.has_category !== false,
        matched_categories: res.data.matched_categories || [],
        matched_products: res.data.matched_products || [],
        matched_products_count: res.data.matched_products_count || 0,
        pricing_notice: res.data.pricing_notice || '',
        message: res.data.message || ''
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load matching registered vendors for this supply category.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && requisition?.id) {
      fetchVendorsForRequisition();
    }
  }, [isOpen, requisition?.id]);

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || amount === '') return '₹0.00';
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const toggleVendorSelect = (vendorId) => {
    setSelectedVendorIds((prev) => {
      if (prev.includes(vendorId)) {
        return prev.filter((id) => id !== vendorId);
      }
      if (prev.length >= 4) {
        return prev;
      }
      return [...prev, vendorId];
    });
  };

  const handleSelectAll = () => {
    if (selectedVendorIds.length > 0) {
      setSelectedVendorIds([]);
    } else {
      setSelectedVendorIds(displayedVendors.slice(0, 4).map((v) => v.id));
    }
  };

  const minRequiredVendors = (data.matched_vendors || []).length < 2 ? 1 : 2;
  const isSelectionValid =
    (data.matched_vendors || []).length < 2
      ? selectedVendorIds.length === 1
      : selectedVendorIds.length >= 2 && selectedVendorIds.length <= 4;

  // Filter vendors based on search query (strictly within matching category vendors only)
  const displayedVendors = (data.matched_vendors || []).filter((v) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = (v.company_name || v.name || '').toLowerCase();
    const contact = (v.contact_person || v.portal_username || '').toLowerCase();
    const email = (v.email || '').toLowerCase();
    const code = (v.vendor_code || '').toLowerCase();
    const categories = (v.supplier_categories || []).map((c) => (c.name || c).toLowerCase()).join(' ');
    const products = (v.products_services_offered || '').toLowerCase();
    return (
      name.includes(q) ||
      contact.includes(q) ||
      email.includes(q) ||
      code.includes(q) ||
      categories.includes(q) ||
      products.includes(q)
    );
  });

  // Filter products based on search query
  const displayedProducts = (data.matched_products || []).filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q)) ||
      (p.model_number && p.model_number.toLowerCase().includes(q)) ||
      (p.category_name && p.category_name.toLowerCase().includes(q)) ||
      (p.vendor_name && p.vendor_name.toLowerCase().includes(q)) ||
      (p.description && p.description.toLowerCase().includes(q)) ||
      (p.technical_specifications && p.technical_specifications.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-6 my-8 max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-violet-100 text-violet-800 border border-violet-200">
                {requisition.req_number}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                <HiOutlineSparkles className="w-3 h-3 text-indigo-600" />
                Vendor Sourcing Phase
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                Purchase Ready
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 leading-snug">
              Find Vendors: {requisition.title}
            </h3>
            <p className="text-xs text-slate-500">
              Department: <strong className="text-slate-800">{requisition.department_name}</strong> • Estimated Budget: <strong className="text-violet-700">{formatCurrency(requisition.estimated_budget)}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* Purchase Item Specs Context Box */}
        <div className="p-4 bg-violet-50/70 rounded-2xl border border-violet-200/80 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 pb-2">
            <span className="text-[10px] uppercase font-bold text-violet-800">
              Required Purchase Specifications
            </span>
            <span className="text-[11px] text-violet-700 font-medium">
              Assigned Committee Member: <strong>{requisition.assigned_committee_member_name || 'You'}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Supply Category</span>
              {data.matched_categories && data.matched_categories.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {data.matched_categories.map((c, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-violet-100 text-violet-800 border border-violet-200"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="font-bold text-amber-700 italic">Not Assigned</span>
              )}
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Required Delivery</span>
              <span className="font-bold text-slate-800">{requisition.required_date || 'Standard Schedule'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Technical Result</span>
              <span className="font-bold text-emerald-700">{requisition.technical_evaluation_result || 'Technically Compliant'}</span>
            </div>
          </div>

          {requisition.items && requisition.items.length > 0 && (
            <div className="pt-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Items to Procure ({requisition.items.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {requisition.items.map((it, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-white border border-violet-200 text-[11px] text-slate-800 font-medium"
                  >
                    <strong>{it.item_name}</strong> (Qty: {it.quantity})
                    {it.category && <span className="text-violet-600 ml-1">[{it.category}]</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search & Tabs Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <HiSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by vendor, product name, brand, model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-white shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('matched')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'matched'
                  ? 'bg-white text-violet-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Matching Suppliers ({data.matched_count})
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'products'
                  ? 'bg-white text-violet-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <HiCube className="w-3.5 h-3.5 text-violet-600" />
              <span>Product Catalogue ({data.matched_products?.length || 0})</span>
            </button>
          </div>
        </div>

        {/* Missing Category Notification Banner */}
        {!loading && (!data.has_category || data.matched_categories.length === 0) && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-3 shadow-xs">
            <HiExclamation className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-bold">No Supply Category Assigned</p>
              <p className="text-[11px] text-amber-800">
                Please select or assign a category to this purchase request before finding vendors.
              </p>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <HiRefresh className="w-8 h-8 animate-spin text-violet-600" />
            <p className="text-xs font-medium">Matching certified suppliers for {requisition.title}...</p>
          </div>
        ) : activeTab === 'products' ? (
          /* Product Catalogue Tab */
          <div className="space-y-4">
            {/* Non-binding Legal Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <HiInformationCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Supplier Product Catalogue — Sourcing &amp; Research</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Products listed below are registered in vendor catalogues matching this purchase requisition's category. <strong>Indicative prices are non-binding reference estimates only.</strong> The Procurement Committee must initiate a formal Request for Quotation (RFQ) to obtain binding pricing. Orders are never placed automatically based on catalogue listings.
              </p>
            </div>

            {displayedProducts.length === 0 ? (
              <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <HiCube className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No matching products found in supplier catalogue</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Registered vendors have not yet listed specific products for the "{data.matched_categories.join(', ') || requisition.category}" category, or no products match your search query.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {displayedProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-violet-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">
                              {prod.product_code || `PRD-${prod.id}`}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-700">
                              {prod.category_name}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-1 leading-snug">
                            {prod.name}
                          </h4>
                          {(prod.brand || prod.model_number) && (
                            <p className="text-[11px] text-slate-500">
                              {prod.brand && <strong>{prod.brand}</strong>}
                              {prod.brand && prod.model_number && ' • '}
                              {prod.model_number && <span>Model: {prod.model_number}</span>}
                            </p>
                          )}
                        </div>

                        {/* Indicative Price */}
                        <div className="text-right flex-shrink-0 bg-violet-50/70 p-2 rounded-xl border border-violet-100">
                          <span className="text-[9px] uppercase font-bold text-slate-400 block">Indicative Price</span>
                          <span className="text-xs font-black text-violet-700 block">
                            {formatCurrency(prod.indicative_price)}
                          </span>
                          <span className="text-[9px] text-slate-500">/ {prod.unit_of_measure || 'Piece'}</span>
                        </div>
                      </div>

                      {/* Technical Specs Preview */}
                      {prod.technical_specifications && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 font-mono bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {prod.technical_specifications}
                        </p>
                      )}

                      {/* Vendor attribution */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">
                          Supplied by: <strong className="text-slate-800">{prod.vendor_name}</strong>
                        </span>
                        <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          Non-binding ref
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (!data.has_category || data.matched_categories.length === 0) ? (
          <div className="py-12 text-center bg-amber-50/50 rounded-2xl border border-dashed border-amber-200 p-8 space-y-3">
            <HiExclamation className="w-12 h-12 text-amber-500 mx-auto" />
            <h4 className="text-sm font-bold text-amber-900">Supply Category Required</h4>
            <p className="text-xs text-amber-800 max-w-md mx-auto">
              Please select or assign a category to this purchase request before finding vendors.
            </p>
          </div>
        ) : displayedVendors.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2 p-8">
            <HiOfficeBuilding className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">No vendors found for this supply category.</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery
                ? `No registered suppliers matching "${searchQuery}" supply the "${data.matched_categories.join(', ') || requisition.category}" category.`
                : `There are currently no active registered suppliers assigned to the "${data.matched_categories.join(', ') || requisition.category}" category.`}
            </p>
          </div>
        ) : (
          /* Vendors Grid / List */
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-3 py-2 bg-slate-50 rounded-2xl border border-slate-200/80">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-violet-700 border border-violet-200 hover:bg-violet-50 transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <input
                    type="checkbox"
                    checked={displayedVendors.length > 0 && selectedVendorIds.length === displayedVendors.length}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded text-violet-600 focus:ring-violet-500 border-slate-300 pointer-events-none"
                  />
                  <span>
                    {selectedVendorIds.length === displayedVendors.length && displayedVendors.length > 0
                      ? 'Deselect All'
                      : 'Select All'}
                  </span>
                </button>
                <span>
                  Showing <strong>{displayedVendors.length}</strong> matching supplier(s) for{' '}
                  <strong className="text-violet-700">{data.matched_categories.join(', ')}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    isSelectionValid
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : selectedVendorIds.length > 0
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  Selected: {selectedVendorIds.length}/4 (Requirement: {minRequiredVendors}–4 vendors)
                </span>
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <HiShieldCheck className="w-4 h-4 text-emerald-600" />
                  Verified Category Suppliers
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {displayedVendors.map((vendor) => {
                const vendorCategories = vendor.supplier_categories || vendor.supply_categories || [];
                const rating = vendor.performance_rating || 4.8;
                const productsCount = vendor.products_count ?? (vendor.products?.length || 0);
                const isSelected = selectedVendorIds.includes(vendor.id);

                return (
                  <div
                    key={vendor.id}
                    onClick={() => toggleVendorSelect(vendor.id)}
                    className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between cursor-pointer ${
                      isSelected
                        ? 'border-violet-500 bg-violet-50/20 shadow-md ring-1 ring-violet-400'
                        : 'border-slate-200/80 bg-white hover:border-violet-300 hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleVendorSelect(vendor.id);
                            }}
                            className="w-4 h-4 mt-0.5 rounded text-violet-600 focus:ring-violet-500 border-slate-300 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-mono font-bold text-violet-600">
                                {vendor.vendor_code || `VEN-2026-${String(vendor.id).padStart(5, '0')}`}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                                <HiCheckCircle className="w-3 h-3 text-emerald-600" />
                                Active
                              </span>
                              {productsCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-50 text-violet-700 border border-violet-200 flex items-center gap-1">
                                  <HiCube className="w-3 h-3 text-violet-600" />
                                  {productsCount} Products Listed
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                              {vendor.company_name || vendor.name}
                            </h4>
                          </div>
                        </div>

                        {/* Performance Rating */}
                        <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 flex-shrink-0">
                          <HiStar className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-bold text-amber-900">{rating}</span>
                        </div>
                      </div>

                      {/* Categories Badges */}
                      <div className="flex flex-wrap gap-1">
                        {vendorCategories.map((c, idx) => {
                          const catName = typeof c === 'string' ? c : c.name;
                          return (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] text-slate-700 font-medium"
                            >
                              {catName}
                            </span>
                          );
                        })}
                      </div>

                      {/* Products / Offerings snippet */}
                      {vendor.products_services_offered && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                          {vendor.products_services_offered}
                        </p>
                      )}

                      {/* Contact Info */}
                      <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px] text-slate-600">
                        {vendor.contact_person && (
                          <div className="flex items-center gap-2">
                            <HiUser className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{vendor.contact_person}</span>
                          </div>
                        )}
                        {vendor.email && (
                          <div className="flex items-center gap-2">
                            <HiMail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{vendor.email}</span>
                          </div>
                        )}
                        {vendor.phone && (
                          <div className="flex items-center gap-2">
                            <HiPhone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{vendor.phone}</span>
                          </div>
                        )}
                        {vendor.address && (
                          <div className="flex items-center gap-2">
                            <HiLocationMarker className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{vendor.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      className="pt-2 border-t border-slate-100 flex items-center justify-between"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedVendorDetail(vendor)}
                        className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1"
                      >
                        <HiExternalLink className="w-3.5 h-3.5" />
                        <span>View Supplier Profile</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleVendorSelect(vendor.id)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-violet-300'
                        }`}
                      >
                        {isSelected ? '✓ Selected' : '+ Select for RFQ'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Vendor Profile Details Submodal */}
        <AnimatePresence>
          {selectedVendorDetail && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-60 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setSelectedVendorDetail(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-violet-100 space-y-4 my-8 max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-violet-600">
                      {selectedVendorDetail.vendor_code || `VEN-2026-${String(selectedVendorDetail.id).padStart(5, '0')}`}
                    </span>
                    <h4 className="text-lg font-bold text-slate-900">
                      {selectedVendorDetail.company_name || selectedVendorDetail.name}
                    </h4>
                  </div>
                  <button
                    onClick={() => setSelectedVendorDetail(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Person</span>
                    <p className="font-bold text-slate-800">{selectedVendorDetail.contact_person || 'N/A'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Email Address</span>
                      <p className="text-slate-700">{selectedVendorDetail.email || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Phone</span>
                      <p className="text-slate-700">{selectedVendorDetail.phone || 'N/A'}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Business Address</span>
                    <p className="text-slate-700">{selectedVendorDetail.address || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Products & Services Overview</span>
                    <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {selectedVendorDetail.products_services_offered || 'Standard Medical and Hospital Equipment Supply Services.'}
                    </p>
                  </div>

                  {/* Vendor Product Catalogue Preview */}
                  {selectedVendorDetail.products && selectedVendorDetail.products.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">
                          Catalogued Products ({selectedVendorDetail.products.length})
                        </span>
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Indicative Pricing
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {selectedVendorDetail.products.map((p) => (
                          <div
                            key={p.id}
                            className="p-2.5 rounded-xl bg-violet-50/50 border border-violet-100 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-800 block">{p.name}</span>
                              <span className="text-[10px] text-slate-500">
                                {p.brand && `${p.brand} • `}
                                {p.category_name}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-violet-700">
                                {formatCurrency(p.indicative_price)}
                              </span>
                              <span className="text-[10px] text-slate-400 block">/ {p.unit_of_measure || 'Piece'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      toggleVendorSelect(selectedVendorDetail.id);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      selectedVendorIds.includes(selectedVendorDetail.id)
                        ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                        : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
                    }`}
                  >
                    {selectedVendorIds.includes(selectedVendorDetail.id)
                      ? '✓ Selected for RFQ'
                      : '+ Select This Vendor for RFQ'}
                  </button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedVendorDetail(null)}
                    className="text-xs"
                  >
                    Close Profile
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="text-[11px] text-slate-500">
            Requisition <strong className="text-slate-800">{requisition.req_number}</strong> •{' '}
            {selectedVendorIds.length > 0 ? (
              <span className={`font-bold ${isSelectionValid ? 'text-emerald-700' : 'text-amber-700'}`}>
                {selectedVendorIds.length} vendor(s) selected {isSelectionValid ? '✓ Ready to issue RFQ' : `(Select ${minRequiredVendors}–4 vendors for competitive quotations)`}
              </span>
            ) : (
              <span>Select {minRequiredVendors} to 4 eligible vendors to request competitive quotations</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="md"
              onClick={onClose}
              className="border-slate-200 text-slate-700 text-xs font-semibold"
            >
              Close
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={!isSelectionValid}
              onClick={() => setCreateRFQOpen(true)}
              className="text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-violet-500/20"
              title={
                !isSelectionValid
                  ? `Please select between ${minRequiredVendors} and 4 eligible vendors to request quotations`
                  : ''
              }
            >
              <HiDocumentText className="w-4 h-4" />
              <span>
                Request Quotations ({selectedVendorIds.length})
              </span>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Create RFQ Modal */}
      {createRFQOpen && (
        <CreateRFQModal
          isOpen={createRFQOpen}
          onClose={() => setCreateRFQOpen(false)}
          requisition={requisition}
          selectedVendors={(data.matched_vendors || []).filter((v) =>
            selectedVendorIds.includes(v.id)
          )}
          onSuccess={(newRFQ) => {
            setCreateRFQOpen(false);
            if (onSuccess) onSuccess(newRFQ);
            onClose();
          }}
        />
      )}
    </div>
  );
};

export default VendorSourcingModal;
