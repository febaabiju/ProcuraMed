import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import TechnicalOfficerLayout from '../../components/layout/TechnicalOfficerLayout';
import Button from '../../components/common/Button';
import {
  HiClipboardList,
  HiClock,
  HiSearch,
  HiCheckCircle,
  HiShieldCheck,
  HiXCircle,
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
  HiBeaker,
  HiTag,
  HiCheck,
  HiBan
} from 'react-icons/hi';

const TechnicalOfficerDashboardPage = () => {
  const [data, setData] = useState({
    user: null,
    stats: {
      assigned_evaluations: 0,
      pending_reviews: 0,
      in_progress_evaluations: 0,
      completed_evaluations: 0,
      compliance_approved: 0,
      compliance_rejected: 0
    },
    pipeline: {
      purchase_requisition: 0,
      quotation_collection: 0,
      technical_evaluation: 0,
      procurement_committee: 0,
      purchase_order: 0
    },
    specializations: [],
    assigned_evaluations: [],
    pending_reviews: [],
    recent_recommendations: [],
    notifications: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [selectedEval, setSelectedEval] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const fetchTechnicalDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/technical-officer-dashboard/');
      setData({
        user: res.data.user || null,
        stats: {
          assigned_evaluations: res.data.stats?.assigned_evaluations ?? 0,
          pending_reviews: res.data.stats?.pending_reviews ?? 0,
          in_progress_evaluations: res.data.stats?.in_progress_evaluations ?? 0,
          completed_evaluations: res.data.stats?.completed_evaluations ?? 0,
          compliance_approved: res.data.stats?.compliance_approved ?? 0,
          compliance_rejected: res.data.stats?.compliance_rejected ?? 0
        },
        pipeline: res.data.pipeline || {
          purchase_requisition: 0,
          quotation_collection: 0,
          technical_evaluation: 0,
          procurement_committee: 0,
          purchase_order: 0
        },
        specializations: res.data.specializations || [],
        assigned_evaluations: res.data.assigned_evaluations || [],
        pending_reviews: res.data.pending_reviews || [],
        recent_recommendations: res.data.recent_recommendations || [],
        notifications: res.data.notifications || []
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load technical officer dashboard information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTechnicalDashboardData();
  }, []);

  const officerName = data.user?.full_name || data.user?.first_name || 'Technical Officer';
  const employeeId = data.user?.employee_id || 'TO101';
  const specializationsList = data.specializations.length > 0
    ? data.specializations
    : (data.user?.technical_specializations || ['Biomedical & Medical Devices']);

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

  const getStatusBadge = (status) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
      case 'APPROVED':
      case 'TECHNICALLY COMPLIANT':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'IN PROGRESS':
      case 'UNDER_REVIEW':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'PENDING REVIEW':
      case 'SUBMITTED':
      case 'PENDING':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'TECHNICALLY NON-COMPLIANT':
      case 'REJECTED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getRecommendationBadge = (rec) => {
    switch (rec?.toLowerCase()) {
      case 'technically compliant':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'technically non-compliant':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'clarification required':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <TechnicalOfficerLayout
      title="Technical Officer Dashboard"
      subtitle="Review technical specifications, evaluate vendor submissions, and provide technical recommendations."
      technicalUser={data.user}
      onRefresh={fetchTechnicalDashboardData}
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
          <div className="absolute bottom-0 right-1/4 -mb-16 w-48 h-48 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold text-violet-200">
                <HiBeaker className="w-3.5 h-3.5 text-teal-300" />
                <span>Technical Evaluation Unit</span>
                <span className="text-violet-300">•</span>
                <span className="font-mono text-white">ID: {employeeId}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Welcome, {officerName}
              </h1>

              <p className="text-xs sm:text-sm text-violet-200 leading-relaxed font-medium">
                Review technical specifications, evaluate vendor submissions, and provide technical recommendations to support transparent procurement decisions.
              </p>

              {/* Assigned Technical Specializations in Banner */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-violet-300 uppercase tracking-wider">
                  Assigned Specialization(s):
                </span>
                {specializationsList.map((spec, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-[11px] font-bold text-white backdrop-blur-md"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/technical-officer/evaluations">
                <Button
                  variant="primary"
                  size="md"
                  className="bg-white text-violet-900 hover:bg-violet-50 font-bold text-xs gap-1.5 shadow-lg shadow-black/10 border-0"
                >
                  <HiBeaker className="w-4 h-4 text-violet-700" />
                  <span>Technical Evaluations</span>
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

        {/* 2. Dashboard Summary Cards (6 Technical Evaluation Statistics) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {[
            {
              title: 'Assigned Evaluations',
              value: data.stats.assigned_evaluations,
              desc: 'Assigned to you',
              icon: HiClipboardList,
              bgLight: 'bg-violet-50',
              textColor: 'text-violet-700',
              borderColor: 'border-violet-100',
              link: '/technical-officer/evaluations'
            },
            {
              title: 'Pending Reviews',
              value: data.stats.pending_reviews,
              desc: 'Awaiting assessment',
              icon: HiClock,
              bgLight: 'bg-amber-50',
              textColor: 'text-amber-700',
              borderColor: 'border-amber-100',
              link: '/technical-officer/assigned-reviews'
            },
            {
              title: 'In Progress',
              value: data.stats.in_progress_evaluations,
              desc: 'Under active review',
              icon: HiSearch,
              bgLight: 'bg-indigo-50',
              textColor: 'text-indigo-700',
              borderColor: 'border-indigo-100',
              link: '/technical-officer/evaluations'
            },
            {
              title: 'Completed',
              value: data.stats.completed_evaluations,
              desc: 'Submitted assessments',
              icon: HiCheckCircle,
              bgLight: 'bg-emerald-50',
              textColor: 'text-emerald-700',
              borderColor: 'border-emerald-100',
              link: '/technical-officer/history'
            },
            {
              title: 'Compliance Approved',
              value: data.stats.compliance_approved,
              desc: 'Technically compliant',
              icon: HiShieldCheck,
              bgLight: 'bg-teal-50',
              textColor: 'text-teal-700',
              borderColor: 'border-teal-100',
              link: '/technical-officer/history'
            },
            {
              title: 'Compliance Rejected',
              value: data.stats.compliance_rejected,
              desc: 'Non-compliant bids',
              icon: HiXCircle,
              bgLight: 'bg-rose-50',
              textColor: 'text-rose-700',
              borderColor: 'border-rose-100',
              link: '/technical-officer/history'
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

        {/* 3. Technical Evaluation Workflow (Highlighting Technical Officer Stage) */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Technical Evaluation Workflow
              </h2>
              <p className="text-[11px] text-slate-400">
                Hospital Procurement Pipeline — Technical Officer Responsibility Area Highlighted
              </p>
            </div>
            <span className="text-xs font-bold text-violet-700 px-3 py-1 bg-violet-50 rounded-xl border border-violet-100 self-start sm:self-auto">
              Evaluation Authority
            </span>
          </div>

          {/* Workflow Chain */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
            {[
              { step: '1', title: 'Purchase Requisition', desc: 'Department Requests', count: data.pipeline.purchase_requisition, highlight: false },
              { step: '2', title: 'Quotation Collection', desc: 'Vendor Bids Sourced', count: data.pipeline.quotation_collection, highlight: false },
              { step: '3', title: 'Technical Evaluation', desc: 'Specs & Compliance', count: data.pipeline.technical_evaluation, highlight: true },
              { step: '4', title: 'Procurement Committee', desc: 'Quorum Determination', count: data.pipeline.procurement_committee, highlight: false },
              { step: '5', title: 'Purchase Order', desc: 'Contract Award', count: data.pipeline.purchase_order, highlight: false },
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

        {/* 4. Split Main Content: Assigned Technical Evaluations & Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Main Table (Assigned Technical Evaluations) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs">
                    <HiBeaker className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      Assigned Technical Evaluations
                    </h2>
                    <p className="text-[11px] text-slate-400">Vendor equipment proposals requiring technical compliance assessment</p>
                  </div>
                </div>
                <Link
                  to="/technical-officer/evaluations"
                  className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  View All →
                </Link>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
                  <HiRefresh className="w-5 h-5 animate-spin text-violet-500" />
                  <span>Loading assigned evaluations...</span>
                </div>
              ) : data.assigned_evaluations.length === 0 ? (
                <div className="p-10 text-center space-y-3 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <div className="w-12 h-12 rounded-2xl bg-violet-100/60 text-violet-600 flex items-center justify-center mx-auto">
                    <HiBeaker className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800">
                      No assigned technical evaluations.
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      When vendor bids in your specialization area are submitted for technical review, they will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Evaluation Ref</th>
                        <th className="px-4 py-3">Procurement Ref</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Category / Item</th>
                        <th className="px-4 py-3">Specialization</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {data.assigned_evaluations.map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-violet-700 whitespace-nowrap">
                            {ev.evaluation_ref}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                            {ev.procurement_ref}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                            {ev.department_name}
                          </td>
                          <td className="px-4 py-3 text-slate-700 max-w-[150px] truncate">
                            {ev.category}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 text-[10px] font-bold">
                              {ev.specialization_category}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(ev.status)}`}>
                              {ev.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedEval(ev)}
                              className="text-[11px] font-bold text-violet-700 border-violet-200 hover:bg-violet-50 py-1 px-2.5"
                            >
                              <HiEye className="w-3.5 h-3.5" />
                              <span>View Evaluation</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Specialization Overview Section */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-3.5">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                  <HiTag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">My Technical Specializations</h3>
                  <p className="text-[10px] text-slate-400">Assigned hospital evaluation areas</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                You are certified to conduct technical evaluations and compliance inspections for:
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {specializationsList.map((spec, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-violet-50/80 rounded-2xl border border-violet-100 flex items-center gap-2.5 text-xs text-violet-900 font-bold"
                  >
                    <HiShieldCheck className="w-4 h-4 text-violet-600 flex-shrink-0" />
                    <span>{spec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Pending Reviews, Recommendations, and Notifications */}
          <div className="space-y-6">
            {/* Widget 1: Pending Technical Reviews */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                    <HiClock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Pending Technical Reviews</h3>
                    <p className="text-[10px] text-slate-400">Cases awaiting action</p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading pending reviews...</div>
              ) : data.pending_reviews.length === 0 ? (
                <div className="p-6 text-center space-y-1.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiClock className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No pending technical reviews.</p>
                  <p className="text-[10px] text-slate-400">Newly assigned reviews will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.pending_reviews.map((item) => (
                    <div key={item.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-violet-700">{item.ref_number}</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase">
                          {item.priority}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 truncate">{item.procurement_requirement}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{item.department_name}</span>
                        <span>Due: {formatDate(item.evaluation_due_date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Widget 2: Recent Technical Recommendations */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    <HiCheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Recent Recommendations</h3>
                    <p className="text-[10px] text-slate-400">Completed assessments</p>
                  </div>
                </div>
                <Link to="/technical-officer/history" className="text-[11px] font-bold text-violet-600 hover:text-violet-800">
                  All →
                </Link>
              </div>

              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading recommendations...</div>
              ) : data.recent_recommendations.length === 0 ? (
                <div className="p-6 text-center space-y-1.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiCheckCircle className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No technical recommendations available.</p>
                  <p className="text-[10px] text-slate-400">Your submitted assessments will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.recent_recommendations.map((rec) => (
                    <div key={rec.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-violet-700">{rec.evaluation_ref}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getRecommendationBadge(rec.recommendation)}`}>
                          {rec.recommendation}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-800 font-bold truncate">{rec.vendor_name}</p>
                      <p className="text-[10px] text-slate-400">{formatDate(rec.evaluation_date)}</p>
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
                    <p className="text-[10px] text-slate-400">Technical alerts</p>
                  </div>
                </div>
                <Link to="/technical-officer/notifications" className="text-[11px] font-bold text-violet-600 hover:text-violet-800">
                  All →
                </Link>
              </div>

              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading notifications...</div>
              ) : data.notifications.length === 0 ? (
                <div className="p-6 text-center space-y-1.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiBell className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No new notifications.</p>
                  <p className="text-[10px] text-slate-400">Alerts on newly assigned reviews and committee queries will appear here.</p>
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

      {/* MODAL 1: EVALUATION DETAILS MODAL */}
      <AnimatePresence>
        {selectedEval && (
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
                    <HiBeaker className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{selectedEval.category}</h3>
                    <p className="text-xs font-mono font-bold text-violet-700">{selectedEval.evaluation_ref}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEval(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Department</p>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedEval.department_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Procurement Ref</p>
                    <p className="font-bold font-mono text-slate-800 mt-0.5">{selectedEval.procurement_ref}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Specialization</p>
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-100">
                      {selectedEval.specialization_category}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Status</p>
                    <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(selectedEval.status)}`}>
                      {selectedEval.status}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Vendor / Sourcing Scope</p>
                  <p className="font-extrabold text-slate-900 text-sm">{selectedEval.vendor_name}</p>
                  {selectedEval.total_amount && (
                    <p className="text-[11px] text-slate-500 font-medium">
                      Estimated Valuation: <strong>{formatCurrency(selectedEval.total_amount)}</strong>
                    </p>
                  )}
                </div>

                {selectedEval.justification && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Technical Specifications &amp; Requirements</p>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {selectedEval.justification}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setSelectedEval(null)}
                  className="border-slate-200 text-slate-700"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: OFFICER PROFILE MODAL */}
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
                    {officerName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">{officerName}</h3>
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
                    <span className="font-bold text-violet-900">Technical Inspection Authority</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white text-violet-700 font-bold text-[11px] border border-violet-200">
                    Technical Officer
                  </span>
                </div>

                {/* Specializations */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
                  <p className="font-bold text-slate-800 border-b border-slate-200/80 pb-1 flex items-center gap-1.5">
                    <HiTag className="w-3.5 h-3.5 text-violet-500" />
                    <span>Evaluation Areas / Specializations</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {specializationsList.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-xl bg-violet-100 text-violet-800 font-bold text-[11px]">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Personal Details */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
                  <p className="font-bold text-slate-800 border-b border-slate-200/80 pb-1 flex items-center gap-1.5">
                    <HiUser className="w-3.5 h-3.5 text-violet-500" />
                    <span>Officer Information</span>
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
    </TechnicalOfficerLayout>
  );
};

export default TechnicalOfficerDashboardPage;
