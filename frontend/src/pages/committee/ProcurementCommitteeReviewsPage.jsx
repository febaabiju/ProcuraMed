import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import RequisitionDetailModal from '../../components/committee/RequisitionDetailModal';
import VendorSourcingModal from '../../components/committee/VendorSourcingModal';
import {
  HiCheckCircle,
  HiEye,
  HiSearch,
  HiX,
  HiRefresh,
  HiShieldCheck,
  HiClipboardCheck,
  HiInformationCircle,
  HiShoppingBag
} from 'react-icons/hi';

const ProcurementCommitteeReviewsPage = () => {
  const [data, setData] = useState({
    user: null,
    pending_reviews: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal State
  const [selectedReq, setSelectedReq] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Vendor Sourcing Modal State
  const [sourcingReq, setSourcingReq] = useState(null);
  const [sourcingModalOpen, setSourcingModalOpen] = useState(false);

  const fetchPendingReviews = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/committee-dashboard/');
      setData({
        user: res.data.user || null,
        pending_reviews: res.data.pending_reviews || []
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load assigned procurement requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingReviews();
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

  // Distinct filter values
  const uniqueDepartments = useMemo(() => {
    const set = new Set();
    data.pending_reviews.forEach(r => {
      if (r.department_name && r.department_name !== 'N/A') set.add(r.department_name);
    });
    return Array.from(set).sort();
  }, [data.pending_reviews]);

  const uniqueCategories = useMemo(() => {
    const set = new Set();
    data.pending_reviews.forEach(r => {
      if (r.category && r.category !== 'N/A') set.add(r.category);
    });
    return Array.from(set).sort();
  }, [data.pending_reviews]);

  // Filter pending reviews
  const filteredPending = useMemo(() => {
    return data.pending_reviews.filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesReq = item.req_number?.toLowerCase().includes(q);
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesItem = item.item_name?.toLowerCase().includes(q);
        const matchesDept = item.department_name?.toLowerCase().includes(q);
        if (!matchesReq && !matchesTitle && !matchesItem && !matchesDept) return false;
      }
      if (selectedDepartment !== 'ALL' && item.department_name !== selectedDepartment) {
        return false;
      }
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [data.pending_reviews, searchQuery, selectedDepartment, selectedCategory]);

  const handleOpenDetail = (req) => {
    setSelectedReq(req);
    setDetailModalOpen(true);
  };

  const handleOpenSourcing = (req) => {
    setSourcingReq(req);
    setSourcingModalOpen(true);
  };

  return (
    <ProcurementCommitteeLayout
      title="My Assigned Purchase Requests"
      subtitle="Purchase-ready requests assigned directly to your queue. Inspect specifications and source registered vendors."
      committeeUser={data.user}
      onRefresh={fetchPendingReviews}
    >
      <div className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700 font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* Search & Filters */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-violet-100 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-96">
              <HiSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by requisition number, item, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
              >
                <option value="ALL">All Departments</option>
                {uniqueDepartments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-violet-500"
              >
                <option value="ALL">All Categories</option>
                {uniqueCategories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Content Table / Cards */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiShoppingBag className="w-5 h-5 text-violet-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Assigned Requisitions ({filteredPending.length})
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              Assigned directly to you • Equal Workload Allocation
            </span>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
              <HiRefresh className="w-8 h-8 animate-spin text-violet-600" />
              <p className="text-xs font-medium">Loading assigned requests...</p>
            </div>
          ) : filteredPending.length === 0 ? (
            <div className="py-16 text-center space-y-2 p-6">
              <HiClipboardCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-700">No matching purchase requests found</p>
              <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                No purchase requests match your current filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">Req Number</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Item Details</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-center">Qty</th>
                    <th className="px-4 py-3">Estimated Budget</th>
                    <th className="px-4 py-3">Required Date</th>
                    <th className="px-4 py-3">Technical Evaluation</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPending.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors group">
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-violet-700 block">
                          {req.req_number}
                        </span>
                        <span className="text-[11px] text-slate-500 line-clamp-1 max-w-[180px]">
                          {req.title}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-800 whitespace-nowrap">
                        {req.department_name}
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900 max-w-[200px]">
                        <span className="line-clamp-1">{req.item_name}</span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                        {req.category}
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-800">
                        {req.quantity}
                      </td>
                      <td className="px-4 py-3.5 font-extrabold text-slate-900 whitespace-nowrap">
                        {formatCurrency(req.estimated_budget)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">
                        {formatDate(req.required_date)}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{req.technical_evaluation_result || 'Technically Suitable'}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenDetail(req)}
                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-violet-700 hover:bg-violet-50 transition-colors inline-flex items-center gap-1 border border-slate-200 hover:border-violet-200"
                          >
                            <HiEye className="w-3.5 h-3.5" />
                            <span>View Details</span>
                          </button>
                          <button
                            onClick={() => handleOpenSourcing(req)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 transition-colors inline-flex items-center gap-1 shadow-sm shadow-violet-500/20"
                          >
                            <HiSearch className="w-3.5 h-3.5" />
                            <span>Find Vendors</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Requisition Detail Modal */}
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

export default ProcurementCommitteeReviewsPage;
