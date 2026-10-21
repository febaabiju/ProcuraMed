import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import RequisitionDetailModal from '../../components/committee/RequisitionDetailModal';
import VendorSourcingModal from '../../components/committee/VendorSourcingModal';
import Button from '../../components/common/Button';
import {
  HiClipboardCheck,
  HiClock,
  HiCheckCircle,
  HiUser,
  HiRefresh,
  HiInformationCircle,
  HiShieldCheck,
  HiEye,
  HiSearch,
  HiUserGroup,
  HiShoppingBag,
  HiOutlineSparkles,
  HiTag
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
    pending_reviews: [],
    approved_requests: [],
    notifications: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Requisition Detail Modal
  const [selectedReq, setSelectedReq] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Vendor Sourcing Modal
  const [sourcingReq, setSourcingReq] = useState(null);
  const [sourcingModalOpen, setSourcingModalOpen] = useState(false);

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
        pending_reviews: res.data.pending_reviews || [],
        approved_requests: res.data.approved_requests || [],
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

  const handleOpenDetail = (req) => {
    setSelectedReq(req);
    setDetailModalOpen(true);
  };

  const handleOpenSourcing = (req) => {
    setSourcingReq(req);
    setSourcingModalOpen(true);
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

  // Combine assigned purchase-ready requests
  const assignedRequests = [...data.pending_reviews, ...data.approved_requests];

  return (
    <ProcurementCommitteeLayout
      title={`Welcome back, ${memberName}`}
      subtitle={`Equal Workload Allocation • Employee ID: ${employeeId}`}
      committeeUser={data.user}
      onRefresh={fetchDashboardData}
    >
      <div className="space-y-7">
        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
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
                {memberName}
              </h2>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                Hospital procurement requests are distributed equally across all 5 committee members. Review your assigned purchase request and proceed to vendor sourcing.
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
                <span>Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Key Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                My Assigned Requests
              </p>
              <h3 className="text-2xl font-black text-slate-900">
                {assignedRequests.length}
              </h3>
              <p className="text-[11px] text-violet-600 font-semibold">
                Direct assignment to {employeeId}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <HiClipboardCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Purchase Ready
              </p>
              <h3 className="text-2xl font-black text-emerald-600">
                {data.pending_reviews.length}
              </h3>
              <p className="text-[11px] text-emerald-600 font-semibold">
                Verified & Ready for Sourcing
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <HiShoppingBag className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active Sourcing
              </p>
              <h3 className="text-2xl font-black text-indigo-600">
                {data.approved_requests.length}
              </h3>
              <p className="text-[11px] text-indigo-600 font-semibold">
                Vendor matching & quotes
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <HiOutlineSparkles className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Equal Committee Distribution
              </p>
              <h3 className="text-2xl font-black text-slate-900">
                5 Members
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Round-robin workload balancing
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <HiUserGroup className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* 3. Workload Balance Indicator (Showing 5 Committee Members) */}
        {data.stats.workload_overview && data.stats.workload_overview.length > 0 && (
          <div className="bg-white p-5 rounded-3xl border border-violet-100 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <HiUserGroup className="w-4 h-4 text-violet-600" />
                  Procurement Committee Workload Distribution
                </h4>
                <p className="text-xs text-slate-500">
                  Requests are balanced evenly across the 5 committee members.
                </p>
              </div>
              <span className="text-[11px] font-mono font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200">
                Balanced Allocation Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-1">
              {data.stats.workload_overview.map((m) => {
                const isCurrent = m.is_current_user || m.username === data.user?.username;
                return (
                  <div
                    key={m.id}
                    className={`p-3 rounded-2xl border text-xs transition-all ${
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
                    <p className="font-bold text-slate-800 mt-1 truncate">
                      {m.name}
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 text-[11px]">
                      <span className="text-slate-500">Active:</span>
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

        {/* 4. My Assigned Purchase Requests Section */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <HiShoppingBag className="w-5 h-5 text-violet-600" />
                My Assigned Purchase Requests
              </h3>
              <p className="text-xs text-slate-500">
                Purchase requests assigned exclusively to you for procurement sourcing.
              </p>
            </div>
            <span className="text-xs font-bold text-violet-700 bg-violet-50 px-3 py-1.5 rounded-xl border border-violet-200">
              {assignedRequests.length} Request{assignedRequests.length !== 1 ? 's' : ''} in Your Queue
            </span>
          </div>

          {loading ? (
            <div className="py-16 bg-white rounded-3xl border border-violet-100 flex flex-col items-center justify-center text-slate-400 gap-2">
              <HiRefresh className="w-8 h-8 animate-spin text-violet-600" />
              <p className="text-xs font-medium">Loading your assigned purchase requests...</p>
            </div>
          ) : assignedRequests.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 space-y-3">
              <HiClipboardCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">No Purchase Requests Currently Assigned</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                You have no pending requests in your queue. New verified requests will be assigned to you in round-robin sequence to maintain equal workload.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignedRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded-3xl border border-violet-100/80 p-5 sm:p-6 shadow-xs hover:border-violet-300 transition-all space-y-4"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-violet-100 text-violet-800 border border-violet-200">
                          {req.req_number}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityBadge(req.priority)}`}>
                          {req.priority} Priority
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <HiCheckCircle className="w-3 h-3 text-emerald-600" />
                          Purchase Ready
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Assigned to {employeeId}
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-slate-900 mt-1">
                        {req.title}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Department: <strong className="text-slate-800">{req.department_name}</strong> • Category: <strong className="text-slate-800">{req.category}</strong>
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 sm:self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetail(req)}
                        className="text-xs font-semibold gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
                      >
                        <HiEye className="w-4 h-4 text-slate-500" />
                        <span>View Details</span>
                      </Button>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenSourcing(req)}
                        className="text-xs font-bold gap-1.5 bg-violet-600 hover:bg-violet-700 text-white shadow-sm shadow-violet-500/20"
                      >
                        <HiSearch className="w-4 h-4" />
                        <span>Find Vendors</span>
                      </Button>
                    </div>
                  </div>

                  {/* Request Highlights Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Item / Quantity</span>
                      <strong className="text-slate-800 block truncate">{req.item_name}</strong>
                      <span className="text-[10px] text-slate-500">Total Qty: {req.quantity}</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Estimated Budget</span>
                      <strong className="text-violet-900 text-sm block">{formatCurrency(req.estimated_budget)}</strong>
                      <span className="text-[10px] text-slate-500">Hospital Sanction</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Required Date</span>
                      <strong className="text-slate-800 block">{formatDate(req.required_date)}</strong>
                      <span className="text-[10px] text-slate-500">Scheduled Delivery</span>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Technical Evaluation</span>
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                        <HiShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span className="truncate">{req.technical_evaluation_result || 'Technically Suitable'}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {req.technical_officer_name || 'Verified Suitable'}
                      </span>
                    </div>
                  </div>

                  {/* Footer Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 pt-1">
                    <span>
                      Submitted by <strong>{req.submitted_by_name}</strong> on {formatDate(req.submission_date)}
                    </span>
                    <span className="text-[11px] text-violet-600 font-semibold">
                      Click "Find Vendors" to match certified hospital suppliers for this requisition
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Requisition Details Modal */}
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
        />
      )}
    </ProcurementCommitteeLayout>
  );
};

export default ProcurementCommitteeDashboardPage;
