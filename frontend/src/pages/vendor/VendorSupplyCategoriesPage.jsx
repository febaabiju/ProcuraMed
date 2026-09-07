import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import VendorLayout from '../../components/layout/VendorLayout';
import Button from '../../components/common/Button';
import {
  HiTag,
  HiCheckCircle,
  HiShieldCheck,
  HiOfficeBuilding,
  HiInformationCircle,
  HiCalendar,
  HiRefresh,
  HiSearch,
  HiDocumentText,
  HiBadgeCheck,
  HiClipboardList,
  HiFilter
} from 'react-icons/hi';

const VendorSupplyCategoriesPage = () => {
  const [vendorData, setVendorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchVendorCategories = async () => {
    setLoading(true);
    setError('');
    try {
      // First try dedicated my_profile endpoint
      const res = await axiosClient.get('/vendors/vendors/my_profile/');
      setVendorData(res.data);
    } catch (err) {
      try {
        // Fallback to dashboard stats
        const fallbackRes = await axiosClient.get('/vendors/dashboard-stats/');
        setVendorData(fallbackRes.data?.vendor || null);
      } catch (e) {
        setError('Failed to load supply categories information.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendorCategories();
  }, []);

  const categories = vendorData?.supplier_category_details || [];
  const companyName = vendorData?.company_name || 'Vendor Partner';
  const vendorCode = vendorData?.vendor_code || `VEN-${vendorData?.id || 'PENDING'}`;
  const registrationDate = vendorData?.created_at || vendorData?.submitted_at;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const filteredCategories = categories.filter((cat) => {
    const term = searchTerm.toLowerCase();
    return (
      cat.name?.toLowerCase().includes(term) ||
      (cat.description && cat.description.toLowerCase().includes(term))
    );
  });

  return (
    <VendorLayout
      title="Supply Categories"
      subtitle="View your company's approved supply capabilities, specialization areas, and procurement opportunity matching criteria."
      companyName={companyName}
      onRefresh={fetchVendorCategories}
    >
      <div className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
              Dismiss
            </button>
          </div>
        )}

        {/* 1. Header Banner */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-violet-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="flex items-start gap-4 relative z-10">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-violet-500/20 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
            >
              <HiTag className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Approved Supply Categories
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase inline-flex items-center gap-1">
                  <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Active Capability Profile
                </span>
              </div>
              <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                Supply Categories classify the types of products, medical equipment, and services your company is authorized to supply to ProcuraMed. These capability classifications are used to automatically match your account with relevant procurement opportunities and tenders.
              </p>
              <div className="flex items-center gap-4 pt-1 text-xs text-slate-400 font-mono">
                <span>Vendor Code: <strong className="text-violet-700 font-bold">{vendorCode}</strong></span>
                <span>Registered: <strong className="text-slate-700">{formatDate(registrationDate)}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 relative z-10 flex-shrink-0">
            <div className="p-4 bg-violet-50/70 border border-violet-100 rounded-2xl text-center min-w-[130px]">
              <span className="text-[10px] uppercase font-bold text-violet-600 block">Total Capabilities</span>
              <span className="text-2xl font-black text-violet-900">{categories.length}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Approved Categories</span>
            </div>
          </div>
        </div>

        {/* 2. Key Capability Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span>Capability Areas</span>
              <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                <HiTag className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900">{categories.length}</p>
            <p className="text-[11px] text-slate-400">Classified Supply Sectors</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span>RFQ Opportunity Matching</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <HiClipboardList className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-600">Automated</p>
            <p className="text-[11px] text-slate-400">Filtered by Supply Category</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span>Profile Governance</span>
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <HiShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-600">Read-Only</p>
            <p className="text-[11px] text-slate-400">Admin Approved &amp; Verified</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span>Accreditation Status</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <HiOfficeBuilding className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-black text-indigo-600">Verified</p>
            <p className="text-[11px] text-slate-400">Approved Hospital Supplier</p>
          </div>
        </div>

        {/* 3. Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-violet-100 shadow-sm">
          <div className="relative">
            <HiSearch className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search your approved supply categories by keyword or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-800 transition-colors"
            />
          </div>
        </div>

        {/* 4. Supply Categories List (Cards & Table) */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs">
                <HiTag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                  Assigned Capability Classifications
                </h2>
                <p className="text-xs text-slate-500">
                  Business areas selected during registration and verified by hospital administration
                </p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Showing {filteredCategories.length} of {categories.length} categories
            </span>
          </div>

          {loading ? (
            <div className="p-16 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
              <HiRefresh className="w-6 h-6 animate-spin text-violet-500" />
              <span>Loading supply categories...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="p-16 text-center space-y-3 bg-slate-50/60 rounded-2xl border border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 mx-auto flex items-center justify-center font-bold">
                <HiTag className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">No supply categories assigned yet.</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Your supply categories will be listed here once registered and approved by the hospital procurement committee.
              </p>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No categories match your search criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCategories.map((cat, idx) => (
                <motion.div
                  key={cat.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="p-5 rounded-2xl bg-gradient-to-br from-white to-slate-50/60 border border-violet-100/90 shadow-2xs hover:shadow-md hover:border-violet-200 transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0" />
                        <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                          {cat.name}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200/60 text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
                        Approved
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed pl-4">
                      {cat.description ||
                        'Authorized supplier classification for participating in hospital tenders and equipment requisitions under this domain.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-slate-400 pl-4">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <HiShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      Accredited Scope
                    </span>
                    <span className="font-mono text-slate-500">
                      Ref: #{String(cat.id).padStart(3, '0')}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Procurement Integration Notice & Governance Banner */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Opportunity Matching Information */}
          <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-3">
              <HiClipboardList className="w-5 h-5 text-violet-600" />
              <span>Tender &amp; RFQ Matching Integration</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              When hospital departments publish new purchase requisitions and open Requests for Quotations (RFQs), the procurement system filters opportunities based on your approved <strong>Supply Categories</strong>.
            </p>
            <div className="p-3 bg-violet-50/60 rounded-xl border border-violet-100 text-xs text-slate-700 space-y-1.5">
              <p className="font-semibold text-violet-900 flex items-center gap-1.5 text-[11px]">
                <HiCheckCircle className="w-4 h-4 text-violet-600" />
                <span>Capability-Based Targeting:</span>
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                You will automatically receive notifications and see open bidding opportunities aligned with your active capability areas (e.g. Medical Equipment, Diagnostic Devices, Surgical Instruments).
              </p>
            </div>
          </div>

          {/* Profile Governance & Read-Only Policy */}
          <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-slate-900 font-extrabold text-sm border-b border-slate-100 pb-3">
              <HiShieldCheck className="w-5 h-5 text-amber-600" />
              <span>Read-Only Compliance Policy</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              In accordance with ProcuraMed procurement compliance standards, approved supply categories are <strong>read-only</strong> post-approval and cannot be modified directly from the vendor portal.
            </p>
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 text-xs text-slate-700 space-y-1.5">
              <p className="font-semibold text-amber-900 flex items-center gap-1.5 text-[11px]">
                <HiInformationCircle className="w-4 h-4 text-amber-600" />
                <span>Requesting Category Additions:</span>
              </p>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                If your company expands its product or service lines, please contact the Hospital System Administrator with updated business certifications to request addition of new supply categories.
              </p>
            </div>
          </div>
        </div>
      </div>
    </VendorLayout>
  );
};

export default VendorSupplyCategoriesPage;
