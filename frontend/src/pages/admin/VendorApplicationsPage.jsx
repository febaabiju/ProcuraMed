import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/common/Button';
import InputField from '../../components/common/InputField';
import {
  HiClipboardList,
  HiCheckCircle,
  HiXCircle,
  HiEye,
  HiOfficeBuilding,
  HiX,
  HiKey,
  HiMail,
  HiPhone,
  HiLocationMarker,
  HiCalendar,
  HiSearch,
  HiRefresh,
  HiTag,
  HiExternalLink,
  HiUser,
  HiShieldCheck,
  HiDocumentText
} from 'react-icons/hi';

const VendorApplicationsPage = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedApp, setSelectedApp] = useState(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [rejectError, setRejectError] = useState('');
  
  // Credentials state for approval
  const [assignUsername, setAssignUsername] = useState('');
  const [assignPassword, setAssignPassword] = useState('');
  
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [approvedCredentials, setApprovedCredentials] = useState(null);

  const fetchApplications = async () => {
    setLoading(true);
    setActionError('');
    try {
      const res = await axiosClient.get('/vendors/applications/', { params: { page_size: 500 } });
      setApplications(res.data.results || res.data || []);
    } catch (err) {
      setActionError('Failed to load vendor applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `PM#${code}!`;
  };

  const openApproveModal = (app) => {
    const targetApp = app || selectedApp;
    if (!targetApp) return;
    setSelectedApp(targetApp);
    setActionError('');

    const suggestedUsername =
      targetApp.portal_username ||
      (targetApp.email
        ? targetApp.email.split('@')[0]
        : (targetApp.company_name || '').toLowerCase().replace(/[^a-z0-9]/g, '.'));

    setAssignUsername(suggestedUsername);
    setAssignPassword(generateTempPassword());
    setAdminRemarks(targetApp.admin_remarks || 'Approved by System Administrator');
    setApproveModalOpen(true);
  };

  const handleApproveSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedApp) return;

    if (!assignUsername.trim()) {
      setActionError('Username is required.');
      return;
    }

    const tempPassword = assignPassword || generateTempPassword();

    setReviewing(true);
    setActionError('');
    setActionSuccess('');

    try {
      const payload = {
        admin_remarks: adminRemarks || 'Approved by System Administrator',
        username: assignUsername.trim(),
        password: tempPassword,
        initial_password: tempPassword,
      };

      const res = await axiosClient.post(`/vendors/applications/${selectedApp.id}/approve/`, payload);

      const creds = res.data.vendor_credentials;
      setApprovedCredentials({
        company_name: selectedApp.company_name,
        contact_person: selectedApp.contact_person,
        username: creds ? creds.username : assignUsername.trim(),
        temporary_password: creds ? (creds.temporary_password || tempPassword) : tempPassword,
      });

      setActionSuccess(`Vendor application for "${selectedApp.company_name}" has been approved and Portal Account (@${creds ? creds.username : assignUsername.trim()}) is now ACTIVE!`);
      setApproveModalOpen(false);
      setReviewModalOpen(false);
      fetchApplications();
    } catch (err) {
      const errData = err.response?.data;
      if (errData) {
        if (typeof errData === 'string') setActionError(errData);
        else if (errData.error) setActionError(errData.error);
        else if (errData.username) setActionError(Array.isArray(errData.username) ? errData.username.join(' ') : errData.username);
        else setActionError(Object.values(errData).flat().join(' '));
      } else {
        setActionError('Failed to approve vendor application.');
      }
    } finally {
      setReviewing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;
    if (!adminRemarks.trim()) {
      setRejectError('Please provide admin remarks explaining the reason for rejection.');
      return;
    }

    setReviewing(true);
    setRejectError('');

    try {
      await axiosClient.post(`/vendors/applications/${selectedApp.id}/reject/`, {
        admin_remarks: adminRemarks,
      });

      setReviewModalOpen(false);
      setRejectError('');
      fetchApplications();
    } catch (err) {
      const errData = err.response?.data;
      if (errData) {
        if (typeof errData === 'string') setRejectError(errData);
        else if (errData.error) setRejectError(errData.error);
        else setRejectError(Object.values(errData).flat().join(' '));
      } else {
        setRejectError('Failed to reject vendor application.');
      }
    } finally {
      setReviewing(false);
    }
  };

  const getCertificateUrl = (fileUrl) => {
    if (!fileUrl) return null;
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      return fileUrl;
    }
    return fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
  };

  const openReviewModal = async (app) => {
    if (!app) return;
    setSelectedApp(app);
    setAdminRemarks(app.admin_remarks || '');
    
    // Auto-suggest username if needed
    const suggestedUsername =
      app.portal_username ||
      (app.email
        ? app.email.split('@')[0]
        : (app.company_name || '').toLowerCase().replace(/[^a-z0-9]/g, '.'));
    
    setAssignUsername(suggestedUsername);
    setAssignPassword('');
    setActionError('');
    setRejectError('');
    setReviewModalOpen(true);

    // Fetch freshest application data from backend
    try {
      const res = await axiosClient.get(`/vendors/applications/${app.id}/`);
      if (res.data) {
        setSelectedApp(res.data);
        if (res.data.admin_remarks) {
          setAdminRemarks(res.data.admin_remarks);
        }
      }
    } catch (e) {
      // Fallback is already loaded into selectedApp
    }
  };

  // Extract all unique categories for dropdown filter
  const allCategories = Array.from(
    new Set(
      applications.flatMap((app) =>
        (app.supplier_category_details || []).map((cat) => cat.name)
      )
    )
  ).filter(Boolean);

  // Filter applications by Tab, Search term, and Category
  const filteredApps = applications.filter((app) => {
    const matchesTab = activeTab === 'ALL' || app.status === activeTab;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      (app.company_name && app.company_name.toLowerCase().includes(term)) ||
      (app.contact_person && app.contact_person.toLowerCase().includes(term)) ||
      (app.email && app.email.toLowerCase().includes(term)) ||
      (app.phone && app.phone.toLowerCase().includes(term)) ||
      (app.address && app.address.toLowerCase().includes(term)) ||
      (app.application_code && app.application_code.toLowerCase().includes(term)) ||
      String(app.id).includes(term) ||
      (app.supplier_category_details &&
        app.supplier_category_details.some((c) => c.name.toLowerCase().includes(term)));

    const matchesCategory =
      categoryFilter === 'ALL' ||
      (app.supplier_category_details &&
        app.supplier_category_details.some((c) => c.name === categoryFilter));

    return matchesTab && matchesSearch && matchesCategory;
  }).sort((a, b) => (a.id || 0) - (b.id || 0));

  const counts = {
    ALL: applications.length,
    PENDING: applications.filter((a) => a.status === 'PENDING').length,
    APPROVED: applications.filter((a) => a.status === 'APPROVED').length,
    REJECTED: applications.filter((a) => a.status === 'REJECTED').length,
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AdminLayout
      title="Vendor Applications Review"
      subtitle="Review supplier registration applications, verify business details, and approve eligible vendors for hospital procurement."
      onRefresh={fetchApplications}
    >
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-violet-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shadow-xs">
              <HiClipboardList className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Vendor Supplier Applications
            </h2>
          </div>

          {/* Status Tabs with Live Counts - Fits naturally without scrolling */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl text-xs font-semibold">
            {[
              { key: 'PENDING', label: 'Pending Approval' },
              { key: 'APPROVED', label: 'Approved' },
              { key: 'REJECTED', label: 'Rejected' },
              { key: 'ALL', label: 'All Applications' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    activeTab === tab.key
                      ? tab.key === 'PENDING'
                        ? 'bg-amber-100 text-amber-800'
                        : tab.key === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : tab.key === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-violet-100 text-violet-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {counts[tab.key] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-violet-100 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <HiSearch className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by company name, registration #, contact person, email, phone, location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-800"
            />
          </div>

          {allCategories.length > 0 && (
            <div className="w-full md:w-64 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-700 font-medium"
              >
                <option value="ALL">All Categories</option>
                {allCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Notifications */}
        {actionSuccess && !actionSuccess.toLowerCase().includes('reject') && (
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

        {actionError && !actionError.toLowerCase().includes('reject') && (
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

        {/* Newly Approved Credentials Card */}
        {approvedCredentials && (
          <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-200 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <HiKey className="w-5 h-5 text-emerald-600" />
                <span>Vendor Login Account Created</span>
              </div>
              <button
                onClick={() => setApprovedCredentials(null)}
                className="text-emerald-600 hover:text-emerald-800 text-xs font-semibold"
              >
                Dismiss
              </button>
            </div>
            <p className="text-xs text-emerald-800">
              The vendor account for <strong>{approvedCredentials.company_name}</strong> is now ACTIVE. The vendor can log in using these credentials:
            </p>
            <div className="p-3.5 bg-white rounded-2xl border border-emerald-200 text-xs font-mono space-y-1.5 max-w-md">
              <p className="flex justify-between">
                <span className="text-slate-500">Username:</span>
                <strong className="text-slate-900">{approvedCredentials.username}</strong>
              </p>
              <p className="flex justify-between">
                <span className="text-slate-500">Initial Password:</span>
                <strong className="text-violet-700">{approvedCredentials.password}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Comprehensive Vendor Applications Table */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
              <HiRefresh className="w-6 h-6 animate-spin text-violet-500" />
              <span>Loading vendor applications...</span>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center font-bold">
                <HiClipboardList className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">No vendor applications found.</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {searchTerm || categoryFilter !== 'ALL'
                  ? 'No applications match your search or filter criteria.'
                  : `There are currently no applications with status "${activeTab}".`}
              </p>
            </div>
          ) : (
            <div className="w-full">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-4">Company Name</th>
                    <th className="px-6 py-4">Reg. / App ID</th>
                    <th className="px-6 py-4">Business Category</th>
                    <th className="px-6 py-4">Contact Person</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredApps.map((app) => {
                    const appCode = app.application_code || `#APP-${String(app.id).padStart(4, '0')}`;
                    const categoriesList = app.supplier_category_details || [];

                    return (
                      <tr key={app.id} className="hover:bg-violet-50/40 transition-colors">
                        {/* 1. Company Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                              <HiOfficeBuilding className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 leading-snug truncate">{app.company_name}</p>
                              <span className="text-[11px] text-slate-400 truncate block">{app.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Registration / App ID */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-violet-700 bg-violet-50/80 px-2.5 py-1 rounded-lg border border-violet-100">
                            {appCode}
                          </span>
                        </td>

                        {/* 3. Business Category */}
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {categoriesList.length > 0 ? (
                              categoriesList.slice(0, 2).map((cat) => (
                                <span
                                  key={cat.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold"
                                >
                                  <HiTag className="w-2.5 h-2.5 text-violet-500" />
                                  {cat.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">General Medical</span>
                            )}
                            {categoriesList.length > 2 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-bold">
                                +{categoriesList.length - 2}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Contact Person */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <HiUser className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-semibold text-slate-800">{app.contact_person || 'N/A'}</span>
                          </div>
                        </td>

                        {/* 5. Status */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                              app.status === 'PENDING'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : app.status === 'APPROVED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {app.status === 'PENDING' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                            {app.status === 'APPROVED' && <HiCheckCircle className="w-3 h-3 text-emerald-600" />}
                            {app.status === 'REJECTED' && <HiXCircle className="w-3 h-3 text-rose-600" />}
                            {app.status}
                          </span>
                        </td>

                        {/* 6. Review Action */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReviewModal(app)}
                            className="gap-1.5 text-xs text-violet-700 border-violet-200 hover:bg-violet-50 shadow-2xs font-semibold"
                          >
                            <HiEye className="w-3.5 h-3.5" /> Review
                          </Button>
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

      {/* Comprehensive Review & Detail Modal */}
      {reviewModalOpen && selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-6 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-lg shadow-xs">
                  <HiOfficeBuilding className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      {selectedApp.company_name}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                        selectedApp.status === 'PENDING'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : selectedApp.status === 'APPROVED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {selectedApp.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Application Ref:{' '}
                    <strong className="text-violet-700">
                      {selectedApp.application_code || `#APP-${String(selectedApp.id).padStart(4, '0')}`}
                    </strong>{' '}
                    • Submitted on {formatDateTime(selectedApp.submitted_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setReviewModalOpen(false);
                  setRejectError('');
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message inside Modal */}
            {actionError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <HiXCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Information Grid */}
            <div className="space-y-4 text-xs">
              {/* Section 1: Company & Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2.5">
                  <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-200/80 pb-1.5">
                    <HiOfficeBuilding className="w-4 h-4 text-violet-600" />
                    <span>Company & Registration Details</span>
                  </div>
                  <div className="space-y-1.5 text-slate-600">
                    <p className="flex justify-between">
                      <span className="text-slate-400">Company Name:</span>
                      <strong className="text-slate-900">{selectedApp.company_name}</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400">Application Code:</span>
                      <strong className="font-mono text-violet-700">
                        {selectedApp.application_code || `#APP-${String(selectedApp.id).padStart(4, '0')}`}
                      </strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400">Application Date:</span>
                      <strong className="text-slate-800">{formatDate(selectedApp.submitted_at)}</strong>
                    </p>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Physical Address:</span>
                      <p className="font-medium text-slate-800 bg-white p-2 rounded-xl border border-slate-200/60 leading-relaxed">
                        {selectedApp.address || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2.5">
                  <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-200/80 pb-1.5">
                    <HiUser className="w-4 h-4 text-violet-600" />
                    <span>Contact Person & Communications</span>
                  </div>
                  <div className="space-y-2 text-slate-600">
                    <p className="flex justify-between">
                      <span className="text-slate-400">Contact Name:</span>
                      <strong className="text-slate-900">{selectedApp.contact_person || 'N/A'}</strong>
                    </p>
                    <p className="flex justify-between items-center">
                      <span className="text-slate-400">Business Email:</span>
                      <a
                        href={`mailto:${selectedApp.email}`}
                        className="text-violet-700 font-bold hover:underline inline-flex items-center gap-1"
                      >
                        <HiMail className="w-3.5 h-3.5" />
                        {selectedApp.email}
                      </a>
                    </p>
                    <p className="flex justify-between items-center">
                      <span className="text-slate-400">Phone Number:</span>
                      <a
                        href={`tel:${selectedApp.phone}`}
                        className="text-slate-800 font-mono font-bold hover:text-violet-600 inline-flex items-center gap-1"
                      >
                        <HiPhone className="w-3.5 h-3.5" />
                        {selectedApp.phone || 'N/A'}
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 2: Supplier Categories & Products/Services */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-3">
                <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-200/80 pb-1.5">
                  <HiTag className="w-4 h-4 text-violet-600" />
                  <span>Supplier Categories & Offerings</span>
                </div>

                <div>
                  <span className="text-slate-500 font-semibold block mb-1.5">Selected Product/Service Categories:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedApp.supplier_category_details && selectedApp.supplier_category_details.length > 0 ? (
                      selectedApp.supplier_category_details.map((cat) => (
                        <span
                          key={cat.id}
                          className="px-3 py-1 rounded-xl bg-violet-100/70 text-violet-800 text-xs font-bold inline-flex items-center gap-1 border border-violet-200"
                        >
                          <HiShieldCheck className="w-3.5 h-3.5 text-violet-600" />
                          {cat.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">No specific categories specified.</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-semibold block mb-1">Products / Services Description:</span>
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-slate-800 leading-relaxed font-medium">
                    {selectedApp.products_services_offered || (
                      <span className="text-slate-400 italic">No detailed description provided.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Uploaded License / Registration Certificate */}
              <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-200/80 pb-1.5">
                  <HiDocumentText className="w-4 h-4 text-violet-600" />
                  <span>Business License & Registration Certificate</span>
                </div>

                {selectedApp.certificate_file ? (
                  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-violet-100">
                    <div className="flex items-center gap-2.5 text-slate-800 font-medium">
                      <HiDocumentText className="w-5 h-5 text-violet-600" />
                      <div>
                        <p className="font-bold text-xs text-slate-900">Business License Document</p>
                        <p className="text-[11px] text-slate-400 truncate max-w-xs">
                          {selectedApp.certificate_file.split('/').pop()}
                        </p>
                      </div>
                    </div>
                    <a
                      href={getCertificateUrl(selectedApp.certificate_file)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold text-xs inline-flex items-center gap-1.5 transition-colors border border-violet-200"
                    >
                      <HiExternalLink className="w-3.5 h-3.5" /> View Certificate
                    </a>
                  </div>
                ) : (
                  <p className="text-slate-400 italic py-1">No registration certificate file uploaded by vendor.</p>
                )}
              </div>

              {/* Section 4: Audit / Review Log & Portal Credentials Status (If already reviewed) */}
              {selectedApp.status !== 'PENDING' && (
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                      <HiShieldCheck className="w-4 h-4 text-violet-600" />
                      <span>Review Decision &amp; Portal Access Status</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-slate-600">
                    <p className="flex justify-between">
                      <span className="text-slate-400">Portal Credentials:</span>
                      {selectedApp.has_credentials ? (
                        <span className="font-bold text-emerald-700 inline-flex items-center gap-1">
                          <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Active (@{selectedApp.portal_username})
                        </span>
                      ) : (
                        <span className="font-bold text-amber-700 inline-flex items-center gap-1">
                          <HiKey className="w-3.5 h-3.5 text-amber-600" /> Auto-Generated on Approval
                        </span>
                      )}
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400">Reviewed By:</span>
                      <strong className="text-slate-900">{selectedApp.reviewed_by_name || 'Administrator'}</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400">Reviewed On:</span>
                      <strong className="text-slate-800">{formatDateTime(selectedApp.reviewed_at)}</strong>
                    </p>
                    {selectedApp.admin_remarks && (
                      <div>
                        <span className="text-slate-400 block mb-0.5">Admin Remarks:</span>
                        <p className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-800 font-medium">
                          {selectedApp.admin_remarks}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 5: Approval Controls (Only for PENDING applications) */}
            {selectedApp.status === 'PENDING' && (
              <div className="space-y-4 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Administrator Review Remarks (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={adminRemarks}
                    onChange={(e) => {
                      setAdminRemarks(e.target.value);
                      if (rejectError) setRejectError('');
                    }}
                    placeholder="Add approval justification or review notes..."
                    className={`w-full p-3 bg-slate-50 border rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 text-slate-800 font-medium transition-colors ${
                      rejectError
                        ? 'border-rose-300 focus:ring-rose-500/20'
                        : 'border-slate-200 focus:ring-violet-500/20'
                    }`}
                  />
                  {rejectError && (
                    <div className="mt-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                      <HiXCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                      <span>{rejectError}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handleReject}
                    isLoading={reviewing}
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 font-bold"
                  >
                    Reject Application
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => openApproveModal(selectedApp)}
                    isLoading={reviewing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20 gap-1.5"
                  >
                    <HiShieldCheck className="w-4 h-4" />
                    <span>Approve Application</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* APPROVE VENDOR & CREATE PORTAL ACCESS MODAL */}
      {approveModalOpen && selectedApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20 bg-emerald-600"
                >
                  <HiShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Approve Vendor &amp; Create Portal Access</h3>
                  <p className="text-xs text-slate-500 font-medium">Enterprise Procurement Supplier Onboarding</p>
                </div>
              </div>
              <button
                onClick={() => setApproveModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <HiX className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <HiXCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={handleApproveSubmit} className="space-y-4 text-xs">
              {/* Vendor & Company Info (Auto-filled) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Vendor Name</span>
                  <p className="font-bold text-slate-900 truncate">{selectedApp.contact_person || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Company Name</span>
                  <p className="font-bold text-slate-900 truncate">{selectedApp.company_name}</p>
                </div>
              </div>

              {/* Portal Username (Auto-generated, editable) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Username <span className="text-slate-400 font-normal">(Auto-generated, editable)</span>
                </label>
                <InputField
                  type="text"
                  value={assignUsername}
                  onChange={(e) => setAssignUsername(e.target.value)}
                  placeholder="e.g. medtech.solutions"
                  required
                />
              </div>

              {/* Temporary Password (Auto-generated) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800">
                    Temporary Password <span className="text-slate-400 font-normal">(Auto-generated)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setAssignPassword(generateTempPassword())}
                    className="text-[11px] text-violet-600 hover:text-violet-800 font-bold inline-flex items-center gap-1"
                  >
                    <HiRefresh className="w-3 h-3" /> Regenerate
                  </button>
                </div>
                <InputField
                  type="text"
                  value={assignPassword}
                  onChange={(e) => setAssignPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  The vendor portal account will be created immediately with Portal Access Status = <strong>Active</strong>.
                </p>
              </div>

              {/* Administrator Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Approval Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <InputField
                  type="text"
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  placeholder="e.g. Approved following specification verification"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setApproveModalOpen(false)}
                  className="border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={reviewing}
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold text-white shadow-md shadow-emerald-600/20 gap-1.5"
                >
                  <HiCheckCircle className="w-4 h-4" />
                  <span>Approve &amp; Create Account</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREDENTIALS GENERATED CONFIRMATION MODAL */}
      {approvedCredentials && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <HiCheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Vendor Portal Account Active</h3>
                <p className="text-xs text-slate-500 font-medium">{approvedCredentials.company_name}</p>
              </div>
            </div>

            <div className="p-4 bg-violet-50/70 rounded-2xl border border-violet-100 space-y-3 text-xs">
              <p className="text-slate-600 font-medium leading-relaxed">
                The vendor application has been approved and moved to <strong>Approved Vendors</strong>. The vendor portal account is now active with the following credentials:
              </p>
              <div className="space-y-2 bg-white p-3 rounded-xl border border-violet-200/80">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Username:</span>
                  <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg">
                    @{approvedCredentials.username}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Temporary Password:</span>
                  <span className="font-mono font-bold text-violet-700 bg-violet-100/70 px-2 py-0.5 rounded-lg select-all">
                    {approvedCredentials.temporary_password}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400">
                The vendor will be required to change their temporary password upon first login.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                variant="primary"
                size="md"
                onClick={() => setApprovedCredentials(null)}
                className="font-bold text-white shadow-md shadow-violet-500/20"
                style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default VendorApplicationsPage;
