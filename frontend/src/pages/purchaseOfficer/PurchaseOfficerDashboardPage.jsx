import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import PurchaseOfficerLayout from '../../components/layout/PurchaseOfficerLayout';
import Button from '../../components/common/Button';
import {
  HiClipboardList,
  HiTag,
  HiDocumentText,
  HiShoppingBag,
  HiTruck,
  HiUserGroup,
  HiCheckCircle,
  HiBadgeCheck,
  HiClock,
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
  HiArrowRight
} from 'react-icons/hi';

const PurchaseOfficerDashboardPage = () => {
  const [data, setData] = useState({
    user: null,
    stats: {
      pending_requisitions: 0,
      requisitions_under_processing: 0,
      quotation_requests: 0,
      quotations_received: 0,
      pending_committee_review: 0,
      approved_purchase_orders: 0,
      pending_deliveries: 0,
      completed_procurement: 0
    },
    pipeline: {
      requisition_received: 0,
      under_procurement: 0,
      quotations: 0,
      technical_evaluation: 0,
      committee_review: 0,
      purchase_order: 0,
      delivery: 0,
      completed: 0
    },
    pending_requisitions: [],
    recent_quotations: [],
    committee_cases: [],
    recent_purchase_orders: [],
    active_deliveries: [],
    notifications: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [selectedReq, setSelectedReq] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const fetchPODashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/purchase-officer-dashboard/');
      setData({
        user: res.data.user || null,
        stats: {
          pending_requisitions: res.data.stats?.pending_requisitions ?? 0,
          requisitions_under_processing: res.data.stats?.requisitions_under_processing ?? 0,
          quotation_requests: res.data.stats?.quotation_requests ?? 0,
          quotations_received: res.data.stats?.quotations_received ?? 0,
          pending_committee_review: res.data.stats?.pending_committee_review ?? 0,
          approved_purchase_orders: res.data.stats?.approved_purchase_orders ?? 0,
          pending_deliveries: res.data.stats?.pending_deliveries ?? 0,
          completed_procurement: res.data.stats?.completed_procurement ?? 0
        },
        pipeline: res.data.pipeline || {
          requisition_received: 0,
          under_procurement: 0,
          quotations: 0,
          technical_evaluation: 0,
          committee_review: 0,
          purchase_order: 0,
          delivery: 0,
          completed: 0
        },
        pending_requisitions: res.data.pending_requisitions || [],
        recent_quotations: res.data.recent_quotations || [],
        committee_cases: res.data.committee_cases || [],
        recent_purchase_orders: res.data.recent_purchase_orders || [],
        active_deliveries: res.data.active_deliveries || [],
        notifications: res.data.notifications || []
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load purchase officer dashboard information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPODashboardData();
  }, []);

  const officerName = data.user?.full_name || data.user?.first_name || 'Purchase Officer';
  const employeeId = data.user?.employee_id || 'PO101';

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
      case 'ACCEPTED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'RFQ_ISSUED':
      case 'OPEN':
      case 'ISSUED':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'PENDING_APPROVAL':
      case 'UNDER_REVIEW':
      case 'SUBMITTED':
      case 'UNDER COMMITTEE REVIEW':
      case 'AWAITING COMMITTEE REVIEW':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'DRAFT':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <PurchaseOfficerLayout
      title="Purchase Officer Dashboard"
      subtitle="Manage purchase requisitions, coordinate procurement activities, evaluate quotations, and monitor purchase orders."
      officerUser={data.user}
      onRefresh={fetchPODashboardData}
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
          <div className="absolute bottom-0 right-1/4 -mb-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="inline-flex flex-wrap items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold text-violet-200">
                <HiBadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Hospital Procurement Officer</span>
                <span className="text-violet-300">•</span>
                <span className="font-mono text-white">ID: {employeeId}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Welcome, {officerName}
              </h1>
              <p className="text-xs sm:text-sm text-violet-200 leading-relaxed font-medium">
                Manage purchase requisitions, coordinate procurement activities, evaluate quotations, and monitor purchase orders from one centralized procurement workspace.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/purchase-officer/opportunities">
                <Button
                  variant="primary"
                  size="md"
                  className="bg-white text-violet-900 hover:bg-violet-50 font-bold text-xs gap-1.5 shadow-lg shadow-black/10 border-0"
                >
                  <HiTag className="w-4 h-4 text-violet-700" />
                  <span>Procurement Opportunities</span>
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

        {/* 2. Procurement Summary Cards (8 Cards in Responsive Grid) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3.5 sm:gap-3">
          {[
            {
              title: 'Pending Requisitions',
              value: data.stats.pending_requisitions,
              desc: 'Awaiting PO review',
              icon: HiClipboardList,
              bgLight: 'bg-amber-50',
              textColor: 'text-amber-700',
              borderColor: 'border-amber-100',
              link: '/purchase-officer/requisitions'
            },
            {
              title: 'Under Processing',
              value: data.stats.requisitions_under_processing,
              desc: 'Being processed',
              icon: HiClock,
              bgLight: 'bg-violet-50',
              textColor: 'text-violet-700',
              borderColor: 'border-violet-100',
              link: '/purchase-officer/requisitions'
            },
            {
              title: 'Quotation Requests',
              value: data.stats.quotation_requests,
              desc: 'Active RFQs',
              icon: HiTag,
              bgLight: 'bg-sky-50',
              textColor: 'text-sky-700',
              borderColor: 'border-sky-100',
              link: '/purchase-officer/opportunities'
            },
            {
              title: 'Quotes Received',
              value: data.stats.quotations_received,
              desc: 'Awaiting evaluation',
              icon: HiDocumentText,
              bgLight: 'bg-purple-50',
              textColor: 'text-purple-700',
              borderColor: 'border-purple-100',
              link: '/purchase-officer/quotations'
            },
            {
              title: 'Committee Review',
              value: data.stats.pending_committee_review,
              desc: 'Pending decision',
              icon: HiUserGroup,
              bgLight: 'bg-indigo-50',
              textColor: 'text-indigo-700',
              borderColor: 'border-indigo-100',
              link: '/purchase-officer/requisitions'
            },
            {
              title: 'Approved POs',
              value: data.stats.approved_purchase_orders,
              desc: 'Issued purchase orders',
              icon: HiShoppingBag,
              bgLight: 'bg-emerald-50',
              textColor: 'text-emerald-700',
              borderColor: 'border-emerald-100',
              link: '/purchase-officer/purchase-orders'
            },
            {
              title: 'Pending Deliveries',
              value: data.stats.pending_deliveries,
              desc: 'Dispatched / In transit',
              icon: HiTruck,
              bgLight: 'bg-cyan-50',
              textColor: 'text-cyan-700',
              borderColor: 'border-cyan-100',
              link: '/purchase-officer/deliveries'
            },
            {
              title: 'Completed Orders',
              value: data.stats.completed_procurement,
              desc: 'Fulfilled cases',
              icon: HiBadgeCheck,
              bgLight: 'bg-teal-50',
              textColor: 'text-teal-700',
              borderColor: 'border-teal-100',
              link: '/purchase-officer/purchase-orders'
            }
          ].map((card, idx) => {
            const Icon = card.icon;
            return (
              <Link
                key={idx}
                to={card.link}
                className={`p-3.5 bg-white rounded-3xl border ${card.borderColor} shadow-sm hover:shadow-md transition-all group flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 leading-tight truncate">
                    {card.title}
                  </span>
                  <div className={`w-7 h-7 rounded-xl ${card.bgLight} ${card.textColor} flex items-center justify-center flex-shrink-0 font-bold group-hover:scale-105 transition-transform`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div>
                  <div className="text-xl font-black text-slate-900 tracking-tight">
                    {loading ? (
                      <span className="text-slate-300 animate-pulse text-base">...</span>
                    ) : (
                      card.value
                    )}
                  </div>
                  <p className="text-[9px] text-slate-400 mt-0.5 truncate">{card.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 3. Procurement Workflow Overview (8 Pipeline Stages) */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                Procurement Workflow Overview
              </h2>
              <p className="text-[11px] text-slate-400">
                Hospital Procurement Pipeline — From Requisition Receipt to Order Completion
              </p>
            </div>
            <span className="text-xs font-bold text-violet-700 px-3 py-1 bg-violet-50 rounded-xl border border-violet-100 self-start sm:self-auto">
              Procurement Lifecycle
            </span>
          </div>

          {/* 8 Workflow Stages Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-1">
            {[
              { step: '1', title: 'Requisition Received', desc: 'Department Requests', count: data.pipeline.requisition_received, text: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
              { step: '2', title: 'Under Procurement', desc: 'Sourcing Scope', count: data.pipeline.under_procurement, text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
              { step: '3', title: 'Quotations', desc: 'RFQs Published', count: data.pipeline.quotations, text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
              { step: '4', title: 'Tech Evaluation', desc: 'Specs Review', count: data.pipeline.technical_evaluation, text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
              { step: '5', title: 'Committee Review', desc: 'Approval Board', count: data.pipeline.committee_review, text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
              { step: '6', title: 'Purchase Order', desc: 'Contracts Issued', count: data.pipeline.purchase_order, text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { step: '7', title: 'Delivery', desc: 'Dispatched Goods', count: data.pipeline.delivery, text: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
              { step: '8', title: 'Completed', desc: 'Procurements Closed', count: data.pipeline.completed, text: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
            ].map((stage, sIdx) => (
              <div
                key={sIdx}
                className={`p-3 rounded-2xl border ${stage.border} ${stage.bg} flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`w-5 h-5 rounded-md bg-white ${stage.text} text-[10px] font-black flex items-center justify-center shadow-2xs border ${stage.border}`}>
                    {stage.step}
                  </span>
                  <span className={`text-base font-black ${stage.text}`}>
                    {loading ? '...' : stage.count}
                  </span>
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-slate-800 leading-tight truncate">{stage.title}</h4>
                  <p className="text-[9px] text-slate-500 truncate">{stage.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Main Content: Pending Requisitions & Committee Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Pending Requisitions & Recent Quotations */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section A: Pending Purchase Requisitions */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                    <HiClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      Pending Purchase Requisitions
                    </h2>
                    <p className="text-[11px] text-slate-400">Department requests awaiting Purchase Officer review and sourcing</p>
                  </div>
                </div>
                <Link
                  to="/purchase-officer/requisitions"
                  className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  View All →
                </Link>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
                  <HiRefresh className="w-5 h-5 animate-spin text-violet-500" />
                  <span>Loading requisitions...</span>
                </div>
              ) : data.pending_requisitions.length === 0 ? (
                <div className="p-8 text-center space-y-2 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-700">No pending purchase requisitions</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    When hospital department staff submit new purchase requisitions, they will appear here for procurement processing.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Req Number</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Requirement</th>
                        <th className="px-4 py-3">Requested By</th>
                        <th className="px-4 py-3">Priority</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {data.pending_requisitions.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-violet-700 whitespace-nowrap">
                            {req.req_number}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-bold text-slate-900">{req.department_name}</span>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-800 max-w-[180px] truncate">
                            {req.title}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {req.requested_by_name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityBadge(req.priority)}`}>
                              {req.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(req.status)}`}>
                              {req.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedReq(req)}
                              className="text-[11px] font-bold text-violet-700 border-violet-200 hover:bg-violet-50 py-1 px-2.5"
                            >
                              <HiEye className="w-3.5 h-3.5" />
                              <span>Review</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section B: Recent Quotations */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                    <HiDocumentText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      Recent Quotations
                    </h2>
                    <p className="text-[11px] text-slate-400">Supplier bids received for active procurement RFQs</p>
                  </div>
                </div>
                <Link
                  to="/purchase-officer/quotations"
                  className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  View All →
                </Link>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">Loading quotations...</div>
              ) : data.recent_quotations.length === 0 ? (
                <div className="p-8 text-center space-y-2 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiDocumentText className="w-8 h-8 text-slate-300 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-700">No quotations received</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    When vendors submit price bids against open RFQs, they will be listed here for technical and commercial evaluation.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Quotation Ref</th>
                        <th className="px-4 py-3">Procurement Ref</th>
                        <th className="px-4 py-3">Vendor</th>
                        <th className="px-4 py-3">Submission Date</th>
                        <th className="px-4 py-3">Quotation Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {data.recent_quotations.map((q) => (
                        <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {q.quotation_number}
                          </td>
                          <td className="px-4 py-3 font-mono text-violet-700 whitespace-nowrap">
                            {q.rfq_number}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 max-w-[160px] truncate">
                            {q.vendor_name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {formatDate(q.submission_date)}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(q.total_amount)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(q.status)}`}>
                              {q.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedQuote(q)}
                              className="text-[11px] font-bold text-violet-700 border-violet-200 hover:bg-violet-50 py-1 px-2.5"
                            >
                              <HiEye className="w-3.5 h-3.5" />
                              <span>Details</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section C: Recent Purchase Orders */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    <HiShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      Recent Purchase Orders
                    </h2>
                    <p className="text-[11px] text-slate-400">Official hospital purchase orders issued to approved vendors</p>
                  </div>
                </div>
                <Link
                  to="/purchase-officer/purchase-orders"
                  className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  View All →
                </Link>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">Loading purchase orders...</div>
              ) : data.recent_purchase_orders.length === 0 ? (
                <div className="p-8 text-center space-y-2 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiShoppingBag className="w-8 h-8 text-slate-300 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-700">No purchase orders available</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Approved purchase orders issued to suppliers will be tracked here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">PO Number</th>
                        <th className="px-4 py-3">Vendor</th>
                        <th className="px-4 py-3">Order Date</th>
                        <th className="px-4 py-3">Total Amount</th>
                        <th className="px-4 py-3">Expected Delivery</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {data.recent_purchase_orders.map((po) => (
                        <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-violet-700 whitespace-nowrap">
                            {po.po_number}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 max-w-[160px] truncate">
                            {po.vendor_name}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {formatDate(po.order_date)}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(po.total_amount)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {formatDate(po.expected_delivery_date)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(po.status)}`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPO(po)}
                              className="text-[11px] font-bold text-violet-700 border-violet-200 hover:bg-violet-50 py-1 px-2.5"
                            >
                              <HiEye className="w-3.5 h-3.5" />
                              <span>View Order</span>
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

          {/* Right Column: Committee Status, Active Deliveries, and Notifications */}
          <div className="space-y-6">
            {/* Widget 1: Procurement Committee Status */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                    <HiUserGroup className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Committee Review</h3>
                    <p className="text-[10px] text-slate-400">Cases under procurement committee decision</p>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading committee cases...</div>
              ) : data.committee_cases.length === 0 ? (
                <div className="p-6 text-center space-y-1.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiUserGroup className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No cases under committee review</p>
                  <p className="text-[10px] text-slate-400">Cases requiring committee quorum will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.committee_cases.map((cCase) => (
                    <div key={cCase.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-violet-700">{cCase.req_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(cCase.committee_status)}`}>
                          {cCase.committee_status}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 truncate">{cCase.title}</p>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{cCase.department_name}</span>
                        <span>{formatDate(cCase.submission_date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Widget 2: Active Deliveries Widget */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold text-xs">
                    <HiTruck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Active Deliveries</h3>
                    <p className="text-[10px] text-slate-400">Real-time shipment tracking</p>
                  </div>
                </div>
                <Link to="/purchase-officer/deliveries" className="text-[11px] font-bold text-violet-600 hover:text-violet-800">
                  Track →
                </Link>
              </div>

              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading deliveries...</div>
              ) : data.active_deliveries.length === 0 ? (
                <div className="p-6 text-center space-y-1.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiTruck className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No active deliveries</p>
                  <p className="text-[10px] text-slate-400">Dispatched supplier shipments will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.active_deliveries.map((del) => (
                    <div key={del.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-violet-700">{del.delivery_number}</span>
                        <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] font-bold uppercase">
                          {del.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-700">
                        <span className="font-bold truncate max-w-[130px]">{del.vendor_name}</span>
                        <span>Due: <strong>{formatDate(del.delivery_date)}</strong></span>
                      </div>
                      {del.tracking_number && (
                        <p className="text-[10px] text-slate-400 font-mono truncate">
                          Tracking: {del.tracking_number}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Widget 3: Recent Notifications Widget */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                    <HiBell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Recent Notifications</h3>
                    <p className="text-[10px] text-slate-400">Procurement activity log</p>
                  </div>
                </div>
                <Link to="/purchase-officer/notifications" className="text-[11px] font-bold text-violet-600 hover:text-violet-800">
                  All →
                </Link>
              </div>

              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading notifications...</div>
              ) : data.notifications.length === 0 ? (
                <div className="p-6 text-center space-y-1.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiBell className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No new notifications.</p>
                  <p className="text-[10px] text-slate-400">Events for new requisitions, RFQs, and awards will appear here.</p>
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

      {/* MODAL 1: REQUISITION DETAILS MODAL */}
      <AnimatePresence>
        {selectedReq && (
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
                    <h3 className="text-base font-extrabold text-slate-900">{selectedReq.title}</h3>
                    <p className="text-xs font-mono font-bold text-violet-700">{selectedReq.req_number}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedReq(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Requesting Department</p>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedReq.department_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Requested By</p>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedReq.requested_by_name}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Request Date</p>
                    <p className="font-bold text-slate-800 mt-0.5">{formatDate(selectedReq.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Priority</p>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityBadge(selectedReq.priority)}`}>
                      {selectedReq.priority}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Estimated Budget</p>
                  <p className="font-extrabold text-slate-900 text-sm">
                    {formatCurrency(selectedReq.estimated_budget)}
                  </p>
                </div>

                {selectedReq.justification && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Justification / Requirements</p>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {selectedReq.justification}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setSelectedReq(null)}
                  className="border-slate-200 text-slate-700"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: QUOTATION DETAILS MODAL */}
      <AnimatePresence>
        {selectedQuote && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    <HiDocumentText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Quotation Details</h3>
                    <p className="text-xs font-mono font-bold text-violet-700">{selectedQuote.quotation_number}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedQuote(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-slate-700">
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Vendor Supplier:</span>
                  <strong className="text-slate-900 font-bold">{selectedQuote.vendor_name} ({selectedQuote.vendor_code})</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Procurement Ref:</span>
                  <strong className="font-mono text-violet-700">{selectedQuote.rfq_number}</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Total Bidded Amount:</span>
                  <strong className="text-slate-900 font-bold text-sm">{formatCurrency(selectedQuote.total_amount)}</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Submission Date:</span>
                  <strong className="text-slate-800">{formatDate(selectedQuote.submission_date)}</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Evaluation Status:</span>
                  <strong className="text-violet-700 uppercase font-bold">{selectedQuote.status}</strong>
                </p>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button variant="outline" size="md" onClick={() => setSelectedQuote(null)} className="border-slate-200 text-slate-700">
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: PURCHASE ORDER DETAILS MODAL */}
      <AnimatePresence>
        {selectedPO && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <HiShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Purchase Order Details</h3>
                    <p className="text-xs font-mono font-bold text-violet-700">{selectedPO.po_number}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPO(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-slate-700">
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Awarded Vendor:</span>
                  <strong className="text-slate-900 font-bold">{selectedPO.vendor_name}</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Order Date:</span>
                  <strong className="text-slate-800">{formatDate(selectedPO.order_date)}</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Total Contract Value:</span>
                  <strong className="text-slate-900 font-bold text-sm">{formatCurrency(selectedPO.total_amount)}</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Expected Delivery:</span>
                  <strong className="text-emerald-700 font-bold">{formatDate(selectedPO.expected_delivery_date)}</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">PO Status:</span>
                  <strong className="text-emerald-700 uppercase font-bold">{selectedPO.status}</strong>
                </p>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button variant="outline" size="md" onClick={() => setSelectedPO(null)} className="border-slate-200 text-slate-700">
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: PURCHASE OFFICER PROFILE MODAL */}
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
                    <span className="font-bold text-violet-900">Hospital Procurement Workspace</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white text-violet-700 font-bold text-[11px] border border-violet-200">
                    Purchase Officer
                  </span>
                </div>

                {/* Personal & Employment Details */}
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
    </PurchaseOfficerLayout>
  );
};

export default PurchaseOfficerDashboardPage;
