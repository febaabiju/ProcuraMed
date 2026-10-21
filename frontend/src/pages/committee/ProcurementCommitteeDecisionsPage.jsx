import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import RequisitionDetailModal from '../../components/committee/RequisitionDetailModal';
import Button from '../../components/common/Button';
import {
  HiCheckCircle,
  HiQuestionMarkCircle,
  HiClock,
  HiSearch,
  HiX,
  HiRefresh,
  HiCheck,
  HiEye,
  HiInformationCircle,
  HiClipboardCheck,
  HiShieldCheck,
  HiPause
} from 'react-icons/hi';

const ProcurementCommitteeDecisionsPage = () => {
  const [data, setData] = useState({
    user: null,
    pending_reviews: [],
    approved_requests: [],
    returned_clarifications: [],
    decision_history: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Active Tab: 'pending', 'approved', 'returned'
  const [decisionTab, setDecisionTab] = useState('pending');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');

  // Quick Action Modal State (Direct Approve / Return from table row)
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    mode: 'approve', // 'approve', 'clarification', 'defer'
    requisition: null,
    remarks: '',
    target: 'department_staff',
    submitting: false,
    error: ''
  });

  // Requisition Detail Inspection Modal
  const [inspectReq, setInspectReq] = useState(null);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);

  const fetchDecisionsData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/committee-dashboard/');
      setData({
        user: res.data.user || null,
        pending_reviews: res.data.pending_reviews || [],
        approved_requests: res.data.approved_requests || [],
        returned_clarifications: res.data.returned_clarifications || [],
        decision_history: res.data.decision_history || []
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load committee decisions data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDecisionsData();
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
    [...data.pending_reviews, ...data.approved_requests, ...data.returned_clarifications].forEach(r => {
      if (r.department_name && r.department_name !== 'N/A') set.add(r.department_name);
    });
    return Array.from(set).sort();
  }, [data.pending_reviews, data.approved_requests, data.returned_clarifications]);

  // Filter helper
  const filterList = (list) => {
    return list.filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesReq = item.req_number?.toLowerCase().includes(q);
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesItem = item.item_name?.toLowerCase().includes(q);
        const matchesDept = item.department_name?.toLowerCase().includes(q);
        const matchesRemarks = (item.clarification_comments || item.review_comments)?.toLowerCase().includes(q);
        if (!matchesReq && !matchesTitle && !matchesItem && !matchesDept && !matchesRemarks) return false;
      }
      if (selectedDepartment !== 'ALL' && item.department_name !== selectedDepartment) {
        return false;
      }
      return true;
    });
  };

  const filteredPending = useMemo(() => filterList(data.pending_reviews), [data.pending_reviews, searchQuery, selectedDepartment]);
  const filteredApproved = useMemo(() => filterList(data.approved_requests), [data.approved_requests, searchQuery, selectedDepartment]);
  const filteredReturned = useMemo(() => filterList(data.returned_clarifications), [data.returned_clarifications, searchQuery, selectedDepartment]);

  const openActionModal = (requisition, mode) => {
    setActionModal({
      isOpen: true,
      mode,
      requisition,
      remarks: mode === 'approve' ? 'Approved by Procurement Committee for hospital procurement sanction.' : '',
      target: requisition.requires_technical_evaluation ? 'technical_officer' : 'department_staff',
      submitting: false,
      error: ''
    });
  };

  const closeActionModal = () => {
    setActionModal({
      isOpen: false,
      mode: 'approve',
      requisition: null,
      remarks: '',
      target: 'department_staff',
      submitting: false,
      error: ''
    });
  };

  const handleExecuteDecision = async () => {
    const { mode, requisition, remarks, target } = actionModal;
    if (!requisition) return;

    if (mode === 'clarification' && !remarks.trim()) {
      setActionModal(prev => ({ ...prev, error: 'Clarification remarks are required. Please explain what is needed.' }));
      return;
    }

    if (mode === 'defer' && !remarks.trim()) {
      setActionModal(prev => ({ ...prev, error: 'Please enter notes explaining why this request is deferred.' }));
      return;
    }

    setActionModal(prev => ({ ...prev, submitting: true, error: '' }));

    try {
      if (mode === 'approve') {
        const res = await axiosClient.post(`/procurement/requisitions/${requisition.id}/approve/`, {
          comments: remarks.trim() || 'Approved by Procurement Committee.'
        });
        setSuccessMessage(res.data.message || `Purchase request ${requisition.req_number} has been approved.`);
      } else if (mode === 'clarification') {
        const res = await axiosClient.post(`/procurement/requisitions/${requisition.id}/return-clarification/`, {
          target,
          remarks: remarks.trim()
        });
        setSuccessMessage(res.data.message || `Purchase request ${requisition.req_number} returned for clarification.`);
      } else if (mode === 'defer') {
        // Return for clarification to PO with deferral note
        const res = await axiosClient.post(`/procurement/requisitions/${requisition.id}/return-clarification/`, {
          target: 'purchase_officer',
          remarks: `[DEFERRED BY COMMITTEE]: ${remarks.trim()}`
        });
        setSuccessMessage(`Purchase request ${requisition.req_number} deferred for further review.`);
      }

      closeActionModal();
      fetchDecisionsData();
      setTimeout(() => setSuccessMessage(''), 6000);
    } catch (err) {
      setActionModal(prev => ({
        ...prev,
        submitting: false,
        error: err.response?.data?.remarks || err.response?.data?.detail || 'Failed to submit decision.'
      }));
    }
  };

  const openInspectModal = (req) => {
    setInspectReq(req);
    setInspectModalOpen(true);
  };

  return (
    <ProcurementCommitteeLayout
      title="Committee Decisions"
      subtitle="Manage committee review decisions, approve requisitions, or return for clarification."
      committeeUser={data.user}
      onRefresh={fetchDecisionsData}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Success Alert Banner */}
        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-emerald-700">
              <HiX className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
              <HiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Decisions Header & Section Tabs */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                  <HiCheckCircle className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Committee Decision Management
                </h1>
              </div>
              <p className="text-xs text-slate-500">
                Execute official committee determinations: approve verified purchase requests, return for clarification, or inspect approved cases.
              </p>
            </div>

            {/* Quick Status Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setDecisionTab('pending')}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                  decisionTab === 'pending'
                    ? 'bg-violet-700 text-white shadow-md shadow-violet-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <HiClock className="w-4 h-4" />
                <span>Pending Decisions</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  decisionTab === 'pending' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  {data.pending_reviews.length}
                </span>
              </button>

              <button
                onClick={() => setDecisionTab('approved')}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                  decisionTab === 'approved'
                    ? 'bg-violet-700 text-white shadow-md shadow-violet-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <HiCheckCircle className="w-4 h-4" />
                <span>Approved</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  decisionTab === 'approved' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {data.approved_requests.length}
                </span>
              </button>

              <button
                onClick={() => setDecisionTab('returned')}
                className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
                  decisionTab === 'returned'
                    ? 'bg-violet-700 text-white shadow-md shadow-violet-500/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <HiQuestionMarkCircle className="w-4 h-4" />
                <span>Returned for Clarification</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  decisionTab === 'returned' ? 'bg-white/20 text-white' : 'bg-sky-100 text-sky-800'
                }`}>
                  {data.returned_clarifications.length}
                </span>
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="relative flex-1 w-full">
              <HiSearch className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Requisition #, Title, Item Name, or Remarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-slate-50/50 text-slate-800 placeholder-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <HiX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-violet-500 self-stretch sm:self-auto"
            >
              <option value="ALL">All Departments</option>
              {uniqueDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            {(searchQuery || selectedDepartment !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDepartment('ALL');
                }}
                className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold flex items-center gap-1 self-stretch sm:self-auto justify-center"
              >
                <HiX className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* DECISION TAB 1: PENDING DECISIONS */}
        {decisionTab === 'pending' && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Requisitions Pending Committee Determination
                </h3>
                <p className="text-[11px] text-slate-400">
                  Select an action directly to approve, return for clarification, or defer for review.
                </p>
              </div>
              <span className="text-xs font-bold text-amber-700 px-3 py-1 bg-amber-50 rounded-xl border border-amber-200">
                {filteredPending.length} Requisition{filteredPending.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
                <HiRefresh className="w-5 h-5 animate-spin text-violet-500" />
                <span>Loading pending requisitions...</span>
              </div>
            ) : filteredPending.length === 0 ? (
              <div className="p-12 text-center space-y-3 bg-slate-50/50">
                <div className="w-12 h-12 rounded-2xl bg-amber-100/60 text-amber-600 flex items-center justify-center mx-auto">
                  <HiClock className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">
                  No requisitions pending committee decision.
                </h4>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  When purchase requests complete technical evaluation or direct purchase officer review, they will appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">Requisition No.</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3">Estimated Budget</th>
                      <th className="px-4 py-3">Evaluation Route</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Decision Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPending.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
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
                        <td className="px-4 py-3.5 font-extrabold text-slate-900 whitespace-nowrap">
                          {formatCurrency(req.estimated_budget)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {req.requires_technical_evaluation ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Technically Suitable</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              <HiShieldCheck className="w-3.5 h-3.5 text-slate-500" />
                              <span>Direct PO Route</span>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Pending Decision
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openInspectModal(req)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-violet-700 hover:bg-violet-50 transition-colors inline-flex items-center gap-1 border border-slate-200"
                              title="View full specs and documents"
                            >
                              <HiEye className="w-3.5 h-3.5" />
                              <span>Details</span>
                            </button>
                            <button
                              onClick={() => openActionModal(req, 'approve')}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors inline-flex items-center gap-1 shadow-xs"
                              title="Sanction & approve purchase"
                            >
                              <HiCheck className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={() => openActionModal(req, 'clarification')}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 transition-colors inline-flex items-center gap-1 border border-sky-200"
                              title="Return for clarification"
                            >
                              <HiQuestionMarkCircle className="w-3.5 h-3.5" />
                              <span>Clarify</span>
                            </button>
                            <button
                              onClick={() => openActionModal(req, 'defer')}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors inline-flex items-center gap-1 border border-slate-200"
                              title="Defer decision to next session"
                            >
                              <HiPause className="w-3.5 h-3.5" />
                              <span>Defer</span>
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
        )}

        {/* DECISION TAB 2: APPROVED PROCUREMENTS */}
        {decisionTab === 'approved' && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Sanctioned & Approved Procurements
                </h3>
                <p className="text-[11px] text-slate-400">
                  Purchase requests officially approved by the Procurement Committee.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 px-3 py-1 bg-emerald-50 rounded-xl border border-emerald-200">
                {filteredApproved.length} Approved
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
                <HiRefresh className="w-5 h-5 animate-spin text-emerald-500" />
                <span>Loading approved requests...</span>
              </div>
            ) : filteredApproved.length === 0 ? (
              <div className="p-12 text-center space-y-3 bg-slate-50/50">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/60 text-emerald-600 flex items-center justify-center mx-auto">
                  <HiCheckCircle className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">
                  No approved purchase requests found.
                </h4>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  Sanctioned requisitions will appear here with full reviewer and sanction timestamps.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">Requisition No.</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3">Estimated Budget</th>
                      <th className="px-4 py-3">Approved By & Date</th>
                      <th className="px-4 py-3">Reviewer Remarks</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredApproved.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
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
                        <td className="px-4 py-3.5 font-extrabold text-slate-900 whitespace-nowrap">
                          {formatCurrency(req.estimated_budget)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-medium text-slate-800 block">
                            {req.reviewed_by_name || 'Procurement Committee'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatDate(req.reviewed_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 max-w-[250px]">
                          <span className="line-clamp-2 italic text-[11px]">
                            "{req.review_comments || 'Approved by Procurement Committee.'}"
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Committee Approved</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => openInspectModal(req)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-violet-700 hover:bg-violet-50 transition-colors inline-flex items-center gap-1 border border-slate-200"
                          >
                            <HiEye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* DECISION TAB 3: RETURNED FOR CLARIFICATION */}
        {decisionTab === 'returned' && (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Requests Returned for Clarification
                </h3>
                <p className="text-[11px] text-slate-400">
                  Requisitions returned by the committee awaiting clarification from Technical Officers, Department Staff, or Purchase Officers.
                </p>
              </div>
              <span className="text-xs font-bold text-sky-700 px-3 py-1 bg-sky-50 rounded-xl border border-sky-200">
                {filteredReturned.length} Active Clarification{filteredReturned.length !== 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
                <HiRefresh className="w-5 h-5 animate-spin text-sky-500" />
                <span>Loading clarification requests...</span>
              </div>
            ) : filteredReturned.length === 0 ? (
              <div className="p-12 text-center space-y-3 bg-slate-50/50">
                <div className="w-12 h-12 rounded-2xl bg-sky-100/60 text-sky-600 flex items-center justify-center mx-auto">
                  <HiQuestionMarkCircle className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">
                  No purchase requests currently returned for clarification.
                </h4>
                <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                  Clarification return history and active status will be tracked here until resubmitted.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-3">Requisition No.</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Item Name</th>
                      <th className="px-4 py-3">Clarification Remarks</th>
                      <th className="px-4 py-3">Returned Date</th>
                      <th className="px-4 py-3">Current Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReturned.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
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
                        <td className="px-4 py-3.5 text-slate-700 max-w-[260px]">
                          <span className="line-clamp-2 italic text-[11px]">
                            "{req.clarification_comments || req.review_comments || 'Clarification required.'}"
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                          {formatDate(req.clarification_returned_at || req.reviewed_at)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {req.status_display}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => openInspectModal(req)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-violet-700 hover:bg-violet-50 transition-colors inline-flex items-center gap-1 border border-slate-200"
                          >
                            <HiEye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QUICK DECISION WORKFLOW CONFIRMATION MODAL */}
      <AnimatePresence>
        {actionModal.isOpen && actionModal.requisition && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-violet-100 space-y-5"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                    actionModal.mode === 'approve'
                      ? 'bg-emerald-100 text-emerald-700'
                      : actionModal.mode === 'clarification'
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {actionModal.mode === 'approve' && <HiCheck className="w-5 h-5" />}
                    {actionModal.mode === 'clarification' && <HiQuestionMarkCircle className="w-5 h-5" />}
                    {actionModal.mode === 'defer' && <HiPause className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      {actionModal.mode === 'approve' && 'Confirm Committee Approval'}
                      {actionModal.mode === 'clarification' && 'Return for Clarification'}
                      {actionModal.mode === 'defer' && 'Defer Purchase Request'}
                    </h3>
                    <p className="text-[11px] font-mono text-violet-600 font-bold">
                      {actionModal.requisition.req_number} • {actionModal.requisition.department_name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeActionModal}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              {/* Error Message */}
              {actionModal.error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-2xl flex items-center gap-2">
                  <HiInformationCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{actionModal.error}</span>
                </div>
              )}

              {/* Content by mode */}
              <div className="space-y-4 text-xs">
                {/* Request Brief */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Purchase Item</p>
                  <p className="font-extrabold text-slate-900 text-sm">
                    {actionModal.requisition.item_name}
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    Estimated Budget: <strong className="text-slate-800">{formatCurrency(actionModal.requisition.estimated_budget)}</strong>
                  </p>
                </div>

                {/* Target Role Selector (Only for clarification) */}
                {actionModal.mode === 'clarification' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 block">
                      Clarification Recipient <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        ...(actionModal.requisition.requires_technical_evaluation ? [
                          { id: 'technical_officer', label: 'Technical Officer' }
                        ] : []),
                        { id: 'department_staff', label: 'Department Staff' },
                        { id: 'purchase_officer', label: 'Purchase Officer' }
                      ].map((t) => (
                        <label
                          key={t.id}
                          className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 text-xs transition-colors ${
                            actionModal.target === t.id
                              ? 'bg-sky-50 border-sky-400 text-sky-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="quick_clarification_target"
                            value={t.id}
                            checked={actionModal.target === t.id}
                            onChange={() => setActionModal(prev => ({ ...prev, target: t.id }))}
                            className="text-sky-600 focus:ring-sky-500"
                          />
                          <span>{t.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remarks Field */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    {actionModal.mode === 'approve' && 'Sanction Remarks (Optional)'}
                    {actionModal.mode === 'clarification' && 'Clarification Requirements (Mandatory)'}
                    {actionModal.mode === 'defer' && 'Deferral Reason / Notes (Mandatory)'}
                  </label>
                  <textarea
                    rows={3}
                    value={actionModal.remarks}
                    onChange={(e) => setActionModal(prev => ({ ...prev, remarks: e.target.value }))}
                    placeholder={
                      actionModal.mode === 'approve'
                        ? 'e.g. Approved by Procurement Committee for hospital purchase sanction.'
                        : 'Explain the clarification needed or reason for deferral...'
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-white"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeActionModal}
                  className="border-slate-200 text-slate-700 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExecuteDecision}
                  disabled={actionModal.submitting}
                  className={`text-white text-xs font-bold gap-1.5 shadow-sm ${
                    actionModal.mode === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : actionModal.mode === 'clarification'
                      ? 'bg-sky-600 hover:bg-sky-700'
                      : 'bg-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {actionModal.submitting ? (
                    <HiRefresh className="w-4 h-4 animate-spin" />
                  ) : (
                    <HiCheck className="w-4 h-4" />
                  )}
                  <span>
                    {actionModal.mode === 'approve' && 'Confirm Approval'}
                    {actionModal.mode === 'clarification' && 'Submit Clarification'}
                    {actionModal.mode === 'defer' && 'Confirm Deferral'}
                  </span>
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REQUISITION DETAIL INSPECTION MODAL */}
      <RequisitionDetailModal
        requisition={inspectReq}
        isOpen={inspectModalOpen}
        onClose={() => setInspectModalOpen(false)}
        onSuccess={(msg) => {
          setSuccessMessage(msg);
          fetchDecisionsData();
          setTimeout(() => setSuccessMessage(''), 6000);
        }}
        initialMode="view"
      />
    </ProcurementCommitteeLayout>
  );
};

export default ProcurementCommitteeDecisionsPage;
