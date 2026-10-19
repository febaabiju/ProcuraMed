import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import TechnicalOfficerLayout from '../../components/layout/TechnicalOfficerLayout';
import Button from '../../components/common/Button';
import TechnicalEvaluationModal from './TechnicalEvaluationModal';
import {
  HiBeaker,
  HiClipboardList,
  HiSearch,
  HiFilter,
  HiCheckCircle,
  HiXCircle,
  HiClock,
  HiRefresh,
  HiEye,
  HiDocumentText,
  HiTag,
  HiShieldCheck,
  HiInformationCircle
} from 'react-icons/hi';

const TechnicalOfficerEvaluationsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState(null);

  // Filter & Search states
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('ALL');

  // Modal state
  const [selectedEval, setSelectedEval] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/technical-officer-dashboard/');
      setDashboardData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load technical evaluations queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatCurrency = (val) => {
    if (val === undefined || val === null || val === '') return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const pendingList = dashboardData?.assigned_evaluations || [];
  const completedList = dashboardData?.recent_recommendations || [];

  // Filter logic
  const filteredPending = pendingList.filter((item) => {
    const matchesSearch =
      (item.req_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.department_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.category?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.primary_item?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    const matchesSpec =
      selectedSpecialization === 'ALL' ||
      item.specialization_category === selectedSpecialization;

    return matchesSearch && matchesSpec;
  });

  const filteredCompleted = completedList.filter((item) => {
    const matchesSearch =
      (item.req_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.title?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.department_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.category?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.remarks?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const officerSpecializations = dashboardData?.specializations || dashboardData?.user?.technical_specializations || [];

  return (
    <TechnicalOfficerLayout
      title="Technical Evaluations Queue"
      subtitle="Examine medical equipment specifications and submit technical evaluations for Purchase Officer-approved requests."
      technicalUser={dashboardData?.user}
      onRefresh={fetchDashboardData}
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
              ✕
            </button>
          </div>
        )}

        {/* Top Control Header: Tabs & Search */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center gap-2 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80 w-fit">
              <button
                onClick={() => setActiveTab('pending')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'pending'
                    ? 'bg-white text-violet-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HiClock className="w-4 h-4 text-amber-500" />
                <span>Pending Evaluations</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'pending' ? 'bg-violet-100 text-violet-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {pendingList.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('completed')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === 'completed'
                    ? 'bg-white text-violet-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HiCheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Completed Assessments</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {completedList.length}
                </span>
              </button>
            </div>

            {/* Specialization Filter (for pending tab) */}
            {activeTab === 'pending' && officerSpecializations.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">Specialization:</span>
                <select
                  value={selectedSpecialization}
                  onChange={(e) => setSelectedSpecialization(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="ALL">All Specializations</option>
                  {officerSpecializations.map((spec, i) => (
                    <option key={i} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative">
            <HiSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by request number, title, equipment name, department, or category..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-slate-50/50"
            />
          </div>
        </div>

        {/* Tab 1: Pending Evaluations Queue */}
        {activeTab === 'pending' && (
          <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center font-bold">
                  <HiBeaker className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Purchase Officer-Approved Requests Assigned to You
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Showing {filteredPending.length} request(s) awaiting technical evaluation
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2.5">
                <HiRefresh className="w-6 h-6 animate-spin text-violet-600" />
                <span>Loading evaluation queue...</span>
              </div>
            ) : filteredPending.length === 0 ? (
              <div className="p-12 text-center space-y-3 bg-slate-50/60 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-violet-100/60 text-violet-600 flex items-center justify-center mx-auto">
                  <HiClipboardList className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800">
                    No pending technical evaluations found.
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {searchQuery
                      ? 'No purchase requests matched your search query.'
                      : 'When a Purchase Officer reviews and routes a requisition matching your technical specialization, it will appear here.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                    <tr>
                      <th className="px-4 py-3">Request Ref</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Item / Scope</th>
                      <th className="px-4 py-3">Specialization</th>
                      <th className="px-4 py-3">Budget</th>
                      <th className="px-4 py-3">Required Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredPending.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-violet-700 block">
                            {ev.req_number || ev.procurement_ref}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Assigned: {formatDate(ev.assigned_date)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-bold text-slate-900">
                          {ev.department_name}
                        </td>
                        <td className="px-4 py-3.5 max-w-[200px]">
                          <p className="font-bold text-slate-900 truncate">{ev.title}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {ev.primary_item ? `${ev.primary_item} (Qty: ${ev.total_quantity})` : ev.category}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 text-[10px] font-bold">
                            {ev.specialization_category}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-slate-800">
                          {formatCurrency(ev.estimated_price || ev.total_amount)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 text-[11px]">
                          {formatDate(ev.required_date)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-amber-50 text-amber-700 border-amber-200">
                            Pending Review
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setSelectedEval(ev)}
                            className="bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs gap-1.5 shadow-sm py-1.5 px-3"
                          >
                            <HiBeaker className="w-3.5 h-3.5" />
                            <span>Evaluate</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Completed Assessments History */}
        {activeTab === 'completed' && (
          <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <HiCheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Completed Technical Evaluations History
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Historical technical recommendations submitted by you
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2.5">
                <HiRefresh className="w-6 h-6 animate-spin text-emerald-600" />
                <span>Loading completed assessments...</span>
              </div>
            ) : filteredCompleted.length === 0 ? (
              <div className="p-12 text-center space-y-3 bg-slate-50/60 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/60 text-emerald-600 flex items-center justify-center mx-auto">
                  <HiShieldCheck className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800">
                    No completed technical evaluations found.
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    When you submit technical evaluations for assigned purchase requests, they will appear in this history register.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCompleted.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-violet-700 text-xs">
                          {rec.req_number || rec.evaluation_ref}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="font-bold text-slate-900 text-xs">
                          {rec.department_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          rec.recommendation === 'Technically Suitable' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          rec.recommendation === 'Technically Not Suitable' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-sky-50 text-sky-700 border-sky-200'
                        }`}>
                          {rec.recommendation}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(rec.evaluation_date)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <p className="font-bold text-slate-900 text-xs">{rec.vendor_name || rec.title}</p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                        {rec.remarks}
                      </p>
                    </div>

                    {rec.supporting_document_url && (
                      <div className="pt-1 flex justify-end">
                        <a
                          href={rec.supporting_document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-violet-700 hover:text-violet-900 font-bold"
                        >
                          <HiDocumentText className="w-4 h-4" />
                          <span>View Evaluation Attachment</span>
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Evaluation Modal */}
      <TechnicalEvaluationModal
        requisition={selectedEval}
        isOpen={!!selectedEval}
        onClose={() => setSelectedEval(null)}
        onEvaluationSubmitted={() => {
          fetchDashboardData();
        }}
      />
    </TechnicalOfficerLayout>
  );
};

export default TechnicalOfficerEvaluationsPage;
