import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import PurchaseOfficerLayout from '../../components/layout/PurchaseOfficerLayout';
import Button from '../../components/common/Button';
import {
  HiClipboardList,
  HiSearch,
  HiEye,
  HiCheckCircle,
  HiXCircle,
  HiReply,
  HiClock,
  HiPaperClip,
  HiOfficeBuilding,
  HiUser,
  HiMail,
  HiCalendar,
  HiCurrencyDollar,
  HiDocumentText,
  HiExclamationCircle,
  HiX,
  HiRefresh,
  HiShieldCheck,
  HiChevronRight,
  HiOutlineDownload,
  HiExternalLink,
  HiInformationCircle
} from 'react-icons/hi';

const APPROVED_SPECIALIZATIONS = [
  'Biomedical Equipment',
  'Medical & Surgical Equipment',
  'Laboratory & Diagnostic Equipment',
  'Radiology & Medical Imaging',
  'Critical Care & Life-Support Equipment',
  'IT & Healthcare Technology'
];

const PurchaseOfficerRequisitionsPage = () => {
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filtering & Search - default to SUBMITTED so PO sees requisitions needing review immediately
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');

  // Review Modal State
  const [selectedReq, setSelectedReq] = useState(null);
  const [activeAction, setActiveAction] = useState(null); // 'PROCEED' | 'RETURN' | 'REJECT' | null
  const [reviewComments, setReviewComments] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);

  // Technical Evaluation Decision State (Purchase Officer must explicitly decide YES or NO)
  const [technicalEvalDecision, setTechnicalEvalDecision] = useState(null); // 'YES' | 'NO' | null
  const [selectedSpecialization, setSelectedSpecialization] = useState('Biomedical Equipment');

  const fetchRequisitions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/requisitions/');
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setRequisitions(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load purchase requisitions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, []);

  // Summary Counts
  const stats = useMemo(() => {
    const total = requisitions.length;
    const submitted = requisitions.filter(r => r.status === 'SUBMITTED').length;
    const proceeded = requisitions.filter(r => [
      'PENDING_TECHNICAL_EVALUATION',
      'PENDING_COMMITTEE_REVIEW',
      'PENDING_APPROVAL',
      'UNDER_REVIEW',
      'APPROVED',
      'RFQ_ISSUED',
      'COMPLETED'
    ].includes(r.status)).length;
    const returned = requisitions.filter(r => r.status === 'RETURNED').length;
    const rejected = requisitions.filter(r => r.status === 'REJECTED').length;
    return { total, submitted, proceeded, returned, rejected };
  }, [requisitions]);

  // Filtered List
  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((req) => {
      const matchesSearch =
        !searchQuery ||
        req.req_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.justification?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.department_details?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.requested_by_details?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.requested_by_details?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesStatus = true;
      if (statusFilter === 'SUBMITTED') {
        matchesStatus = req.status === 'SUBMITTED';
      } else if (statusFilter === 'PROCEEDED') {
        matchesStatus = [
          'PENDING_TECHNICAL_EVALUATION',
          'PENDING_COMMITTEE_REVIEW',
          'PENDING_APPROVAL',
          'UNDER_REVIEW',
          'APPROVED',
          'RFQ_ISSUED',
          'COMPLETED'
        ].includes(req.status);
      } else if (statusFilter === 'RETURNED') {
        matchesStatus = req.status === 'RETURNED';
      } else if (statusFilter === 'REJECTED') {
        matchesStatus = req.status === 'REJECTED';
      }

      return matchesSearch && matchesStatus;
    });
  }, [requisitions, searchQuery, statusFilter]);

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
      case 'SUBMITTED':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'PENDING_TECHNICAL_EVALUATION':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'PENDING_COMMITTEE_REVIEW':
      case 'PENDING_APPROVAL':
      case 'UNDER_REVIEW':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'RETURNED':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'RFQ_ISSUED':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'DRAFT':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getReadableStatus = (status) => {
    switch (status?.toUpperCase()) {
      case 'SUBMITTED': return 'Submitted (Needs Review)';
      case 'PENDING_TECHNICAL_EVALUATION': return 'Pending Technical Evaluation';
      case 'PENDING_COMMITTEE_REVIEW': return 'Pending Committee Review';
      case 'PENDING_APPROVAL': return 'Pending Approval';
      case 'UNDER_REVIEW': return 'Under Review';
      case 'RETURNED': return 'Returned for Correction';
      case 'REJECTED': return 'Rejected';
      case 'APPROVED': return 'Approved';
      case 'RFQ_ISSUED': return 'Procurement in Progress';
      case 'COMPLETED': return 'Completed';
      case 'DRAFT': return 'Draft';
      default: return status || 'Unknown';
    }
  };

  const handleOpenReview = (req) => {
    setSelectedReq(req);
    setActiveAction(null);
    setReviewComments('');
    setActionError('');
    setTechnicalEvalDecision(null);
    const suggested = req.technical_evaluation_advisory?.suggested_specialization;
    setSelectedSpecialization(suggested || 'Biomedical Equipment');
  };

  const handleCloseModal = () => {
    setSelectedReq(null);
    setActiveAction(null);
    setReviewComments('');
    setActionError('');
    setTechnicalEvalDecision(null);
  };

  const handleDownloadDoc = async (req) => {
    if (!req) return;
    setDocLoading(true);
    try {
      const res = await axiosClient.get(`/procurement/requisitions/${req.id}/document/`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(blob);
      window.open(fileURL, '_blank');
    } catch (err) {
      if (req.supporting_document) {
        window.open(req.supporting_document, '_blank');
      } else {
        alert(err.response?.data?.detail || 'Failed to download supporting document.');
      }
    } finally {
      setDocLoading(false);
    }
  };

  const handleExecuteReview = async (actionType) => {
    setActionError('');
    if (actionType === 'PROCEED') {
      if (technicalEvalDecision === null) {
        setActionError('Please specify whether technical evaluation is required (Yes or No) before proceeding.');
        return;
      }
    }

    if ((actionType === 'RETURN' || actionType === 'REJECT') && !reviewComments.trim()) {
      setActionError(`Please provide a reason or remarks for ${actionType === 'RETURN' ? 'returning' : 'rejecting'} this requisition.`);
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        action: actionType,
        reason: reviewComments.trim()
      };
      if (actionType === 'PROCEED') {
        payload.requires_technical_evaluation = technicalEvalDecision === 'YES';
        if (technicalEvalDecision === 'YES') {
          payload.technical_specialization = selectedSpecialization;
        }
      }

      const res = await axiosClient.post(`/procurement/requisitions/${selectedReq.id}/review/`, payload);

      const updated = res.data.requisition || res.data;
      setSuccessMessage(
        actionType === 'PROCEED'
          ? technicalEvalDecision === 'YES'
            ? `Requisition ${selectedReq.req_number} proceeded for Technical Officer Evaluation (${selectedSpecialization})!`
            : `Requisition ${selectedReq.req_number} proceeded directly to Procurement Committee Review!`
          : actionType === 'RETURN'
          ? `Requisition ${selectedReq.req_number} returned to Department Staff for correction.`
          : `Requisition ${selectedReq.req_number} has been rejected.`
      );

      // Update local state
      setRequisitions(prev => prev.map(r => (r.id === selectedReq.id ? updated : r)));
      handleCloseModal();
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.requires_technical_evaluation) {
        setActionError(Array.isArray(errData.requires_technical_evaluation) ? errData.requires_technical_evaluation[0] : errData.requires_technical_evaluation);
      } else if (errData?.reason) {
        setActionError(Array.isArray(errData.reason) ? errData.reason[0] : errData.reason);
      } else if (errData?.detail) {
        setActionError(errData.detail);
      } else {
        setActionError('Failed to complete review action. Please try again.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Advisory recommendation details from backend (evaluated dynamically at item level)
  const advisory = useMemo(() => {
    if (!selectedReq) return null;
    if (selectedReq.technical_evaluation_advisory) {
      return selectedReq.technical_evaluation_advisory;
    }
    return {
      recommended: false,
      reason: 'No technical evaluation advisory available.',
      suggested_specialization: null,
      triggering_items: []
    };
  }, [selectedReq]);

  return (
    <PurchaseOfficerLayout
      title="Purchase Requisitions Review"
      subtitle="Review submitted Department Staff purchase requisitions, verify item specifications, and proceed, return, or reject."
      onRefresh={fetchRequisitions}
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Global Notifications */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <HiExclamationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
              <HiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage('')} className="text-emerald-500 hover:text-emerald-700">
              <HiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div
            onClick={() => setStatusFilter('ALL')}
            className={`cursor-pointer rounded-2xl border p-4 shadow-xs transition-all ${
              statusFilter === 'ALL'
                ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-500/20'
                : 'bg-white border-violet-100 hover:border-violet-300'
            }`}
          >
            <span className={`text-[10px] uppercase font-bold tracking-wider block ${statusFilter === 'ALL' ? 'text-violet-100' : 'text-slate-400'}`}>
              Total Requisitions
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className={`text-2xl font-black ${statusFilter === 'ALL' ? 'text-white' : 'text-slate-900'}`}>
                {stats.total}
              </span>
              <HiClipboardList className={`w-5 h-5 ${statusFilter === 'ALL' ? 'text-white' : 'text-violet-400'}`} />
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('SUBMITTED')}
            className={`cursor-pointer rounded-2xl border p-4 shadow-xs transition-all ${
              statusFilter === 'SUBMITTED'
                ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20'
                : 'bg-white border-blue-100 hover:border-blue-300'
            }`}
          >
            <span className={`text-[10px] uppercase font-bold tracking-wider block ${statusFilter === 'SUBMITTED' ? 'text-blue-100' : 'text-blue-600'}`}>
              Needs Review
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className={`text-2xl font-black ${statusFilter === 'SUBMITTED' ? 'text-white' : 'text-blue-900'}`}>
                {stats.submitted}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusFilter === 'SUBMITTED' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'}`}>
                Queue
              </span>
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('PROCEEDED')}
            className={`cursor-pointer rounded-2xl border p-4 shadow-xs transition-all ${
              statusFilter === 'PROCEEDED'
                ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                : 'bg-white border-purple-100 hover:border-purple-300'
            }`}
          >
            <span className={`text-[10px] uppercase font-bold tracking-wider block ${statusFilter === 'PROCEEDED' ? 'text-purple-100' : 'text-purple-600'}`}>
              Proceeded / Pipeline
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className={`text-2xl font-black ${statusFilter === 'PROCEEDED' ? 'text-white' : 'text-purple-900'}`}>
                {stats.proceeded}
              </span>
              <HiCheckCircle className={`w-5 h-5 ${statusFilter === 'PROCEEDED' ? 'text-white' : 'text-purple-400'}`} />
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('RETURNED')}
            className={`cursor-pointer rounded-2xl border p-4 shadow-xs transition-all ${
              statusFilter === 'RETURNED'
                ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20'
                : 'bg-white border-amber-100 hover:border-amber-300'
            }`}
          >
            <span className={`text-[10px] uppercase font-bold tracking-wider block ${statusFilter === 'RETURNED' ? 'text-amber-100' : 'text-amber-600'}`}>
              Returned for Corr.
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className={`text-2xl font-black ${statusFilter === 'RETURNED' ? 'text-white' : 'text-amber-900'}`}>
                {stats.returned}
              </span>
              <HiReply className={`w-5 h-5 ${statusFilter === 'RETURNED' ? 'text-white' : 'text-amber-400'}`} />
            </div>
          </div>

          <div
            onClick={() => setStatusFilter('REJECTED')}
            className={`cursor-pointer rounded-2xl border p-4 shadow-xs transition-all ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-500/20'
                : 'bg-white border-rose-100 hover:border-rose-300'
            }`}
          >
            <span className={`text-[10px] uppercase font-bold tracking-wider block ${statusFilter === 'REJECTED' ? 'text-rose-100' : 'text-rose-600'}`}>
              Rejected
            </span>
            <div className="mt-2 flex items-baseline justify-between">
              <span className={`text-2xl font-black ${statusFilter === 'REJECTED' ? 'text-white' : 'text-rose-900'}`}>
                {stats.rejected}
              </span>
              <HiXCircle className={`w-5 h-5 ${statusFilter === 'REJECTED' ? 'text-white' : 'text-rose-400'}`} />
            </div>
          </div>
        </div>

        {/* 2. Controls Bar: Search & Status Filter Tabs */}
        <div className="bg-white rounded-3xl border border-violet-100 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <HiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search REQ #, title, staff, dept..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:border-violet-500 focus:ring-violet-500/20 bg-slate-50/50 hover:border-slate-300 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <HiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'SUBMITTED', label: 'Needs Review' },
              { id: 'PROCEEDED', label: 'Proceeded / Pipeline' },
              { id: 'RETURNED', label: 'Returned for Correction' },
              { id: 'REJECTED', label: 'Rejected' },
              { id: 'ALL', label: 'All Requisitions' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === tab.id
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Purchase Requisitions Table (10 Required Columns) */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-violet-500 border-t-transparent" />
              <p className="text-xs font-semibold text-slate-500">Loading purchase requisitions...</p>
            </div>
          ) : filteredRequisitions.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto shadow-xs">
                <HiClipboardList className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">No Requisitions Found</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {statusFilter === 'SUBMITTED'
                    ? 'No purchase requisitions are currently waiting for Purchase Officer review.'
                    : 'No purchase requisitions matched your search or filter criteria.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 border-b border-violet-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Requisition Number</th>
                    <th className="py-3.5 px-4">Department</th>
                    <th className="py-3.5 px-4">Requester</th>
                    <th className="py-3.5 px-4">Requisition Title</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4">Estimated Total</th>
                    <th className="py-3.5 px-4">Required Date</th>
                    <th className="py-3.5 px-4">Submitted Date</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredRequisitions.map((req) => {
                    const isSubmitted = req.status === 'SUBMITTED';

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* 1. Requisition Number */}
                        <td className="py-3.5 px-4 font-mono font-bold text-violet-700 whitespace-nowrap">
                          {req.req_number}
                        </td>

                        {/* 2. Department */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-slate-800">
                            {req.department_details?.name || req.department_name || 'N/A'}
                          </span>
                        </td>

                        {/* 3. Requester */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                          {req.requested_by_details?.full_name || req.requested_by_name || req.requested_by_details?.username || 'Staff'}
                        </td>

                        {/* 4. Requisition Title */}
                        <td className="py-3.5 px-4 max-w-[220px]">
                          <span className="font-bold text-slate-900 block truncate text-xs" title={req.title}>
                            {req.title}
                          </span>
                          <span className="text-slate-400 block truncate text-[11px] mt-0.5" title={req.justification}>
                            {req.justification || 'No justification provided'}
                          </span>
                        </td>

                        {/* 5. Priority */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getPriorityBadge(req.priority)}`}>
                            {req.priority || 'MEDIUM'}
                          </span>
                        </td>

                        {/* 6. Estimated Total */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(req.estimated_budget)}
                        </td>

                        {/* 7. Required Date */}
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatDate(req.required_date || (req.items?.[0]?.required_date))}
                        </td>

                        {/* 8. Submitted Date */}
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          {formatDate(req.submitted_at || req.created_at)}
                        </td>

                        {/* 9. Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadge(req.status)}`}>
                            {getReadableStatus(req.status)}
                          </span>
                        </td>

                        {/* 10. Review Action */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Button
                            variant={isSubmitted ? "primary" : "outline"}
                            size="sm"
                            onClick={() => handleOpenReview(req)}
                            className={`text-[11px] font-bold py-1 px-3 gap-1.5 ${
                              isSubmitted
                                ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-xs'
                                : 'text-violet-700 border-violet-200 hover:bg-violet-50'
                            }`}
                          >
                            <HiEye className="w-3.5 h-3.5" />
                            <span>{isSubmitted ? 'Review' : 'View'}</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4. Detailed Review Modal */}
        <AnimatePresence>
          {selectedReq && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8 max-h-[92vh] overflow-y-auto border border-violet-100"
              >
                {/* Modal Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200">
                        {selectedReq.req_number}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${getStatusBadge(selectedReq.status)}`}>
                        {getReadableStatus(selectedReq.status)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${getPriorityBadge(selectedReq.priority)}`}>
                        {selectedReq.priority} Priority
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight mt-1">
                      {selectedReq.title}
                    </h2>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                {/* Requisition Meta Details Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[10px]">Requesting Department</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">
                      {selectedReq.department_details?.name || selectedReq.department_name || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[10px]">Requesting Staff</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">
                      {selectedReq.requested_by_details?.full_name || selectedReq.requested_by_name || selectedReq.requested_by_details?.username}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {selectedReq.requested_by_details?.email || selectedReq.requested_by_email || ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[10px]">Submitted Date</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">
                      {formatDate(selectedReq.submitted_at || selectedReq.created_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[10px]">Required Delivery Date</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">
                      {formatDate(selectedReq.required_date || (selectedReq.items?.[0]?.required_date))}
                    </span>
                  </div>
                </div>

                {/* Estimated Total & Justification */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-violet-50/70 border border-violet-100 text-xs">
                    <span className="text-violet-600 block uppercase font-bold text-[10px]">Estimated Requisition Total</span>
                    <span className="font-mono font-black text-xl text-violet-900 mt-1 block">
                      {formatCurrency(selectedReq.estimated_budget)}
                    </span>
                    <span className="text-[11px] text-violet-700 mt-0.5 block">
                      {selectedReq.items?.length || 0} item{(selectedReq.items?.length || 0) !== 1 ? 's' : ''} requested
                    </span>
                  </div>

                  <div className="sm:col-span-2 text-xs space-y-1">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      Reason / Clinical Justification
                    </span>
                    <p className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap font-medium h-[calc(100%-24px)] overflow-y-auto">
                      {selectedReq.justification || 'No justification entered.'}
                    </p>
                  </div>
                </div>

                {/* Secure Supporting Document Access */}
                {(selectedReq.supporting_document || selectedReq.secure_document_url) && (
                  <div className="text-xs space-y-1.5">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      Supporting Documentation
                    </span>
                    <div className="p-3.5 rounded-2xl bg-violet-50/70 border border-violet-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                          <HiPaperClip className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-violet-950 block text-xs">Attached Procurement Document</span>
                          <span className="text-[10px] text-violet-600">Verified PDF supporting file uploaded by department staff</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadDoc(selectedReq)}
                        isLoading={docLoading}
                        className="bg-white border-violet-200 text-violet-700 hover:bg-violet-50 text-xs font-bold gap-1.5 shadow-xs"
                      >
                        <HiOutlineDownload className="w-4 h-4" />
                        <span>Download / View Secure PDF</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Requested Items Full Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      Requested Items Breakdown ({selectedReq.items?.length || 0} items)
                    </span>
                    <span className="text-xs font-bold text-slate-500 font-mono">
                      Line Items Total: {formatCurrency(selectedReq.estimated_budget)}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3.5">#</th>
                          <th className="py-2.5 px-3.5">Item Name</th>
                          <th className="py-2.5 px-3.5">Category</th>
                          <th className="py-2.5 px-3.5">Specifications</th>
                          <th className="py-2.5 px-3.5 text-center">Qty</th>
                          <th className="py-2.5 px-3.5 text-center">Unit</th>
                          <th className="py-2.5 px-3.5 text-right">Est. Unit Price</th>
                          <th className="py-2.5 px-3.5 text-right">Total Price</th>
                          <th className="py-2.5 px-3.5">Required Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {selectedReq.items && selectedReq.items.length > 0 ? (
                          selectedReq.items.map((it, idx) => (
                            <tr key={it.id || idx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                              <td className="py-2.5 px-3.5 font-bold text-slate-900">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{it.item_name}</span>
                                  {it.technical_advisory ? (
                                    it.technical_advisory.is_technical ? (
                                      <span
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200"
                                        title={`Advisory: Technical evaluation recommended (${it.technical_advisory.suggested_specialization || 'Technical Specialization'})`}
                                      >
                                        Tech Eval
                                      </span>
                                    ) : (
                                      <span
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-500"
                                        title="Advisory: Routine consumable / supply"
                                      >
                                        Routine
                                      </span>
                                    )
                                  ) : null}
                                </div>
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-600">
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-semibold text-slate-700">
                                  {it.category || 'General'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-600 max-w-[180px] truncate" title={it.specifications}>
                                {it.specifications || 'N/A'}
                              </td>
                              <td className="py-2.5 px-3.5 text-center font-bold text-slate-900">{it.quantity}</td>
                              <td className="py-2.5 px-3.5 text-center text-slate-500 text-[11px]">
                                {it.unit_of_measure || 'Units'}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-mono text-slate-700">
                                {formatCurrency(it.estimated_unit_price)}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-mono font-bold text-violet-900">
                                {formatCurrency(it.total_price)}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap text-[11px]">
                                {formatDate(it.required_date)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={9} className="py-4 text-center text-slate-400">
                              No items recorded for this requisition.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Prior Approval & Audit History */}
                {selectedReq.approvals && selectedReq.approvals.length > 0 && (
                  <div className="space-y-1.5 text-xs">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      Workflow Approval History ({selectedReq.approvals.length} Record{selectedReq.approvals.length !== 1 ? 's' : ''})
                    </span>
                    <div className="space-y-2">
                      {selectedReq.approvals.map((appr) => (
                        <div key={appr.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{appr.stage}</span>
                              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${appr.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                {appr.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              Reviewed by: <strong className="text-slate-800">{appr.approved_by_details?.full_name || appr.approved_by_details?.username || 'Officer'}</strong>
                              {appr.comments && <span> • Remarks: "{appr.comments}"</span>}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatDate(appr.created_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prior Review Comments / Feedback Banner */}
                {selectedReq.review_comments && (
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs space-y-1">
                    <div className="flex items-center justify-between text-amber-900 font-bold">
                      <div className="flex items-center gap-1.5">
                        <HiExclamationCircle className="w-4 h-4 text-amber-600" />
                        <span>Previous Review Feedback / Remarks</span>
                      </div>
                      {selectedReq.reviewed_at && (
                        <span className="text-[10px] text-amber-700">
                          {formatDate(selectedReq.reviewed_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-amber-900 bg-white/70 p-2.5 rounded-xl border border-amber-100 font-medium leading-relaxed">
                      {selectedReq.review_comments}
                    </p>
                  </div>
                )}

                {/* Dedicated Technical Evaluation Section */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-violet-50/70 via-slate-50 to-purple-50/40 border border-violet-100 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-violet-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs">
                        <HiShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm tracking-tight">TECHNICAL EVALUATION</h3>
                        <p className="text-[11px] text-slate-500">Purchase Officer routing decision for Technical Officer or Procurement Committee.</p>
                      </div>
                    </div>
                    {/* System Advisory Badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400">System Advisory:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        advisory?.recommended
                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      }`}>
                        {advisory?.recommended ? 'Recommended: Required' : 'Recommended: Not Required'}
                      </span>
                    </div>
                  </div>

                  {/* System Advisory Recommendation Card */}
                  <div className="p-3.5 rounded-xl bg-white border border-violet-100 space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <HiInformationCircle className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1 text-slate-700 leading-relaxed w-full">
                        <p>
                          <span className="font-semibold text-slate-900">Recommendation:</span>{' '}
                          {advisory?.reason || 'Evaluation completed based on requested item complexity.'}
                        </p>
                        {advisory?.suggested_specialization && (
                          <p>
                            <span className="font-semibold text-slate-900">Suggested Technical Officer Specialization:</span>{' '}
                            <span className="inline-block px-2 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold text-[11px] border border-violet-200">
                              {advisory.suggested_specialization}
                            </span>
                          </p>
                        )}
                        {advisory?.triggering_items && advisory.triggering_items.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span className="font-semibold text-slate-900 text-[11px]">Triggering Item(s):</span>
                            {advisory.triggering_items.map((itemName, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-medium border border-purple-200">
                                {itemName}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="border-t border-slate-100 pt-2 text-[10px] text-slate-400 italic">
                      Important: The system advisory recommendation is non-binding. Your selected Yes/No decision below is the actual workflow decision.
                    </div>
                  </div>

                  {/* Purchase Officer Decision Form (Enabled for SUBMITTED) */}
                  {selectedReq.status === 'SUBMITTED' ? (
                    <div className="space-y-2.5 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-slate-900 mb-1">
                          Technical Evaluation Required? <span className="text-rose-500">*</span>
                        </label>
                        <p className="text-[11px] text-slate-500 mb-2.5">
                          The Purchase Officer must select either Yes or No before clicking Proceed.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* YES Option */}
                          <div
                            onClick={() => {
                              setTechnicalEvalDecision('YES');
                              setActionError('');
                            }}
                            className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                              technicalEvalDecision === 'YES'
                                ? 'border-purple-600 bg-purple-50/60 shadow-xs ring-2 ring-purple-600/10'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                id="po_tech_decision_yes"
                                name="po_technical_eval_decision"
                                checked={technicalEvalDecision === 'YES'}
                                onChange={() => {
                                  setTechnicalEvalDecision('YES');
                                  setActionError('');
                                }}
                                className="mt-0.5 text-purple-600 focus:ring-purple-500"
                              />
                              <div className="space-y-1">
                                <label htmlFor="po_tech_decision_yes" className="font-bold text-xs text-slate-900 block cursor-pointer">
                                  Yes — Route to Technical Officer
                                </label>
                                <span className="text-[11px] text-slate-500 block leading-tight">
                                  Routes to Technical Officer Evaluation (<code className="text-purple-700 bg-purple-50 px-1 rounded font-mono text-[10px]">PENDING_TECHNICAL_EVALUATION</code>)
                                </span>
                              </div>
                            </div>

                            {/* Specialization selector shown when YES is selected */}
                            {technicalEvalDecision === 'YES' && (
                              <div className="mt-3 pt-2.5 border-t border-purple-200/60" onClick={(e) => e.stopPropagation()}>
                                <label className="block text-[11px] font-bold text-purple-900 mb-1">
                                  Technical Officer Specialization:
                                </label>
                                <select
                                  value={selectedSpecialization}
                                  onChange={(e) => setSelectedSpecialization(e.target.value)}
                                  className="w-full text-xs p-2 rounded-lg border border-purple-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                  {APPROVED_SPECIALIZATIONS.map(spec => (
                                    <option key={spec} value={spec}>{spec}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* NO Option */}
                          <div
                            onClick={() => {
                              setTechnicalEvalDecision('NO');
                              setActionError('');
                            }}
                            className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                              technicalEvalDecision === 'NO'
                                ? 'border-indigo-600 bg-indigo-50/60 shadow-xs ring-2 ring-indigo-600/10'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="radio"
                                id="po_tech_decision_no"
                                name="po_technical_eval_decision"
                                checked={technicalEvalDecision === 'NO'}
                                onChange={() => {
                                  setTechnicalEvalDecision('NO');
                                  setActionError('');
                                }}
                                className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div className="space-y-1">
                                <label htmlFor="po_tech_decision_no" className="font-bold text-xs text-slate-900 block cursor-pointer">
                                  No — Proceed directly to Procurement Committee
                                </label>
                                <span className="text-[11px] text-slate-500 block leading-tight">
                                  Bypasses Technical Officer; routes to Committee (<code className="text-indigo-700 bg-indigo-50 px-1 rounded font-mono text-[10px]">PENDING_COMMITTEE_REVIEW</code>)
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">Recorded Technical Decision:</span>
                        <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          selectedReq.requires_technical_evaluation
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {selectedReq.requires_technical_evaluation
                            ? `Yes — Technical Officer (${selectedReq.technical_specialization || 'Assigned'})`
                            : 'No — Direct to Procurement Committee'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Confirmation & Form Panel */}
                <div className="border-t border-slate-100 pt-5 space-y-4">
                  {/* Action Error Banner */}
                  {actionError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <HiExclamationCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>{actionError}</span>
                    </div>
                  )}

                  {/* Only allow review actions if SUBMITTED */}
                  {selectedReq.status !== 'SUBMITTED' ? (
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <HiInformationCircle className="w-5 h-5 text-violet-600" />
                        <span>This requisition is currently in read-only mode ({getReadableStatus(selectedReq.status)}). No further review action required.</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleCloseModal}>
                        Close
                      </Button>
                    </div>
                  ) : activeAction ? (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs flex items-center gap-2">
                          {activeAction === 'PROCEED' && (
                            <>
                              <HiCheckCircle className="w-4 h-4 text-emerald-600" />
                              <span>Proceed Requisition to Next Procurement Stage</span>
                            </>
                          )}
                          {activeAction === 'RETURN' && (
                            <>
                              <HiReply className="w-4 h-4 text-amber-600" />
                              <span>Return Requisition for Staff Correction (Reason Mandatory)</span>
                            </>
                          )}
                          {activeAction === 'REJECT' && (
                            <>
                              <HiXCircle className="w-4 h-4 text-rose-600" />
                              <span>Reject Requisition (Reason Mandatory)</span>
                            </>
                          )}
                        </span>
                        <button
                          onClick={() => { setActiveAction(null); setActionError(''); }}
                          className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                        >
                          Change Action
                        </button>
                      </div>

                      {/* Summary of Decision on Proceed */}
                      {activeAction === 'PROCEED' && (
                        <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-950 text-xs space-y-1.5 leading-relaxed">
                          <p className="font-bold flex items-center gap-1.5 text-purple-900">
                            <HiInformationCircle className="w-4 h-4 text-purple-700" />
                            <span>Destination Routing:</span>
                          </p>
                          {technicalEvalDecision === 'YES' ? (
                            <div className="space-y-1 text-[11px] text-purple-900">
                              <p>• <strong>Technical Evaluation Required:</strong> YES</p>
                              <p>• <strong>Specialization:</strong> {selectedSpecialization}</p>
                              <p>• <strong>Status Transition:</strong> <code className="font-mono bg-purple-100 px-1 py-0.5 rounded text-purple-800">PENDING_TECHNICAL_EVALUATION</code></p>
                              <p>• Routes to the Technical Officer for compliance review.</p>
                            </div>
                          ) : (
                            <div className="space-y-1 text-[11px] text-indigo-900">
                              <p>• <strong>Technical Evaluation Required:</strong> NO</p>
                              <p>• <strong>Status Transition:</strong> <code className="font-mono bg-indigo-100 px-1 py-0.5 rounded text-indigo-800">PENDING_COMMITTEE_REVIEW</code></p>
                              <p>• Routes directly to Procurement Committee Review.</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          {activeAction === 'PROCEED'
                            ? 'Verification Remarks (Optional):'
                            : activeAction === 'RETURN'
                            ? 'Reason for Return & Required Corrections *:'
                            : 'Reason for Rejection *:'}
                        </label>
                        <textarea
                          rows={3}
                          value={reviewComments}
                          onChange={(e) => setReviewComments(e.target.value)}
                          placeholder={
                            activeAction === 'PROCEED'
                              ? 'e.g. Specifications verified. Proceeding to next workflow stage.'
                              : activeAction === 'RETURN'
                              ? 'e.g. Please clarify technical specifications for Item 2 and update estimated unit price.'
                              : 'e.g. Requisition does not align with current hospital procurement policy.'
                          }
                          className="w-full p-3 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 bg-white"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2.5 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setActiveAction(null); setActionError(''); }}
                          disabled={actionLoading}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleExecuteReview(activeAction)}
                          isLoading={actionLoading}
                          className={`text-xs font-bold gap-1.5 ${
                            activeAction === 'PROCEED'
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                              : activeAction === 'RETURN'
                              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                              : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
                          }`}
                        >
                          {activeAction === 'PROCEED' && 'Confirm & Proceed'}
                          {activeAction === 'RETURN' && 'Confirm Return for Correction'}
                          {activeAction === 'REJECT' && 'Confirm Rejection'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Initial 3 Action Buttons */
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <Button
                        variant="outline"
                        size="md"
                        onClick={handleCloseModal}
                        className="w-full sm:w-auto text-xs"
                      >
                        Close
                      </Button>

                      <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => {
                            setActiveAction('RETURN');
                            setReviewComments('');
                            setActionError('');
                          }}
                          className="text-xs font-bold text-amber-700 border-amber-200 hover:bg-amber-50 gap-1.5"
                        >
                          <HiReply className="w-4 h-4 text-amber-600" />
                          <span>Return for Correction</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="md"
                          onClick={() => {
                            setActiveAction('REJECT');
                            setReviewComments('');
                            setActionError('');
                          }}
                          className="text-xs font-bold text-rose-700 border-rose-200 hover:bg-rose-50 gap-1.5"
                        >
                          <HiXCircle className="w-4 h-4 text-rose-600" />
                          <span>Reject</span>
                        </Button>

                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => {
                            if (technicalEvalDecision === null) {
                              setActionError('Please select whether Technical Evaluation is required (Yes or No) in the Technical Evaluation section above before clicking Proceed.');
                              return;
                            }
                            setActiveAction('PROCEED');
                            setReviewComments('');
                            setActionError('');
                          }}
                          className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 gap-1.5"
                        >
                          <HiCheckCircle className="w-4 h-4 text-white" />
                          <span>Proceed</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </PurchaseOfficerLayout>
  );
};

export default PurchaseOfficerRequisitionsPage;
