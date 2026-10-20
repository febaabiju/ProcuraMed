import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['pending', 'completed', 'suitable', 'clarification'];
  const initialTab = validTabs.includes(searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'pending';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialization, setSelectedSpecialization] = useState('ALL');

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    if (newTab === 'pending') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: newTab });
    }
  };

  // Modal state
  const [selectedEval, setSelectedEval] = useState(null);
  const [docLoadingId, setDocLoadingId] = useState(null);

  const handleOpenDoc = async (item) => {
    if (!item) return;
    const actualUrl = item.actual_document_url || item.supporting_document;
    if (actualUrl && (actualUrl.includes('/media/') || actualUrl.startsWith('blob:') || actualUrl.startsWith('data:'))) {
      window.open(actualUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const reqId = item.requisition_id || item.id;
    setDocLoadingId(item.id || reqId);
    try {
      const res = await axiosClient.get(`/procurement/requisitions/${reqId}/document/`, {
        responseType: 'blob'
      });
      const contentType = res.headers['content-type'] || 'application/pdf';
      const blob = new Blob([res.data], { type: contentType });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const directTarget = item.supporting_document_url || actualUrl;
      if (directTarget) {
        window.open(directTarget, '_blank', 'noopener,noreferrer');
      } else {
        alert(err.response?.data?.detail || 'Failed to open supporting document.');
      }
    } finally {
      setDocLoadingId(null);
    }
  };

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
      (item.vendor_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.department_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.category?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.remarks?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (item.recommendation?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const isSuitable = (item) => {
    const rec = (item.current_technical_recommendation || item.recommendation || '').toLowerCase();
    return rec === 'technically suitable' || (rec.includes('suitable') && !rec.includes('not'));
  };

  const isClarification = (item) => {
    // A requisition approved as technically suitable cannot simultaneously appear as actively returned for clarification
    if (isSuitable(item)) return false;
    // Requisitions that have advanced to Procurement Committee review or later are not actively returned for clarification
    const reqStatus = (item.current_requisition_status || '').toUpperCase();
    if (['PENDING_COMMITTEE_REVIEW', 'PENDING_QUOTATION', 'PENDING_PO_CREATION', 'APPROVED', 'COMPLETED'].includes(reqStatus)) {
      return false;
    }
    const rec = (item.current_technical_recommendation || item.recommendation || '').toLowerCase();
    return rec === 'requires clarification' || rec.includes('clarification') || rec === 'returned';
  };

  const allSuitable = completedList.filter(isSuitable);
  const allClarification = completedList.filter(isClarification);
  const suitableCount = allSuitable.length;
  const clarificationCount = allClarification.length;

  const suitableCompleted = filteredCompleted.filter(isSuitable);
  const clarificationCompleted = filteredCompleted.filter(isClarification);

  const renderEvaluationCard = (rec, outcomeType) => {
    const isApproved = outcomeType === 'suitable';
    return (
      <div
        key={rec.id}
        className={`p-4 rounded-2xl border transition-colors space-y-2.5 ${
          isApproved
            ? 'bg-slate-50/70 hover:bg-emerald-50/30 border-slate-200/80 hover:border-emerald-200'
            : 'bg-slate-50/70 hover:bg-amber-50/30 border-slate-200/80 hover:border-amber-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-violet-700 text-xs">
              {rec.req_number || rec.evaluation_ref}
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-bold text-slate-900 text-xs">
              {rec.department_name}
            </span>
            {rec.category && rec.category !== 'N/A' && (
              <>
                <span className="text-slate-300 hidden sm:inline">•</span>
                <span className="text-[10px] text-slate-500 font-medium px-2 py-0.5 rounded-md bg-white border border-slate-200/70">
                  {rec.category}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                isApproved
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {rec.recommendation || (isApproved ? 'Technically Suitable' : 'Requires Clarification')}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {formatDate(rec.evaluation_date)}
            </span>
          </div>
        </div>

        <div>
          <p className="font-bold text-slate-900 text-xs">{rec.vendor_name || rec.title}</p>
          <div
            className={`mt-1.5 p-3 rounded-xl border text-xs text-slate-700 leading-relaxed font-medium bg-white ${
              isApproved ? 'border-slate-200/80' : 'border-amber-100 bg-amber-50/20'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-slate-400">
              {isApproved ? 'Technical Assessment Remarks' : 'Clarification Reason & Requirements'}
            </span>
            <p className="whitespace-pre-line">{rec.remarks || 'No remarks recorded.'}</p>
          </div>
        </div>

        {/* Previous clarification history preserved and accessible on resolved/approved evaluations */}
        {rec.clarification_history && rec.clarification_history.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-200/60">
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                <span className="flex items-center gap-1.5">
                  <HiRefresh className="w-3.5 h-3.5 text-amber-600" />
                  Clarification History ({rec.clarification_history.length} {rec.clarification_history.length === 1 ? 'Cycle' : 'Cycles'} - Resolved)
                </span>
                <span className="text-[10px] text-amber-700 font-semibold uppercase bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
                  Resolved
                </span>
              </div>
              {rec.clarification_history.map((hist, idx) => (
                <div key={idx} className="text-xs text-slate-600 bg-white/90 p-2.5 rounded-lg border border-amber-100/80 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                    <span>Clarification Returned: {formatDate(hist.evaluation_date || hist.created_at)}</span>
                    <span className="text-amber-700 font-bold">{hist.recommendation}</span>
                  </div>
                  <p className="italic text-slate-700 font-medium">"{hist.remarks}"</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(rec.actual_document_url || rec.supporting_document || rec.supporting_document_url) && (
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => handleOpenDoc(rec)}
              disabled={docLoadingId === (rec.id || rec.requisition_id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
              title="View original supporting document attached to purchase request"
            >
              <HiDocumentText className="w-3.5 h-3.5 text-violet-600" />
              <span>{docLoadingId === (rec.id || rec.requisition_id) ? 'Opening...' : 'View Document'}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

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

        {/* Top Control Header: Tabs, Specialization & Search */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-5 space-y-4">
          {/* Row 1: All four tabs in a single horizontal row */}
          <div className="overflow-x-auto pb-1 sm:pb-0">
            <div className="inline-flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/80 flex-nowrap min-w-max">
              <button
                onClick={() => handleTabChange('pending')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${
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
                onClick={() => handleTabChange('completed')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'completed'
                    ? 'bg-white text-violet-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HiClipboardList className="w-4 h-4 text-violet-600" />
                <span>Completed Assessments</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'completed' ? 'bg-violet-100 text-violet-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {completedList.length}
                </span>
              </button>

              <button
                onClick={() => handleTabChange('suitable')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'suitable'
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HiCheckCircle className="w-4 h-4 text-emerald-500" />
                <span>Technically Suitable (Approved)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'suitable' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {suitableCount}
                </span>
              </button>

              <button
                onClick={() => handleTabChange('clarification')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'clarification'
                    ? 'bg-white text-amber-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <HiRefresh className="w-4 h-4 text-amber-500" />
                <span>Returned for Clarification</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === 'clarification' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
                }`}>
                  {clarificationCount}
                </span>
              </button>
            </div>
          </div>

          {/* Row 2: Specialization dropdown on a separate row directly below the four tabs, aligned to the right */}
          {activeTab === 'pending' && officerSpecializations.length > 0 && (
            <div className="flex justify-end items-center pt-1">
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
            </div>
          )}

          {/* Row 3: Search bar below Specialization dropdown */}
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
                          {ev.is_resubmitted_clarification ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-amber-100 text-amber-900 border-amber-300">
                              <HiRefresh className="w-3 h-3 text-amber-700" />
                              <span>Clarified &amp; Resubmitted</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-amber-50 text-amber-700 border-amber-200">
                              Pending Review
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {(ev.actual_document_url || ev.supporting_document || ev.supporting_document_url) && (
                              <button
                                type="button"
                                onClick={() => handleOpenDoc(ev)}
                                disabled={docLoadingId === ev.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                                title="View original supporting document attached to purchase request"
                              >
                                <HiDocumentText className="w-3.5 h-3.5 text-violet-600" />
                                <span>{docLoadingId === ev.id ? 'Opening...' : 'View Document'}</span>
                              </button>
                            )}
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => setSelectedEval(ev)}
                              className="bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs gap-1.5 shadow-sm py-1.5 px-3"
                            >
                              <HiBeaker className="w-3.5 h-3.5" />
                              <span>Evaluate</span>
                            </Button>
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

        {/* Tab 2: Completed Assessments History (Two Distinct Sections) */}
        {activeTab === 'completed' && (
          <div className="space-y-6">
            {loading ? (
              <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2.5">
                <HiRefresh className="w-6 h-6 animate-spin text-emerald-600" />
                <span>Loading completed assessments...</span>
              </div>
            ) : filteredCompleted.length === 0 ? (
              <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/60 text-emerald-600 flex items-center justify-center mx-auto">
                  <HiShieldCheck className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800">
                    No completed technical evaluations found.
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {searchQuery
                      ? 'No evaluation records matched your search query. Try clearing or modifying your search terms.'
                      : 'When you submit technical evaluations for assigned purchase requests, they will appear in this history register.'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Section 1: Technically Suitable (Approved) */}
                <div className="bg-white rounded-3xl border border-emerald-200/90 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center font-bold">
                        <HiCheckCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-extrabold text-slate-900">
                            Technically Suitable (Approved)
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {suitableCompleted.length} {suitableCompleted.length === 1 ? 'Record' : 'Records'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Evaluations confirmed compliant with technical specifications and forwarded to Procurement Committee
                        </p>
                      </div>
                    </div>
                  </div>

                  {suitableCompleted.length === 0 ? (
                    <div className="p-8 text-center space-y-2 bg-emerald-50/30 rounded-2xl border border-emerald-100/70">
                      <HiCheckCircle className="w-7 h-7 text-emerald-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">No technically suitable evaluations found.</p>
                      <p className="text-[11px] text-slate-400">
                        {searchQuery
                          ? 'No suitable evaluations match the current search filter.'
                          : 'Evaluations approved as technically suitable will appear in this section.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {suitableCompleted.map((rec) => renderEvaluationCard(rec, 'suitable'))}
                    </div>
                  )}
                </div>

                {/* Section 2: Returned for Clarification */}
                <div className="bg-white rounded-3xl border border-amber-200/90 shadow-sm p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-amber-100 pb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center font-bold">
                        <HiRefresh className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-extrabold text-slate-900">
                            Returned for Clarification
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                            {clarificationCompleted.length} {clarificationCompleted.length === 1 ? 'Record' : 'Records'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Evaluations returned to requesting departments for parameter or specification clarification
                        </p>
                      </div>
                    </div>
                  </div>

                  {clarificationCompleted.length === 0 ? (
                    <div className="p-8 text-center space-y-2 bg-amber-50/30 rounded-2xl border border-amber-100/70">
                      <HiRefresh className="w-7 h-7 text-amber-400 mx-auto" />
                      <p className="text-xs font-bold text-slate-700">No evaluations returned for clarification found.</p>
                      <p className="text-[11px] text-slate-400">
                        {searchQuery
                          ? 'No clarification records match the current search filter.'
                          : 'Evaluations returned for clarification will appear in this section.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {clarificationCompleted.map((rec) => renderEvaluationCard(rec, 'clarification'))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Technically Suitable (Approved) Only */}
        {activeTab === 'suitable' && (
          <div className="bg-white rounded-3xl border border-emerald-200/90 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center font-bold">
                  <HiCheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Technically Suitable (Approved) Evaluations
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {suitableCompleted.length} {suitableCompleted.length === 1 ? 'Record' : 'Records'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Purchase requests verified to meet equipment specifications and forwarded to Procurement Committee
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2.5">
                <HiRefresh className="w-6 h-6 animate-spin text-emerald-600" />
                <span>Loading approved evaluations...</span>
              </div>
            ) : suitableCompleted.length === 0 ? (
              <div className="p-12 text-center space-y-3 bg-slate-50/60 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/60 text-emerald-600 flex items-center justify-center mx-auto">
                  <HiCheckCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800">
                    No technically suitable evaluations found.
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {searchQuery
                      ? 'No suitable evaluations match the current search filter.'
                      : 'Evaluations approved as technically suitable will appear here.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {suitableCompleted.map((rec) => renderEvaluationCard(rec, 'suitable'))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Returned for Clarification Only */}
        {activeTab === 'clarification' && (
          <div className="bg-white rounded-3xl border border-amber-200/90 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-100 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center font-bold">
                  <HiRefresh className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Returned for Clarification Evaluations
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                      {clarificationCompleted.length} {clarificationCompleted.length === 1 ? 'Record' : 'Records'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Purchase requests returned to requesting departments for technical parameter or specification clarification
                  </p>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2.5">
                <HiRefresh className="w-6 h-6 animate-spin text-amber-600" />
                <span>Loading clarification evaluations...</span>
              </div>
            ) : clarificationCompleted.length === 0 ? (
              <div className="p-12 text-center space-y-3 bg-slate-50/60 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-amber-100/60 text-amber-600 flex items-center justify-center mx-auto">
                  <HiRefresh className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800">
                    No evaluations returned for clarification found.
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {searchQuery
                      ? 'No clarification records match the current search filter.'
                      : 'Evaluations returned for clarification will appear here.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {clarificationCompleted.map((rec) => renderEvaluationCard(rec, 'clarification'))}
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
