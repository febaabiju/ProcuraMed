import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import Button from '../../components/common/Button';
import {
  HiHome,
  HiClipboardCheck,
  HiClock,
  HiCheckCircle,
  HiRefresh,
  HiInformationCircle,
  HiShieldCheck,
  HiUserGroup,
  HiShoppingBag,
  HiOutlineSparkles,
  HiDocumentText,
  HiArchive,
  HiTag,
  HiArrowRight,
  HiExternalLink,
  HiBell
} from 'react-icons/hi';

const ProcurementCommitteeDashboardPage = () => {
  const [data, setData] = useState({
    user: null,
    stats: {
      my_assigned_requests: 0,
      approved_cases: 0,
      active_sourcing: 0,
      completed_purchases: 0,
      total_assigned: 0,
      workload_overview: []
    },
    pipeline: {},
    pending_reviews: [],
    approved_requests: [],
    decision_history: [],
    notifications: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/committee-dashboard/');
      setData({
        user: res.data.user || null,
        stats: {
          my_assigned_requests: res.data.stats?.my_assigned_requests ?? res.data.pending_reviews?.length ?? 0,
          approved_cases: res.data.stats?.approved_cases ?? 0,
          active_sourcing: res.data.stats?.active_sourcing ?? 0,
          completed_purchases: res.data.stats?.completed_purchases ?? 0,
          total_assigned: res.data.stats?.total_assigned ?? 0,
          workload_overview: res.data.stats?.workload_overview || []
        },
        pipeline: res.data.pipeline || {},
        pending_reviews: res.data.pending_reviews || [],
        approved_requests: res.data.approved_requests || [],
        decision_history: res.data.decision_history || [],
        notifications: res.data.notifications || []
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load procurement committee dashboard information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const memberName = data.user?.full_name || data.user?.first_name || 'Committee Member';
  const employeeId = data.user?.employee_id || 'PC101';

  // Derived counts for stage metrics
  const totalAssigned = data.stats.total_assigned || (data.assigned_requests?.length ?? ((data.pending_reviews?.length ?? 0) + (data.approved_requests?.length ?? 0)));
  const newlyAssignedCount = data.stats.newly_assigned ?? (data.pending_reviews?.length ?? 0);
  const vendorSourcingCount = data.stats.vendor_sourcing ?? (data.approved_requests || []).filter((r) => r.status === 'APPROVED').length;
  const awaitingQuotesCount = data.stats.awaiting_quotations ?? (data.approved_requests || []).filter((r) => r.status === 'RFQ_ISSUED').length;
  const completedCount = data.stats.completed_purchases ?? (data.approved_requests || []).filter((r) => r.status === 'COMPLETED').length;

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || amount === '') return '₹0.00';
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Stage-wise process navigation items
  const stageNavigation = [
    {
      title: 'My Assigned Requests',
      path: '/committee/reviews',
      count: totalAssigned,
      badgeText: `${totalAssigned} Total Assigned`,
      badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
      icon: HiClipboardCheck,
      iconColor: 'text-violet-600 bg-violet-50',
      description:
        'All purchase-ready requisitions assigned directly to your queue. Inspect specifications, technical assessments, source vendors, and progress requests through all stages until closure.'
    },
    {
      title: 'Approved & Sourcing',
      path: '/committee/approved',
      count: vendorSourcingCount,
      badgeText: `${vendorSourcingCount} Sourcing`,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: HiOutlineSparkles,
      iconColor: 'text-emerald-600 bg-emerald-50',
      description:
        'Approved hospital requisitions in active supplier sourcing. Match registered vendors by category, review catalogues, and prepare RFQs.'
    },
    {
      title: 'Sent RFQs',
      path: '/committee/rfqs',
      count: awaitingQuotesCount,
      badgeText: `${awaitingQuotesCount} Awaiting Quotes`,
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: HiDocumentText,
      iconColor: 'text-indigo-600 bg-indigo-50',
      description:
        'Formal Requests for Quotation issued to registered vendors. Track quotation deadlines, invited vendors, and quotation responses.'
    },
    {
      title: 'Committee Decisions',
      path: '/committee/decisions',
      count: data.decision_history?.length ?? 0,
      badgeText: `${data.decision_history?.length ?? 0} Executed`,
      badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
      icon: HiCheckCircle,
      iconColor: 'text-violet-600 bg-violet-50',
      description:
        'Review and execute formal committee decisions. Sanction purchase requests, return requests for specification clarification, or defer.'
    },
    {
      title: 'Completed Procurements',
      path: '/committee/history',
      count: completedCount,
      badgeText: `${completedCount} Completed`,
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: HiArchive,
      iconColor: 'text-slate-600 bg-slate-100',
      description:
        'Historical repository of completed procurement cycles, finalized purchase orders, and complete committee decision audit trail.'
    }
  ];

  return (
    <ProcurementCommitteeLayout
      title="Procurement Committee Portal"
      subtitle={`Equal Workload Allocation • Employee ID: ${employeeId}`}
      committeeUser={data.user}
      onRefresh={fetchDashboardData}
    >
      <div className="space-y-7 max-w-7xl mx-auto">
        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError('')}
              className="text-rose-500 hover:text-rose-700 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 1. Header Hero Card with Assigned Status */}
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-violet-500/30 text-violet-200 border border-violet-400/30 flex items-center gap-1.5">
                  <HiUserGroup className="w-3.5 h-3.5" />
                  Procurement Committee Member
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5">
                  <HiCheckCircle className="w-3.5 h-3.5" />
                  ID: {employeeId}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Welcome back, {memberName}
              </h2>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                Hospital procurement requests are distributed equally across all 5 committee members.
                Use the stage-wise process navigation below to inspect detailed specifications and take action for each stage.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={fetchDashboardData}
                disabled={loading}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold gap-2 backdrop-blur-xs"
              >
                <HiRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Counts</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Key Summary Count Metrics Row (KPIs) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Total Assigned
              </span>
              <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                <HiShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{totalAssigned}</h3>
              <p className="text-[10px] text-violet-600 font-semibold mt-0.5">
                Total in your pipeline
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Pending Review
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <HiClipboardCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-amber-600">{newlyAssignedCount}</h3>
              <p className="text-[10px] text-amber-700 font-semibold mt-0.5">
                Awaiting initial action
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Approved & Sourcing
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <HiOutlineSparkles className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-emerald-600">{vendorSourcingCount}</h3>
              <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                Ready for vendor RFQ
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Sent RFQs
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <HiDocumentText className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-indigo-600">{awaitingQuotesCount}</h3>
              <p className="text-[10px] text-indigo-700 font-semibold mt-0.5">
                Vendor quotations pending
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-2 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Completed
              </span>
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <HiArchive className="w-4 h-4" />
              </div>
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-800">{completedCount}</h3>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Finished procurement cycles
              </p>
            </div>
          </div>
        </div>

        {/* 3. Stage-Wise Process Navigation (Separating Dashboard Summary from Stage Details) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <HiShoppingBag className="w-5 h-5 text-violet-600" />
                Procurement Committee Process Stages
              </h3>
              <p className="text-xs text-slate-500">
                Select any stage below to inspect detailed purchase requests, evaluate specifications, and take action.
              </p>
            </div>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              Sidebar & Dashboard Separation Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stageNavigation.map((stage) => {
              const Icon = stage.icon;
              return (
                <div
                  key={stage.path}
                  className="bg-white rounded-3xl border border-violet-100 p-5 shadow-xs hover:border-violet-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${stage.iconColor}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${stage.badgeColor}`}>
                        {stage.badgeText}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-extrabold text-slate-900 group-hover:text-violet-700 transition-colors">
                        {stage.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {stage.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800">
                      {stage.count} Item{stage.count !== 1 ? 's' : ''}
                    </span>
                    <Link
                      to={stage.path}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-50 text-violet-700 hover:bg-violet-600 hover:text-white transition-all shadow-2xs"
                    >
                      <span>Open Stage</span>
                      <HiArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4. Workload Balance Indicator (Showing 5 Committee Members) */}
        {data.stats.workload_overview && data.stats.workload_overview.length > 0 && (
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-violet-100 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <HiUserGroup className="w-4 h-4 text-violet-600" />
                  Procurement Committee Workload Distribution
                </h4>
                <p className="text-xs text-slate-500">
                  Hospital purchase requests are balanced evenly across the 5 committee members.
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200">
                Balanced Allocation Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
              {data.stats.workload_overview.map((m) => {
                const isCurrent = m.is_current_user || m.username === data.user?.username;
                return (
                  <div
                    key={m.id}
                    className={`p-3.5 rounded-2xl border text-xs transition-all ${
                      isCurrent
                        ? 'bg-violet-50/80 border-violet-300 ring-2 ring-violet-500/20 shadow-xs'
                        : 'bg-slate-50 border-slate-200/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-slate-500">
                        {m.employee_id}
                      </span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-violet-600 text-white">
                          You
                        </span>
                      )}
                    </div>
                    <p className="font-bold text-slate-800 mt-1 truncate">{m.name}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 text-[11px]">
                      <span className="text-slate-500">Active Queue:</span>
                      <strong className={isCurrent ? 'text-violet-700' : 'text-slate-800'}>
                        {m.active_workload} request{m.active_workload !== 1 ? 's' : ''}
                      </strong>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Recent Activity and Notification Log (Summary Only) */}
        {data.notifications && data.notifications.length > 0 && (
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-violet-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <HiBell className="w-5 h-5 text-violet-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Recent Committee Activity & Audit Trail
                </h4>
              </div>
              <Link
                to="/committee/notifications"
                className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1"
              >
                <span>View All Notifications</span>
                <HiArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {data.notifications.slice(0, 5).map((n) => (
                <div key={n.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 block">{n.action}</span>
                    <p className="text-slate-500 line-clamp-1">{n.description}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                    {formatDate(n.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProcurementCommitteeLayout>
  );
};

export default ProcurementCommitteeDashboardPage;
