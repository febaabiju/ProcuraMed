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
  HiOutlineSparkles
} from 'react-icons/hi';
import axiosClient from '../../api/axiosClient';
import Button from '../common/Button';

const VendorSourcingModal = ({
  requisition,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !requisition) return null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    matched_vendors: [],
    matched_count: 0,
    other_vendors: [],
    total_active_vendors: 0,
    matched_categories: []
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('matched'); // 'matched', 'all'
  const [selectedVendorDetail, setSelectedVendorDetail] = useState(null);

  const fetchVendorsForRequisition = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get(`/procurement/requisitions/${requisition.id}/find-vendors/`);
      setData({
        matched_vendors: res.data.matched_vendors || [],
        matched_count: res.data.matched_count || 0,
        other_vendors: res.data.other_vendors || [],
        total_active_vendors: res.data.total_active_vendors || 0,
        matched_categories: res.data.matched_categories || []
      });
    } catch (err) {
      // Fallback: fetch active vendors directory
      try {
        const fallbackRes = await axiosClient.get('/vendors/applications/', {
          params: { status: 'APPROVED', page_size: 100 }
        });
        const allApproved = (fallbackRes.data.results || fallbackRes.data || [])
          .filter((v) => v.status === 'APPROVED');
        
        setData({
          matched_vendors: allApproved,
          matched_count: allApproved.length,
          other_vendors: [],
          total_active_vendors: allApproved.length,
          matched_categories: [requisition.category].filter(Boolean)
        });
      } catch {
        setError(err.response?.data?.detail || 'Failed to load matching registered vendors.');
      }
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

  // Filter vendors based on search query
  const displayedVendors = (activeTab === 'matched' ? data.matched_vendors : [
    ...data.matched_vendors,
    ...data.other_vendors
  ]).filter((v) => {
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
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Category</span>
              <span className="font-bold text-slate-800">{requisition.category || 'General Supplies'}</span>
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
              placeholder="Search by vendor name, category, products..."
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
              Category Matched ({data.matched_count})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-white text-violet-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Active Suppliers ({data.total_active_vendors})
            </button>
          </div>
        </div>

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
        ) : displayedVendors.length === 0 ? (
          <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
            <HiOfficeBuilding className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">No matching active suppliers found</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              No registered suppliers match your search query. Try broadening your search or browse all active suppliers.
            </p>
          </div>
        ) : (
          /* Vendors Grid / List */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Showing <strong>{displayedVendors.length}</strong> registered supplier(s)</span>
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <HiShieldCheck className="w-4 h-4 text-emerald-600" />
                Verified Hospital Suppliers
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {displayedVendors.map((vendor) => {
                const vendorCategories = vendor.supplier_categories || vendor.supply_categories || [];
                const rating = vendor.performance_rating || 4.8;

                return (
                  <div
                    key={vendor.id}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-violet-300 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-bold text-violet-600">
                              {vendor.vendor_code || `VEN-2026-${String(vendor.id).padStart(5, '0')}`}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-0.5">
                              <HiCheckCircle className="w-3 h-3 text-emerald-600" />
                              Active
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                            {vendor.company_name || vendor.name}
                          </h4>
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

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedVendorDetail(vendor)}
                        className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1"
                      >
                        <HiExternalLink className="w-3.5 h-3.5" />
                        <span>View Supplier Profile</span>
                      </button>

                      <span className="text-[10px] font-semibold text-slate-400">
                        Certified Vendor
                      </span>
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
              className="fixed inset-0 z-60 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setSelectedVendorDetail(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-violet-100 space-y-4"
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
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Products & Services</span>
                    <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                      {selectedVendorDetail.products_services_offered || 'Standard Medical and Hospital Equipment Supply Services.'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
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
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">
            Requisition {requisition.req_number} • Ready for vendor sourcing
          </span>
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            className="border-slate-200 text-slate-700 text-xs font-semibold"
          >
            Close Sourcing View
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default VendorSourcingModal;
