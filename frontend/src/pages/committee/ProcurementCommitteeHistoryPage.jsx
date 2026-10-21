import React, { useState, useEffect, useMemo } from 'react';
import axiosClient from '../../api/axiosClient';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import RequisitionDetailModal from '../../components/committee/RequisitionDetailModal';
import {
  HiArchive,
  HiCheckCircle,
  HiQuestionMarkCircle,
  HiSearch,
  HiX,
  HiRefresh,
  HiEye,
  HiInformationCircle
} from 'react-icons/hi';

const ProcurementCommitteeHistoryPage = () => {
  const [data, setData] = useState({
    user: null,
    decision_history: [],
    all_requisitions: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDecision, setSelectedDecision] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');

  // Inspection Modal
  const [inspectReq, setInspectReq] = useState(null);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);

  const fetchHistoryData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/committee-dashboard/');
      const allReqs = [
        ...(res.data.pending_reviews || []),
        ...(res.data.approved_requests || []),
        ...(res.data.returned_clarifications || [])
      ];
      setData({
        user: res.data.user || null,
        decision_history: res.data.decision_history || [],
        all_requisitions: allReqs
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load procurement decision history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoryData();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || amount === '') return '₹0.00';
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const uniqueDepartments = useMemo(() => {
    const set = new Set();
    data.decision_history.forEach(d => {
      if (d.department_name && d.department_name !== 'N/A') set.add(d.department_name);
    });
    return Array.from(set).sort();
  }, [data.decision_history]);

  const filteredHistory = useMemo(() => {
    return data.decision_history.filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesReq = item.req_number?.toLowerCase().includes(q);
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesDept = item.department_name?.toLowerCase().includes(q);
        const matchesRemarks = item.remarks?.toLowerCase().includes(q);
        const matchesReviewer = item.reviewer_name?.toLowerCase().includes(q);
        if (!matchesReq && !matchesTitle && !matchesDept && !matchesRemarks && !matchesReviewer) return false;
      }
      if (selectedDecision !== 'ALL' && item.decision_status !== selectedDecision) {
        return false;
      }
      if (selectedDepartment !== 'ALL' && item.department_name !== selectedDepartment) {
        return false;
      }
      return true;
    });
  }, [data.decision_history, searchQuery, selectedDecision, selectedDepartment]);

  const handleInspect = (requisitionId) => {
    const req = data.all_requisitions.find(r => r.id === requisitionId);
    if (req) {
      setInspectReq(req);
      setInspectModalOpen(true);
    }
  };

  return (
    <ProcurementCommitteeLayout
      title="Procurement History"
      subtitle="Complete chronological audit trail of all procurement committee decisions, approvals, and returned clarifications."
      committeeUser={data.user}
      onRefresh={fetchHistoryData}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
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

        {/* Page Header Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                <HiArchive className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Procurement Decision History
              </h1>
            </div>
            <p className="text-xs text-slate-500">
              Permanent audit log of official decisions executed by committee members with review remarks and timestamps.
            </p>
          </div>

          <span className="px-3 py-1.5 rounded-xl bg-violet-50 text-violet-800 border border-violet-200 text-xs font-black self-start sm:self-auto">
            {filteredHistory.length} Decision{filteredHistory.length !== 1 ? 's' : ''} Logged
          </span>
        </div>

        {/* Search & Filters */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3 text-xs">
          <div className="relative flex-1 w-full">
            <HiSearch className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Requisition #, Reviewer, Remarks, or Title..."
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
            value={selectedDecision}
            onChange={(e) => setSelectedDecision(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-violet-500 self-stretch sm:self-auto"
          >
            <option value="ALL">All Decisions</option>
            <option value="APPROVED">Approved Only</option>
            <option value="RETURNED">Returned for Clarification Only</option>
          </select>

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

          {(searchQuery || selectedDecision !== 'ALL' || selectedDepartment !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDecision('ALL');
                setSelectedDepartment('ALL');
              }}
              className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold flex items-center gap-1 self-stretch sm:self-auto justify-center"
            >
              <HiX className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* History Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
              <HiRefresh className="w-5 h-5 animate-spin text-violet-500" />
              <span>Loading decision history...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-12 text-center space-y-3 bg-slate-50/50">
              <div className="w-12 h-12 rounded-2xl bg-violet-100/60 text-violet-600 flex items-center justify-center mx-auto">
                <HiArchive className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold text-slate-800">
                No decision history records found.
              </h4>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                When committee members sanction purchase requests or return them for clarification, permanent audit records are created here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Requisition No.</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Decision</th>
                    <th className="px-4 py-3">Decision Remarks</th>
                    <th className="px-4 py-3">Reviewer</th>
                    <th className="px-4 py-3">Decision Date & Time</th>
                    <th className="px-4 py-3">Current Status</th>
                    <th className="px-4 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-violet-700 block">
                          {item.req_number}
                        </span>
                        <span className="text-[11px] text-slate-500 line-clamp-1 max-w-[180px]">
                          {item.title}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-800 whitespace-nowrap">
                        {item.department_name}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {item.decision_status === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Approved</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            <HiQuestionMarkCircle className="w-3.5 h-3.5 text-sky-600" />
                            <span>Returned for Clarification</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-700 max-w-[280px]">
                        <span className="line-clamp-2 italic text-[11px]">
                          "{item.remarks}"
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-800 font-semibold whitespace-nowrap">
                        {item.reviewer_name}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {formatDate(item.decision_date)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="text-[11px] font-medium text-slate-600">
                          {item.current_status_display}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {item.requisition_id && (
                          <button
                            onClick={() => handleInspect(item.requisition_id)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-violet-700 hover:bg-violet-50 transition-colors inline-flex items-center gap-1 border border-slate-200"
                          >
                            <HiEye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Requisition Inspection Modal */}
      <RequisitionDetailModal
        requisition={inspectReq}
        isOpen={inspectModalOpen}
        onClose={() => setInspectModalOpen(false)}
        initialMode="view"
      />
    </ProcurementCommitteeLayout>
  );
};

export default ProcurementCommitteeHistoryPage;
