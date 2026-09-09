import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import Button from '../../components/common/Button';
import {
  HiClipboardCheck,
  HiClock,
  HiCheckCircle,
  HiXCircle,
  HiQuestionMarkCircle,
  HiBadgeCheck,
  HiEye,
  HiUser,
  HiMail,
  HiPhone,
  HiOfficeBuilding,
  HiCalendar,
  HiCurrencyDollar,
  HiBell,
  HiX,
  HiRefresh,
  HiInformationCircle,
  HiShieldCheck,
  HiArrowRight,
  HiDocumentText,
  HiCheck,
  HiBan
} from 'react-icons/hi';

const ProcurementCommitteeDashboardPage = () => {
  const [data, setData] = useState({
    user: null,
    stats: {
      pending_committee_reviews: 0,
      under_review: 0,
      approved_cases: 0,
      rejected_cases: 0,
      clarification_requested: 0,
      completed_decisions: 0
    },
    pipeline: {
      department_staff: 0,
      purchase_officer: 0,
      technical_evaluation: 0,
      procurement_committee: 0,
      purchase_order: 0,
      vendor_delivery: 0
    },
    pending_reviews: [],
    review_queue: [],
    recent_decisions: [],
    notifications: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [selectedReview, setSelectedReview] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const fetchCommitteeDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/committee-dashboard/');
      setData({
        user: res.data.user || null,
        stats: {
          pending_committee_reviews: res.data.stats?.pending_committee_reviews ?? 0,
          under_review: res.data.stats?.under_review ?? 0,
          approved_cases: res.data.stats?.approved_cases ?? 0,
          rejected_cases: res.data.stats?.rejected_cases ?? 0,
          clarification_requested: res.data.stats?.clarification_requested ?? 0,
          completed_decisions: res.data.stats?.completed_decisions ?? 0
        },
        pipeline: res.data.pipeline || {
          department_staff: 0,
          purchase_officer: 0,
          technical_evaluation: 0,
          procurement_committee: 0,
          purchase_order: 0,
          vendor_delivery: 0
        },
        pending_reviews: res.data.pending_reviews || [],
        review_queue: res.data.review_queue || [],
        recent_decisions: res.data.recent_decisions || [],
        notifications: res.data.notifications || []
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load procurement committee dashboard information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommitteeDashboardData();
  }, []);

  const memberName = data.user?.full_name || data.user?.first_name || 'Committee Member';
  const employeeId = data.user?.employee_id || 'PC101';

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
    if (amount === undefined || amount === null || amount === '') return 'N/A';
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getPriorityBadge = (priority) => {
    switch (priority?.toUpperCase()) {
      case 'URGENT':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'HIGH':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MEDIUM':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'LOW':
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'CLARIFICATION_REQUESTED':
      case 'CLARIFICATION REQUESTED':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'AWAITING COMMITTEE REVIEW':
      case 'PENDING COMMITTEE REVIEW':
      case 'UNDER REVIEW':
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTechStatusBadge = (techStatus) => {
    switch (techStatus?.toLowerCase()) {
      case 'technically compliant':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'under evaluation':
        return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'bids received':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'not required':
      case 'n/a':
        return 'bg-slate-100 text-slate-500 border-slate-200';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <ProcurementCommitteeLayout
      title="Procurement Committee Dashboard"
      subtitle="Review procurement submissions, evaluate recommendations, and make informed procurement decisions."
      committeeUser={data.user}
      onRefresh={fetchCommitteeDashboardData}
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
              <HiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. Welcome Banner */}
        <div
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl"
          style={{
            background: 'linear-gradient(135deg, #18103a 0%, #2e1d68 50%, #4a2890 100%)',
          }}
        >
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 -mb-16 w-48 h-48 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold text-violet-200">
                <HiShieldCheck className="w-3.5 h-3.5 text-violet-300" />
                <span>Procurement Committee Board</span>
                <span className="text-violet-300">•</span>
                <span className="font-mono text-white">ID: {employeeId}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Welcome, {memberName}
              </h1>
              <p className="text-xs sm:text-sm text-violet-200 leading-relaxed font-medium">
                Review procurement submissions, evaluate recommendations, and make informed procurement decisions to support transparent hospital purchasing.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/committee/reviews">
                <Button
                  variant="primary"
                  size="md"
                  className="bg-white text-violet-900 hover:bg-violet-50 font-bold text-xs gap-1.5 shadow-lg shadow-black/10 border-0"
                >
                  <HiClipboardCheck className="w-4 h-4 text-violet-700" />
                  <span>Procurement Reviews</span>
                </Button>
              </Link>

              <Button
                variant="outline"
                size="md"
                onClick={() => setProfileModalOpen(true)}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md font-bold text-xs gap-1.5 shadow-sm"
              >
                <HiUser className="w-4 h-4" />
                <span>My Profile</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Dashboard Summary Cards (6 Decision-Related Statistics) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {[
            {
              title: 'Pending Reviews',
              value: data.stats.pending_committee_reviews,
              desc: 'Awaiting review',
              icon: HiClipboardCheck,
              bgLight: 'bg-amber-50',
              textColor: 'text-amber-700',
              borderColor: 'border-amber-100',
              link: '/committee/reviews'
            },
            {
              title: 'Under Review',
              value: data.stats.under_review,
              desc: 'In committee quorum',
              icon: HiClock,
              bgLight: 'bg-violet-50',
              textColor: 'text-violet-700',
              borderColor: 'border-violet-100',
              link: '/committee/reviews'
            },
            {
              title: 'Approved Cases',
              value: data.stats.approved_cases,
              desc: 'Sanctioned procurements',
              icon: HiCheckCircle,
              bgLight: 'bg-emerald-50',
              textColor: 'text-emerald-700',
              borderColor: 'border-emerald-100',
              link: '/committee/decisions'
            },
            {
              title: 'Rejected Cases',
              value: data.stats.rejected_cases,
              desc: 'Declined submissions',
              icon: HiXCircle,
              bgLight: 'bg-rose-50',
              textColor: 'text-rose-700',
              borderColor: 'border-rose-100',
              link: '/committee/decisions'
            },
            {
              title: 'Clarification Req.',
              value: data.stats.clarification_requested,
              desc: 'Returned for info',
              icon: HiQuestionMarkCircle,
              bgLight: 'bg-sky-50',
              textColor: 'text-sky-700',
              borderColor: 'border-sky-100',
              link: '/committee/reviews'
            },
            {
              title: 'Completed Decisions',
              value: data.stats.completed_decisions,
              desc: 'Processed cases',
              icon: HiBadgeCheck,
              bgLight: 'bg-teal-50',
              textColor: 'text-teal-700',
              borderColor: 'border-teal-100',
              link: '/committee/history'
            }
          ].map((card, idx) => {
            const Icon = card.icon;
            return (
              <Link
                key={idx}
                to={card.link}
                className={`p-4 bg-white rounded-3xl border ${card.borderColor} shadow-sm hover:shadow-md transition-all group flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 leading-tight truncate">
                    {card.title}
                  </span>
                  <div className={`w-8 h-8 rounded-xl ${card.bgLight} ${card.textColor} flex items-center justify-center flex-shrink-0 font-bold group-hover:scale-105 transition-transform`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {loading ? (
                      <span className="text-slate-300 animate-pulse text-lg">...</span>
                    ) : (
                      card.value
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">{card.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 3. Procurement Workflow Overview (Highlighting Committee Responsibility) */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Procurement Workflow Overview
              </h2>
              <p className="text-[11px] text-slate-400">
                Hospital Procurement Decision Chain — Committee Governance Area Highlighted
              </p>
            </div>
            <span className="text-xs font-bold text-violet-700 px-3 py-1 bg-violet-50 rounded-xl border border-violet-100 self-start sm:self-auto">
              Decision Quorum
            </span>
          </div>

          {/* Workflow Chain */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
            {[
              { step: '1', title: 'Department Staff', desc: 'Requisitions Raised', count: data.pipeline.department_staff, highlight: false },
              { step: '2', title: 'Purchase Officer', desc: 'RFQ & Sourcing', count: data.pipeline.purchase_officer, highlight: false },
              { step: '3', title: 'Technical Evaluation', desc: 'Specs & Quality', count: data.pipeline.technical_evaluation, highlight: false },
              { step: '4', title: 'Procurement Committee', desc: 'Review & Approval', count: data.pipeline.procurement_committee, highlight: true },
              { step: '5', title: 'Purchase Order', desc: 'Contract Issued', count: data.pipeline.purchase_order, highlight: false },
              { step: '6', title: 'Vendor Delivery', desc: 'Fulfillment & Inspection', count: data.pipeline.vendor_delivery, highlight: false },
            ].map((stage, sIdx) => (
              <div
                key={sIdx}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                  stage.highlight
                    ? 'bg-violet-600 text-white border-violet-700 shadow-md shadow-violet-500/20'
                    : 'bg-slate-50/80 border-slate-100 text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center ${
                      stage.highlight ? 'bg-white text-violet-800' : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {stage.step}
                  </span>
                  <span className={`text-lg font-black ${stage.highlight ? 'text-white' : 'text-slate-900'}`}>
                    {loading ? '...' : stage.count}
                  </span>
                </div>
                <div>
                  <h4 className={`text-xs font-bold leading-tight ${stage.highlight ? 'text-white' : 'text-slate-800'}`}>
                    {stage.title}
                  </h4>
                  <p className={`text-[10px] mt-0.5 truncate ${stage.highlight ? 'text-violet-100 font-medium' : 'text-slate-400'}`}>
                    {stage.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Split Main Content: Pending Reviews Table & Queue / Decisions Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Main Table (Pending Procurement Reviews) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs">
                    <HiClipboardCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      Pending Procurement Reviews
                    </h2>
                    <p className="text-[11px] text-slate-400">High-value purchase cases submitted for committee determination</p>
                  </div>
                </div>
                <Link
                  to="/committee/reviews"
                  className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  View All →
                </Link>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
                  <HiRefresh className="w-5 h-5 animate-spin text-violet-500" />
                  <span>Loading pending reviews...</span>
                </div>
              ) : data.pending_reviews.length === 0 ? (
                <div className="p-10 text-center space-y-3 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <div className="w-12 h-12 rounded-2xl bg-violet-100/60 text-violet-600 flex items-center justify-center mx-auto">
                    <HiClipboardCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800">
                      No pending procurement reviews.
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      When procurement cases are finalized by the Purchase Officer and Technical Officers, they will appear here for committee approval.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Procurement Ref</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Submission Date</th>
                        <th className="px-4 py-3">Tech Eval Status</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {data.pending_reviews.map((rev) => (
                        <tr key={rev.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-violet-700 whitespace-nowrap">
                            {rev.req_number}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                            {rev.department_name}
                          </td>
                          <td className="px-4 py-3 text-slate-700 max-w-[150px] truncate">
                            {rev.title}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {formatDate(rev.submission_date)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getTechStatusBadge(rev.technical_evaluation_status)}`}>
                              {rev.technical_evaluation_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(rev.current_status)}`}>
                              {rev.current_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedReview(rev)}
                              className="text-[11px] font-bold text-violet-700 border-violet-200 hover:bg-violet-50 py-1 px-2.5"
                            >
                              <HiEye className="w-3.5 h-3.5" />
                              <span>View Review</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Committee Review Queue, Decisions, and Notifications */}
          <div className="space-y-6">
            {/* Widget 1: Committee Review Queue */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                    <HiClock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Committee Review Queue</h3>
                    <p className="text-[10px] text-slate-400">Items awaiting committee quorum</p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading review queue...</div>
              ) : data.review_queue.length === 0 ? (
                <div className="p-6 text-center space-y-1.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiClock className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No cases currently in review queue.</p>
                  <p className="text-[10px] text-slate-400">New procurement dossiers will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.review_queue.map((item) => (
                    <div key={item.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-violet-700">{item.req_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityBadge(item.priority)}`}>
                          {item.priority}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-800">
                        <span className="font-bold">{item.department_name}</span>
                        <span className="font-semibold text-slate-500">By: {item.submitted_by}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 border-t border-slate-200/60">
                        <span className="text-emerald-700 font-semibold">{item.technical_evaluation_result}</span>
                        <span className="font-bold text-slate-900">{formatCurrency(item.estimated_budget)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Widget 2: Recent Committee Decisions */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    <HiCheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Recent Decisions</h3>
                    <p className="text-[10px] text-slate-400">Formal committee verdicts</p>
                  </div>
                </div>
                <Link to="/committee/decisions" className="text-[11px] font-bold text-violet-600 hover:text-violet-800">
                  All →
                </Link>
              </div>

              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading decisions...</div>
              ) : data.recent_decisions.length === 0 ? (
                <div className="p-6 text-center space-y-1.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiCheckCircle className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No committee decisions available.</p>
                  <p className="text-[10px] text-slate-400">Past review approvals and rejections will be archived here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.recent_decisions.map((dec) => (
                    <div key={dec.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-violet-700">{dec.req_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(dec.decision)}`}>
                          {dec.decision}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-800 font-bold truncate">{dec.title}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{dec.department_name}</span>
                        <span>{formatDate(dec.decision_date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Widget 3: Notifications */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs">
                    <HiBell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Recent Notifications</h3>
                    <p className="text-[10px] text-slate-400">Committee governance alerts</p>
                  </div>
                </div>
                <Link to="/committee/notifications" className="text-[11px] font-bold text-violet-600 hover:text-violet-800">
                  All →
                </Link>
              </div>

              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading notifications...</div>
              ) : data.notifications.length === 0 ? (
                <div className="p-6 text-center space-y-1.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiBell className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No new notifications.</p>
                  <p className="text-[10px] text-slate-400">Alerts on new submissions and technical evaluations will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.notifications.map((notif) => (
                    <div key={notif.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-[11px]">{notif.action}</span>
                        <span className="text-[10px] text-slate-400">{formatDate(notif.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{notif.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: REVIEW DETAILS MODAL */}
      <AnimatePresence>
        {selectedReview && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                    <HiClipboardCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{selectedReview.title}</h3>
                    <p className="text-xs font-mono font-bold text-violet-700">{selectedReview.req_number}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedReview(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Department</p>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedReview.department_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Submission Date</p>
                    <p className="font-bold text-slate-800 mt-0.5">{formatDate(selectedReview.submission_date)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Priority</p>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityBadge(selectedReview.priority)}`}>
                      {selectedReview.priority}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Technical Evaluation</p>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getTechStatusBadge(selectedReview.technical_evaluation_status)}`}>
                      {selectedReview.technical_evaluation_status}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Estimated Procurement Budget</p>
                  <p className="font-extrabold text-slate-900 text-sm">
                    {formatCurrency(selectedReview.estimated_budget)}
                  </p>
                </div>

                {selectedReview.justification && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Clinical / Operational Justification</p>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {selectedReview.justification}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setSelectedReview(null)}
                  className="border-slate-200 text-slate-700"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: COMMITTEE MEMBER PROFILE MODAL */}
      <AnimatePresence>
        {profileModalOpen && data.user && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm text-lg"
                    style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
                  >
                    {memberName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">{memberName}</h3>
                    <p className="text-xs text-violet-600 font-mono font-bold">@{data.user.username} • {employeeId}</p>
                  </div>
                </div>
                <button
                  onClick={() => setProfileModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* Role Status */}
                <div className="p-3 bg-violet-50 rounded-2xl border border-violet-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HiShieldCheck className="w-4 h-4 text-violet-600" />
                    <span className="font-bold text-violet-900">Hospital Procurement Governance</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white text-violet-700 font-bold text-[11px] border border-violet-200">
                    Committee Member
                  </span>
                </div>

                {/* Personal & Employment Details */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
                  <p className="font-bold text-slate-800 border-b border-slate-200/80 pb-1 flex items-center gap-1.5">
                    <HiUser className="w-3.5 h-3.5 text-violet-500" />
                    <span>Member Information</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-slate-600 pt-1">
                    <p className="flex justify-between">
                      <span className="text-slate-400">Employee ID:</span>
                      <strong className="text-slate-900 font-mono">{employeeId}</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400">Gender:</span>
                      <strong className="text-slate-900">{data.user.gender || 'Not specified'}</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400">Date of Birth:</span>
                      <strong className="text-slate-900">{formatDate(data.user.date_of_birth)}</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400">Role:</span>
                      <strong className="text-violet-700">{data.user.role}</strong>
                    </p>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
                  <p className="font-bold text-slate-800 border-b border-slate-200/80 pb-1 flex items-center gap-1.5">
                    <HiMail className="w-3.5 h-3.5 text-violet-500" />
                    <span>Contact Details</span>
                  </p>
                  <div className="space-y-1.5 text-slate-600 pt-1">
                    <p className="flex justify-between">
                      <span className="text-slate-400">Email Address:</span>
                      <strong className="text-slate-900">{data.user.email}</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400">Phone Number:</span>
                      <strong className="text-slate-900">{data.user.phone || 'N/A'}</strong>
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setProfileModalOpen(false)}
                  className="border-slate-200 text-slate-700"
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

export default ProcurementCommitteeDashboardPage;
