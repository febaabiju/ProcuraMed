import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import VendorLayout from '../../components/layout/VendorLayout';
import Button from '../../components/common/Button';
import ViewQuotationModal from '../../components/vendor/ViewQuotationModal';
import {
  HiDocumentText,
  HiSearch,
  HiRefresh,
  HiCheckCircle,
  HiClock,
  HiX,
  HiEye,
  HiExternalLink,
  HiTag,
  HiCurrencyDollar,
  HiTruck,
  HiCalendar,
  HiExclamation
} from 'react-icons/hi';

const VendorQuotationsPage = () => {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED'
  const [selectedQuotation, setSelectedQuotation] = useState(null);

  const fetchQuotations = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/quotations/');
      const data = res.data?.results || res.data || [];
      setQuotations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load quotations:', err);
      setError('Unable to load quotations. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  const filteredQuotations = quotations.filter((q) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'SUBMITTED' && !['SUBMITTED', 'UNDER_REVIEW'].includes(q.status)) return false;
      if (statusFilter === 'ACCEPTED' && q.status !== 'ACCEPTED') return false;
      if (statusFilter === 'REJECTED' && q.status !== 'REJECTED') return false;
    }

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const qNum = (q.quotation_number || '').toLowerCase();
    const rfqNum = (q.quotation_request?.rfq_number || '').toLowerCase();
    const remarks = (q.remarks || '').toLowerCase();

    return qNum.includes(term) || rfqNum.includes(term) || remarks.includes(term);
  });

  const totalCount = quotations.length;
  const pendingReviewCount = quotations.filter((q) => ['SUBMITTED', 'UNDER_REVIEW'].includes(q.status)).length;
  const acceptedCount = quotations.filter((q) => q.status === 'ACCEPTED').length;
  const rejectedCount = quotations.filter((q) => q.status === 'REJECTED').length;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
            <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Accepted
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
            <HiX className="w-3.5 h-3.5 text-rose-600" />
            Rejected
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
            <HiClock className="w-3.5 h-3.5 text-amber-600" />
            Under Review
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">
            <HiCheckCircle className="w-3.5 h-3.5 text-blue-600" />
            Submitted
          </span>
        );
    }
  };

  return (
    <VendorLayout
      title="Submitted Quotations"
      subtitle="Track evaluation status, pricing breakdown, and awards for quotations submitted to hospital procurement."
      onRefresh={fetchQuotations}
    >
      <div className="space-y-6">
        {/* 1. Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-3xl p-5 border border-violet-100 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <HiDocumentText className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 leading-tight block">
                {totalCount}
              </span>
              <span className="text-xs font-bold text-slate-500">Total Submitted</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-amber-100 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <HiClock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-amber-900 leading-tight block">
                {pendingReviewCount}
              </span>
              <span className="text-xs font-bold text-slate-500">Under Review</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-emerald-100 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <HiCheckCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-emerald-900 leading-tight block">
                {acceptedCount}
              </span>
              <span className="text-xs font-bold text-slate-500">Accepted Proposals</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
              <HiX className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-700 leading-tight block">
                {rejectedCount}
              </span>
              <span className="text-xs font-bold text-slate-500">Not Awarded</span>
            </div>
          </div>
        </div>

        {/* 2. Controls & Filter Tabs */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-xs p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl text-xs font-bold overflow-x-auto">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3.5 py-1.5 rounded-xl transition ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-violet-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => setStatusFilter('SUBMITTED')}
                className={`px-3.5 py-1.5 rounded-xl transition ${
                  statusFilter === 'SUBMITTED'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Under Review ({pendingReviewCount})
              </button>
              <button
                onClick={() => setStatusFilter('ACCEPTED')}
                className={`px-3.5 py-1.5 rounded-xl transition ${
                  statusFilter === 'ACCEPTED'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Accepted ({acceptedCount})
              </button>
              <button
                onClick={() => setStatusFilter('REJECTED')}
                className={`px-3.5 py-1.5 rounded-xl transition ${
                  statusFilter === 'REJECTED'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Not Awarded ({rejectedCount})
              </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2.5">
              <div className="relative flex-grow md:w-72">
                <HiSearch className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search Quotation #, RFQ #..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 font-medium text-slate-800"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <HiX className="w-4 h-4" />
                  </button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchQuotations}
                disabled={loading}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 p-2.5"
                title="Refresh Quotations"
              >
                <HiRefresh className={`w-4 h-4 ${loading ? 'animate-spin text-violet-600' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* 3. Quotations List */}
        {loading ? (
          <div className="bg-white rounded-3xl border border-violet-100 p-16 text-center space-y-3">
            <HiRefresh className="w-8 h-8 animate-spin text-violet-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">Loading submitted quotations...</h4>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center space-y-4">
            <HiExclamation className="w-8 h-8 text-rose-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">{error}</h4>
            <Button variant="primary" size="sm" onClick={fetchQuotations} className="mx-auto">
              Retry
            </Button>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="bg-white rounded-3xl border border-violet-100 p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto border border-purple-100">
              <HiDocumentText className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {searchTerm ? 'No quotations match your search' : 'No submitted quotations found'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              When you submit proposals for purchase requests and RFQs, they will be listed here.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-violet-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Quotation Ref</th>
                    <th className="px-5 py-3.5">Linked RFQ</th>
                    <th className="px-5 py-3.5">Quoted Total</th>
                    <th className="px-5 py-3.5">Lead Time</th>
                    <th className="px-5 py-3.5">Submitted On</th>
                    <th className="px-5 py-3.5">Evaluation Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredQuotations.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-5 py-4 font-mono font-bold text-violet-700 whitespace-nowrap">
                        {q.quotation_number}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-bold text-slate-800 block">
                          {q.quotation_request?.rfq_number || 'RFQ Reference'}
                        </span>
                        <span className="text-[11px] text-slate-400 block truncate max-w-[200px]">
                          {q.quotation_request?.title || 'Hospital RFQ'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-black text-slate-900 whitespace-nowrap text-sm">
                        {formatCurrency(q.total_amount)}
                        {(parseFloat(q.tax_amount || 0) > 0 || parseFloat(q.shipping_charges || 0) > 0) && (
                          <span className="text-[10px] text-slate-400 font-normal block">
                            Incl. Tax &amp; Freight
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="flex items-center gap-1 font-bold text-slate-700">
                          <HiTruck className="w-3.5 h-3.5 text-slate-400" />
                          {q.lead_time_days ? `${q.lead_time_days} Days` : 'N/A'}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500">
                        {formatDate(q.submission_date)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {getStatusBadge(q.status)}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedQuotation(q)}
                            className="text-xs font-bold text-violet-700 border-violet-200 hover:bg-violet-50 py-1 px-2.5"
                          >
                            <HiEye className="w-3.5 h-3.5" />
                            <span>Details</span>
                          </Button>

                          {(q.quotation_document_url || q.quotation_document) && (
                            <a
                              href={q.quotation_document_url || q.quotation_document}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
                              title="Download Quotation Proposal"
                            >
                              <HiExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ViewQuotationModal
        isOpen={Boolean(selectedQuotation)}
        onClose={() => setSelectedQuotation(null)}
        quotation={selectedQuotation}
      />
    </VendorLayout>
  );
};

export default VendorQuotationsPage;
