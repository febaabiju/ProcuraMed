import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import Button from '../../components/common/Button';
import {
  HiSearch,
  HiRefresh,
  HiClipboardList,
  HiCheckCircle,
  HiInformationCircle,
  HiOfficeBuilding,
  HiCalendar,
  HiTag,
  HiX,
  HiShieldCheck,
  HiEye
} from 'react-icons/hi';

const ProcurementCommitteePurchaseRequestsPage = () => {
  const { user: authUser } = useAuth();
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Category tabs: 'ALL', 'TECHNICAL', 'NON_TECHNICAL'
  const [activeTab, setActiveTab] = useState('ALL');

  // Detail Modal state
  const [selectedReq, setSelectedReq] = useState(null);

  const fetchRequisitions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/requisitions/');
      const data = res.data?.results ? res.data.results : (Array.isArray(res.data) ? res.data : []);
      setRequisitions(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load purchase requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, []);

  // Compute category counts
  const counts = useMemo(() => {
    const total = requisitions.length;
    const technical = requisitions.filter(r => r.requires_technical_evaluation).length;
    const nonTechnical = requisitions.filter(r => !r.requires_technical_evaluation).length;

    return { total, technical, nonTechnical };
  }, [requisitions]);

  // Filtered requisitions based on category tab and search query
  const filteredRequisitions = useMemo(() => {
    return requisitions.filter(req => {
      // 1. Category Tab Filter
      if (activeTab === 'TECHNICAL' && !req.requires_technical_evaluation) {
        return false;
      }
      if (activeTab === 'NON_TECHNICAL' && req.requires_technical_evaluation) {
        return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const reqNum = (req.req_number || '').toLowerCase();
        const title = (req.title || '').toLowerCase();
        const dept = (req.department_details?.name || req.department_name || '').toLowerCase();
        const cat = (req.category || '').toLowerCase();
        const member = (req.assigned_committee_member_name || '').toLowerCase();
        const items = (req.items || []).map(i => (i.item_name || '').toLowerCase()).join(' ');

        if (
          !reqNum.includes(query) &&
          !title.includes(query) &&
          !dept.includes(query) &&
          !cat.includes(query) &&
          !member.includes(query) &&
          !items.includes(query)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [requisitions, activeTab, searchQuery]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '₹0.00';
    const num = Number(amount);
    return isNaN(num) ? '₹0.00' : `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (statusStr) => {
    const s = (statusStr || '').toUpperCase();
    if (s.includes('PENDING') || s.includes('REVIEW')) {
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        label: 'Pending Committee Review'
      };
    }
    if (s.includes('APPROVED')) {
      return {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        label: 'Approved'
      };
    }
    if (s.includes('RFQ') || s.includes('QUOTATION')) {
      return {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        label: s.includes('RFQ') ? 'Awaiting Quotations' : 'Quotations Received'
      };
    }
    if (s.includes('COMPLETED')) {
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-200',
        label: 'Completed'
      };
    }
    return {
      bg: 'bg-slate-50',
      text: 'text-slate-600',
      border: 'border-slate-200',
      label: statusStr || 'In Progress'
    };
  };

  const getPriorityBadge = (priority) => {
    const p = (priority || 'MEDIUM').toUpperCase();
    if (p === 'URGENT') return 'bg-rose-100 text-rose-800 border-rose-200';
    if (p === 'HIGH') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (p === 'LOW') return 'bg-slate-100 text-slate-700 border-slate-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  return (
    <ProcurementCommitteeLayout
      title="Purchase Requests"
      subtitle="Comprehensive intake of purchase requests received from Purchase Officer and Technical Officer evaluation."
      onRefresh={fetchRequisitions}
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Error Notification with Retry */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchRequisitions}
                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition"
              >
                Retry
              </button>
              <button
                onClick={() => setError('')}
                className="text-rose-500 hover:text-rose-700 text-xs font-bold px-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* 1. Category Filter Tabs & Search Controls */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-violet-100 shadow-xs space-y-5">
          {/* Top Controls: Search Bar & Refresh */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <HiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by req number, item, department, or member..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <HiX className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRequisitions}
                disabled={loading}
                className="text-xs font-semibold gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <HiRefresh className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </Button>
            </div>
          </div>

          {/* Category Tabs: Required by Specification */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            {/* Tab 1: All Requests */}
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 border ${
                activeTab === 'ALL'
                  ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300 hover:text-slate-900'
              }`}
            >
              <HiClipboardList className="w-4 h-4" />
              <span>All Requests</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  activeTab === 'ALL'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {counts.total}
              </span>
            </button>

            {/* Tab 2: Technical Evaluation Completed */}
            <button
              onClick={() => setActiveTab('TECHNICAL')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 border ${
                activeTab === 'TECHNICAL'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-slate-900'
              }`}
            >
              <HiShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Technical Evaluation Completed</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  activeTab === 'TECHNICAL'
                    ? 'bg-white/20 text-white'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}
              >
                {counts.technical}
              </span>
            </button>

            {/* Tab 3: No Technical Evaluation Required */}
            <button
              onClick={() => setActiveTab('NON_TECHNICAL')}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center gap-2 border ${
                activeTab === 'NON_TECHNICAL'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-slate-900'
              }`}
            >
              <HiCheckCircle className="w-4 h-4 text-emerald-400" />
              <span>No Technical Evaluation Required</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  activeTab === 'NON_TECHNICAL'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {counts.nonTechnical}
              </span>
            </button>
          </div>
        </div>

        {/* 2. Requests List */}
        {loading ? (
          <div className="bg-white rounded-3xl p-12 border border-violet-100 shadow-xs text-center space-y-3">
            <HiRefresh className="w-8 h-8 text-violet-500 animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-500">Loading purchase requests...</p>
          </div>
        ) : error && requisitions.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-rose-100 shadow-xs text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <HiInformationCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800">Unable to Load Purchase Requests</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">{error}</p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={fetchRequisitions}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold gap-1.5 text-xs mx-auto"
            >
              <HiRefresh className="w-3.5 h-3.5" />
              <span>Retry Loading Requests</span>
            </Button>
          </div>
        ) : filteredRequisitions.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-violet-100 shadow-xs text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto">
              <HiClipboardList className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Purchase Requests Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery
                ? `No requests match your search "${searchQuery}". Try clearing the search.`
                : activeTab === 'TECHNICAL'
                ? 'No purchase requests with completed technical evaluation are currently in your queue.'
                : activeTab === 'NON_TECHNICAL'
                ? 'No routine purchase requests without technical evaluation are currently in your queue.'
                : 'No purchase requests are currently assigned to your committee queue.'}
            </p>
            {(searchQuery || activeTab !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveTab('ALL');
                }}
                className="text-xs font-bold text-violet-600 hover:text-violet-800 underline"
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequisitions.map((req) => {
              const statusBadge = getStatusBadge(req.status);
              const isTechnical = req.requires_technical_evaluation;
              const isAssignedToCurrentUser =
                authUser?.id &&
                (req.assigned_committee_member === authUser.id ||
                  req.assigned_committee_member_details?.id === authUser.id);

              const itemsList = req.items || [];
              const itemsCount = itemsList.length;
              const primaryItemName = itemsList[0]?.item_name || req.title;
              const totalQuantity = itemsList.reduce((acc, it) => acc + (it.quantity || 1), 0);

              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white rounded-3xl border border-violet-100 hover:border-violet-200 shadow-xs transition-all p-5 sm:p-6 space-y-4"
                >
                  {/* Top Row: Req Number, Priority, Dates & Status */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-xl">
                        {req.req_number}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getPriorityBadge(
                          req.priority
                        )}`}
                      >
                        {req.priority || 'MEDIUM'}
                      </span>
                      <span className="text-slate-400 text-xs">•</span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <HiCalendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDate(req.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${statusBadge.bg} ${statusBadge.text} ${statusBadge.border}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {statusBadge.label}
                      </span>
                    </div>
                  </div>

                  {/* Middle Section: Item & Department Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    {/* Column 1: Items info */}
                    <div className="md:col-span-2 space-y-1.5">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <span>{primaryItemName}</span>
                        {itemsCount > 1 && (
                          <span className="text-[11px] font-semibold text-slate-400">
                            (+{itemsCount - 1} more item{itemsCount > 2 ? 's' : ''})
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {req.justification || req.title || 'Hospital procurement requisition'}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                        <span className="flex items-center gap-1.5 font-medium">
                          <HiOfficeBuilding className="w-4 h-4 text-slate-400" />
                          <span>{req.department_details?.name || 'Department'}</span>
                        </span>
                        <span className="flex items-center gap-1.5 font-medium">
                          <HiTag className="w-4 h-4 text-slate-400" />
                          <span>{req.category || 'General Supplies'}</span>
                        </span>
                        <span className="font-semibold text-slate-800">
                          Total Qty: <span className="font-mono">{totalQuantity}</span>
                        </span>
                        {req.estimated_budget && (
                          <span className="font-bold text-violet-700">
                            Budget: {formatCurrency(req.estimated_budget)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Column 2: Assigned Committee Member */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          Assigned Member
                        </span>
                        {isAssignedToCurrentUser && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                            You
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center text-xs font-bold">
                          {(req.assigned_committee_member_name || 'PC').charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {req.assigned_committee_member_name || 'Unassigned'}
                          </p>
                          <p className="text-[10px] font-mono text-slate-500">
                            {req.assigned_committee_member_employee_id || 'PC-MEMBER'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Source Banner & Action */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Source Information Pill */}
                    <div className="flex items-center gap-2.5">
                      {isTechnical ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-900 text-xs">
                          <HiShieldCheck className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                          <div>
                            <span className="font-bold">Technical Evaluation Completed: </span>
                            <span className="font-medium text-indigo-700">
                              {req.technical_recommendation || 'Technically Suitable'}
                              {req.assigned_technical_officer_name && ` (Evaluated by ${req.assigned_technical_officer_name})`}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs">
                          <HiCheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <div>
                            <span className="font-bold">No Technical Evaluation Required: </span>
                            <span className="font-medium text-emerald-700">
                              Direct PO Route
                              {req.assigned_purchase_officer_name && ` (Forwarded by ${req.assigned_purchase_officer_name})`}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* View Details Trigger */}
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedReq(req)}
                        className="text-xs font-semibold text-slate-700 hover:text-violet-700 hover:bg-violet-50 border-slate-200 gap-1.5 w-full sm:w-auto"
                      >
                        <HiEye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Read-Only Details Modal */}
      <AnimatePresence>
        {selectedReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl shadow-2xl border border-violet-100 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-50/50 to-white">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-violet-700 bg-violet-100 px-2.5 py-0.5 rounded-lg">
                      {selectedReq.req_number}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">{formatDate(selectedReq.created_at)}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {selectedReq.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedReq(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs">
                {/* Source & Intake Overview */}
                <div
                  className={`p-4 rounded-2xl border ${
                    selectedReq.requires_technical_evaluation
                      ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900'
                      : 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {selectedReq.requires_technical_evaluation ? (
                      <>
                        <HiShieldCheck className="w-5 h-5 text-indigo-600" />
                        <span>Source: Technical Officer Evaluation Completed</span>
                      </>
                    ) : (
                      <>
                        <HiCheckCircle className="w-5 h-5 text-emerald-600" />
                        <span>Source: Purchase Officer Direct Route (No Technical Evaluation Required)</span>
                      </>
                    )}
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    {selectedReq.requires_technical_evaluation
                      ? `This requisition required technical evaluation and was confirmed as ${selectedReq.technical_recommendation || 'Technically Suitable'} by Technical Officer ${selectedReq.assigned_technical_officer_name || 'Biomedical Specialist'}.`
                      : 'This requisition contains routine hospital consumables or supplies and was forwarded directly from the Purchase Officer without technical evaluation.'}
                  </p>
                </div>

                {/* Assignment & Department Info */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block">
                      Assigned Committee Member
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {selectedReq.assigned_committee_member_name || 'Unassigned'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 block">
                      ID: {selectedReq.assigned_committee_member_employee_id || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase text-[10px] block">
                      Department
                    </span>
                    <span className="font-bold text-slate-900 text-xs">
                      {selectedReq.department_details?.name || 'Department'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 block">
                      Category: {selectedReq.category || 'General'}
                    </span>
                  </div>
                </div>

                {/* Items List */}
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider text-[11px]">
                    Requested Items ({selectedReq.items?.length || 0})
                  </h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                    {(selectedReq.items || []).map((it, idx) => (
                      <div key={idx} className="p-3 bg-white flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{it.item_name}</p>
                          {it.specifications && (
                            <p className="text-[11px] text-slate-500">{it.specifications}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-800">
                            Qty: {it.quantity}
                          </span>
                          {it.estimated_unit_price && (
                            <p className="text-[10px] text-slate-400">
                              @{formatCurrency(it.estimated_unit_price)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Justification & Remarks */}
                {selectedReq.justification && (
                  <div className="space-y-1">
                    <span className="font-bold text-slate-400 uppercase text-[10px] block">
                      Clinical Justification
                    </span>
                    <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs leading-relaxed">
                      {selectedReq.justification}
                    </p>
                  </div>
                )}

                {selectedReq.review_comments && (
                  <div className="space-y-1">
                    <span className="font-bold text-slate-400 uppercase text-[10px] block">
                      Review Remarks
                    </span>
                    <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs leading-relaxed">
                      {selectedReq.review_comments}
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedReq(null)}
                  className="text-xs font-semibold px-5"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ProcurementCommitteeLayout>
  );
};

export default ProcurementCommitteePurchaseRequestsPage;
