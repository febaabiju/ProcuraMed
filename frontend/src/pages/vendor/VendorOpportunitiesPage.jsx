import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import VendorLayout from '../../components/layout/VendorLayout';
import Button from '../../components/common/Button';
import RFQDetailsModal from '../../components/vendor/RFQDetailsModal';
import SubmitQuotationModal from '../../components/vendor/SubmitQuotationModal';
import ViewQuotationModal from '../../components/vendor/ViewQuotationModal';
import {
  HiClipboardList,
  HiSearch,
  HiFilter,
  HiRefresh,
  HiClock,
  HiCheckCircle,
  HiCalendar,
  HiTag,
  HiLocationMarker,
  HiOfficeBuilding,
  HiCurrencyDollar,
  HiEye,
  HiExclamation,
  HiChevronRight,
  HiCheck,
  HiX
} from 'react-icons/hi';

const VendorOpportunitiesPage = () => {
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL', 'PENDING', 'QUOTED', 'CLOSED'

  // Modals state
  const [detailsModalRfqId, setDetailsModalRfqId] = useState(null);
  const [selectedRfqForDetails, setSelectedRfqForDetails] = useState(null);
  const [selectedRfqForQuote, setSelectedRfqForQuote] = useState(null);
  const [selectedQuotationForView, setSelectedQuotationForView] = useState(null);

  const fetchRFQs = async () => {
    setLoading(true);
    setError('');
    try {
      // Backend automatically scopes to this vendor's invitations!
      const res = await axiosClient.get('/procurement/rfqs/');
      const data = res.data?.results || res.data || [];
      setRfqs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load RFQs:', err);
      setError('Unable to load purchase requests and RFQs. Please check your network or try again.');
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

  // Helper calculation for countdown
  const getDaysRemaining = (dueDateStr) => {
    if (!dueDateStr) return null;
    const due = new Date(dueDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Tab Filtering & Search
  const filteredRfqs = rfqs.filter((rfq) => {
    const req = rfq.requisition_details || {};
    const myInv = rfq.my_invitation;
    const myQuote = rfq.my_quotation;
    const isQuoted = Boolean(myQuote || myInv?.status === 'QUOTED');
    const isExpired = rfq.is_expired || (rfq.due_date && new Date(rfq.due_date) < new Date(new Date().setHours(0, 0, 0, 0)));
    const isClosed = rfq.status === 'CLOSED';

    // Tab filter
    if (activeTab === 'PENDING') {
      if (isQuoted || isExpired || isClosed) return false;
    } else if (activeTab === 'QUOTED') {
      if (!isQuoted) return false;
    } else if (activeTab === 'CLOSED') {
      if (!isClosed && !isExpired) return false;
    }

    // Search filter
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const rfqNum = (rfq.rfq_number || '').toLowerCase();
    const reqNum = (req.requisition_number || '').toLowerCase();
    const title = (rfq.title || '').toLowerCase();
    const itemName = (req.item_name || '').toLowerCase();
    const dept = (req.department_details?.name || '').toLowerCase();
    const cat = (req.category || '').toLowerCase();

    return (
      rfqNum.includes(q) ||
      reqNum.includes(q) ||
      title.includes(q) ||
      itemName.includes(q) ||
      dept.includes(q) ||
      cat.includes(q)
    );
  });

  // Stats calculation
  const totalReceived = rfqs.length;
  const pendingActionCount = rfqs.filter((r) => {
    const isQuoted = Boolean(r.my_quotation || r.my_invitation?.status === 'QUOTED');
    const isExpired = r.is_expired || (r.due_date && new Date(r.due_date) < new Date(new Date().setHours(0, 0, 0, 0)));
    return !isQuoted && !isExpired && r.status !== 'CLOSED';
  }).length;
  const quotedCount = rfqs.filter((r) => Boolean(r.my_quotation || r.my_invitation?.status === 'QUOTED')).length;
  const acceptedCount = rfqs.filter((r) => r.my_quotation?.status === 'ACCEPTED').length;

  const handleOpenDetails = (rfq) => {
    setSelectedRfqForDetails(rfq);
    setDetailsModalRfqId(rfq.id);
  };

  const handleOpenSubmit = (rfq) => {
    setSelectedRfqForQuote(rfq);
  };

  const handleOpenViewQuote = (quotation) => {
    setSelectedQuotationForView(quotation);
  };

  const handleQuotationSubmitted = () => {
    fetchRFQs();
  };

  return (
    <VendorLayout
      title="Purchase Requests / Quotation Requests"
      subtitle="View RFQs issued directly to your organization by the Procurement Committee and submit formal price quotations."
      onRefresh={fetchRFQs}
    >
      <div className="space-y-6">
        {/* 1. Stats Ribbon */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-3xl p-5 border border-violet-100 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <HiClipboardList className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 leading-tight block">
                {totalReceived}
              </span>
              <span className="text-xs font-bold text-slate-500">Total RFQs Received</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-amber-100 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <HiClock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-amber-900 leading-tight block">
                {pendingActionCount}
              </span>
              <span className="text-xs font-bold text-slate-500">Pending Quotation</span>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-5 border border-blue-100 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <HiCurrencyDollar className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-black text-blue-900 leading-tight block">
                {quotedCount}
              </span>
              <span className="text-xs font-bold text-slate-500">Quotations Submitted</span>
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
        </div>

        {/* 2. Controls & Tabs */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-xs p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl text-xs font-bold overflow-x-auto">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-3.5 py-1.5 rounded-xl transition ${
                  activeTab === 'ALL'
                    ? 'bg-white text-violet-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Requests ({totalReceived})
              </button>
              <button
                onClick={() => setActiveTab('PENDING')}
                className={`px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                  activeTab === 'PENDING'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Pending Action</span>
                {pendingActionCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px]">
                    {pendingActionCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('QUOTED')}
                className={`px-3.5 py-1.5 rounded-xl transition ${
                  activeTab === 'QUOTED'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Quotations Submitted ({quotedCount})
              </button>
              <button
                onClick={() => setActiveTab('CLOSED')}
                className={`px-3.5 py-1.5 rounded-xl transition ${
                  activeTab === 'CLOSED'
                    ? 'bg-white text-slate-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Closed / Expired
              </button>
            </div>

            {/* Search & Refresh */}
            <div className="flex items-center gap-2.5">
              <div className="relative flex-grow md:w-72">
                <HiSearch className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search RFQ #, Item, Dept..."
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
                onClick={fetchRFQs}
                disabled={loading}
                className="border-slate-200 text-slate-700 hover:bg-slate-50 p-2.5"
                title="Refresh Requests"
              >
                <HiRefresh className={`w-4 h-4 ${loading ? 'animate-spin text-violet-600' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* 3. Requests List */}
        {loading ? (
          <div className="bg-white rounded-3xl border border-violet-100 p-16 text-center space-y-3">
            <HiRefresh className="w-8 h-8 animate-spin text-violet-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">Loading purchase requests...</h4>
            <p className="text-xs text-slate-400">Retrieving RFQs sent specifically to your vendor account.</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl border border-rose-200 p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <HiExclamation className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">{error}</h4>
              <p className="text-xs text-slate-500 mt-1">Please verify your connection and reload.</p>
            </div>
            <Button variant="primary" size="sm" onClick={fetchRFQs} className="mx-auto">
              Retry
            </Button>
          </div>
        ) : filteredRfqs.length === 0 ? (
          <div className="bg-white rounded-3xl border border-violet-100 p-12 text-center space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto border border-violet-100">
              <HiClipboardList className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {searchTerm
                  ? 'No quotation requests match your search criteria'
                  : activeTab === 'PENDING'
                  ? 'No pending quotation requests awaiting your action'
                  : activeTab === 'QUOTED'
                  ? 'No quotations submitted yet'
                  : 'No quotation requests received yet'}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                {searchTerm
                  ? 'Try adjusting your search keywords or clear the search filter.'
                  : 'When the Procurement Committee selects your company for purchase requisitions, quotation requests will appear here.'}
              </p>
            </div>
            {searchTerm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="border-slate-200 text-slate-700 mx-auto"
              >
                Clear Search Filter
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRfqs.map((rfq) => {
              const req = rfq.requisition_details || {};
              const myInv = rfq.my_invitation;
              const myQuote = rfq.my_quotation;
              const isQuoted = Boolean(myQuote || myInv?.status === 'QUOTED');
              const isExpired = rfq.is_expired || (rfq.due_date && new Date(rfq.due_date) < new Date(new Date().setHours(0, 0, 0, 0)));
              const isClosed = rfq.status === 'CLOSED';
              const daysRemaining = getDaysRemaining(rfq.due_date);

              return (
                <div
                  key={rfq.id}
                  className="bg-white rounded-3xl border border-violet-100 shadow-xs hover:shadow-md transition p-5 sm:p-6 space-y-4"
                >
                  {/* Top Bar: IDs, Category, and Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200">
                        {rfq.rfq_number}
                      </span>
                      {req.requisition_number && (
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                          PR: {req.requisition_number}
                        </span>
                      )}
                      {(req.category || rfq.items?.[0]?.category) && (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center gap-1">
                          <HiTag className="w-3 h-3 text-violet-500" />
                          {req.category || rfq.items?.[0]?.category}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Invitation Status Badge */}
                      {isQuoted ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          Quotation Submitted
                          {myQuote?.quotation_number && ` (${myQuote.quotation_number})`}
                        </span>
                      ) : myInv?.status === 'VIEWED' ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                          <HiEye className="w-3.5 h-3.5 text-blue-500" />
                          Viewed &bull; Pending Quotation
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <HiClock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                          New Request Received
                        </span>
                      )}

                      {/* RFQ Status Badge */}
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                          isExpired
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isClosed
                            ? 'bg-slate-100 text-slate-700 border-slate-300'
                            : 'bg-violet-50 text-violet-700 border-violet-200'
                        }`}
                      >
                        {isExpired ? 'Expired' : isClosed ? 'Closed' : rfq.status_display || rfq.status}
                      </span>
                    </div>
                  </div>

                  {/* Main Grid: Scope, Quantity, Department, Deadline */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    {/* Item Scope */}
                    <div className="md:col-span-2 space-y-1">
                      <h3 className="text-sm font-black text-slate-900 leading-snug">
                        {req.item_name || rfq.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {req.technical_specifications || req.description || req.justification || 'No additional technical specifications provided.'}
                      </p>
                    </div>

                    {/* Quantity & Unit */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Required Quantity</span>
                      <span className="font-black text-slate-900 text-sm text-violet-800 block">
                        {req.quantity ? `${req.quantity} ${req.unit || 'Units'}` : (rfq.items?.[0]?.quantity ? `${rfq.items[0].quantity} ${rfq.items[0].unit_of_measurement || 'Units'}` : '1 Unit')}
                      </span>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <HiOfficeBuilding className="w-3 h-3 text-slate-400" />
                        {req.department_details?.name || 'Hospital Department'}
                      </span>
                    </div>

                    {/* Deadline */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Submission Deadline</span>
                      <span
                        className={`font-black text-sm block ${
                          isExpired
                            ? 'text-rose-600'
                            : daysRemaining !== null && daysRemaining <= 3
                            ? 'text-amber-600'
                            : 'text-slate-800'
                        }`}
                      >
                        {formatDate(rfq.due_date)}
                      </span>
                      <span className="text-[10px] text-slate-500 block">
                        {isExpired
                          ? 'Bidding Closed'
                          : daysRemaining !== null && daysRemaining >= 0
                          ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`
                          : 'Active Opportunity'}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <HiCalendar className="w-3.5 h-3.5" />
                      <span>Issued: {formatDate(rfq.created_at || rfq.issue_date)}</span>
                      {rfq.delivery_location && (
                        <>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <HiLocationMarker className="w-3.5 h-3.5 text-slate-400" />
                            {rfq.delivery_location}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDetails(rfq)}
                        className="text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50"
                      >
                        <HiEye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </Button>

                      {isQuoted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenViewQuote(myQuote)}
                          className="text-xs font-bold text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                        >
                          <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>View My Quotation</span>
                        </Button>
                      ) : !isExpired && !isClosed ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleOpenSubmit(rfq)}
                          className="text-xs font-bold text-white shadow-md shadow-violet-500/20"
                          style={{ background: 'linear-gradient(135deg, #8B7CF8, #6D5BD0)' }}
                        >
                          <HiCurrencyDollar className="w-3.5 h-3.5" />
                          <span>Submit Quotation</span>
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          Opportunity closed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODALS */}
      <RFQDetailsModal
        isOpen={Boolean(detailsModalRfqId)}
        onClose={() => {
          setDetailsModalRfqId(null);
          setSelectedRfqForDetails(null);
        }}
        rfqId={detailsModalRfqId}
        initialRfq={selectedRfqForDetails}
        onSubmitQuotation={(rfq) => {
          handleOpenSubmit(rfq);
        }}
        onViewQuotation={(quote) => {
          handleOpenViewQuote(quote);
        }}
        onStatusChanged={() => {
          fetchRFQs();
        }}
      />

      <SubmitQuotationModal
        isOpen={Boolean(selectedRfqForQuote)}
        onClose={() => setSelectedRfqForQuote(null)}
        rfq={selectedRfqForQuote}
        onQuotationSubmitted={handleQuotationSubmitted}
      />

      <ViewQuotationModal
        isOpen={Boolean(selectedQuotationForView)}
        onClose={() => setSelectedQuotationForView(null)}
        quotation={selectedQuotationForView}
      />
    </VendorLayout>
  );
};

export default VendorOpportunitiesPage;
