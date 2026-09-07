import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import DepartmentStaffLayout from '../../components/layout/DepartmentStaffLayout';
import Button from '../../components/common/Button';
import {
  HiClipboardList,
  HiDocumentText,
  HiClock,
  HiSearch,
  HiCheckCircle,
  HiBadgeCheck,
  HiPlus,
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
  HiTag
} from 'react-icons/hi';

const DepartmentStaffDashboardPage = () => {
  const [data, setData] = useState({
    user: null,
    stats: {
      total_requests: 0,
      draft_requests: 0,
      pending_requests: 0,
      under_review_requests: 0,
      approved_requests: 0,
      completed_requests: 0
    },
    pipeline: {
      submitted: 0,
      under_review: 0,
      procurement: 0,
      approved: 0,
      completed: 0
    },
    recent_requests: [],
    notifications: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const fetchStaffDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/staff-dashboard/');
      setData({
        user: res.data.user || null,
        stats: {
          total_requests: res.data.stats?.total_requests ?? 0,
          draft_requests: res.data.stats?.draft_requests ?? 0,
          pending_requests: res.data.stats?.pending_requests ?? 0,
          under_review_requests: res.data.stats?.under_review_requests ?? 0,
          approved_requests: res.data.stats?.approved_requests ?? 0,
          completed_requests: res.data.stats?.completed_requests ?? 0
        },
        pipeline: res.data.pipeline || {
          submitted: 0,
          under_review: 0,
          procurement: 0,
          approved: 0,
          completed: 0
        },
        recent_requests: res.data.recent_requests || [],
        notifications: res.data.notifications || []
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load department staff dashboard information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffDashboardData();
  }, []);

  const staffName = data.user?.full_name || data.user?.first_name || 'Staff Member';
  const departmentName = data.user?.department_name || 'Hospital Department';
  const employeeId = data.user?.employee_id || 'DS-PENDING';

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
      case 'COMPLETED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'RFQ_ISSUED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'PENDING_APPROVAL':
      case 'UNDER_REVIEW':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'DRAFT':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getReadableStatus = (status) => {
    switch (status) {
      case 'PENDING_APPROVAL': return 'Pending Approval';
      case 'RFQ_ISSUED': return 'Procurement in Progress';
      case 'UNDER_REVIEW': return 'Under Review';
      case 'APPROVED': return 'Approved';
      case 'COMPLETED': return 'Completed';
      case 'REJECTED': return 'Rejected';
      case 'CANCELLED': return 'Cancelled';
      case 'DRAFT': return 'Draft';
      default: return status || 'Unknown';
    }
  };

  return (
    <DepartmentStaffLayout
      title="Department Staff Dashboard"
      subtitle="Create and monitor your department's purchase requests and track their progress through the procurement process."
      staffUser={data.user}
      onRefresh={fetchStaffDashboardData}
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
          {/* Glowing gradient background effects */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 -mb-16 w-48 h-48 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold text-violet-200">
                <HiOfficeBuilding className="w-3.5 h-3.5 text-violet-300" />
                <span>Department: <strong className="text-white">{departmentName}</strong></span>
                <span className="text-violet-300">•</span>
                <span className="font-mono text-white">ID: {employeeId}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Welcome, {staffName}
              </h1>
              <p className="text-xs sm:text-sm text-violet-200 leading-relaxed font-medium">
                Create and monitor your department's purchase requests and track their progress through the procurement process.
              </p>
            </div>

            {/* Quick Actions in Banner */}
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/staff/create-request">
                <Button
                  variant="primary"
                  size="md"
                  className="bg-white text-violet-900 hover:bg-violet-50 font-bold text-xs gap-1.5 shadow-lg shadow-black/10 border-0"
                >
                  <HiPlus className="w-4 h-4 text-violet-700" />
                  <span>+ Create Purchase Request</span>
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

        {/* 2. Procurement Summary Cards (6 Cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {[
            {
              title: 'Total Requests',
              value: data.stats.total_requests,
              desc: 'All purchase requests',
              icon: HiClipboardList,
              bgLight: 'bg-violet-50',
              textColor: 'text-violet-700',
              borderColor: 'border-violet-100',
              link: '/staff/requests'
            },
            {
              title: 'Draft Requests',
              value: data.stats.draft_requests,
              desc: 'Saved as draft',
              icon: HiDocumentText,
              bgLight: 'bg-slate-100',
              textColor: 'text-slate-700',
              borderColor: 'border-slate-200',
              link: '/staff/requests'
            },
            {
              title: 'Pending Requests',
              value: data.stats.pending_requests,
              desc: 'Waiting for approval',
              icon: HiClock,
              bgLight: 'bg-amber-50',
              textColor: 'text-amber-700',
              borderColor: 'border-amber-100',
              link: '/staff/requests'
            },
            {
              title: 'Under Review',
              value: data.stats.under_review_requests,
              desc: 'In evaluation stage',
              icon: HiSearch,
              bgLight: 'bg-indigo-50',
              textColor: 'text-indigo-700',
              borderColor: 'border-indigo-100',
              link: '/staff/requests'
            },
            {
              title: 'Approved Requests',
              value: data.stats.approved_requests,
              desc: 'Approved / RFQ stage',
              icon: HiCheckCircle,
              bgLight: 'bg-emerald-50',
              textColor: 'text-emerald-700',
              borderColor: 'border-emerald-100',
              link: '/staff/requests'
            },
            {
              title: 'Completed Requests',
              value: data.stats.completed_requests,
              desc: 'Fulfilled procurements',
              icon: HiBadgeCheck,
              bgLight: 'bg-teal-50',
              textColor: 'text-teal-700',
              borderColor: 'border-teal-100',
              link: '/staff/requests'
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

        {/* 3. Purchase Request Progress Section */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Purchase Request Progress
              </h2>
              <p className="text-[11px] text-slate-400">
                Track how your department's requests move through the hospital procurement lifecycle
              </p>
            </div>
            <span className="text-xs font-bold text-violet-700 px-3 py-1 bg-violet-50 rounded-xl border border-violet-100 self-start sm:self-auto">
              Department Workflow
            </span>
          </div>

          {/* Progress Pipeline Visualization */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
            {[
              {
                step: '1',
                title: 'Submitted',
                desc: 'Draft / Submitted',
                count: data.pipeline.submitted,
                color: 'violet',
                bg: 'bg-violet-50',
                border: 'border-violet-200',
                text: 'text-violet-700'
              },
              {
                step: '2',
                title: 'Under Review',
                desc: 'Awaiting Approvals',
                count: data.pipeline.under_review,
                color: 'amber',
                bg: 'bg-amber-50',
                border: 'border-amber-200',
                text: 'text-amber-700'
              },
              {
                step: '3',
                title: 'Procurement',
                desc: 'RFQ & Vendor Bidding',
                count: data.pipeline.procurement,
                color: 'indigo',
                bg: 'bg-indigo-50',
                border: 'border-indigo-200',
                text: 'text-indigo-700'
              },
              {
                step: '4',
                title: 'Approved',
                desc: 'Contract Awarded',
                count: data.pipeline.approved,
                color: 'emerald',
                bg: 'bg-emerald-50',
                border: 'border-emerald-200',
                text: 'text-emerald-700'
              },
              {
                step: '5',
                title: 'Completed',
                desc: 'Delivered & Fulfilled',
                count: data.pipeline.completed,
                color: 'teal',
                bg: 'bg-teal-50',
                border: 'border-teal-200',
                text: 'text-teal-700'
              }
            ].map((stage, sIdx) => (
              <div
                key={sIdx}
                className={`p-4 rounded-2xl border ${stage.border} ${stage.bg} relative overflow-hidden flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`w-6 h-6 rounded-lg bg-white ${stage.text} text-[11px] font-black flex items-center justify-center shadow-2xs border ${stage.border}`}>
                    {stage.step}
                  </span>
                  <span className={`text-lg font-black ${stage.text}`}>
                    {loading ? '...' : stage.count}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">{stage.title}</h4>
                  <p className="text-[10px] text-slate-500 truncate">{stage.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Split Main Section: Recent Purchase Requests & Recent Notifications */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Recent Purchase Requests */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs">
                    <HiClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      Recent Purchase Requests
                    </h2>
                    <p className="text-[11px] text-slate-400">Requisitions submitted by your account for {departmentName}</p>
                  </div>
                </div>
                <Link
                  to="/staff/requests"
                  className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  View All →
                </Link>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
                  <HiRefresh className="w-5 h-5 animate-spin text-violet-500" />
                  <span>Loading purchase requests...</span>
                </div>
              ) : data.recent_requests.length === 0 ? (
                <div className="p-10 text-center space-y-3 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <div className="w-12 h-12 rounded-2xl bg-violet-100/60 text-violet-600 flex items-center justify-center mx-auto">
                    <HiClipboardList className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800">
                      No purchase requests have been created yet.
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Click below to initiate your first purchase requisition for equipment, medicines, or departmental supplies.
                    </p>
                  </div>
                  <div className="pt-1">
                    <Link to="/staff/create-request">
                      <Button
                        variant="primary"
                        size="sm"
                        className="text-xs font-bold text-white shadow-md shadow-violet-500/20"
                        style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
                      >
                        <HiPlus className="w-3.5 h-3.5" />
                        <span>+ Create Purchase Request</span>
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Request Number</th>
                        <th className="px-4 py-3">Item / Requirement</th>
                        <th className="px-4 py-3">Request Date</th>
                        <th className="px-4 py-3">Est. Budget</th>
                        <th className="px-4 py-3">Priority</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {data.recent_requests.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-violet-700 whitespace-nowrap">
                            {req.req_number}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 max-w-[200px] truncate">
                            {req.title}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {formatDate(req.created_at)}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(req.estimated_budget)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityBadge(req.priority)}`}>
                              {req.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(req.status)}`}>
                              {getReadableStatus(req.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedRequest(req)}
                              className="text-[11px] font-bold text-violet-700 border-violet-200 hover:bg-violet-50 py-1 px-2.5"
                            >
                              <HiEye className="w-3.5 h-3.5" />
                              <span>View Details</span>
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

          {/* Right Column: Quick Action Card & Recent Notifications */}
          <div className="space-y-6">
            {/* Quick Action Widget */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-3.5">
              <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
                <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                  <HiPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Quick Actions</h3>
                  <p className="text-[10px] text-slate-400">Initiate procurement requests</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Need new medical equipment, laboratory reagents, surgical instruments, or maintenance parts for <strong>{departmentName}</strong>?
              </p>

              <Link to="/staff/create-request" className="block">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full justify-center text-xs font-bold text-white shadow-md shadow-violet-500/20 py-2.5"
                  style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
                >
                  <HiPlus className="w-4 h-4" />
                  <span>+ Create Purchase Request</span>
                </Button>
              </Link>
            </div>

            {/* Notifications Widget */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                    <HiBell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Recent Notifications</h3>
                    <p className="text-[10px] text-slate-400">Request status &amp; procurement updates</p>
                  </div>
                </div>
                <Link to="/staff/notifications" className="text-[11px] font-bold text-violet-600 hover:text-violet-800">
                  All →
                </Link>
              </div>

              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading notifications...</div>
              ) : data.notifications.length === 0 ? (
                <div className="p-6 text-center space-y-1.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiBell className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No new notifications.</p>
                  <p className="text-[10px] text-slate-400">
                    Updates on requisition reviews, committee approvals, and order completions will appear here.
                  </p>
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

      {/* MODAL 1: REQUEST DETAILS MODAL */}
      <AnimatePresence>
        {selectedRequest && (
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
                    <HiClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{selectedRequest.title}</h3>
                    <p className="text-xs font-mono font-bold text-violet-700">{selectedRequest.req_number}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Department</p>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedRequest.department_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Request Date</p>
                    <p className="font-bold text-slate-800 mt-0.5">{formatDate(selectedRequest.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Priority</p>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityBadge(selectedRequest.priority)}`}>
                      {selectedRequest.priority}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Current Status</p>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(selectedRequest.status)}`}>
                      {getReadableStatus(selectedRequest.status)}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Estimated Budget</p>
                  <p className="font-extrabold text-slate-900 text-sm">
                    {formatCurrency(selectedRequest.estimated_budget)}
                  </p>
                </div>

                {selectedRequest.justification && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Justification / Reason for Requirement</p>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {selectedRequest.justification}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setSelectedRequest(null)}
                  className="border-slate-200 text-slate-700"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: STAFF PROFILE MODAL */}
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
                    {staffName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">{staffName}</h3>
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
                {/* Department Badge */}
                <div className="p-3 bg-violet-50 rounded-2xl border border-violet-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HiOfficeBuilding className="w-4 h-4 text-violet-600" />
                    <span className="font-bold text-violet-900">Hospital Department</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white text-violet-700 font-bold text-[11px] border border-violet-200">
                    {departmentName}
                  </span>
                </div>

                {/* Personal & Contact Details */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
                  <p className="font-bold text-slate-800 border-b border-slate-200/80 pb-1 flex items-center gap-1.5">
                    <HiUser className="w-3.5 h-3.5 text-violet-500" />
                    <span>Personal Details</span>
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
    </DepartmentStaffLayout>
  );
};

export default DepartmentStaffDashboardPage;
