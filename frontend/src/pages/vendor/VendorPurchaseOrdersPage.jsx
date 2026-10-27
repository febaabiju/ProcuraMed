import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiShoppingBag,
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
  HiCurrencyRupee,
  HiOfficeBuilding,
  HiTruck,
  HiDocumentText,
  HiCheck
} from 'react-icons/hi';
import axiosClient from '../../api/axiosClient';
import VendorLayout from '../../components/layout/VendorLayout';
import Button from '../../components/common/Button';

const VendorPurchaseOrdersPage = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'ACKNOWLEDGED' | 'DELIVERED'

  // Modals state
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [acknowledgingOrder, setAcknowledgingOrder] = useState(null);
  const [acknowledgmentNotes, setAcknowledgmentNotes] = useState('');
  const [submittingAck, setSubmittingAck] = useState(false);
  const [ackError, setAckError] = useState('');

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

  const formatCurrency = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  // Metrics
  const metrics = useMemo(() => {
    const total = purchaseOrders.length;
    const pending = purchaseOrders.filter(po => !po.is_acknowledged && po.status !== 'ACKNOWLEDGED' && po.status !== 'VENDOR_ACKNOWLEDGED').length;
    const acknowledged = purchaseOrders.filter(po => po.is_acknowledged || po.status === 'ACKNOWLEDGED' || po.status === 'VENDOR_ACKNOWLEDGED').length;
    const delivered = purchaseOrders.filter(po => ['DELIVERED', 'INSPECTED', 'CLOSED'].includes(po.status)).length;
    return { total, pending, acknowledged, delivered };
  }, [purchaseOrders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      // Status filter
      if (statusFilter === 'PENDING') {
        if (po.is_acknowledged || po.status === 'ACKNOWLEDGED' || po.status === 'VENDOR_ACKNOWLEDGED') return false;
      } else if (statusFilter === 'ACKNOWLEDGED') {
        if (!po.is_acknowledged && po.status !== 'ACKNOWLEDGED' && po.status !== 'VENDOR_ACKNOWLEDGED') return false;
      } else if (statusFilter === 'DELIVERED') {
        if (!['DELIVERED', 'INSPECTED', 'CLOSED'].includes(po.status)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const poNum = (po.po_number || '').toLowerCase();
        const reqNum = (po.requisition_details?.req_number || '').toLowerCase();
        const reqTitle = (po.requisition_details?.title || '').toLowerCase();
        const itemsStr = (po.items || []).map(i => i.item_name).join(' ').toLowerCase();
        const locationStr = (po.delivery_location || '').toLowerCase();
        return (
          poNum.includes(q) ||
          reqNum.includes(q) ||
          reqTitle.includes(q) ||
          itemsStr.includes(q) ||
          locationStr.includes(q)
        );
      }

      return true;
    });
  }, [purchaseOrders, statusFilter, searchQuery]);

  const handleOpenAcknowledgeModal = (po) => {
    setAcknowledgingOrder(po);
    setAcknowledgmentNotes('');
    setAckError('');
  };

  const handleConfirmAcknowledge = async () => {
    if (!acknowledgingOrder) return;

    setSubmittingAck(true);
    setAckError('');

    try {
      const payload = {
        notes: acknowledgmentNotes.trim() || 'Purchase order confirmed and accepted for fulfillment.'
      };
      const res = await axiosClient.post(
        `/procurement/purchase-orders/${acknowledgingOrder.id}/acknowledge/`,
        payload
      );

      setSuccessMessage(
        `Purchase Order ${res.data.po_number || acknowledgingOrder.po_number} acknowledged successfully!`
      );

      // If details modal was open with this order, update it
      if (selectedOrder && selectedOrder.id === acknowledgingOrder.id) {
        setSelectedOrder(res.data);
      }

      setAcknowledgingOrder(null);
      await fetchOrders();
    } catch (err) {
      setAckError(
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Failed to acknowledge purchase order. Please retry.'
      );
    } finally {
      setSubmittingAck(false);
    }
  };

  return (
    <VendorLayout
      title="My Purchase Orders"
      subtitle="View hospital purchase orders, review ordered specifications, delivery schedules, and acknowledge receipt."
      onRefresh={fetchOrders}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Global Notifications */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <HiExclamationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchOrders}
              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage('')}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0 font-bold">
              <HiShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Orders
              </span>
              <span className="text-2xl font-bold text-slate-800 font-mono">
                {metrics.total}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-amber-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 font-bold">
              <HiClock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">
                Pending Ack
              </span>
              <span className="text-2xl font-bold text-amber-800 font-mono">
                {metrics.pending}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 font-bold">
              <HiCheckCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">
                Acknowledged
              </span>
              <span className="text-2xl font-bold text-emerald-800 font-mono">
                {metrics.acknowledged}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-blue-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold">
              <HiTruck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">
                Delivered / Closed
              </span>
              <span className="text-2xl font-bold text-blue-800 font-mono">
                {metrics.delivered}
              </span>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full md:w-96">
            <HiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by PO#, PR reference, item name, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
            />
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-slate-400 text-xs flex items-center gap-1 mr-1">
              <HiFilter className="w-3.5 h-3.5" /> Filter:
            </span>
            {[
              { id: 'ALL', label: 'All Orders' },
              { id: 'PENDING', label: 'Pending Acknowledgment' },
              { id: 'ACKNOWLEDGED', label: 'Acknowledged' },
              { id: 'DELIVERED', label: 'Delivered' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-violet-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Purchase Orders List */}
        {loading ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
            <HiRefresh className="w-8 h-8 text-violet-600 animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-semibold">
              Loading your purchase orders...
            </p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto">
              <HiShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              No Purchase Orders Found
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {searchQuery || statusFilter !== 'ALL'
                ? 'No purchase orders match your search or filter criteria. Try clearing filters.'
                : 'When the hospital Purchase Officer issues official purchase orders for your approved quotations, they will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((po) => {
              const req = po.requisition_details || {};
              const isAck = po.is_acknowledged || po.status === 'ACKNOWLEDGED' || po.status === 'VENDOR_ACKNOWLEDGED';
              const itemsCount = po.items?.length || 0;

              return (
                <div
                  key={po.id}
                  className="bg-white rounded-2xl border border-slate-200/90 hover:border-violet-300 transition shadow-xs overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm font-bold text-slate-900 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-2xs">
                        {po.po_number}
                      </span>
                      {req.req_number && (
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                          Ref: <strong className="font-mono text-slate-800">{req.req_number}</strong>
                        </span>
                      )}
                      <span className="text-xs text-slate-500 font-medium">
                        Order Date: <strong>{formatDate(po.order_date || po.created_at)}</strong>
                      </span>
                    </div>

                    {/* Status Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {isAck ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <HiCheck className="w-3.5 h-3.5" />
                          <span>Vendor Acknowledged</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <HiClock className="w-3.5 h-3.5" />
                          <span>Pending Acknowledgment</span>
                        </span>
                      )}

                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {po.status_display || po.status}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                    {/* Left: Requisition & Item details */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Requested Procurement Item
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm leading-snug">
                        {req.title || (po.items?.[0]?.item_name) || 'Hospital Medical Supplies'}
                      </h4>
                      <p className="text-slate-600 text-xs">
                        Department: <strong className="text-slate-800">{req.department_name || 'Hospital Central'}</strong>
                      </p>

                      {/* Items list preview */}
                      <div className="pt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Ordered Items ({itemsCount}):
                        </span>
                        <div className="space-y-1">
                          {(po.items || []).slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-slate-700 bg-slate-50 px-2 py-1 rounded-lg">
                              <span className="truncate pr-2 font-medium">{item.item_name}</span>
                              <span className="font-mono text-slate-900 font-bold whitespace-nowrap">
                                Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                              </span>
                            </div>
                          ))}
                          {itemsCount > 3 && (
                            <span className="text-[11px] text-violet-600 font-semibold italic block pt-0.5">
                              + {itemsCount - 3} more items in full order
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Delivery & Logistics */}
                    <div className="space-y-2.5 border-t md:border-t-0 md:border-l md:border-r border-slate-100 md:px-5 pt-3 md:pt-0">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Delivery Schedule
                        </span>
                        <div className="flex items-center gap-1.5 text-slate-800 font-semibold mt-0.5">
                          <HiCalendar className="w-4 h-4 text-violet-600 flex-shrink-0" />
                          <span>Expected: {formatDate(po.expected_delivery_date)}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Delivery Location
                        </span>
                        <div className="flex items-start gap-1.5 text-slate-800 font-medium mt-0.5">
                          <HiLocationMarker className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                          <span className="leading-snug">{po.delivery_location || 'Hospital Central Procurement Stores'}</span>
                        </div>
                      </div>

                      {po.delivery_instructions && (
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Delivery Instructions
                          </span>
                          <p className="text-slate-600 text-[11px] italic bg-slate-50 p-2 rounded-lg border border-slate-200/60 leading-relaxed mt-0.5">
                            "{po.delivery_instructions}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Right: Order Value & Actions */}
                    <div className="flex flex-col justify-between space-y-4 border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Total Order Value
                        </span>
                        <div className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
                          {formatCurrency(po.total_amount)}
                        </div>
                        {isAck ? (
                          <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1 pt-1">
                            <HiCheckCircle className="w-3.5 h-3.5" />
                            <span>Acknowledged: {formatDateTime(po.acknowledged_at)}</span>
                          </div>
                        ) : (
                          <div className="text-[11px] text-amber-700 font-semibold flex items-center gap-1 pt-1">
                            <HiClock className="w-3.5 h-3.5" />
                            <span>Awaiting your acknowledgment</span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOrder(po)}
                          className="w-full text-xs font-bold gap-1.5 justify-center py-2"
                        >
                          <HiEye className="w-4 h-4" />
                          <span>View Details</span>
                        </Button>

                        {!isAck && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleOpenAcknowledgeModal(po)}
                            className="w-full text-xs font-bold gap-1.5 justify-center py-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                          >
                            <HiCheck className="w-4 h-4" />
                            <span>Acknowledge Order</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* View Details Modal (Read-Only Order Webpage) */}
        <AnimatePresence>
          {selectedOrder && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8"
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center">
                      <HiDocumentText className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Purchase Order Details — {selectedOrder.po_number}
                      </h2>
                      <p className="text-xs text-slate-500">
                        Official hospital procurement order issued by ProcuraMed
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body: Hospital Purchase Order Sheet */}
                <div className="p-6 space-y-6 text-xs max-h-[75vh] overflow-y-auto">
                  {/* Status Banner */}
                  {(selectedOrder.is_acknowledged || selectedOrder.status === 'ACKNOWLEDGED' || selectedOrder.status === 'VENDOR_ACKNOWLEDGED') ? (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <div>
                          <strong className="block text-xs font-bold text-emerald-800">
                            Order Acknowledged by Vendor
                          </strong>
                          <span className="text-[11px] text-emerald-700">
                            Acknowledged on {formatDateTime(selectedOrder.acknowledged_at)}
                            {selectedOrder.acknowledged_by_details && ` by ${selectedOrder.acknowledged_by_details.full_name || selectedOrder.acknowledged_by_details.username}`}
                          </span>
                        </div>
                      </div>
                      <span className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs">
                        Confirmed
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <HiClock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <div>
                          <strong className="block text-xs font-bold text-amber-800">
                            Pending Vendor Acknowledgment
                          </strong>
                          <span className="text-[11px] text-amber-700">
                            Please review the specifications and delivery instructions below, then acknowledge receipt.
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenAcknowledgeModal(selectedOrder)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition"
                      >
                        Acknowledge Now
                      </button>
                    </div>
                  )}

                  {/* Hospital Order Header & Vendor Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Hospital / Issuing Entity
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        ProcuraMed Central Hospital Procurement
                      </h4>
                      <p className="text-slate-600 text-xs">
                        Department: <strong className="text-slate-800">{selectedOrder.requisition_details?.department_name || 'Hospital Central'}</strong>
                      </p>
                      <p className="text-slate-600 text-xs font-mono">
                        PR Reference: <strong>{selectedOrder.requisition_details?.req_number || 'N/A'}</strong>
                      </p>
                      <p className="text-slate-600 text-xs">
                        Issued By: <strong>{selectedOrder.created_by_details?.full_name || selectedOrder.created_by_details?.username || 'Purchase Officer'}</strong>
                      </p>
                    </div>

                    <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-slate-200 md:pl-5 pt-3 md:pt-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Vendor Partner (Recipient)
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {selectedOrder.vendor_details?.company_name || 'Vendor Partner'}
                      </h4>
                      <p className="text-slate-600 text-xs font-mono">
                        Vendor Code: <strong>{selectedOrder.vendor_details?.vendor_code || 'N/A'}</strong>
                      </p>
                      <p className="text-slate-600 text-xs">
                        Contact Person: <strong>{selectedOrder.vendor_details?.contact_person || 'N/A'}</strong> ({selectedOrder.vendor_details?.phone || 'N/A'})
                      </p>
                      <p className="text-slate-600 text-xs">
                        Email: <strong>{selectedOrder.vendor_details?.email || 'N/A'}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Delivery & Logistics Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Delivery Location
                      </span>
                      <div className="flex items-start gap-2 text-slate-800 font-semibold">
                        <HiLocationMarker className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                        <span className="text-xs leading-relaxed">
                          {selectedOrder.delivery_location || 'Hospital Central Procurement Stores'}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Expected Delivery Date
                      </span>
                      <div className="flex items-center gap-2 text-slate-800 font-semibold">
                        <HiCalendar className="w-5 h-5 text-violet-600 flex-shrink-0" />
                        <span className="text-xs">
                          {formatDate(selectedOrder.expected_delivery_date)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Instructions */}
                  {selectedOrder.delivery_instructions && (
                    <div className="p-4 rounded-2xl bg-violet-50/50 border border-violet-100 space-y-1">
                      <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider block">
                        Delivery Instructions &amp; Remarks
                      </span>
                      <p className="text-slate-700 text-xs leading-relaxed italic">
                        "{selectedOrder.delivery_instructions}"
                      </p>
                    </div>
                  )}

                  {/* Ordered Items Table */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-800 block">
                      Ordered Line Items &amp; Technical Specifications
                    </span>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-4">#</th>
                            <th className="py-2.5 px-4">Item Name &amp; Specification</th>
                            <th className="py-2.5 px-4 text-center">Qty</th>
                            <th className="py-2.5 px-4 text-right">Unit Price</th>
                            <th className="py-2.5 px-4 text-right">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(selectedOrder.items || []).map((item, idx) => (
                            <tr key={item.id || idx} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4 font-mono text-slate-400 font-bold">{idx + 1}</td>
                              <td className="py-3 px-4">
                                <span className="font-bold text-slate-900 block">{item.item_name}</span>
                                {item.specification && (
                                  <span className="text-[11px] text-slate-500 block pt-0.5 leading-relaxed">
                                    {item.specification}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center font-bold font-mono text-slate-800">
                                {item.quantity}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-slate-700">
                                {formatCurrency(item.unit_price)}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                                {formatCurrency(item.total_price)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                          <tr>
                            <td colSpan={4} className="py-3 px-4 text-right uppercase text-slate-600">
                              Grand Total Order Value:
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-base font-black text-slate-900">
                              {formatCurrency(selectedOrder.total_amount)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Terms & Conditions */}
                  {selectedOrder.terms_and_conditions && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Contract Terms &amp; Conditions
                      </span>
                      <pre className="text-slate-700 text-xs font-sans whitespace-pre-wrap leading-relaxed">
                        {selectedOrder.terms_and_conditions}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                  <div className="text-[11px] text-slate-400">
                    ProcuraMed Hospital Procurement Management System • Read-Only View
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOrder(null)}
                      className="text-xs font-bold"
                    >
                      Close View
                    </Button>
                    {!(selectedOrder.is_acknowledged || selectedOrder.status === 'ACKNOWLEDGED' || selectedOrder.status === 'VENDOR_ACKNOWLEDGED') && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenAcknowledgeModal(selectedOrder)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                      >
                        <HiCheck className="w-4 h-4" />
                        <span>Acknowledge Order</span>
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Acknowledge Confirmation Modal */}
        <AnimatePresence>
          {acknowledgingOrder && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden"
              >
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/70">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <HiCheckCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Acknowledge Purchase Order
                      </h3>
                      <p className="text-xs text-slate-500">
                        {acknowledgingOrder.po_number}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setAcknowledgingOrder(null)}
                    disabled={submittingAck}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 text-xs">
                  {ackError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                      <HiExclamationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                      <span>{ackError}</span>
                    </div>
                  )}

                  <p className="text-slate-600 leading-relaxed">
                    By acknowledging this purchase order, you confirm that your company accepts the order details, delivery schedule by <strong>{formatDate(acknowledgingOrder.expected_delivery_date)}</strong>, and terms of supply for <strong>{formatCurrency(acknowledgingOrder.total_amount)}</strong>.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 block">
                      Optional Acknowledgment Remarks / Notes
                    </label>
                    <textarea
                      rows={3}
                      value={acknowledgmentNotes}
                      onChange={(e) => setAcknowledgmentNotes(e.target.value)}
                      placeholder="e.g. Order received and scheduled for dispatch on Nov 2nd..."
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none leading-relaxed"
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAcknowledgingOrder(null)}
                    disabled={submittingAck}
                    className="text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleConfirmAcknowledge}
                    disabled={submittingAck}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-xs"
                  >
                    {submittingAck ? (
                      <>
                        <HiRefresh className="w-4 h-4 animate-spin" />
                        <span>Confirming...</span>
                      </>
                    ) : (
                      <>
                        <HiCheck className="w-4 h-4" />
                        <span>Confirm Acknowledgment</span>
                      </>
                    )}
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

export default VendorPurchaseOrdersPage;
