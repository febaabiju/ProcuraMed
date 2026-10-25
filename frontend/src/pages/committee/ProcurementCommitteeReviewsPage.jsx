import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import RequisitionDetailModal from '../../components/committee/RequisitionDetailModal';
import VendorSourcingModal from '../../components/committee/VendorSourcingModal';
import RFQDetailModal from '../../components/committee/RFQDetailModal';
import {
  HiCheckCircle,
  HiEye,
  HiSearch,
  HiX,
  HiRefresh,
  HiShieldCheck,
  HiClipboardCheck,
  HiInformationCircle,
  HiShoppingBag,
  HiTag,
  HiOutlineSparkles,
  HiDocumentText,
  HiExternalLink,
  HiClock,
  HiUserGroup,
  HiCheck,
  HiFilter,
  HiArrowRight,
  HiExclamationCircle,
  HiArchive
} from 'react-icons/hi';

const ProcurementCommitteeReviewsPage = () => {
  const navigate = useNavigate();

  const [data, setData] = useState({
    user: null,
    assigned_requests: [],
    stats: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Active Stage Filter Tab
  // 'ACTIVE' (default: all active non-completed requests),
  // 'NEWLY_ASSIGNED', 'VENDOR_SOURCING', 'AWAITING_QUOTATIONS', 'QUOTATION_REVIEW', 'COMPLETED', 'ALL'
  const [stageTab, setStageTab] = useState('ACTIVE');

  // Action status sub-filter: 'ALL', 'ACTION_REQUIRED', 'IN_PROGRESS'
  const [actionFilter, setActionFilter] = useState('ALL');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modals State
  const [selectedReq, setSelectedReq] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Vendor Sourcing Modal State
  const [sourcingReq, setSourcingReq] = useState(null);
  const [sourcingModalOpen, setSourcingModalOpen] = useState(false);

  // RFQ Detail Modal State (for Tracking Quotations & Reviewing Quotes directly)
  const [selectedRFQ, setSelectedRFQ] = useState(null);
  const [rfqModalOpen, setRfqModalOpen] = useState(false);
  const [rfqLoading, setRfqLoading] = useState(false);

  const fetchAssignedRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/committee-dashboard/');
      // Load all assigned requests; fallback to pending + approved if needed
      const assigned = res.data.assigned_requests || [
        ...(res.data.pending_reviews || []),
        ...(res.data.approved_requests || [])
      ];
      setData({
        user: res.data.user || null,
        assigned_requests: assigned,
        stats: res.data.stats || {}
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load assigned procurement requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignedRequests();
  }, []);

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

  // Stage-based partitions
  const activeRequests = useMemo(() => {
    return data.assigned_requests.filter(
      (r) => r.is_active !== false && r.status !== 'COMPLETED' && r.status !== 'CANCELLED' && r.status !== 'REJECTED'
    );
  }, [data.assigned_requests]);

  const newlyAssignedRequests = useMemo(() => {
    return data.assigned_requests.filter(
      (r) => r.stage_key === 'NEWLY_ASSIGNED' || r.status === 'PENDING_COMMITTEE_REVIEW'
    );
  }, [data.assigned_requests]);

  const vendorSourcingRequests = useMemo(() => {
    return data.assigned_requests.filter(
      (r) => r.stage_key === 'VENDOR_SOURCING' || r.status === 'APPROVED'
    );
  }, [data.assigned_requests]);

  const awaitingQuotesRequests = useMemo(() => {
    return data.assigned_requests.filter(
      (r) => r.stage_key === 'AWAITING_QUOTATIONS' || r.status === 'RFQ_ISSUED'
    );
  }, [data.assigned_requests]);

  const quotationReviewRequests = useMemo(() => {
    return data.assigned_requests.filter(
      (r) => r.stage_key === 'QUOTATION_REVIEW' || r.status === 'QUOTATIONS_RECEIVED'
    );
  }, [data.assigned_requests]);

  const completedRequests = useMemo(() => {
    return data.assigned_requests.filter(
      (r) => r.stage_key === 'COMPLETED' || r.status === 'COMPLETED'
    );
  }, [data.assigned_requests]);

  const actionRequiredCount = useMemo(() => {
    return data.assigned_requests.filter(
      (r) => r.action_required || r.status === 'PENDING_COMMITTEE_REVIEW' || r.status === 'QUOTATIONS_RECEIVED'
    ).length;
  }, [data.assigned_requests]);

  // Distinct departments and categories
  const uniqueDepartments = useMemo(() => {
    const set = new Set();
    data.assigned_requests.forEach((r) => {
      if (r.department_name && r.department_name !== 'N/A') set.add(r.department_name);
    });
    return Array.from(set).sort();
  }, [data.assigned_requests]);

  const uniqueCategories = useMemo(() => {
    const set = new Set();
    data.assigned_requests.forEach((r) => {
      if (r.category && r.category !== 'N/A') set.add(r.category);
    });
    return Array.from(set).sort();
  }, [data.assigned_requests]);

  const totalEstimatedValue = useMemo(() => {
    return activeRequests.reduce((sum, r) => sum + Number(r.estimated_budget || 0), 0);
  }, [activeRequests]);

  // Stage Tab Navigation configuration
  const stageTabs = [
    {
      key: 'ACTIVE',
      label: 'All Active Assigned',
      count: activeRequests.length,
      badgeColor: 'bg-violet-100 text-violet-700'
    },
    {
      key: 'NEWLY_ASSIGNED',
      label: 'Newly Assigned',
      count: newlyAssignedRequests.length,
      badgeColor: 'bg-amber-100 text-amber-800'
    },
    {
      key: 'VENDOR_SOURCING',
      label: 'Vendor Sourcing',
      count: vendorSourcingRequests.length,
      badgeColor: 'bg-emerald-100 text-emerald-800'
    },
    {
      key: 'AWAITING_QUOTATIONS',
      label: 'Awaiting Quotations',
      count: awaitingQuotesRequests.length,
      badgeColor: 'bg-blue-100 text-blue-800'
    },
    {
      key: 'QUOTATION_REVIEW',
      label: 'Quotation Review',
      count: quotationReviewRequests.length,
      badgeColor: 'bg-purple-100 text-purple-800'
    },
    {
      key: 'COMPLETED',
      label: 'Completed / Closed',
      count: completedRequests.length,
      badgeColor: 'bg-slate-200 text-slate-700'
    },
    {
      key: 'ALL',
      label: 'All Assigned',
      count: data.assigned_requests.length,
      badgeColor: 'bg-slate-100 text-slate-600'
    }
  ];

  // Filter requests based on stage tab, action filter, search, and dropdowns
  const filteredRequests = useMemo(() => {
    return data.assigned_requests.filter((item) => {
      // 1. Stage Tab Filter
      if (stageTab === 'ACTIVE') {
        const isActive = item.is_active !== false && item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && item.status !== 'REJECTED';
        if (!isActive) return false;
      } else if (stageTab === 'NEWLY_ASSIGNED') {
        if (item.stage_key !== 'NEWLY_ASSIGNED' && item.status !== 'PENDING_COMMITTEE_REVIEW') return false;
      } else if (stageTab === 'VENDOR_SOURCING') {
        if (item.stage_key !== 'VENDOR_SOURCING' && item.status !== 'APPROVED') return false;
      } else if (stageTab === 'AWAITING_QUOTATIONS') {
        if (item.stage_key !== 'AWAITING_QUOTATIONS' && item.status !== 'RFQ_ISSUED') return false;
      } else if (stageTab === 'QUOTATION_REVIEW') {
        if (item.stage_key !== 'QUOTATION_REVIEW' && item.status !== 'QUOTATIONS_RECEIVED') return false;
      } else if (stageTab === 'COMPLETED') {
        if (item.stage_key !== 'COMPLETED' && item.status !== 'COMPLETED') return false;
      }

      // 2. Action Filter
      if (actionFilter === 'ACTION_REQUIRED') {
        const needsAction = item.action_required || item.status === 'PENDING_COMMITTEE_REVIEW' || item.status === 'QUOTATIONS_RECEIVED';
        if (!needsAction) return false;
      } else if (actionFilter === 'IN_PROGRESS') {
        const inProg = !item.action_required && item.status !== 'COMPLETED' && item.status !== 'CANCELLED' && item.status !== 'REJECTED';
        if (!inProg) return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesReq = item.req_number?.toLowerCase().includes(q);
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesItem = item.item_name?.toLowerCase().includes(q);
        const matchesDept = item.department_name?.toLowerCase().includes(q);
        const matchesStage = item.workflow_stage_display?.toLowerCase().includes(q);
        if (!matchesReq && !matchesTitle && !matchesItem && !matchesDept && !matchesStage) return false;
      }

      // 4. Department Filter
      if (selectedDepartment !== 'ALL' && item.department_name !== selectedDepartment) {
        return false;
      }

      // 5. Category Filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [data.assigned_requests, stageTab, actionFilter, searchQuery, selectedDepartment, selectedCategory]);

  const handleOpenDetail = (req) => {
    setSelectedReq(req);
    setDetailModalOpen(true);
  };

  const handleOpenSourcing = (req) => {
    setSourcingReq(req);
    setSourcingModalOpen(true);
  };

  const handleOpenRFQTracking = async (req) => {
    if (req.linked_rfq && req.linked_rfq.id) {
      setRfqLoading(true);
      try {
        const res = await axiosClient.get(`/procurement/rfqs/${req.linked_rfq.id}/`);
        setSelectedRFQ(res.data);
        setRfqModalOpen(true);
      } catch (err) {
        // Fallback to navigating to Sent RFQs page
        navigate('/committee/rfqs');
      } finally {
        setRfqLoading(false);
      }
    } else {
      navigate('/committee/rfqs');
    }
  };

  const handleRFQSuccess = (newRFQ) => {
    fetchAssignedRequests();
    setSuccessNotice(
      `Quotation request ${newRFQ?.rfq_number || ''} created successfully! This request is now in Awaiting Quotations stage and remains visible in your assigned list.`
    );
    setTimeout(() => setSuccessNotice(''), 8000);
  };

  // Render stage status badge
  const renderStageBadge = (req) => {
    const status = req.status;
    const stageKey = req.stage_key;

    if (stageKey === 'NEWLY_ASSIGNED' || status === 'PENDING_COMMITTEE_REVIEW') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span>Newly Assigned</span>
        </span>
      );
    }
    if (stageKey === 'VENDOR_SOURCING' || status === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <HiOutlineSparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Vendor Sourcing</span>
        </span>
      );
    }
    if (stageKey === 'AWAITING_QUOTATIONS' || status === 'RFQ_ISSUED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
          <HiClock className="w-3.5 h-3.5 text-blue-600" />
          <span>Awaiting Quotations</span>
        </span>
      );
    }
    if (stageKey === 'QUOTATION_REVIEW' || status === 'QUOTATIONS_RECEIVED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
          <span>Quotation Review</span>
        </span>
      );
    }
    if (stageKey === 'COMPLETED' || status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          <HiCheckCircle className="w-3.5 h-3.5 text-slate-500" />
          <span>Completed / Closed</span>
        </span>
      );
    }
    if (stageKey === 'RETURNED' || status === 'RETURNED') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
          <HiExclamationCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>Returned for Clarification</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
        <span>{req.status_display || status}</span>
      </span>
    );
  };

  // Render contextual action buttons based on stage
  const renderActions = (req) => {
    const status = req.status;
    const stageKey = req.stage_key;

    if (stageKey === 'NEWLY_ASSIGNED' || status === 'PENDING_COMMITTEE_REVIEW') {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenDetail(req)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 transition-colors inline-flex items-center gap-1"
          >
            <HiClipboardCheck className="w-3.5 h-3.5 text-violet-600" />
            <span>Review & Decide</span>
          </button>
          <button
            onClick={() => handleOpenSourcing(req)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors inline-flex items-center gap-1 shadow-xs"
          >
            <HiSearch className="w-3.5 h-3.5" />
            <span>Find Vendors</span>
          </button>
        </div>
      );
    }

    if (stageKey === 'VENDOR_SOURCING' || status === 'APPROVED') {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenSourcing(req)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors inline-flex items-center gap-1 shadow-xs"
          >
            <HiSearch className="w-3.5 h-3.5" />
            <span>Find Vendors & Quote</span>
          </button>
          <button
            onClick={() => handleOpenDetail(req)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-violet-700 hover:bg-violet-50 border border-slate-200 transition-colors inline-flex items-center gap-1"
          >
            <HiEye className="w-3.5 h-3.5" />
            <span>Details</span>
          </button>
        </div>
      );
    }

    if (stageKey === 'AWAITING_QUOTATIONS' || status === 'RFQ_ISSUED') {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenRFQTracking(req)}
            disabled={rfqLoading}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors inline-flex items-center gap-1 shadow-xs"
          >
            <HiClock className="w-3.5 h-3.5" />
            <span>Track Quotations</span>
          </button>
          <button
            onClick={() => handleOpenDetail(req)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-violet-700 hover:bg-violet-50 border border-slate-200 transition-colors inline-flex items-center gap-1"
          >
            <HiEye className="w-3.5 h-3.5" />
            <span>Details</span>
          </button>
        </div>
      );
    }

    if (stageKey === 'QUOTATION_REVIEW' || status === 'QUOTATIONS_RECEIVED') {
      return (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenRFQTracking(req)}
            disabled={rfqLoading}
            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 transition-colors inline-flex items-center gap-1 shadow-xs animate-pulse hover:animate-none"
          >
            <HiDocumentText className="w-3.5 h-3.5" />
            <span>Review & Award</span>
          </button>
          <button
            onClick={() => handleOpenDetail(req)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-violet-700 hover:bg-violet-50 border border-slate-200 transition-colors inline-flex items-center gap-1"
          >
            <HiEye className="w-3.5 h-3.5" />
            <span>Details</span>
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-end gap-1.5">
        <button
          onClick={() => handleOpenDetail(req)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-violet-700 hover:bg-violet-50 border border-slate-200 transition-colors inline-flex items-center gap-1"
        >
          <HiEye className="w-3.5 h-3.5" />
          <span>View Details</span>
        </button>
      </div>
    );
  };

  return (
    <ProcurementCommitteeLayout
      title="My Assigned Requests"
      subtitle="Complete view of all hospital purchase requests assigned to your queue. Requests remain visible and organized across all workflow stages until procurement closure."
      committeeUser={data.user}
      onRefresh={fetchAssignedRequests}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Success Alert Banner */}
        {successNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{successNotice}</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/committee/rfqs"
                className="text-emerald-700 underline hover:text-emerald-900 font-bold flex items-center gap-1"
              >
                <span>Go to Sent RFQs</span>
                <HiExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => setSuccessNotice('')}
                className="text-emerald-500 hover:text-emerald-700"
              >
                <HiX className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError('')}
              className="text-rose-500 hover:text-rose-700 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Assigned Queue
              </p>
              <h3 className="text-2xl font-black text-slate-900">
                {data.assigned_requests.length}
              </h3>
              <p className="text-[11px] text-violet-600 font-semibold">
                {activeRequests.length} currently active in workflow
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <HiShoppingBag className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Action Required
              </p>
              <h3 className="text-2xl font-black text-amber-600">
                {actionRequiredCount}
              </h3>
              <p className="text-[11px] text-amber-700 font-semibold">
                Needs review, decision, or quote award
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <HiClipboardCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active Sourcing & Quotes
              </p>
              <h3 className="text-2xl font-black text-emerald-600">
                {vendorSourcingRequests.length + awaitingQuotesRequests.length + quotationReviewRequests.length}
              </h3>
              <p className="text-[11px] text-emerald-700 font-semibold">
                Supplier matching & quotation cycle
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <HiOutlineSparkles className="w-6 h-6" />
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-violet-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active Queue Budget
              </p>
              <h3 className="text-2xl font-black text-slate-800">
                {formatCurrency(totalEstimatedValue)}
              </h3>
              <p className="text-[11px] text-slate-500 font-semibold">
                Total estimated allocation
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center font-bold">
              <HiTag className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Workflow Stage Categorization Navigation */}
        <div className="bg-white p-2.5 sm:p-3 rounded-2xl border border-violet-100 shadow-xs flex flex-wrap items-center gap-1.5 overflow-x-auto text-xs">
          {stageTabs.map((tab) => {
            const isActive = stageTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStageTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
                    : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : tab.badgeColor
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Action Filters & Department/Category Selectors */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-violet-100 shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
            <div className="relative w-full lg:w-96">
              <HiSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search request number, item, department, status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {/* Quick Action Filter */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
                <button
                  onClick={() => setActionFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    actionFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  All Statuses
                </button>
                <button
                  onClick={() => setActionFilter('ACTION_REQUIRED')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    actionFilter === 'ACTION_REQUIRED' ? 'bg-amber-500 text-white shadow-xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Action Required
                </button>
                <button
                  onClick={() => setActionFilter('IN_PROGRESS')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    actionFilter === 'IN_PROGRESS' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  In Progress
                </button>
              </div>

              {/* Department Dropdown */}
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
              >
                <option value="ALL">All Departments</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Category Dropdown */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
              >
                <option value="ALL">All Categories</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Detailed Requests Table */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HiShoppingBag className="w-5 h-5 text-violet-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Assigned Requisitions ({filteredRequests.length})
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              Assigned directly to you • Equal Workload Allocation • Retained until closure
            </span>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <HiRefresh className="w-8 h-8 animate-spin text-violet-600" />
              <p className="text-xs font-medium">Loading assigned requests across all stages...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="py-16 text-center space-y-2 p-6">
              <HiClipboardCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">No matching purchase requests found</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                No purchase requests match your current stage or filter selections. Requests remain in your assigned queue as they move between stages until procurement closure.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">Request Number</th>
                    <th className="px-4 py-3">Item & Category</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Current Stage</th>
                    <th className="px-4 py-3">Assigned Member</th>
                    <th className="px-4 py-3 text-right">Budget</th>
                    <th className="px-4 py-3">Required Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors group">
                      {/* Request Number & Title */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-violet-700 block">
                            {req.req_number}
                          </span>
                          {req.priority === 'URGENT' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-rose-100 text-rose-700">
                              Urgent
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 line-clamp-1 max-w-[180px]">
                          {req.title}
                        </span>
                      </td>

                      {/* Item Details & Category */}
                      <td className="px-4 py-3.5 max-w-[200px]">
                        <span className="font-bold text-slate-900 block line-clamp-1">
                          {req.item_name}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[10px]">
                            {req.category}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            Qty: {req.quantity}
                          </span>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-medium text-slate-800 block">
                          {req.department_name}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          By: {req.submitted_by_name}
                        </span>
                      </td>

                      {/* Workflow Stage */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {renderStageBadge(req)}
                        {req.linked_rfq && (
                          <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-1">
                            <span>{req.linked_rfq.rfq_number}</span>
                            <span>•</span>
                            <span>{req.linked_rfq.quotations_count || 0} Quote(s)</span>
                          </div>
                        )}
                      </td>

                      {/* Assigned Member */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 block">
                          {req.assigned_committee_member_name || data.user?.full_name || 'Committee Member'}
                        </span>
                        <span className="text-[10px] font-mono text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                          {req.assigned_committee_member_employee_id || data.user?.employee_id || 'You'}
                        </span>
                      </td>

                      {/* Estimated Budget */}
                      <td className="px-4 py-3.5 font-extrabold text-slate-900 whitespace-nowrap text-right">
                        {formatCurrency(req.estimated_budget)}
                      </td>

                      {/* Required Date */}
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                        {formatDate(req.required_date)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {renderActions(req)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Requisition Detail Inspection & Sanction Modal */}
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

      {/* Vendor Sourcing & RFQ Creation Modal */}
      {sourcingReq && (
        <VendorSourcingModal
          requisition={sourcingReq}
          isOpen={sourcingModalOpen}
          onClose={() => {
            setSourcingModalOpen(false);
            setSourcingReq(null);
          }}
          onSuccess={handleRFQSuccess}
        />
      )}

      {/* RFQ Detail & Quotation Review / Award Modal */}
      {selectedRFQ && (
        <RFQDetailModal
          rfq={selectedRFQ}
          isOpen={rfqModalOpen}
          onClose={() => {
            setRfqModalOpen(false);
            setSelectedRFQ(null);
          }}
          onRFQUpdated={() => {
            fetchAssignedRequests();
          }}
        />
      )}
    </ProcurementCommitteeLayout>
  );
};

export default ProcurementCommitteeReviewsPage;
