import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiDocumentText,
  HiSearch,
  HiFilter,
  HiRefresh,
  HiCalendar,
  HiClock,
  HiOfficeBuilding,
  HiShieldCheck,
  HiBan,
  HiCheckCircle,
  HiEye,
  HiTag,
  HiInformationCircle,
  HiOutlineSparkles,
  HiClipboardList
} from 'react-icons/hi';
import axiosClient from '../../api/axiosClient';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import Button from '../../components/common/Button';
import RFQDetailModal from '../../components/committee/RFQDetailModal';
import CancelRFQModal from '../../components/committee/CancelRFQModal';

const ProcurementCommitteeRFQsPage = () => {
  const [rfqs, setRfqs] = useState([]);
  const [summary, setSummary] = useState({
    total_rfqs: 0,
    open_rfqs: 0,
    expired_rfqs: 0,
    cancelled_rfqs: 0,
    closed_rfqs: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTab, setStatusTab] = useState('ALL'); // 'ALL', 'OPEN', 'EXPIRED', 'CANCELLED', 'CLOSED'

  // Modals
  const [selectedRFQ, setSelectedRFQ] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [rfqToCancel, setRfqToCancel] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const fetchRFQs = async () => {
    setLoading(true);
    setError('');
    try {
      const [rfqRes, summaryRes] = await Promise.all([
        axiosClient.get('/procurement/rfqs/'),
        axiosClient.get('/procurement/rfqs/summary/')
      ]);
      const data = rfqRes.data?.results || rfqRes.data || [];
      setRfqs(Array.isArray(data) ? data : []);
      if (summaryRes.data) {
        setSummary(summaryRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load Sent RFQs. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRFQs();
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

  const getDaysRemainingText = (dueDateStr, status) => {
    if (status === 'CANCELLED') return 'Cancelled';
    if (status === 'CLOSED') return 'Closed';
    if (!dueDateStr) return 'N/A';
    try {
      const due = new Date(dueDateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      const diffTime = due - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return 'Expired';
      if (diffDays === 0) return 'Due today';
      if (diffDays === 1) return '1 day left';
      return `${diffDays} days left`;
    } catch {
      return dueDateStr;
    }
  };

  const filteredRFQs = useMemo(() => {
    return rfqs.filter((rfq) => {
      const isCancelled = rfq.status === 'CANCELLED';
      const isClosed = rfq.status === 'CLOSED';
      const isExpired = rfq.is_expired || rfq.status === 'EXPIRED';
      const isOpen = !isCancelled && !isClosed && !isExpired && (rfq.status === 'OPEN' || rfq.status === 'SENT');

      // Status Tab filter
      if (statusTab === 'OPEN' && !isOpen) return false;
      if (statusTab === 'EXPIRED' && !isExpired) return false;
      if (statusTab === 'CANCELLED' && !isCancelled) return false;
      if (statusTab === 'CLOSED' && !isClosed) return false;

      // Search Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const rfqNum = (rfq.rfq_number || '').toLowerCase();
        const title = (rfq.title || '').toLowerCase();
        const reqNum = (rfq.requisition_details?.req_number || '').toLowerCase();
        const reqTitle = (rfq.requisition_details?.title || '').toLowerCase();
        const dept = (rfq.requisition_details?.department_name || '').toLowerCase();
        const category = (rfq.requisition_details?.category || '').toLowerCase();

        if (
          !rfqNum.includes(q) &&
          !title.includes(q) &&
          !reqNum.includes(q) &&
          !reqTitle.includes(q) &&
          !dept.includes(q) &&
          !category.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rfqs, statusTab, searchQuery]);

  const handleOpenDetail = (rfq) => {
    setSelectedRFQ(rfq);
    setDetailModalOpen(true);
  };

  const handleOpenCancel = (rfq) => {
    setRfqToCancel(rfq);
    setCancelModalOpen(true);
  };

  const handleRFQUpdated = (updatedRFQ) => {
    setRfqs((prev) => prev.map((r) => (r.id === updatedRFQ.id ? updatedRFQ : r)));
    if (selectedRFQ && selectedRFQ.id === updatedRFQ.id) {
      setSelectedRFQ(updatedRFQ);
    }
    // Refresh stats
    axiosClient.get('/procurement/rfqs/summary/').then((res) => {
      if (res.data) setSummary(res.data);
    });
  };

  return (
    <ProcurementCommitteeLayout
      title="Sent Requests for Quotation (RFQs)"
      subtitle="Manage issued RFQs, track invited vendor engagement, and monitor quotation deadlines."
      onRefresh={fetchRFQs}
    >
      <div className="space-y-6">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-white p-4 rounded-3xl border border-violet-100 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Sent RFQs</span>
              <HiDocumentText className="w-4 h-4 text-violet-500" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              {summary.total_rfqs ?? rfqs.length}
            </div>
            <span className="text-[10px] text-slate-400 block">Issued by Committee</span>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-emerald-100 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">Open / Awaiting</span>
              <HiShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-700">
              {summary.open_rfqs ?? 0}
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold block">Active quotation period</span>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-amber-100 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">Expired</span>
              <HiClock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-700">
              {summary.expired_rfqs ?? 0}
            </div>
            <span className="text-[10px] text-amber-600 font-semibold block">Past deadline</span>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-rose-100 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">Cancelled</span>
              <HiBan className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-700">
              {summary.cancelled_rfqs ?? 0}
            </div>
            <span className="text-[10px] text-rose-600 font-semibold block">Recorded cancellations</span>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-violet-100 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-96">
              <HiSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search RFQ number, title, requisition..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-white"
              />
            </div>

            {/* Status Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs w-full sm:w-auto">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'OPEN', label: 'Open' },
                { key: 'EXPIRED', label: 'Expired' },
                { key: 'CANCELLED', label: 'Cancelled' },
                { key: 'CLOSED', label: 'Closed' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusTab(tab.key)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                    statusTab === tab.key
                      ? 'bg-white text-violet-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Table / Cards */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiClipboardList className="w-5 h-5 text-violet-600" />
              <h3 className="text-sm font-bold text-slate-900">
                RFQ Records ({filteredRFQs.length})
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              Procurement Committee Vendor Sourcing Records
            </span>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <HiRefresh className="w-8 h-8 animate-spin text-violet-600" />
              <p className="text-xs font-medium">Loading sent RFQ records...</p>
            </div>
          ) : filteredRFQs.length === 0 ? (
            <div className="py-16 text-center space-y-2 p-6">
              <HiDocumentText className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">No matching RFQs found</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                {searchQuery || statusTab !== 'ALL'
                  ? 'No RFQs match your current search and filter criteria.'
                  : 'No Requests for Quotation have been issued yet. Open an approved purchase request from "My Assigned Requests" and click "Find Vendors" to create an RFQ.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">RFQ Reference</th>
                    <th className="px-4 py-3">Title &amp; Requisition</th>
                    <th className="px-4 py-3">Department &amp; Category</th>
                    <th className="px-4 py-3 text-center">Invited Vendors</th>
                    <th className="px-4 py-3">Issue Date</th>
                    <th className="px-4 py-3">Deadline</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRFQs.map((rfq) => {
                    const isCancelled = rfq.status === 'CANCELLED';
                    const isClosed = rfq.status === 'CLOSED';
                    const isExpired = rfq.is_expired || rfq.status === 'EXPIRED';
                    const isOpen = !isCancelled && !isClosed && !isExpired;
                    const req = rfq.requisition_details || {};
                    const vendorCount = rfq.invited_vendors_count || (rfq.vendor_invitations || []).length;
                    const remainingText = getDaysRemainingText(rfq.due_date, rfq.status);

                    return (
                      <tr key={rfq.id} className="hover:bg-slate-50/60 transition-colors group">
                        <td className="px-4 py-3.5">
                          <span className="font-mono font-bold text-violet-700 block">
                            {rfq.rfq_number}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            By @{rfq.created_by_details?.username || 'committee'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 max-w-[220px]">
                          <span className="font-bold text-slate-900 block truncate" title={rfq.title}>
                            {rfq.title}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            Linked: {req.req_number || 'N/A'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-medium text-slate-800 block">
                            {req.department_name || req.department?.name || 'General'}
                          </span>
                          <span className="text-[10px] text-violet-700 font-semibold">
                            {req.category || 'Standard'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          {(() => {
                            const quotesCount = rfq.quotations_count ?? (rfq.quotations || []).length;
                            return (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  <HiOfficeBuilding className="w-3 h-3 text-slate-500" />
                                  <span>{vendorCount} Invited</span>
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                  quotesCount === 0
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : quotesCount >= vendorCount
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                }`}>
                                  {quotesCount}/{vendorCount} Quoted
                                </span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-600">
                          {formatDate(rfq.issue_date || rfq.created_at)}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-bold text-slate-800 block">
                            {formatDate(rfq.due_date)}
                          </span>
                          <span
                            className={`text-[10px] font-semibold ${
                              isCancelled
                                ? 'text-slate-400'
                                : isExpired
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {remainingText}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {(() => {
                            const quotesCount = rfq.quotations_count ?? (rfq.quotations || []).length;
                            if (isCancelled) {
                              return (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                                  <HiBan className="w-3 h-3 text-rose-600" />
                                  Cancelled
                                </span>
                              );
                            }
                            if (rfq.has_accepted_quotation || isClosed) {
                              return (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                                  <HiCheckCircle className="w-3 h-3 text-emerald-600" />
                                  Quotation Stage Complete
                                </span>
                              );
                            }
                            if (isExpired) {
                              return (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                                  <HiClock className="w-3 h-3 text-amber-600" />
                                  Expired
                                </span>
                              );
                            }
                            if (quotesCount > 0) {
                              return (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1">
                                  <HiCheckCircle className="w-3 h-3 text-indigo-600" />
                                  Quotations Received ({quotesCount}/{vendorCount})
                                </span>
                              );
                            }
                            return (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                <HiClock className="w-3 h-3 text-amber-600" />
                                Awaiting Quotations
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(rfq)}
                              className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-violet-700 hover:bg-violet-50 transition-colors inline-flex items-center gap-1 border border-slate-200 hover:border-violet-200"
                            >
                              <HiEye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                            {isOpen && (
                              <button
                                type="button"
                                onClick={() => handleOpenCancel(rfq)}
                                className="px-2 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors inline-flex items-center gap-1 border border-rose-100 hover:border-rose-300"
                                title="Cancel this RFQ"
                              >
                                <HiBan className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </button>
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
      </div>

      {/* RFQ Detail Modal */}
      {selectedRFQ && (
        <RFQDetailModal
          rfq={selectedRFQ}
          isOpen={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setSelectedRFQ(null);
          }}
          onRFQUpdated={handleRFQUpdated}
        />
      )}

      {/* Cancel RFQ Modal */}
      {rfqToCancel && (
        <CancelRFQModal
          rfq={rfqToCancel}
          isOpen={cancelModalOpen}
          onClose={() => {
            setCancelModalOpen(false);
            setRfqToCancel(null);
          }}
          onSuccess={handleRFQUpdated}
        />
      )}
    </ProcurementCommitteeLayout>
  );
};

export default ProcurementCommitteeRFQsPage;
