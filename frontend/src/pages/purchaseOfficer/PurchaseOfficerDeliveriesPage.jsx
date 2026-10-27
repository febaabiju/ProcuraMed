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
  HiOfficeBuilding,
  HiDocumentText,
  HiCheck,
  HiPlus,
  HiShieldCheck,
  HiArchive,
  HiClipboardList
} from 'react-icons/hi';
import axiosClient from '../../api/axiosClient';
import PurchaseOfficerLayout from '../../components/layout/PurchaseOfficerLayout';
import Button from '../../components/common/Button';

const PurchaseOfficerDeliveriesPage = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'AWAITING_DELIVERY' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'DELIVERY_ISSUE'

  // Modals
  const [recordDeliveryPO, setRecordDeliveryPO] = useState(null);
  const [historyPO, setHistoryPO] = useState(null);
  const [detailsPO, setDetailsPO] = useState(null);

  // Record Delivery Form State
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [inspectionResult, setInspectionResult] = useState('PASSED');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [deliveryIssueDetails, setDeliveryIssueDetails] = useState('');
  const [deliveryRemarks, setDeliveryRemarks] = useState('');
  const [itemQuantities, setItemQuantities] = useState({});
  const [itemConditions, setItemConditions] = useState({});
  const [itemRemarks, setItemRemarks] = useState({});
  const [submittingDelivery, setSubmittingDelivery] = useState(false);
  const [formError, setFormError] = useState('');

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
        'Failed to load purchase orders for delivery management. Please refresh or retry.'
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

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
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
    const awaiting = purchaseOrders.filter(
      po => (po.delivery_status === 'AWAITING_DELIVERY' || !po.delivery_status)
    ).length;
    const partial = purchaseOrders.filter(
      po => po.delivery_status === 'PARTIALLY_DELIVERED'
    ).length;
    const delivered = purchaseOrders.filter(
      po => po.delivery_status === 'DELIVERED'
    ).length;
    const issues = purchaseOrders.filter(
      po => po.delivery_status === 'DELIVERY_ISSUE'
    ).length;
    return { total, awaiting, partial, delivered, issues };
  }, [purchaseOrders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        const delivStatus = po.delivery_status || 'AWAITING_DELIVERY';
        if (delivStatus !== statusFilter) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const poNum = (po.po_number || '').toLowerCase();
        const reqNum = (po.requisition_details?.req_number || '').toLowerCase();
        const reqTitle = (po.requisition_details?.title || '').toLowerCase();
        const vendorName = (po.vendor_details?.company_name || '').toLowerCase();
        const tracking = (po.vendor_tracking_number || '').toLowerCase();
        const itemNames = (po.items || []).map(i => i.item_name.toLowerCase()).join(' ');

        const match =
          poNum.includes(q) ||
          reqNum.includes(q) ||
          reqTitle.includes(q) ||
          vendorName.includes(q) ||
          tracking.includes(q) ||
          itemNames.includes(q);

        if (!match) return false;
      }

      return true;
    });
  }, [purchaseOrders, statusFilter, searchQuery]);

  // Open Record Delivery Modal
  const handleOpenRecordDelivery = (po) => {
    setRecordDeliveryPO(po);
    setDeliveryDate(new Date().toISOString().split('T')[0]);
    setTrackingNumber(po.vendor_tracking_number || '');
    setInspectionResult('PASSED');
    setInspectionNotes('');
    setDeliveryIssueDetails('');
    setDeliveryRemarks('');
    setFormError('');

    // Pre-populate line item inputs: default received qty = remaining_quantity
    const initialQtys = {};
    const initialConds = {};
    const initialRems = {};

    (po.items || []).forEach((item) => {
      const remaining = item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity;
      initialQtys[item.id] = remaining; // default to remaining
      initialConds[item.id] = 'SATISFACTORY';
      initialRems[item.id] = '';
    });

    setItemQuantities(initialQtys);
    setItemConditions(initialConds);
    setItemRemarks(initialRems);
  };

  // Submit Record Delivery
  const handleSubmitDelivery = async (e) => {
    e.preventDefault();
    if (!recordDeliveryPO) return;
    setFormError('');

    // Prepare item payloads
    const itemsPayload = [];
    let totalQtyToDeliver = 0;
    let hasDamage = false;

    for (const item of recordDeliveryPO.items || []) {
      const qty = parseInt(itemQuantities[item.id] || 0, 10);
      const remaining = item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity;

      if (isNaN(qty) || qty < 0) {
        setFormError(`Received quantity for item "${item.item_name}" cannot be negative.`);
        return;
      }

      if (qty > remaining) {
        setFormError(
          `Received quantity (${qty}) for item "${item.item_name}" exceeds the remaining quantity (${remaining}). Excessive quantities are not permitted.`
        );
        return;
      }

      if (qty > 0) {
        const cond = itemConditions[item.id] || 'SATISFACTORY';
        if (cond === 'DAMAGED' || cond === 'REJECTED') {
          hasDamage = true;
        }

        itemsPayload.push({
          po_item: item.id,
          quantity_delivered: qty,
          condition: cond,
          remarks: itemRemarks[item.id] || ''
        });
        totalQtyToDeliver += qty;
      }
    }

    if (totalQtyToDeliver <= 0 || itemsPayload.length === 0) {
      setFormError('Please enter at least one item with a received quantity greater than zero.');
      return;
    }

    // Auto-detect delivery issue if damage or rejection selected
    let finalInspection = inspectionResult;
    if (hasDamage && (finalInspection === 'PASSED' || finalInspection === 'PARTIALLY_ACCEPTED')) {
      finalInspection = 'DELIVERY_ISSUE';
    }

    const payload = {
      delivery_date: deliveryDate,
      tracking_number: trackingNumber.trim(),
      inspection_result: finalInspection,
      inspection_notes: inspectionNotes.trim(),
      delivery_issue_details: deliveryIssueDetails.trim(),
      remarks: deliveryRemarks.trim(),
      items: itemsPayload
    };

    setSubmittingDelivery(true);
    try {
      await axiosClient.post(`/procurement/purchase-orders/${recordDeliveryPO.id}/record-delivery/`, payload);
      setSuccessMessage(`Delivery batch recorded successfully for PO ${recordDeliveryPO.po_number}.`);
      setRecordDeliveryPO(null);
      await fetchOrders();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setFormError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to record delivery. Please verify item quantities and retry.'
      );
    } finally {
      setSubmittingDelivery(false);
    }
  };

  const getDeliveryStatusBadge = (status) => {
    switch (status) {
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Delivered</span>
          </span>
        );
      case 'PARTIALLY_DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <HiClock className="w-3.5 h-3.5 text-blue-600" />
            <span>Partially Delivered</span>
          </span>
        );
      case 'DELIVERY_ISSUE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
            <HiExclamationCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Delivery Issue</span>
          </span>
        );
      case 'AWAITING_DELIVERY':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <HiClock className="w-3.5 h-3.5 text-amber-600" />
            <span>Awaiting Delivery</span>
          </span>
        );
    }
  };

  const getDispatchStatusBadge = (dispatchStatus) => {
    switch (dispatchStatus) {
      case 'DELIVERED_TO_HOSPITAL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <HiCheck className="w-3 h-3 text-purple-600" />
            <span>Delivered to Hospital</span>
          </span>
        );
      case 'DISPATCHED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
            <HiTruck className="w-3 h-3 text-indigo-600" />
            <span>Dispatched / In Transit</span>
          </span>
        );
      case 'PREPARING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <HiClock className="w-3 h-3 text-slate-500" />
            <span>Preparing</span>
          </span>
        );
    }
  };

  return (
    <PurchaseOfficerLayout
      title="Delivery Management"
      subtitle="Track vendor dispatches, inspect received consignments, manage partial deliveries, and confirm official hospital goods receipts."
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
              <HiClipboardList className="w-5 h-5 text-slate-400" />
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">Active procurement orders</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs bg-gradient-to-br from-white to-amber-50/30">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">
              Awaiting Delivery
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-black text-amber-700">{metrics.awaiting}</span>
              <HiClock className="w-5 h-5 text-amber-500" />
            </div>
            <span className="text-[11px] text-amber-600/80 mt-1 block">No hospital receipt yet</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-2xs bg-gradient-to-br from-white to-blue-50/30">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
              Partially Delivered
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-black text-blue-700">{metrics.partial}</span>
              <HiTruck className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-[11px] text-blue-600/80 mt-1 block">Partial batches received</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-2xs bg-gradient-to-br from-white to-emerald-50/30">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
              Fully Delivered
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-black text-emerald-700">{metrics.delivered}</span>
              <HiCheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-[11px] text-emerald-600/80 mt-1 block">100% quantities received</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-2xs bg-gradient-to-br from-white to-rose-50/30">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block">
              Delivery Issues
            </span>
            <div className="flex items-baseline justify-between mt-1.5">
              <span className="text-2xl font-black text-rose-700">{metrics.issues}</span>
              <HiExclamationCircle className="w-5 h-5 text-rose-500" />
            </div>
            <span className="text-[11px] text-rose-600/80 mt-1 block">Damaged / rejected items</span>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'ALL', label: 'All Orders' },
              { id: 'AWAITING_DELIVERY', label: 'Awaiting Delivery' },
              { id: 'PARTIALLY_DELIVERED', label: 'Partially Delivered' },
              { id: 'DELIVERED', label: 'Delivered' },
              { id: 'DELIVERY_ISSUE', label: 'Delivery Issue' }
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
                placeholder="Search PO, vendor, tracking..."
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

        {/* Purchase Orders Delivery Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Purchase Order Delivery Pipeline
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'} with items, ordered quantities, received progress, and hospital receipt actions.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400">
              <HiRefresh className="w-8 h-8 animate-spin text-violet-600 mb-2" />
              <span className="text-xs font-semibold">Loading delivery records...</span>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-20 text-center">
              <HiTruck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">No Purchase Orders Found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'No purchase orders matched your search or status filter. Try resetting filters.'
                  : 'No purchase orders have been created yet. Create a purchase order from Approved Vendor Selections to begin tracking deliveries.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">PO Details</th>
                    <th className="py-3 px-4">Vendor Partner</th>
                    <th className="py-3 px-4">Items &amp; Quantities</th>
                    <th className="py-3 px-4">Vendor Dispatch</th>
                    <th className="py-3 px-4">Hospital Delivery Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((po) => {
                    const totalOrdered = (po.items || []).reduce((acc, it) => acc + (it.quantity || 0), 0);
                    const totalReceived = (po.items || []).reduce((acc, it) => acc + (it.total_quantity_received || 0), 0);
                    const percentReceived = totalOrdered > 0 ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100)) : 0;
                    const isFullyDelivered = po.delivery_status === 'DELIVERED';
                    const historyCount = (po.delivery_history || []).length;

                    return (
                      <tr key={po.id} className="hover:bg-slate-50/50 transition">
                        {/* PO Details */}
                        <td className="py-3.5 px-4 align-top">
                          <span className="font-mono font-bold text-slate-900 block text-xs">
                            {po.po_number}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            Order Date: {formatDate(po.order_date)}
                          </span>
                          {po.requisition_details?.req_number && (
                            <span className="text-[10px] text-violet-600 font-mono block mt-0.5">
                              PR: {po.requisition_details.req_number}
                            </span>
                          )}
                        </td>

                        {/* Vendor */}
                        <td className="py-3.5 px-4 align-top">
                          <span className="font-bold text-slate-900 block">
                            {po.vendor_details?.company_name || 'Vendor'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono block">
                            Code: {po.vendor_details?.vendor_code || 'N/A'}
                          </span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            Dest: {po.delivery_location || 'Receiving Dock'}
                          </span>
                        </td>

                        {/* Items & Quantities */}
                        <td className="py-3.5 px-4 align-top min-w-[220px]">
                          <div className="space-y-1">
                            {(po.items || []).map((it) => (
                              <div key={it.id} className="text-[11px] flex items-center justify-between gap-2 border-b border-slate-50 pb-0.5">
                                <span className="font-medium text-slate-800 truncate max-w-[140px]" title={it.item_name}>
                                  {it.item_name}
                                </span>
                                <span className="font-mono text-[10px] text-slate-600 whitespace-nowrap">
                                  <strong>{it.total_quantity_received || 0}</strong> / {it.quantity} received
                                  {it.remaining_quantity > 0 && (
                                    <span className="text-amber-600 ml-1">({it.remaining_quantity} left)</span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Progress bar */}
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                              <span>Fulfillment</span>
                              <span className="font-bold font-mono">{percentReceived}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full transition-all duration-500 ${
                                  percentReceived === 100
                                    ? 'bg-emerald-500'
                                    : percentReceived > 0
                                    ? 'bg-blue-500'
                                    : 'bg-slate-300'
                                }`}
                                style={{ width: `${percentReceived}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Vendor Dispatch Status */}
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
                            {getDeliveryStatusBadge(po.delivery_status)}
                            <span className="text-[10px] text-slate-400 block mt-1">
                              Expected: {formatDate(po.expected_delivery_date)}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Record Delivery Button */}
                            {!isFullyDelivered ? (
                              <button
                                onClick={() => handleOpenRecordDelivery(po)}
                                className="px-2.5 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition"
                                title="Record received shipment at hospital dock"
                              >
                                <HiPlus className="w-3.5 h-3.5" />
                                <span>Record Delivery</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenRecordDelivery(po)}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition"
                                title="Record additional batch or return adjustment"
                              >
                                <HiPlus className="w-3.5 h-3.5" />
                                <span>Add Receipt</span>
                              </button>
                            )}

                            {/* View History Button */}
                            <button
                              onClick={() => setHistoryPO(po)}
                              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition"
                              title="View delivery shipment batches"
                            >
                              <HiClock className="w-3.5 h-3.5 text-slate-500" />
                              <span>History {historyCount > 0 ? `(${historyCount})` : ''}</span>
                            </button>

                            {/* PO Details Modal */}
                            <button
                              onClick={() => setDetailsPO(po)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                              title="View full PO details"
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

        {/* Modal: Record Delivery */}
        <AnimatePresence>
          {recordDeliveryPO && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6"
              >
                {/* Modal Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-violet-50/70">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-xs">
                      <HiTruck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Record Hospital Goods Receipt
                      </h3>
                      <p className="text-xs text-slate-500">
                        PO Reference: <strong className="font-mono text-violet-700">{recordDeliveryPO.po_number}</strong> • Vendor: {recordDeliveryPO.vendor_details?.company_name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setRecordDeliveryPO(null)}
                    disabled={submittingDelivery}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmitDelivery}>
                  <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
                    {/* Form Error Alert */}
                    {formError && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                        <HiExclamationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                        <span>{formError}</span>
                      </div>
                    )}

                    {/* Vendor Dispatch Summary Alert */}
                    <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-900 text-xs flex items-start gap-2.5">
                      <HiInformationCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-bold">Hospital Receiving Bay Protocol:</span>
                        <p className="text-blue-800 leading-relaxed">
                          Enter the quantities physically received and inspected at the hospital receiving dock. Items marked as damaged or rejected will automatically flag the delivery as a <strong>Delivery Issue</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Delivery Date & Tracking */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Actual Delivery Date *
                        </label>
                        <input
                          type="date"
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          required
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Carrier / Tracking / Consignment Number
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. BLUEDART-992100"
                          value={trackingNumber}
                          onChange={(e) => setTrackingNumber(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Line Items Receiving Table */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-bold text-slate-800">
                          Items &amp; Quantities Received in This Batch *
                        </label>
                        <span className="text-[10px] text-slate-400">
                          Enter received quantities (cannot exceed remaining quantity)
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                            <tr>
                              <th className="py-2.5 px-3">Item Name</th>
                              <th className="py-2.5 px-2 text-center">Ordered</th>
                              <th className="py-2.5 px-2 text-center">Received</th>
                              <th className="py-2.5 px-2 text-center">Remaining</th>
                              <th className="py-2.5 px-3 text-center w-24">Qty Received *</th>
                              <th className="py-2.5 px-3">Condition</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(recordDeliveryPO.items || []).map((item) => {
                              const remaining = item.remaining_quantity !== undefined ? item.remaining_quantity : item.quantity;
                              const currentInput = itemQuantities[item.id] !== undefined ? itemQuantities[item.id] : remaining;

                              return (
                                <tr key={item.id} className="hover:bg-slate-50/50">
                                  <td className="py-2.5 px-3">
                                    <span className="font-bold text-slate-900 block">{item.item_name}</span>
                                    {item.specification && (
                                      <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">
                                        {item.specification}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-700">
                                    {item.quantity}
                                  </td>
                                  <td className="py-2.5 px-2 text-center font-mono text-emerald-600 font-bold">
                                    {item.total_quantity_received || 0}
                                  </td>
                                  <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-700">
                                    {remaining}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <input
                                      type="number"
                                      min="0"
                                      max={remaining}
                                      value={currentInput}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        setItemQuantities({
                                          ...itemQuantities,
                                          [item.id]: isNaN(val) ? 0 : val
                                        });
                                      }}
                                      className="w-20 p-1.5 text-center font-mono font-bold text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-none"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <select
                                      value={itemConditions[item.id] || 'SATISFACTORY'}
                                      onChange={(e) => {
                                        const cond = e.target.value;
                                        setItemConditions({
                                          ...itemConditions,
                                          [item.id]: cond
                                        });
                                        if (cond === 'DAMAGED' || cond === 'REJECTED') {
                                          setInspectionResult('DELIVERY_ISSUE');
                                        }
                                      }}
                                      className={`w-full p-1.5 text-xs font-semibold rounded-lg border focus:outline-none ${
                                        itemConditions[item.id] === 'DAMAGED' || itemConditions[item.id] === 'REJECTED'
                                          ? 'bg-rose-50 border-rose-300 text-rose-800'
                                          : 'bg-white border-slate-200 text-slate-800'
                                      }`}
                                    >
                                      <option value="SATISFACTORY">Satisfactory</option>
                                      <option value="DAMAGED">Damaged</option>
                                      <option value="REJECTED">Rejected</option>
                                      <option value="INCOMPLETE">Incomplete</option>
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Overall Inspection Result */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Overall Inspection Result *
                        </label>
                        <select
                          value={inspectionResult}
                          onChange={(e) => setInspectionResult(e.target.value)}
                          className={`w-full p-2.5 rounded-xl border text-xs font-bold focus:ring-2 focus:ring-violet-500 focus:outline-none ${
                            inspectionResult === 'DELIVERY_ISSUE' || inspectionResult === 'DAMAGED' || inspectionResult === 'REJECTED'
                              ? 'bg-rose-50 border-rose-300 text-rose-800'
                              : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          <option value="PASSED">Passed / Satisfactory</option>
                          <option value="PARTIALLY_ACCEPTED">Partially Accepted</option>
                          <option value="DAMAGED">Damaged Goods</option>
                          <option value="REJECTED">Rejected Consignment</option>
                          <option value="DELIVERY_ISSUE">Delivery Issue / Discrepancy</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Inspection Notes &amp; Observations
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Seals intact, serial numbers verified"
                          value={inspectionNotes}
                          onChange={(e) => setInspectionNotes(e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Issue Details if Damaged or Rejected */}
                    {(inspectionResult === 'DELIVERY_ISSUE' || inspectionResult === 'DAMAGED' || inspectionResult === 'REJECTED') && (
                      <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1.5">
                        <label className="block text-xs font-bold text-rose-900">
                          Delivery Issue Discrepancy Details *
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Describe the damages, missing items, or reasons for rejection..."
                          value={deliveryIssueDetails}
                          onChange={(e) => setDeliveryIssueDetails(e.target.value)}
                          className="w-full p-2.5 bg-white border border-rose-300 rounded-xl text-xs text-rose-900 focus:ring-2 focus:ring-rose-500 focus:outline-none resize-none leading-relaxed"
                        />
                      </div>
                    )}

                    {/* General Remarks */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        General Delivery Remarks
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Received at bay 3, invoice stamped and submitted to accounts"
                        value={deliveryRemarks}
                        onChange={(e) => setDeliveryRemarks(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none resize-none leading-relaxed"
                      />
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRecordDeliveryPO(null)}
                      disabled={submittingDelivery}
                      className="text-xs font-bold"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={submittingDelivery}
                      className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                    >
                      {submittingDelivery ? (
                        <>
                          <HiRefresh className="w-4 h-4 animate-spin" />
                          <span>Saving Receipt...</span>
                        </>
                      ) : (
                        <>
                          <HiCheck className="w-4 h-4" />
                          <span>Confirm Hospital Receipt</span>
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Delivery History */}
        <AnimatePresence>
          {historyPO && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6"
              >
                {/* Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-xs">
                      <HiClock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Delivery Batch History
                      </h3>
                      <p className="text-xs text-slate-500">
                        PO: <strong className="font-mono text-slate-800">{historyPO.po_number}</strong> • Vendor: {historyPO.vendor_details?.company_name}
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
                      <p className="font-semibold text-slate-600">No delivery batches recorded yet.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Once consignments arrive at the hospital receiving dock, click "Record Delivery" to document the batch.
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
                            {getDeliveryStatusBadge(batch.status)}
                          </div>
                          <div className="text-right text-[11px] text-slate-500">
                            <span>Receipt Date: <strong>{formatDate(batch.delivery_date)}</strong></span>
                          </div>
                        </div>

                        {/* Batch Details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] text-slate-600">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Recorded By</span>
                            <span className="font-semibold text-slate-800">{batch.recorded_by_name || 'Purchase Officer'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Tracking / Consignment</span>
                            <span className="font-mono font-semibold text-slate-800">{batch.tracking_number || 'N/A'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-bold">Inspection Result</span>
                            <span className={`font-bold ${batch.inspection_result === 'PASSED' ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {batch.inspection_result_display || batch.inspection_result}
                            </span>
                          </div>
                        </div>

                        {/* Inspection Notes & Discrepancies */}
                        {batch.inspection_notes && (
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-[11px] text-slate-700">
                            <span className="font-bold text-slate-900 block text-[10px] uppercase">Inspection Notes:</span>
                            <p className="mt-0.5">{batch.inspection_notes}</p>
                          </div>
                        )}

                        {batch.delivery_issue_details && (
                          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800">
                            <span className="font-bold text-rose-900 block text-[10px] uppercase">Issue Details:</span>
                            <p className="mt-0.5">{batch.delivery_issue_details}</p>
                          </div>
                        )}

                        {/* Items in this batch */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Delivered Line Items
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

                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                  <span className="text-[11px] text-slate-400">
                    ProcuraMed Hospital Delivery Audit Log
                  </span>
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

        {/* Modal: Full PO Details */}
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
                      Vendor: {detailsPO.vendor_details?.company_name} • Total: {formatCurrency(detailsPO.total_amount)}
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
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Vendor Dispatch Status</span>
                      <div className="mt-1">{getDispatchStatusBadge(detailsPO.vendor_dispatch_status)}</div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Hospital Delivery Status</span>
                      <div className="mt-1">{getDeliveryStatusBadge(detailsPO.delivery_status)}</div>
                    </div>
                  </div>

                  {/* Items breakdown */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-800 block">Ordered Items &amp; Fulfillment</span>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Item</th>
                            <th className="py-2.5 px-2 text-center">Ordered</th>
                            <th className="py-2.5 px-2 text-center">Received</th>
                            <th className="py-2.5 px-2 text-center">Remaining</th>
                            <th className="py-2.5 px-3 text-right">Unit Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(detailsPO.items || []).map((it) => (
                            <tr key={it.id}>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">{it.item_name}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-slate-800">{it.quantity}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-emerald-600">{it.total_quantity_received || 0}</td>
                              <td className="py-2.5 px-2 text-center font-mono font-bold text-amber-700">{it.remaining_quantity}</td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700">{formatCurrency(it.unit_price)}</td>
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
    </PurchaseOfficerLayout>
  );
};

export default PurchaseOfficerDeliveriesPage;
