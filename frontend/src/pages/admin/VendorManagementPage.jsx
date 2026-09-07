import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/common/Button';
import {
  HiOfficeBuilding,
  HiSearch,
  HiCheckCircle,
  HiXCircle,
  HiEye,
  HiKey,
  HiRefresh,
  HiX,
  HiFilter,
  HiUser,
  HiMail,
  HiPhone,
  HiLocationMarker,
  HiDocumentText,
  HiExternalLink,
  HiShieldCheck,
  HiTag,
  HiClipboardCopy
} from 'react-icons/hi';

const VendorManagementPage = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modals state
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [toggleModalOpen, setToggleModalOpen] = useState(false);
  const [newPasswordData, setNewPasswordData] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchVendors = async () => {
    setLoading(true);
    setActionError('');
    try {
      const res = await axiosClient.get('/vendors/vendors/', { params: { page_size: 500 } });
      setVendors(res.data.results || res.data || []);
    } catch (err) {
      setActionError('Failed to fetch approved vendors directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  // Open View Details Modal (Read-Only)
  const openViewModal = (vendor) => {
    setSelectedVendor(vendor);
    setViewModalOpen(true);
  };

  // Open Reset Password Confirmation Modal
  const openResetModal = (vendor) => {
    setSelectedVendor(vendor);
    setActionError('');
    setActionSuccess('');
    setResetModalOpen(true);
  };

  // Open Toggle Status Modal (Activate / Deactivate)
  const openToggleModal = (vendor) => {
    setSelectedVendor(vendor);
    setActionError('');
    setActionSuccess('');
    setToggleModalOpen(true);
  };

  // Confirm Reset Password (Admin generates temporary password & sets force password change)
  const handleConfirmResetPassword = async () => {
    if (!selectedVendor) return;
    setActionError('');
    setActionSuccess('');
    setSubmitting(true);

    try {
      const res = await axiosClient.post(`/vendors/vendors/${selectedVendor.id}/reset_password/`);
      setNewPasswordData(res.data);
      setResetModalOpen(false);
      setCopied(false);
      fetchVendors();
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to reset vendor password.';
      setActionError(errMsg);
      setResetModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Copy password to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Execute Activate / Deactivate Account
  const handleConfirmToggle = async () => {
    if (!selectedVendor) return;
    setActionError('');
    setActionSuccess('');
    setSubmitting(true);

    try {
      const res = await axiosClient.post(`/vendors/vendors/${selectedVendor.id}/toggle_status/`);
      const isNowActive = res.data.is_active;
      setActionSuccess(
        `Vendor account for "${selectedVendor.company_name}" has been ${
          isNowActive ? 'activated. Portal access is now Active.' : 'deactivated. Portal access is now Disabled.'
        }`
      );
      setToggleModalOpen(false);
      setSelectedVendor(null);
      fetchVendors();
    } catch (err) {
      setActionError('Failed to update vendor portal access status.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCertificateUrl = (fileUrl) => {
    if (!fileUrl) return null;
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return fileUrl;
    }
    return fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
  };

  // Filter & Sort Vendors (Ascending order by ID)
  const filteredVendors = vendors
    .filter((v) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        (v.company_name && v.company_name.toLowerCase().includes(term)) ||
        (v.vendor_code && v.vendor_code.toLowerCase().includes(term)) ||
        (v.email && v.email.toLowerCase().includes(term)) ||
        (v.contact_person && v.contact_person.toLowerCase().includes(term)) ||
        (v.portal_username && v.portal_username.toLowerCase().includes(term));

      const isPortalActive = v.is_active && (v.portal_access_active !== false && v.user);
      let matchesStatus = true;
      if (statusFilter === 'ACTIVE') {
        matchesStatus = isPortalActive;
      } else if (statusFilter === 'DEACTIVATED') {
        matchesStatus = !isPortalActive;
      }

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => (a.id || 0) - (b.id || 0));

  return (
    <AdminLayout
      title="Approved Vendors Directory"
      subtitle="View approved supplier registration records, manage portal access, and perform admin-controlled password resets."
      onRefresh={fetchVendors}
    >
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-violet-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
            >
              <HiOfficeBuilding className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Approved Vendors</h2>
              <p className="text-xs text-slate-500">System Admin Portal • Read-Only Registry &amp; Credential Control</p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {actionSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess('')} className="text-emerald-500 hover:text-emerald-700">
              <HiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <HiXCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError('')} className="text-rose-500 hover:text-rose-700">
              <HiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search & Status Filters */}
        <div className="bg-white p-5 rounded-3xl border border-violet-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <HiFilter className="w-4 h-4 text-violet-500" />
            <span>Search &amp; Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative sm:col-span-2">
              <HiSearch className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search approved vendors by vendor name, company name, username, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-800 transition-colors"
              />
            </div>

            {/* Access Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors font-medium"
              >
                <option value="ALL">All Portal Statuses</option>
                <option value="ACTIVE">Portal Access: Active</option>
                <option value="DEACTIVATED">Portal Access: Deactivated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Approved Vendors Table */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
              <HiRefresh className="w-6 h-6 animate-spin text-violet-500" />
              <span>Loading approved vendors directory...</span>
            </div>
          ) : filteredVendors.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center font-bold">
                <HiOfficeBuilding className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">No approved vendors found.</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchTerm || statusFilter !== 'ALL'
                  ? 'No vendors match your search or filter criteria.'
                  : 'Vendors approved through the Vendor Applications review will appear here with active portal accounts.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-4">Vendor Name</th>
                    <th className="px-6 py-4">Company Name</th>
                    <th className="px-6 py-4">Username</th>
                    <th className="px-6 py-4 text-center">Portal Access Status</th>
                    <th className="px-6 py-4 text-center">Account Status</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredVendors.map((v) => {
                    const isPortalActive = v.is_active && (v.portal_access_active !== false && v.user);
                    const usernameDisplay = v.portal_username || v.user_details?.username;

                    return (
                      <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Vendor Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                              <HiUser className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-snug">{v.contact_person || 'N/A'}</p>
                              <span className="text-[11px] text-slate-400">{v.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Company Name */}
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-bold text-slate-900 leading-snug">{v.company_name}</p>
                            <span className="text-[10px] font-mono text-violet-700 font-bold bg-violet-50 px-1.5 py-0.5 rounded border border-violet-100 inline-block mt-0.5">
                              {v.vendor_code || `VEN-${v.id}`}
                            </span>
                          </div>
                        </td>

                        {/* 3. Username (Permanent Read-Only) */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {usernameDisplay ? (
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg text-[11px]">
                              @{usernameDisplay}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* 4. Portal Access Status (Active / Deactivated) */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {isPortalActive ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase inline-flex items-center gap-1">
                              <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Active
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold uppercase inline-flex items-center gap-1">
                              <HiXCircle className="w-3.5 h-3.5 text-rose-600" /> Deactivated
                            </span>
                          )}
                        </td>

                        {/* 5. Account Status */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              v.status === 'ACTIVE' && v.is_active
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {v.status === 'ACTIVE' && v.is_active ? 'Active Supplier' : 'Inactive'}
                          </span>
                        </td>

                        {/* 6. Actions (View Vendor, Reset Password, Activate / Deactivate) */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* View Vendor (Read-Only) */}
                            <button
                              onClick={() => openViewModal(v)}
                              title="View Vendor Details (Read-Only)"
                              className="p-1.5 rounded-xl text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                            >
                              <HiEye className="w-4 h-4" />
                            </button>

                            {/* Reset Password (Admin-Controlled) */}
                            <button
                              onClick={() => openResetModal(v)}
                              disabled={!isPortalActive}
                              title={
                                isPortalActive
                                  ? 'Reset Password (Generate Temporary Password & Force Change)'
                                  : 'Cannot reset password for deactivated vendor'
                              }
                              className={`p-1.5 rounded-xl transition-colors ${
                                isPortalActive
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 cursor-pointer'
                                  : 'text-slate-200 cursor-not-allowed'
                              }`}
                            >
                              <HiKey className="w-4 h-4" />
                            </button>

                            {/* Activate / Deactivate Account */}
                            <button
                              onClick={() => openToggleModal(v)}
                              title={v.is_active ? 'Deactivate Vendor Account' : 'Activate Vendor Account'}
                              className={`p-1.5 rounded-xl transition-colors ${
                                v.is_active
                                  ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {v.is_active ? <HiXCircle className="w-4 h-4" /> : <HiCheckCircle className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* VIEW VENDOR DETAILS MODAL (READ-ONLY) */}
      <AnimatePresence>
        {viewModalOpen && selectedVendor && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <HiOfficeBuilding className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{selectedVendor.company_name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{selectedVendor.vendor_code || `VEN-${selectedVendor.id}`}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              {/* Submitted Registration Information (Read-Only Format) */}
              <div className="space-y-3.5 text-xs">
                {/* Card 1: Registration Status & Access */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Vendor Code</span>
                    <span className="font-bold font-mono text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-100 inline-block">
                      {selectedVendor.vendor_code || `VEN-${selectedVendor.id}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Portal Access Status</span>
                    <span
                      className={`font-bold inline-flex items-center gap-1 ${
                        selectedVendor.is_active ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {selectedVendor.is_active ? (
                        <>
                          <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Active
                        </>
                      ) : (
                        <>
                          <HiXCircle className="w-3.5 h-3.5 text-rose-600" /> Deactivated
                        </>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Portal Username</span>
                    <span className="font-mono font-bold text-slate-900 bg-slate-200/80 px-2 py-0.5 rounded inline-block">
                      @{selectedVendor.portal_username || selectedVendor.user_details?.username || '—'}
                    </span>
                  </div>
                </div>

                {/* Card 2: Company & Contact Information */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-200/80 pb-1.5">
                    <HiUser className="w-4 h-4 text-violet-600" />
                    <span>Vendor Contact &amp; Company Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Company Name:</span>
                      <strong className="text-slate-900">{selectedVendor.company_name}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Contact Person:</span>
                      <strong className="text-slate-900">{selectedVendor.contact_person || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Email Address:</span>
                      <a href={`mailto:${selectedVendor.email}`} className="text-violet-700 hover:underline font-semibold flex items-center gap-1">
                        <HiMail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{selectedVendor.email || 'N/A'}</span>
                      </a>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Phone Number:</span>
                      <a href={`tel:${selectedVendor.phone}`} className="text-slate-800 font-semibold flex items-center gap-1">
                        <HiPhone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{selectedVendor.phone || 'N/A'}</span>
                      </a>
                    </div>
                  </div>

                  {selectedVendor.application_details?.address && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <span className="text-slate-400 block text-[11px]">Registered Physical Address:</span>
                      <p className="text-slate-800 font-medium flex items-start gap-1 mt-0.5">
                        <HiLocationMarker className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <span>{selectedVendor.application_details.address}</span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Card 3: Supplier Categories */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-200/80 pb-1.5">
                    <HiTag className="w-4 h-4 text-violet-600" />
                    <span>Approved Supplier Categories</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {selectedVendor.supplier_category_details && selectedVendor.supplier_category_details.length > 0 ? (
                      selectedVendor.supplier_category_details.map((cat) => (
                        <span
                          key={cat.id}
                          className="px-2.5 py-1 rounded-xl bg-violet-100 text-violet-800 font-semibold text-xs border border-violet-200/60"
                        >
                          {cat.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">General Medical Products</span>
                    )}
                  </div>
                </div>

                {/* Card 4: Products & Services Description */}
                {selectedVendor.application_details?.products_services_offered && (
                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-200/80 pb-1.5">
                      <HiDocumentText className="w-4 h-4 text-violet-600" />
                      <span>Products &amp; Services Description</span>
                    </div>
                    <p className="text-slate-700 font-medium leading-relaxed">
                      {selectedVendor.application_details.products_services_offered}
                    </p>
                  </div>
                )}

                {/* Card 5: Business License / Certificate */}
                {selectedVendor.application_details?.certificate_file && (
                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-200/80 pb-1.5">
                      <HiShieldCheck className="w-4 h-4 text-violet-600" />
                      <span>Submitted Business License / Registration Document</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-violet-100">
                      <div className="flex items-center gap-2 text-slate-800 font-medium truncate">
                        <HiDocumentText className="w-5 h-5 text-violet-600 flex-shrink-0" />
                        <span className="truncate text-xs font-bold">
                          {selectedVendor.application_details.certificate_file.split('/').pop()}
                        </span>
                      </div>
                      <a
                        href={getCertificateUrl(selectedVendor.application_details.certificate_file)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold text-xs inline-flex items-center gap-1.5 transition-colors border border-violet-200 flex-shrink-0"
                      >
                        <HiExternalLink className="w-3.5 h-3.5" /> View Certificate
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="pt-3 flex justify-end items-center border-t border-slate-100">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setViewModalOpen(false)}
                  className="border-slate-200 text-slate-700"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RESET PASSWORD CONFIRMATION MODAL */}
      <AnimatePresence>
        {resetModalOpen && selectedVendor && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <HiKey className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Reset Vendor Password</h3>
                  <p className="text-xs text-slate-500 font-medium">{selectedVendor.company_name}</p>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Vendor Name:</span>
                  <strong className="text-slate-900">{selectedVendor.contact_person || 'N/A'}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Username:</span>
                  <strong className="font-mono text-slate-900">
                    @{selectedVendor.portal_username || selectedVendor.user_details?.username}
                  </strong>
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-100 text-amber-900 text-xs leading-relaxed space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <HiShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Admin-Controlled Reset</span>
                </p>
                <p className="text-[11px] text-amber-800">
                  This will generate a secure temporary password. The existing username remains unchanged. The vendor will be forced to change their password immediately upon their next login before accessing the dashboard.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setResetModalOpen(false)}
                  className="border-slate-200 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  isLoading={submitting}
                  onClick={handleConfirmResetPassword}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md shadow-amber-600/20 gap-1.5"
                >
                  <HiKey className="w-4 h-4" />
                  <span>Generate Temporary Password</span>
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PASSWORD RESET SUCCESSFUL DIALOG */}
      <AnimatePresence>
        {newPasswordData && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <HiCheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Password Reset Successful</h3>
                  <p className="text-xs text-slate-500 font-medium">{newPasswordData.company_name}</p>
                </div>
              </div>

              <div className="p-4 bg-violet-50/70 rounded-2xl border border-violet-100 space-y-3 text-xs">
                <p className="text-slate-600 font-medium leading-relaxed">
                  A temporary password has been generated securely. Please provide these credentials to the vendor:
                </p>

                <div className="space-y-2 bg-white p-3.5 rounded-xl border border-violet-200/80">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Username:</span>
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                      @{newPasswordData.username}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">Temporary Password:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-violet-700 bg-violet-100/70 px-2 py-0.5 rounded-lg select-all">
                        {newPasswordData.temporary_password}
                      </span>
                      <button
                        onClick={() => copyToClipboard(newPasswordData.temporary_password)}
                        className="p-1 rounded-lg text-violet-600 hover:bg-violet-100 transition-colors"
                        title="Copy Password"
                      >
                        <HiClipboardCopy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {copied && (
                  <p className="text-[11px] text-emerald-600 font-bold text-right">Copied to clipboard!</p>
                )}

                <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200/60 text-[11px] text-amber-800 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <HiShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>Force Password Change: Active</span>
                  </p>
                  <p className="text-[10px]">
                    The vendor must change this temporary password upon login before accessing their dashboard.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setNewPasswordData(null)}
                  className="font-bold text-white shadow-md shadow-violet-500/20"
                  style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
                >
                  Done
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ACTIVATE / DEACTIVATE CONFIRMATION MODAL */}
      <AnimatePresence>
        {toggleModalOpen && selectedVendor && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    selectedVendor.is_active ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                  }`}
                >
                  {selectedVendor.is_active ? <HiXCircle className="w-6 h-6" /> : <HiCheckCircle className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {selectedVendor.is_active ? 'Deactivate Vendor Account?' : 'Activate Vendor Account?'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">{selectedVendor.company_name}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {selectedVendor.is_active
                  ? `Deactivating ${selectedVendor.company_name} will immediately disable portal access (Portal Access Status = Deactivated) and prevent the vendor from signing in to submit quotations or view RFQs until reactivated.`
                  : `Activating ${selectedVendor.company_name} will restore portal access (Portal Access Status = Active) and allow the vendor to sign in normally.`}
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setToggleModalOpen(false)}
                  className="border-slate-200 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  variant={selectedVendor.is_active ? 'danger' : 'primary'}
                  size="md"
                  isLoading={submitting}
                  onClick={handleConfirmToggle}
                  className={
                    !selectedVendor.is_active
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold'
                      : 'font-bold'
                  }
                >
                  {selectedVendor.is_active ? 'Confirm Deactivation' : 'Confirm Activation'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
};

export default VendorManagementPage;
