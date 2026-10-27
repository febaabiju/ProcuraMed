import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
  HiOfficeBuilding,
  HiTruck,
  HiDocumentText,
  HiCheck,
  HiPlus,
  HiGlobeAlt
} from 'react-icons/hi';
import axiosClient from '../../api/axiosClient';
import PurchaseOfficerLayout from '../../components/layout/PurchaseOfficerLayout';
import Button from '../../components/common/Button';

const PurchaseOfficerPurchaseOrdersPage = () => {
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING_ACK' | 'ACKNOWLEDGED' | 'DELIVERED'

  // Modal
  const [selectedOrder, setSelectedOrder] = useState(null);

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
    const pendingAck = purchaseOrders.filter(
      po => !po.is_acknowledged && po.status !== 'ACKNOWLEDGED' && po.status !== 'VENDOR_ACKNOWLEDGED'
    ).length;
    const acknowledged = purchaseOrders.filter(
      po => po.is_acknowledged || po.status === 'ACKNOWLEDGED' || po.status === 'VENDOR_ACKNOWLEDGED'
    ).length;
    const totalValue = purchaseOrders.reduce((sum, po) => sum + Number(po.total_amount || 0), 0);
    return { total, pendingAck, acknowledged, totalValue };
  }, [purchaseOrders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      // Status filter
      if (statusFilter === 'PENDING_ACK') {
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
        const vendorName = (po.vendor_details?.company_name || '').toLowerCase();
        const vendorCode = (po.vendor_details?.vendor_code || '').toLowerCase();
        const reqNum = (po.requisition_details?.req_number || '').toLowerCase();
        const reqTitle = (po.requisition_details?.title || '').toLowerCase();
        const dept = (po.requisition_details?.department_name || '').toLowerCase();
        const location = (po.delivery_location || '').toLowerCase();
        return (
          poNum.includes(q) ||
          vendorName.includes(q) ||
          vendorCode.includes(q) ||
          reqNum.includes(q) ||
          reqTitle.includes(q) ||
          dept.includes(q) ||
          location.includes(q)
        );
      }

      return true;
    });
  }, [purchaseOrders, statusFilter, searchQuery]);

  return (
    <PurchaseOfficerLayout
      title="Purchase Orders Management"
      subtitle="Monitor hospital purchase orders, verify vendor portal visibility, track vendor acknowledgments, and manage delivery handovers."
      onRefresh={fetchOrders}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Error notification */}
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

        {/* Top Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0 font-bold">
              <HiShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Orders Issued
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
                Pending Vendor Ack
              </span>
              <span className="text-2xl font-bold text-amber-800 font-mono">
                {metrics.pendingAck}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-emerald-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 font-bold">
              <HiCheckCircle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">
                Vendor Acknowledged
              </span>
              <span className="text-2xl font-bold text-emerald-800 font-mono">
                {metrics.acknowledged}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 font-bold">
              <HiOfficeBuilding className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider block">
                Total Order Volume
              </span>
              <span className="text-lg font-bold text-slate-800 font-mono truncate block">
                {formatCurrency(metrics.totalValue)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Banner / Quick Link */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-violet-900 to-indigo-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-violet-300 uppercase tracking-wider">
              Procurement Officer Workflow
            </span>
            <h3 className="text-sm font-bold text-white">
              Approved Vendor Selections Awaiting Purchase Order
            </h3>
            <p className="text-xs text-violet-200 max-w-xl leading-relaxed">
              Generate new binding hospital Purchase Orders for vendor quotations that have been officially evaluated and approved by the Procurement Committee.
            </p>
          </div>
          <Link
            to="/purchase-officer/approved-vendor-selections"
            className="px-4 py-2.5 rounded-xl bg-white text-violet-900 font-bold text-xs hover:bg-violet-50 transition shadow-xs flex items-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <HiPlus className="w-4 h-4 text-violet-700" />
            <span>Issue New PO from Approved Selections</span>
          </Link>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <HiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by PO#, vendor, PR ref, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-slate-400 text-xs flex items-center gap-1 mr-1">
              <HiFilter className="w-3.5 h-3.5" /> Status:
            </span>
            {[
              { id: 'ALL', label: 'All Orders' },
              { id: 'PENDING_ACK', label: 'Pending Acknowledgment' },
              { id: 'ACKNOWLEDGED', label: 'Vendor Acknowledged' },
              { id: 'DELIVERED', label: 'Delivered / Closed' }
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

        {/* Purchase Orders Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-12 text-center space-y-3">
              <HiRefresh className="w-8 h-8 text-violet-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-semibold">
                Loading purchase orders...
              </p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto">
                <HiShoppingBag className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">
                No Purchase Orders Found
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'No purchase orders match your filter criteria.'
                  : 'No hospital purchase orders have been created yet. You can create purchase orders for committee-approved selections.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">PO Number &amp; Date</th>
                    <th className="py-3 px-4">Vendor Partner</th>
                    <th className="py-3 px-4">PR Reference &amp; Dept</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Vendor Portal</th>
                    <th className="py-3 px-4">Acknowledgment</th>
                    <th className="py-3 px-4">Delivery Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((po) => {
                    const req = po.requisition_details || {};
                    const vendor = po.vendor_details || {};
                    const isAck = po.is_acknowledged || po.status === 'ACKNOWLEDGED' || po.status === 'VENDOR_ACKNOWLEDGED';

                    return (
                      <tr key={po.id} className="hover:bg-slate-50/60 transition">
                        {/* PO Number & Date */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-slate-900 block text-xs">
                            {po.po_number}
                          </span>
                          <span className="text-[11px] text-slate-400 block pt-0.5">
                            {formatDate(po.order_date || po.created_at)}
                          </span>
                        </td>

                        {/* Vendor Partner */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block truncate max-w-[180px]">
                            {vendor.company_name || 'Vendor Partner'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {vendor.vendor_code || 'VEN-CODE'}
                          </span>
                        </td>

                        {/* PR Reference & Dept */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-violet-700 block text-[11px]">
                            {req.req_number || 'N/A'}
                          </span>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[180px]">
                            {req.department_name || 'Hospital Department'}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {formatCurrency(po.total_amount)}
                        </td>

                        {/* Portal Visibility */}
                        <td className="py-3.5 px-4">
                          {po.portal_visible ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <HiGlobeAlt className="w-3.5 h-3.5" />
                              <span>Visible in Portal</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              <span>No Portal Account</span>
                            </span>
                          )}
                        </td>

                        {/* Vendor Acknowledgment */}
                        <td className="py-3.5 px-4">
                          {isAck ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <HiCheck className="w-3.5 h-3.5" />
                                <span>Acknowledged</span>
                              </span>
                              {po.acknowledged_at && (
                                <span className="text-[10px] text-slate-400 block pt-0.5 font-mono">
                                  {formatDateTime(po.acknowledged_at)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <HiClock className="w-3.5 h-3.5" />
                              <span>Pending Ack</span>
                            </span>
                          )}
                        </td>

                        {/* Delivery Status */}
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {po.delivery_status || 'Pending Dispatch'}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(po)}
                            className="p-1.5 text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 rounded-lg transition cursor-pointer"
                            title="View Purchase Order Details"
                          >
                            <HiEye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PO Details Modal for Purchase Officer */}
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
                        Purchase Order — {selectedOrder.po_number}
                      </h2>
                      <p className="text-xs text-slate-500">
                        Created on {formatDate(selectedOrder.created_at || selectedOrder.order_date)}
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

                {/* Modal Body */}
                <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
                  {/* Status & Portal Visibility Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Acknowledgment */}
                    <div className={`p-4 rounded-2xl border ${
                      (selectedOrder.is_acknowledged || selectedOrder.status === 'ACKNOWLEDGED' || selectedOrder.status === 'VENDOR_ACKNOWLEDGED')
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                        Vendor Acknowledgment
                      </span>
                      <strong className="text-sm font-bold block pt-1">
                        {(selectedOrder.is_acknowledged || selectedOrder.status === 'ACKNOWLEDGED' || selectedOrder.status === 'VENDOR_ACKNOWLEDGED')
                          ? 'Vendor Acknowledged'
                          : 'Pending Acknowledgment'}
                      </strong>
                      <span className="text-[11px] block pt-0.5">
                        {selectedOrder.acknowledged_at
                          ? `Acknowledged: ${formatDateTime(selectedOrder.acknowledged_at)}`
                          : 'Awaiting vendor confirmation'}
                      </span>
                    </div>

                    {/* Portal Visibility */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Vendor Portal Access
                      </span>
                      <strong className="text-sm font-bold block pt-1 text-slate-900">
                        {selectedOrder.portal_visible ? 'Available & Visible' : 'No Active Vendor Portal'}
                      </strong>
                      <span className="text-[11px] text-slate-500 block pt-0.5">
                        {selectedOrder.portal_visible
                          ? 'Vendor can review and acknowledge via their portal'
                          : 'Vendor profile not linked to an active user account'}
                      </span>
                    </div>

                    {/* Delivery Status */}
                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 block">
                        Delivery Progress
                      </span>
                      <strong className="text-sm font-bold block pt-1 text-blue-900">
                        {selectedOrder.delivery_status || 'Pending Dispatch'}
                      </strong>
                      <span className="text-[11px] text-blue-700 block pt-0.5">
                        Expected: {formatDate(selectedOrder.expected_delivery_date)}
                      </span>
                    </div>
                  </div>

                  {/* Vendor & Requisition Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Awarded Vendor Partner
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {selectedOrder.vendor_details?.company_name}
                      </h4>
                      <p className="text-slate-600 font-mono text-xs">
                        Code: <strong>{selectedOrder.vendor_details?.vendor_code}</strong>
                      </p>
                      <p className="text-slate-600 text-xs">
                        Contact: <strong>{selectedOrder.vendor_details?.contact_person}</strong> ({selectedOrder.vendor_details?.phone})
                      </p>
                      <p className="text-slate-600 text-xs">
                        Email: <strong>{selectedOrder.vendor_details?.email}</strong>
                      </p>
                    </div>

                    <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-slate-200 md:pl-5 pt-3 md:pt-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Procurement Requisition
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        {selectedOrder.requisition_details?.title}
                      </h4>
                      <p className="text-slate-600 font-mono text-xs">
                        PR Ref: <strong>{selectedOrder.requisition_details?.req_number}</strong>
                      </p>
                      <p className="text-slate-600 text-xs">
                        Department: <strong>{selectedOrder.requisition_details?.department_name}</strong>
                      </p>
                      <p className="text-slate-600 text-xs">
                        Approved Quotation: <strong className="font-mono text-purple-700">{selectedOrder.quotation_details?.quotation_number || 'N/A'}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Delivery Location & Instructions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Designated Delivery Location
                      </span>
                      <div className="flex items-start gap-1.5 text-slate-800 font-semibold">
                        <HiLocationMarker className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                        <span>{selectedOrder.delivery_location || 'Hospital Central Procurement Stores'}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Delivery Instructions
                      </span>
                      <p className="text-slate-700 text-xs italic leading-relaxed">
                        "{selectedOrder.delivery_instructions || 'Standard hospital receiving hours apply.'}"
                      </p>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-800 block">
                      Ordered Line Items
                    </span>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                          <tr>
                            <th className="py-2.5 px-4">#</th>
                            <th className="py-2.5 px-4">Item Name &amp; Specification</th>
                            <th className="py-2.5 px-4 text-center">Qty</th>
                            <th className="py-2.5 px-4 text-right">Unit Price</th>
                            <th className="py-2.5 px-4 text-right">Total Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(selectedOrder.items || []).map((item, idx) => (
                            <tr key={item.id || idx}>
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
                              Total Order Amount:
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

                  {/* Acknowledgment Audit Notes */}
                  {selectedOrder.acknowledgment_notes && (
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-emerald-900 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                        Vendor Acknowledgment Notes
                      </span>
                      <p className="text-xs italic leading-relaxed">
                        "{selectedOrder.acknowledgment_notes}"
                      </p>
                    </div>
                  )}

                  {/* Delivery History Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 block">
                        Hospital Delivery &amp; Inspection History
                      </span>
                      {selectedOrder.delivery_status && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          selectedOrder.delivery_status === 'DELIVERED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : selectedOrder.delivery_status === 'PARTIALLY_DELIVERED'
                            ? 'bg-blue-100 text-blue-800'
                            : selectedOrder.delivery_status === 'DELIVERY_ISSUE'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {selectedOrder.delivery_status_display || selectedOrder.delivery_status}
                        </span>
                      )}
                    </div>

                    {(!selectedOrder.delivery_history || selectedOrder.delivery_history.length === 0) ? (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-400">
                        <p className="text-xs">No delivery receipts recorded yet for this order.</p>
                        <Link
                          to="/purchase-officer/deliveries"
                          className="text-[11px] text-violet-600 font-bold hover:underline inline-flex items-center gap-1 mt-1"
                        >
                          <HiTruck className="w-3.5 h-3.5" />
                          <span>Go to Delivery Management to record hospital receipt</span>
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedOrder.delivery_history.map((batch, idx) => (
                          <div key={batch.id || idx} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-900">{batch.delivery_number}</span>
                              <span className="text-[11px] text-slate-500">{formatDate(batch.delivery_date)}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                              <div>Tracking: <strong>{batch.tracking_number || 'N/A'}</strong></div>
                              <div>
                                Result: <strong className={batch.inspection_result === 'PASSED' ? 'text-emerald-700' : 'text-rose-700'}>
                                  {batch.inspection_result_display || batch.inspection_result}
                                </strong>
                              </div>
                            </div>
                            {batch.inspection_notes && (
                              <p className="text-[11px] text-slate-600 italic">"{batch.inspection_notes}"</p>
                            )}
                            <div className="space-y-1 pt-1 border-t border-slate-200">
                              {(batch.items || []).map((it) => (
                                <div key={it.id} className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-800">{it.item_name}</span>
                                  <span className="font-mono text-slate-600">
                                    Qty: <strong>{it.quantity_delivered}</strong> ({it.condition_display || it.condition})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-5 border-t border-slate-100 flex items-center justify-between bg-slate-50">
                  <Link
                    to="/purchase-officer/deliveries"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold text-xs border border-violet-200 transition"
                  >
                    <HiTruck className="w-4 h-4 text-violet-600" />
                    <span>Manage Deliveries</span>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedOrder(null)}
                    className="text-xs font-bold"
                  >
                    Close View
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

export default PurchaseOfficerPurchaseOrdersPage;
