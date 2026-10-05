import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import DepartmentStaffLayout from '../../components/layout/DepartmentStaffLayout';
import Button from '../../components/common/Button';
import {
  HiClipboardList,
  HiSearch,
  HiPlus,
  HiEye,
  HiPencil,
  HiTrash,
  HiCheckCircle,
  HiClock,
  HiDocumentText,
  HiPaperClip,
  HiOfficeBuilding,
  HiX,
  HiRefresh,
  HiExclamationCircle,
  HiChevronRight
} from 'react-icons/hi';

const MyRequisitionsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [selectedRequisition, setSelectedRequisition] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchMyRequisitions = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/requisitions/');
      // Handle both paginated and plain list responses
      const data = Array.isArray(res.data) ? res.data : res.data.results || [];
      setRequisitions(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load your purchase requisitions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRequisitions();
  }, []);

  // Filtered requisitions
  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((req) => {
      const matchesSearch =
        !searchQuery ||
        req.req_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.justification?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'SUBMITTED' && (
          req.status === 'SUBMITTED' ||
          req.status === 'PENDING_APPROVAL' ||
          req.status === 'PENDING_TECHNICAL_EVALUATION' ||
          req.status === 'PENDING_COMMITTEE_REVIEW'
        )) ||
        req.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [requisitions, searchQuery, statusFilter]);

  // Submit a Draft directly
  const handleSubmitDraft = async (reqId) => {
    setActionLoading(true);
    setError('');
    try {
      await axiosClient.post(`/procurement/requisitions/${reqId}/submit/`);
      setSuccessMessage('Draft requisition submitted successfully! Status is now "Submitted".');
      if (selectedRequisition && selectedRequisition.id === reqId) {
        setSelectedRequisition(null);
      }
      fetchMyRequisitions();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit draft.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete a Draft
  const handleDeleteDraft = async (reqId) => {
    if (!window.confirm('Are you sure you want to delete this draft requisition?')) return;
    setActionLoading(true);
    setError('');
    try {
      await axiosClient.delete(`/procurement/requisitions/${reqId}/`);
      setSuccessMessage('Draft deleted successfully.');
      if (selectedRequisition && selectedRequisition.id === reqId) {
        setSelectedRequisition(null);
      }
      fetchMyRequisitions();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to delete draft.');
    } finally {
      setActionLoading(false);
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
      case 'RFQ_ISSUED':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'RETURNED':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      case 'REJECTED':
      case 'CANCELLED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'DRAFT':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getReadableStatus = (status) => {
    switch (status?.toUpperCase()) {
      case 'SUBMITTED': return 'Submitted';
      case 'PENDING_TECHNICAL_EVALUATION': return 'Pending Technical Evaluation';
      case 'PENDING_COMMITTEE_REVIEW': return 'Pending Committee Review';
      case 'PENDING_APPROVAL': return 'Pending Approval';
      case 'UNDER_REVIEW': return 'Under Review';
      case 'RETURNED': return 'Returned for Correction';
      case 'RFQ_ISSUED': return 'Procurement in Progress';
      case 'APPROVED': return 'Approved';
      case 'COMPLETED': return 'Completed';
      case 'REJECTED': return 'Rejected';
      case 'CANCELLED': return 'Cancelled';
      case 'DRAFT': return 'Draft';
      default: return status || 'Unknown';
    }
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

  return (
    <DepartmentStaffLayout
      title="My Purchase Requests"
      subtitle="View, monitor, and track all procurement requisitions created for your department."
      onRefresh={fetchMyRequisitions}
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Alert Notifications */}
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

        {/* Top Control Bar: Search, Status Filters & Create Button */}
        <div className="bg-white rounded-3xl border border-violet-100 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <HiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by REQ # or title..."
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

          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'SUBMITTED', label: 'Submitted' },
              { id: 'RETURNED', label: 'Returned for Correction' },
              { id: 'DRAFT', label: 'Drafts' },
              { id: 'APPROVED', label: 'Approved' },
              { id: 'COMPLETED', label: 'Completed' },
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

          {/* "+ Create Purchase Request" Button */}
          <Link to="/staff/create-request">
            <Button
              variant="primary"
              size="md"
              className="w-full md:w-auto text-xs font-bold gap-1.5 whitespace-nowrap shadow-sm shadow-violet-500/20"
            >
              <HiPlus className="w-4 h-4" />
              <span>+ Create Purchase Request</span>
            </Button>
          </Link>
        </div>

        {/* Requisitions List Table */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-violet-500 border-t-transparent" />
              <p className="text-xs font-semibold text-slate-500">Loading your purchase requests...</p>
            </div>
          ) : filteredRequisitions.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto shadow-xs">
                <HiClipboardList className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">No Requisitions Found</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'No purchase requests matched your active filter or search criteria.'
                    : "You haven't initiated any purchase requests yet. Create your first procurement requisition to get started."}
                </p>
              </div>
              <Link to="/staff/create-request">
                <Button variant="primary" size="md" className="text-xs font-bold gap-1.5 mt-2">
                  <HiPlus className="w-4 h-4" />
                  <span>Create Requisition</span>
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-violet-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3.5 px-5">Requisition #</th>
                    <th className="py-3.5 px-5">Title & Justification</th>
                    <th className="py-3.5 px-5">Priority</th>
                    <th className="py-3.5 px-5">Items</th>
                    <th className="py-3.5 px-5">Est. Budget</th>
                    <th className="py-3.5 px-5">Date Created</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequisitions.map((req) => {
                    const isDraft = req.status === 'DRAFT';
                    const itemsCount = req.items?.length || 0;
                    return (
                      <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                        {/* Requisition Number */}
                        <td className="py-4 px-5 font-mono font-bold text-violet-700 whitespace-nowrap">
                          {req.req_number}
                        </td>

                        {/* Title & Justification */}
                        <td className="py-4 px-5 max-w-xs">
                          <span className="font-bold text-slate-900 block truncate text-xs">
                            {req.title}
                          </span>
                          <span className="text-slate-400 block truncate text-[11px] mt-0.5">
                            {req.justification || 'No justification specified'}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="py-4 px-5 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${getPriorityBadge(
                              req.priority
                            )}`}
                          >
                            {req.priority || 'MEDIUM'}
                          </span>
                        </td>

                        {/* Items Count */}
                        <td className="py-4 px-5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                            <HiDocumentText className="w-4 h-4 text-violet-500" />
                            <span>
                              {itemsCount} item{itemsCount !== 1 ? 's' : ''}
                            </span>
                          </span>
                        </td>

                        {/* Budget */}
                        <td className="py-4 px-5 font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatCurrency(req.estimated_budget)}
                        </td>

                        {/* Date Created */}
                        <td className="py-4 px-5 text-slate-500 whitespace-nowrap">
                          {formatDate(req.created_at)}
                        </td>

                        {/* Status */}
                        <td className="py-4 px-5 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${getStatusBadge(
                              req.status
                            )}`}
                          >
                            {getReadableStatus(req.status)}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => setSelectedRequisition(req)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                              title="View Details"
                            >
                              <HiEye className="w-4 h-4" />
                            </button>

                            {/* If Returned for Correction, show Correct & Resubmit */}
                            {req.status === 'RETURNED' && (
                              <Link
                                to={`/staff/create-request?id=${req.id}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors font-bold text-[11px]"
                                title="Edit and Correct Requisition"
                              >
                                <HiPencil className="w-3.5 h-3.5 text-amber-600" />
                                <span>Correct & Resubmit</span>
                              </Link>
                            )}

                            {/* If Draft, allow edit and submit */}
                            {isDraft && (
                              <>
                                <Link
                                  to={`/staff/create-request?id=${req.id}`}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                                  title="Edit Draft"
                                >
                                  <HiPencil className="w-4 h-4" />
                                </Link>
                                <button
                                  onClick={() => handleSubmitDraft(req.id)}
                                  disabled={actionLoading}
                                  className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                                  title="Submit Requisition"
                                >
                                  <HiCheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDraft(req.id)}
                                  disabled={actionLoading}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                  title="Delete Draft"
                                >
                                  <HiTrash className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detailed Requisition View Modal */}
        <AnimatePresence>
          {selectedRequisition && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 my-8"
              >
                {/* Modal Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-md border border-violet-100">
                        {selectedRequisition.req_number}
                      </span>
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${getStatusBadge(
                          selectedRequisition.status
                        )}`}
                      >
                        {getReadableStatus(selectedRequisition.status)}
                      </span>
                    </div>
                    <h2 className="text-lg font-black text-slate-900 mt-2">
                      {selectedRequisition.title}
                    </h2>
                  </div>
                  <button
                    onClick={() => setSelectedRequisition(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 text-xs">
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[10px]">Department</span>
                    <span className="font-bold text-slate-800">
                      {selectedRequisition.department_details?.name || 'Assigned Department'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[10px]">Priority</span>
                    <span className="font-bold text-slate-800">
                      {selectedRequisition.priority || 'MEDIUM'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[10px]">Date Initiated</span>
                    <span className="font-bold text-slate-800">
                      {formatDate(selectedRequisition.created_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[10px]">Estimated Budget</span>
                    <span className="font-bold text-violet-700 font-mono">
                      {formatCurrency(selectedRequisition.estimated_budget)}
                    </span>
                  </div>
                </div>

                {/* Clinical Justification */}
                <div className="text-xs space-y-1">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    Clinical / Operational Justification
                  </span>
                  <p className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {selectedRequisition.justification || 'No justification provided.'}
                  </p>
                </div>

                {/* Supporting Document */}
                {selectedRequisition.supporting_document && (
                  <div className="text-xs space-y-1">
                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                      Attached Supporting Document
                    </span>
                    <div className="p-3 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HiPaperClip className="w-4 h-4 text-violet-600" />
                        <span className="font-semibold text-violet-900">Document Attached</span>
                      </div>
                      <a
                        href={selectedRequisition.supporting_document}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-violet-700 underline hover:text-violet-900"
                      >
                        Download / View Document
                      </a>
                    </div>
                  </div>
                )}

                {/* Itemized Table */}
                <div className="space-y-2">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                    Requisition Items Breakdown ({selectedRequisition.items?.length || 0} items)
                  </span>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">Item</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Specs</th>
                          <th className="py-2.5 px-3 text-center">Qty</th>
                          <th className="py-2.5 px-3 text-right">Unit Price</th>
                          <th className="py-2.5 px-3 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedRequisition.items && selectedRequisition.items.length > 0 ? (
                          selectedRequisition.items.map((item, idx) => (
                            <tr key={item.id || idx}>
                              <td className="py-2 px-3 font-bold text-slate-900">{item.item_name}</td>
                              <td className="py-2 px-3 text-slate-600">{item.category || 'N/A'}</td>
                              <td className="py-2 px-3 text-slate-500 truncate max-w-xs">{item.specifications || 'N/A'}</td>
                              <td className="py-2 px-3 text-center font-bold">{item.quantity}</td>
                              <td className="py-2 px-3 text-right font-mono text-slate-700">
                                {formatCurrency(item.estimated_unit_price)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-violet-900">
                                {formatCurrency(item.total_price)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-4 text-center text-slate-400">
                              No items recorded for this requisition.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Immutability Notice for Submitted / Under Review Requisitions */}
                {selectedRequisition.status !== 'DRAFT' && selectedRequisition.status !== 'RETURNED' && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
                    <HiCheckCircle className="w-4 h-4 text-violet-600 flex-shrink-0" />
                    <span>
                      This requisition is in <strong>"{getReadableStatus(selectedRequisition.status)}"</strong> status and is read-only.
                    </span>
                  </div>
                )}

                {/* Return for Correction Banner (if returned) */}
                {selectedRequisition.status === 'RETURNED' && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-2">
                    <div className="flex items-center justify-between text-amber-900 font-bold">
                      <div className="flex items-center gap-2">
                        <HiExclamationCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>Returned for Correction by Purchase Officer</span>
                      </div>
                      {selectedRequisition.reviewed_at && (
                        <span className="text-[10px] text-amber-700">{formatDate(selectedRequisition.reviewed_at)}</span>
                      )}
                    </div>
                    <p className="text-amber-900 bg-white/80 p-3 rounded-xl border border-amber-100 font-medium leading-relaxed">
                      {selectedRequisition.review_comments || 'Please revise the requisition details and resubmit.'}
                    </p>
                    {selectedRequisition.reviewed_by_details && (
                      <p className="text-[10px] text-amber-700">
                        Reviewer: {selectedRequisition.reviewed_by_details.full_name || selectedRequisition.reviewed_by_details.username}
                      </p>
                    )}
                  </div>
                )}

                {/* Modal Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRequisition(null)}
                    className="text-xs"
                  >
                    Close
                  </Button>
                  {selectedRequisition.status === 'DRAFT' && (
                    <div className="flex items-center gap-2">
                      <Link to={`/staff/create-request?id=${selectedRequisition.id}`}>
                        <Button variant="outline" size="sm" className="text-xs font-bold">
                          Edit Draft
                        </Button>
                      </Link>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSubmitDraft(selectedRequisition.id)}
                        isLoading={actionLoading}
                        className="text-xs font-bold"
                      >
                        Submit Requisition
                      </Button>
                    </div>
                  )}
                  {selectedRequisition.status === 'RETURNED' && (
                    <Link to={`/staff/create-request?id=${selectedRequisition.id}`}>
                      <Button variant="primary" size="sm" className="text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                        <HiPencil className="w-3.5 h-3.5" />
                        <span>Edit & Correct Requisition</span>
                      </Button>
                    </Link>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DepartmentStaffLayout>
  );
};

export default MyRequisitionsPage;
