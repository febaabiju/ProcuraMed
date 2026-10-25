import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import Button from '../../components/common/Button';
import {
  HiHome,
  HiClipboardList,
  HiClipboardCheck,
  HiCheckCircle,
  HiRefresh,
  HiInformationCircle,
  HiShieldCheck,
  HiUserGroup,
  HiShoppingBag,
  HiArchive,
  HiBell,
  HiArrowRight
} from 'react-icons/hi';

const ProcurementCommitteeDashboardPage = () => {
  const [data, setData] = useState({
    user: null,
    stats: {
      total_requests: 0,
      total_assigned: 0,
      under_review: 0,
      pending_committee_reviews: 0,
      approved_cases: 0,
      completed_purchases: 0
    },
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
          total_requests: res.data.stats?.total_assigned ?? res.data.stats?.total_requests ?? 0,
          total_assigned: res.data.stats?.total_assigned ?? 0,
          under_review: res.data.stats?.under_review ?? res.data.stats?.pending_committee_reviews ?? 0,
          pending_committee_reviews: res.data.stats?.pending_committee_reviews ?? 0,
          approved_cases: res.data.stats?.approved_cases ?? 0,
          completed_purchases: res.data.stats?.completed_purchases ?? 0
        },
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
  const employeeId = data.user?.employee_id || 'PC-BOARD';

  const totalReqs = data.stats.total_requests || data.stats.total_assigned || 0;
  const underReview = data.stats.under_review || data.stats.pending_committee_reviews || 0;
  const approvedCases = data.stats.approved_cases || 0;
  const completedPurchases = data.stats.completed_purchases || 0;

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

  return (
    <ProcurementCommitteeLayout
      title="Procurement Committee Dashboard"
      subtitle="Sample summary overview for hospital procurement committee members."
      committeeUser={data.user}
      onRefresh={fetchDashboardData}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
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

        {/* 1. Clean Welcome Section */}
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-violet-500/30 text-violet-200 border border-violet-400/30 flex items-center gap-1.5">
                  <HiUserGroup className="w-3.5 h-3.5" />
                  Procurement Committee
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
                Hospital Procurement Committee governance and advisory overview. Monitor high-level procurement metrics and review hospital notices.
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
                <span>Refresh Overview</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Sample Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Assigned Requests */}
          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Assigned Requests
              </span>
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                <HiShoppingBag className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-900">{totalReqs}</h3>
              <p className="text-xs text-violet-600 font-semibold mt-1">
                Your assigned purchase cases
              </p>
            </div>
          </div>

          {/* Card 2: Under Review */}
          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Under Review
              </span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <HiClipboardCheck className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-amber-600">{underReview}</h3>
              <p className="text-xs text-amber-700 font-semibold mt-1">
                Awaiting committee review
              </p>
            </div>
          </div>

          {/* Card 3: Approved */}
          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Approved Cases
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <HiCheckCircle className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-emerald-600">{approvedCases}</h3>
              <p className="text-xs text-emerald-700 font-semibold mt-1">
                Sanctioned procurements
              </p>
            </div>
          </div>

          {/* Card 4: Completed */}
          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Completed
              </span>
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <HiArchive className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="text-3xl font-black text-slate-800">{completedPurchases}</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Fulfilled procurement cycles
              </p>
            </div>
          </div>
        </div>

        {/* 3. Sample Committee Governance & Advisory Card */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl border border-violet-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
              <HiShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Procurement Committee Governance Overview
              </h3>
              <p className="text-xs text-slate-500">
                Sample advisory dashboard interface
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            The Procurement Committee provides institutional oversight and financial governance for ProcuraMed's healthcare procurement pipeline.
            This simplified portal displays sample metrics and high-level summaries for committee reference.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              to="/committee/purchase-requests"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 shadow-xs transition-colors"
            >
              <HiClipboardList className="w-4 h-4" />
              <span>View Purchase Requests</span>
            </Link>
            <Link
              to="/committee/notifications"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
            >
              <HiBell className="w-4 h-4" />
              <span>View Notifications</span>
            </Link>
            <Link
              to="/committee/profile"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
            >
              <span>My Profile</span>
            </Link>
          </div>
        </div>

        {/* 4. Recent Notifications Summary */}
        {data.notifications && data.notifications.length > 0 && (
          <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <HiBell className="w-4 h-4 text-violet-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Recent Committee Activity
                </h4>
              </div>
              <Link
                to="/committee/notifications"
                className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1"
              >
                <span>View All</span>
                <HiArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {data.notifications.slice(0, 4).map((n) => (
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
