import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import RequisitionDetailModal from '../../components/committee/RequisitionDetailModal';
import VendorSourcingModal from '../../components/committee/VendorSourcingModal';
import Button from '../../components/common/Button';
import {
  HiCheckCircle,
  HiEye,
  HiSearch,
  HiX,
  HiRefresh,
  HiShieldCheck,
  HiOutlineSparkles,
  HiInformationCircle,
  HiShoppingBag,
  HiDocumentText,
  HiTag,
  HiExternalLink
} from 'react-icons/hi';

const ProcurementCommitteeApprovedPage = () => {
  const [data, setData] = useState({
    user: null,
    approved_requests: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Sourcing status sub-filter tab
  const [statusTab, setStatusTab] = useState('ALL'); // 'ALL', 'APPROVED', 'RFQ_ISSUED'

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal State
  const [selectedReq, setSelectedReq] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Vendor Sourcing Modal State
  const [sourcingReq, setSourcingReq] = useState(null);
  const [sourcingModalOpen, setSourcingModalOpen] = useState(false);

  const fetchApprovedRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/committee-dashboard/');
      setData({
        user: res.data.user || null,
        approved_requests: res.data.approved_requests || []
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load approved procurement requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovedRequests();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || amount === '') return '₹0.00';
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Distinct departments
  const uniqueDepartments = useMemo(() => {
    const set = new Set();
    data.approved_requests.forEach((r) => {
      if (r.department_name && r.department_name !== 'N/A') set.add(r.department_name);
    });
    return Array.from(set).sort();
  }, [data.approved_requests]);

  // Distinct categories
  const uniqueCategories = useMemo(() => {
    const set = new Set();
    data.approved_requests.forEach((r) => {
      if (r.category && r.category !== 'N/A') set.add(r.category);
    });
    return Array.from(set).sort();
  }, [data.approved_requests]);

  // Filter approved & sourcing requests
  const filteredRequests = useMemo(() => {
    return data.approved_requests.filter((item) => {
      // Stage sub-filter
      if (statusTab === 'APPROVED' && item.status !== 'APPROVED') return false;
      if (statusTab === 'RFQ_ISSUED' && item.status !== 'RFQ_ISSUED') return false;
      if (statusTab === 'QUOTATIONS_RECEIVED' && item.status !== 'QUOTATIONS_RECEIVED') return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesReq = item.req_number?.toLowerCase().includes(q);
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesItem = item.item_name?.toLowerCase().includes(q);
        const matchesDept = item.department_name?.toLowerCase().includes(q);
        if (!matchesReq && !matchesTitle && !matchesItem && !matchesDept) return false;
      }

      // Department dropdown
      if (selectedDepartment !== 'ALL' && item.department_name !== selectedDepartment) {
        return false;
      }

      // Category dropdown
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [data.approved_requests, statusTab, searchQuery, selectedDepartment, selectedCategory]);

  // Counts for tabs
  const approvedCount = useMemo(
    () => data.approved_requests.filter((r) => r.status === 'APPROVED').length,
    [data.approved_requests]
  );
  const rfqIssuedCount = useMemo(
    () => data.approved_requests.filter((r) => r.status === 'RFQ_ISSUED').length,
    [data.approved_requests]
  );
  const quotesReceivedCount = useMemo(
    () => data.approved_requests.filter((r) => r.status === 'QUOTATIONS_RECEIVED').length,
    [data.approved_requests]
  );

  const totalApprovedValue = useMemo(() => {
    return data.approved_requests.reduce((sum, r) => sum + Number(r.estimated_budget || 0), 0);
  }, [data.approved_requests]);

  const handleOpenDetail = (req) => {
    setSelectedReq(req);
    setDetailModalOpen(true);
  };

  const handleOpenSourcing = (req) => {
    setSourcingReq(req);
    setSourcingModalOpen(true);
  };

  const handleRFQSuccess = (newRFQ) => {
    fetchApprovedRequests();
    setSuccessNotice(
      `Quotation request ${newRFQ?.rfq_number || ''} issued successfully! The requisition has progressed to Sent RFQs.`
    );
    setTimeout(() => setSuccessNotice(''), 8000);
  };

  return (
    <ProcurementCommitteeLayout
      title="Approved & Active Sourcing"
      subtitle="Sanctioned purchase requests in active vendor sourcing. Search category suppliers, review catalogues, and issue RFQs."
      committeeUser={data.user}
      onRefresh={fetchApprovedRequests}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Success Alert Banner */}
        {successNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{successNotice}</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/committee/rfqs"
                className="text-emerald-700 underline hover:text-emerald-900 font-bold flex items-center gap-1"
              >
                <span>View Sent RFQs</span>
                <HiExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSuccessNotice('')}
                className="text-emerald-500 hover:text-emerald-700"
              >
                <HiX className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError('')}
              className="text-rose-500 hover:text-rose-700 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Stage Overview KPI Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Sourcing Queue
              </p>
              <h3 className="text-2xl font-black text-slate-900">
                {data.approved_requests.length}
              </h3>
              <p className="text-[11px] text-violet-600 font-semibold">
                Approved procurement pipeline
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <HiOutlineSparkles className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Ready for Quotation
              </p>
              <h3 className="text-2xl font-black text-emerald-600">
                {approvedCount}
              </h3>
              <p className="text-[11px] text-emerald-600 font-semibold">
                Sanctioned • Awaiting RFQ issuance
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <HiCheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Sanctioned Value
              </p>
              <h3 className="text-2xl font-black text-violet-700">
                {formatCurrency(totalApprovedValue)}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Allocated procurement budget
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <HiTag className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Filters and Sub-Tabs */}
        <div className="bg-white p-5 rounded-3xl border border-violet-100 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-3">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs w-full sm:w-auto">
              <button
                onClick={() => setStatusTab('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  statusTab === 'ALL'
                    ? 'bg-white text-violet-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Sourcing ({data.approved_requests.length})
              </button>
              <button
                onClick={() => setStatusTab('APPROVED')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  statusTab === 'APPROVED'
                    ? 'bg-white text-violet-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ready for RFQ ({approvedCount})
              </button>
              <button
                onClick={() => setStatusTab('RFQ_ISSUED')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  statusTab === 'RFQ_ISSUED'
                    ? 'bg-white text-violet-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Awaiting Quotations ({rfqIssuedCount})
              </button>
              <button
                onClick={() => setStatusTab('QUOTATIONS_RECEIVED')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  statusTab === 'QUOTATIONS_RECEIVED'
                    ? 'bg-white text-violet-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Quotations Received ({quotesReceivedCount})
              </button>
            </div>

            <span className="text-[11px] font-semibold text-slate-500">
              Assigned directly to you • Equal Workload Allocation
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <HiSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by requisition number, item, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
              >
                <option value="ALL">All Departments</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
              >
                <option value="ALL">All Categories</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content Table / Cards */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiShoppingBag className="w-5 h-5 text-violet-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Approved Requisitions in Sourcing ({filteredRequests.length})
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              Stage: Committee Approved & Vendor Sourcing
            </span>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <HiRefresh className="w-8 h-8 animate-spin text-violet-600" />
              <p className="text-xs font-medium">Loading approved requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-16 text-center space-y-2 p-6">
              <HiShieldCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">No matching approved requests found</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                No purchase requests in your approved queue match the active search or filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">Req Number</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Item Details</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3">Sanctioned Budget</th>
                    <th className="px-4 py-3">Stage Status</th>
                    <th className="px-4 py-3">Assigned Member</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-violet-700 block">
                          {req.req_number}
                        </span>
                        <span className="text-[11px] text-slate-500 line-clamp-1 max-w-[180px]">
                          {req.title}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-800 whitespace-nowrap">
                        {req.department_name}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900 max-w-[200px]">
                        <span className="line-clamp-1">{req.item_name}</span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 font-medium text-[11px]">
                          {req.category}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-800">
                        {req.quantity}
                      </td>
                      <td className="px-4 py-3.5 font-extrabold text-slate-900 whitespace-nowrap">
                        {formatCurrency(req.estimated_budget)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {req.status === 'QUOTATIONS_RECEIVED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <HiDocumentText className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Quotations Received</span>
                          </span>
                        ) : req.status === 'RFQ_ISSUED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <HiClock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Awaiting Quotations</span>
                          </span>
                        ) : req.status === 'COMPLETED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Quotation Stage Complete</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <HiCheckCircle className="w-3.5 h-3.5 text-blue-600" />
                            <span>Ready for RFQ</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 block">
                          {req.assigned_committee_member_name || data.user?.full_name || 'Committee Member'}
                        </span>
                        <span className="text-[10px] font-mono text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                          {req.assigned_committee_member_employee_id || data.user?.employee_id || 'You'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenDetail(req)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-violet-700 hover:bg-violet-50 transition-colors inline-flex items-center gap-1 border border-slate-200 hover:border-violet-200"
                          >
                            <HiEye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>
                          <button
                            onClick={() => handleOpenSourcing(req)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors inline-flex items-center gap-1 shadow-sm shadow-violet-500/20"
                          >
                            <HiSearch className="w-3.5 h-3.5" />
                            <span>{req.status === 'RFQ_ISSUED' ? 'Vendor Sourcing' : 'Find Vendors & Quote'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Requisition Detail Modal */}
      {selectedReq && (
        <RequisitionDetailModal
          requisition={selectedReq}
          isOpen={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedReq(null);
          }}
          onFindVendors={(req) => {
            setDetailModalOpen(false);
            handleOpenSourcing(req);
          }}
        />
      )}

      {/* Vendor Sourcing Modal */}
      {sourcingReq && (
        <VendorSourcingModal
          requisition={sourcingReq}
          isOpen={sourcingModalOpen}
          onClose={() => {
            setSourcingModalOpen(false);
            setSourcingReq(null);
          }}
          onSuccess={handleRFQSuccess}
        />
      )}
    </ProcurementCommitteeLayout>
  );
};

export default ProcurementCommitteeApprovedPage;
