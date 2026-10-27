import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiTruck,
  HiSearch,
  HiFilter,
  HiRefresh,
  HiCalendar,
  HiLocationMarker,
  HiInformationCircle,
  HiCheckCircle,
  HiClock,
  HiEye,
  HiX,
  HiExclamationCircle,
  HiShoppingBag,
  HiDocumentText,
  HiCheck,
  HiPlus,
  HiPencilAlt,
  HiShieldCheck
} from 'react-icons/hi';
import axiosClient from '../../api/axiosClient';
import VendorLayout from '../../components/layout/VendorLayout';
import Button from '../../components/common/Button';

const VendorDeliveriesPage = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PREPARING' | 'DISPATCHED' | 'DELIVERED_TO_HOSPITAL'

  // Modals
  const [dispatchPO, setDispatchPO] = useState(null);
  const [historyPO, setHistoryPO] = useState(null);
  const [detailsPO, setDetailsPO] = useState(null);

  // Dispatch Status Form State
  const [dispatchStatus, setDispatchStatus] = useState('PREPARING');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [submittingDispatch, setSubmittingDispatch] = useState(false);
  const [dispatchError, setDispatchError] = useState('');

  const fetchOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/purchase-orders/');
      const data = res.data.results || res.data || [];
      setPurchaseOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to load purchase orders. Please refresh or retry.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
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

  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = purchaseOrders.length;
    const preparing = purchaseOrders.filter(
      po => (po.vendor_dispatch_status === 'PREPARING' || !po.vendor_dispatch_status)
    ).length;
    const dispatched = purchaseOrders.filter(
      po => po.vendor_dispatch_status === 'DISPATCHED'
    ).length;
    const deliveredHospital = purchaseOrders.filter(
      po => po.vendor_dispatch_status === 'DELIVERED_TO_HOSPITAL'
    ).length;
    const confirmedReceipt = purchaseOrders.filter(
      po => po.delivery_status === 'DELIVERED'
    ).length;
    return { total, preparing, dispatched, deliveredHospital, confirmedReceipt };
  }, [purchaseOrders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (statusFilter !== 'ALL') {
        const dStatus = po.vendor_dispatch_status || 'PREPARING';
        if (dStatus !== statusFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const poNum = (po.po_number || '').toLowerCase();
        const reqNum = (po.requisition_details?.req_number || '').toLowerCase();
        const tracking = (po.vendor_tracking_number || '').toLowerCase();
        const itemNames = (po.items || []).map(i => i.item_name.toLowerCase()).join(' ');

        const match =
          poNum.includes(q) ||
          reqNum.includes(q) ||
          tracking.includes(q) ||
          itemNames.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [purchaseOrders, statusFilter, searchQuery]);

  // Open Dispatch Modal
  const handleOpenDispatchModal = (po) => {
    setDispatchPO(po);
    setDispatchStatus(po.vendor_dispatch_status || 'PREPARING');
    setTrackingNumber(po.vendor_tracking_number || '');
    setDispatchNotes(po.vendor_dispatch_notes || '');
    setDispatchError('');
  };

  // Submit Dispatch Update
  const handleSubmitDispatch = async (e) => {
    e.preventDefault();
    if (!dispatchPO) return;
    setDispatchError('');
    setSubmittingDispatch(true);

    try {
      await axiosClient.post(`/procurement/purchase-orders/${dispatchPO.id}/update-dispatch-status/`, {
        dispatch_status: dispatchStatus,
        tracking_number: trackingNumber.trim(),
        notes: dispatchNotes.trim()
      });

      setSuccessMessage(`Dispatch status updated to "${dispatchStatus.replace(/_/g, ' ')}" for PO ${dispatchPO.po_number}.`);
      setDispatchPO(null);
      await fetchOrders();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setDispatchError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to update dispatch status. Please retry.'
      );
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const getDispatchStatusBadge = (status) => {
    switch (status) {
      case 'DELIVERED_TO_HOSPITAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <HiCheck className="w-3.5 h-3.5 text-purple-600" />
            <span>Delivered to Hospital</span>
          </span>
        );
      case 'DISPATCHED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <HiTruck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Dispatched / In Transit</span>
          </span>
        );
      case 'PREPARING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <HiClock className="w-3.5 h-3.5 text-slate-500" />
            <span>Preparing Order</span>
          </span>
        );
    }
  };

  const getHospitalDeliveryBadge = (status) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <HiCheckCircle className="w-3 h-3 text-emerald-600" />
            <span>Hospital Verified &amp; Received</span>
          </span>
        );
      case 'PARTIALLY_DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <HiClock className="w-3 h-3 text-blue-600" />
            <span>Partially Received</span>
          </span>
        );
      case 'DELIVERY_ISSUE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <HiExclamationCircle className="w-3 h-3 text-rose-600" />
            <span>Delivery Issue Noted</span>
          </span>
        );
      case 'AWAITING_DELIVERY':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <HiClock className="w-3 h-3 text-amber-600" />
            <span>Hospital Receipt Pending</span>
          </span>
        );
    }
  };

  return (
    <VendorLayout
      title="Deliveries & Consignments"
      subtitle="Track purchase orders, update shipping and dispatch statuses, and monitor hospital receipt verification."
      onRefresh={fetchOrders}
    >
      <div className="space-y-6">
        {/* Success Alert */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center justify-between shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
              <button
                onClick={() => setSuccessMessage('')}
                className="text-emerald-600 hover:text-emerald-800 text-xs font-bold"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center gap-2.5">
            <HiExclamationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 5 Summary Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Purchase Orders
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-black text-slate-900">{metrics.total}</span>
              <HiShoppingBag className="w-5 h-5 text-slate-400" />
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Assigned to your company</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block">
              In Preparation
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-black text-slate-800">{metrics.preparing}</span>
              <HiClock className="w-5 h-5 text-slate-400" />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">Packing &amp; preparing</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-2xs bg-gradient-to-br from-white to-indigo-50/30">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block">
              Dispatched / In Transit
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-black text-indigo-700">{metrics.dispatched}</span>
              <HiTruck className="w-5 h-5 text-indigo-500" />
            </div>
            <span className="text-[11px] text-indigo-600/80 mt-1 block">En route with carrier</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-purple-200/80 shadow-2xs bg-gradient-to-br from-white to-purple-50/30">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 block">
              Delivered to Hospital
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-black text-purple-700">{metrics.deliveredHospital}</span>
              <HiCheck className="w-5 h-5 text-purple-500" />
            </div>
            <span className="text-[11px] text-purple-600/80 mt-1 block">Arrived at hospital gate</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-2xs bg-gradient-to-br from-white to-emerald-50/30">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
              Hospital Confirmed
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-black text-emerald-700">{metrics.confirmedReceipt}</span>
              <HiShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-[11px] text-emerald-600/80 mt-1 block">Inspected &amp; received</span>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'ALL', label: 'All Shipments' },
              { id: 'PREPARING', label: 'Preparing' },
              { id: 'DISPATCHED', label: 'Dispatched / In Transit' },
              { id: 'DELIVERED_TO_HOSPITAL', label: 'Delivered to Hospital' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <HiSearch className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search PO, tracking, items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
              title="Refresh"
            >
              <HiRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Deliveries Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Your Issued Purchase Orders &amp; Dispatch Status
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Update shipment dispatch milestones (Preparing, Dispatched, Delivered to Hospital) and review hospital inspection logs.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <HiRefresh className="w-8 h-8 animate-spin text-violet-600 mb-2" />
              <span className="text-xs font-semibold">Loading orders...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-20 text-center">
              <HiTruck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">No Purchase Orders Found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'No purchase orders matched your search or status filter.'
                  : 'You do not have any issued purchase orders currently.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Purchase Order</th>
                    <th className="py-3 px-4">Ordered Items &amp; Qty</th>
                    <th className="py-3 px-4">Destination &amp; Schedule</th>
                    <th className="py-3 px-4">Your Dispatch Status</th>
                    <th className="py-3 px-4">Hospital Receipt Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((po) => {
                    const historyCount = (po.delivery_history || []).length;
                    return (
                      <tr key={po.id} className="hover:bg-slate-50/50 transition">
                        {/* PO Info */}
                        <td className="py-3.5 px-4 align-top">
                          <span className="font-mono font-bold text-slate-900 block text-xs">
                            {po.po_number}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            Order Date: {formatDate(po.order_date)}
                          </span>
                          <span className="text-[11px] font-bold text-slate-800 font-mono block mt-0.5">
                            {formatCurrency(po.total_amount)}
                          </span>
                          {po.requisition_details?.req_number && (
                            <span className="text-[10px] text-violet-600 font-mono block mt-0.5">
                              PR: {po.requisition_details.req_number}
                            </span>
                          )}
                        </td>

                        {/* Items */}
                        <td className="py-3.5 px-4 align-top min-w-[200px]">
                          <div className="space-y-1">
                            {(po.items || []).map((it) => (
                              <div key={it.id} className="text-[11px] flex items-center justify-between gap-2 border-b border-slate-50 pb-0.5">
                                <span className="font-medium text-slate-800 truncate max-w-[130px]" title={it.item_name}>
                                  {it.item_name}
                                </span>
                                <span className="font-mono text-[10px] text-slate-600 whitespace-nowrap">
                                  <strong>{it.quantity}</strong> ordered
                                  {it.total_quantity_received > 0 && (
                                    <span className="text-emerald-600 ml-1">({it.total_quantity_received} received)</span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Destination */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-slate-800 block">
                              {po.delivery_location || 'Hospital Central Procurement Stores'}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              Expected: <strong>{formatDate(po.expected_delivery_date)}</strong>
                            </span>
                          </div>
                        </td>

                        {/* Dispatch Status */}
                        <td className="py-3.5 px-4 align-top">
                          <div>
                            {getDispatchStatusBadge(po.vendor_dispatch_status)}
                            {po.vendor_tracking_number && (
                              <span className="text-[10px] text-slate-600 font-mono block mt-1">
                                Trk: <strong>{po.vendor_tracking_number}</strong>
                              </span>
                            )}
                            {po.vendor_dispatched_at && (
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Dispatched: {formatDate(po.vendor_dispatched_at)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Hospital Delivery Status */}
                        <td className="py-3.5 px-4 align-top">
                          <div>
                            {getHospitalDeliveryBadge(po.delivery_status)}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenDispatchModal(po)}
                              className="px-2.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition"
                              title="Update dispatch milestone"
                            >
                              <HiPencilAlt className="w-3.5 h-3.5" />
                              <span>Update Dispatch</span>
                            </button>

                            <button
                              onClick={() => setHistoryPO(po)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition"
                              title="View hospital inspection reports"
                            >
                              <HiClock className="w-3.5 h-3.5 text-slate-500" />
                              <span>History {historyCount > 0 ? `(${historyCount})` : ''}</span>
                            </button>

                            <button
                              onClick={() => setDetailsPO(po)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                              title="View order details"
                            >
                              <HiEye className="w-4 h-4" />
                            </button>
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

        {/* Modal: Update Dispatch Status */}
        <AnimatePresence>
          {dispatchPO && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden"
              >
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-violet-50/70">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-xs">
                      <HiTruck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Update Dispatch Status
                      </h3>
                      <p className="text-xs text-slate-500">
                        PO: <strong className="font-mono text-violet-700">{dispatchPO.po_number}</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDispatchPO(null)}
                    disabled={submittingDispatch}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmitDispatch}>
                  <div className="p-6 space-y-4 text-xs">
                    {/* Error Alert */}
                    {dispatchError && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                        <HiExclamationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                        <span>{dispatchError}</span>
                      </div>
                    )}

                    {/* Notice */}
                    <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
                      <HiInformationCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-blue-800 leading-relaxed">
                        Updating your dispatch status notifies hospital procurement that the shipment is underway. Official goods receipt will be confirmed by the Purchase Officer upon physical dock inspection.
                      </p>
                    </div>

                    {/* Status Options */}
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1.5">
                        Consignment Dispatch Stage *
                      </label>
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          {
                            id: 'PREPARING',
                            label: 'Preparing Consignment',
                            desc: 'Goods are being packed and inspected in your warehouse.'
                          },
                          {
                            id: 'DISPATCHED',
                            label: 'Dispatched / In Transit',
                            desc: 'Consignment handed over to courier / freight carrier.'
                          },
                          {
                            id: 'DELIVERED_TO_HOSPITAL',
                            label: 'Delivered to Hospital',
                            desc: 'Vehicle arrived at hospital receiving dock.'
                          }
                        ].map((option) => (
                          <label
                            key={option.id}
                            onClick={() => setDispatchStatus(option.id)}
                            className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                              dispatchStatus === option.id
                                ? 'bg-violet-50/60 border-violet-400 ring-2 ring-violet-500/20'
                                : 'bg-slate-50/60 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="radio"
                              name="dispatchStatus"
                              value={option.id}
                              checked={dispatchStatus === option.id}
                              onChange={() => setDispatchStatus(option.id)}
                              className="mt-0.5 text-violet-600 focus:ring-violet-500"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block">{option.label}</span>
                              <span className="text-[11px] text-slate-500 leading-relaxed block mt-0.5">
                                {option.desc}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Tracking Number */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tracking / Carrier Consignment Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. BLUEDART-882910, DHL-99212"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                      />
                    </div>

                    {/* Dispatch Notes */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Dispatch Notes &amp; Consignment Details
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Dispatched via express cargo. Driver contact: +91 98765 43210. Expected arrival by 14:00."
                        value={dispatchNotes}
                        onChange={(e) => setDispatchNotes(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDispatchPO(null)}
                      disabled={submittingDispatch}
                      className="text-xs font-bold"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={submittingDispatch}
                      className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                    >
                      {submittingDispatch ? (
                        <>
                          <HiRefresh className="w-4 h-4 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <HiCheck className="w-4 h-4" />
                          <span>Update Status</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: View Delivery History */}
        <AnimatePresence>
          {historyPO && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6"
              >
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-xs">
                      <HiClock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Hospital Goods Receipt History
                      </h3>
                      <p className="text-xs text-slate-500">
                        PO: <strong className="font-mono text-slate-800">{historyPO.po_number}</strong>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setHistoryPO(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                  {(!historyPO.delivery_history || historyPO.delivery_history.length === 0) ? (
                    <div className="py-12 text-center text-slate-400">
                      <HiTruck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="font-semibold text-slate-600">No hospital receipts recorded yet.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Receipt records will appear here once the hospital Purchase Officer receives and verifies your consignment.
                      </p>
                    </div>
                  ) : (
                    historyPO.delivery_history.map((batch, bIdx) => (
                      <div
                        key={batch.id || bIdx}
                        className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {batch.delivery_number}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                batch.inspection_result === 'PASSED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {batch.inspection_result_display || batch.inspection_result}
                            </span>
                          </div>
                          <div className="text-right text-[11px] text-slate-500">
                            <span>Receipt Date: <strong>{formatDate(batch.delivery_date)}</strong></span>
                          </div>
                        </div>

                        {/* Batch Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-600">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Recorded By</span>
                            <span className="font-semibold text-slate-800">{batch.recorded_by_name || 'Hospital Officer'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Tracking Ref</span>
                            <span className="font-mono font-semibold text-slate-800">{batch.tracking_number || 'N/A'}</span>
                          </div>
                        </div>

                        {batch.inspection_notes && (
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-[11px] text-slate-700">
                            <span className="font-bold text-slate-900 block text-[10px] uppercase">Inspection Notes:</span>
                            <p className="mt-0.5">{batch.inspection_notes}</p>
                          </div>
                        )}

                        {batch.delivery_issue_details && (
                          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800">
                            <span className="font-bold text-rose-900 block text-[10px] uppercase">Issue / Damaged Notes:</span>
                            <p className="mt-0.5">{batch.delivery_issue_details}</p>
                          </div>
                        )}

                        {/* Items in this batch */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Received Items
                          </span>
                          <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[9px]">
                                <tr>
                                  <th className="py-1.5 px-3">Item</th>
                                  <th className="py-1.5 px-2 text-center">Delivered</th>
                                  <th className="py-1.5 px-2 text-center">Accepted</th>
                                  <th className="py-1.5 px-2 text-center">Rejected</th>
                                  <th className="py-1.5 px-3">Condition</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(batch.items || []).map((it) => (
                                  <tr key={it.id}>
                                    <td className="py-2 px-3 font-semibold text-slate-800">
                                      {it.item_name}
                                    </td>
                                    <td className="py-2 px-2 text-center font-mono font-bold text-slate-900">
                                      {it.quantity_delivered}
                                    </td>
                                    <td className="py-2 px-2 text-center font-mono font-bold text-emerald-600">
                                      {it.quantity_accepted || it.quantity_delivered}
                                    </td>
                                    <td className="py-2 px-2 text-center font-mono font-bold text-rose-600">
                                      {it.quantity_rejected || 0}
                                    </td>
                                    <td className="py-2 px-3">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          it.condition === 'DAMAGED' || it.condition === 'REJECTED'
                                            ? 'bg-rose-100 text-rose-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                        }`}
                                      >
                                        {it.condition_display || it.condition}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPO(null)}
                    className="text-xs font-bold"
                  >
                    Close
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Order Details */}
        <AnimatePresence>
          {detailsPO && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6"
              >
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Purchase Order {detailsPO.po_number}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Order Value: {formatCurrency(detailsPO.total_amount)} • Order Date: {formatDate(detailsPO.order_date)}
                    </p>
                  </div>
                  <button
                    onClick={() => setDetailsPO(null)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Your Dispatch Status</span>
                      <div className="mt-1">{getDispatchStatusBadge(detailsPO.vendor_dispatch_status)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Hospital Receipt Status</span>
                      <div className="mt-1">{getHospitalDeliveryBadge(detailsPO.delivery_status)}</div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-800 block">Ordered Items</span>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Item</th>
                            <th className="py-2.5 px-2 text-center">Ordered</th>
                            <th className="py-2.5 px-2 text-center">Received by Hospital</th>
                            <th className="py-2.5 px-3 text-right">Unit Price</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(detailsPO.items || []).map((it) => (
                            <tr key={it.id}>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{it.item_name}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-800">{it.quantity}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-600">{it.total_quantity_received || 0}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatCurrency(it.unit_price)}</td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{formatCurrency(it.total_price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 flex items-center justify-end bg-slate-50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDetailsPO(null)}
                    className="text-xs font-bold"
                  >
                    Close
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </VendorLayout>
  );
};

export default VendorDeliveriesPage;
