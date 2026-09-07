import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import VendorLayout from '../../components/layout/VendorLayout';
import Button from '../../components/common/Button';
import {
  HiOfficeBuilding,
  HiClipboardList,
  HiDocumentText,
  HiShoppingBag,
  HiTruck,
  HiCheckCircle,
  HiClock,
  HiRefresh,
  HiEye,
  HiTag,
  HiCalendar,
  HiCurrencyDollar,
  HiShieldCheck,
  HiBell,
  HiX,
  HiUser,
  HiMail,
  HiPhone,
  HiLocationMarker,
  HiExternalLink,
  HiInformationCircle
} from 'react-icons/hi';

const VendorDashboardPage = () => {
  const [data, setData] = useState({
    vendor: null,
    stats: {
      open_opportunities: 0,
      quotations_submitted: 0,
      pending_quotations: 0,
      approved_pos: 0,
      pending_deliveries: 0,
      completed_orders: 0
    },
    opportunities: [],
    recent_quotations: [],
    recent_purchase_orders: [],
    recent_deliveries: [],
    notifications: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modals state
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [selectedPO, setSelectedPO] = useState(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/vendors/dashboard-stats/');
      setData({
        vendor: res.data.vendor || null,
        stats: {
          open_opportunities: res.data.stats?.open_opportunities ?? 0,
          quotations_submitted: res.data.stats?.quotations_submitted ?? 0,
          pending_quotations: res.data.stats?.pending_quotations ?? 0,
          approved_pos: res.data.stats?.approved_pos ?? 0,
          pending_deliveries: res.data.stats?.pending_deliveries ?? 0,
          completed_orders: res.data.stats?.completed_orders ?? 0
        },
        opportunities: res.data.opportunities || [],
        recent_quotations: res.data.recent_quotations || [],
        recent_purchase_orders: res.data.recent_purchase_orders || [],
        recent_deliveries: res.data.recent_deliveries || [],
        notifications: res.data.notifications || []
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load vendor dashboard information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const vendorName = data.vendor?.company_name || 'Vendor Partner';
  const vendorCode = data.vendor?.vendor_code || 'VEN-PENDING';

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
    if (amount === undefined || amount === null) return '$0.00';
    return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <VendorLayout
      title="Vendor Dashboard"
      subtitle="Manage procurement opportunities, submit quotations, track purchase orders, and monitor deliveries."
      companyName={vendorName}
      onRefresh={fetchDashboardData}
    >
      <div className="space-y-6">
        {/* Error Alert if any */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
              <HiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. Welcome Banner */}
        <div
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl"
          style={{
            background: 'linear-gradient(135deg, #18103a 0%, #2e1d68 50%, #4a2890 100%)',
          }}
        >
          {/* Subtle background glowing circles */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 -mb-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-bold text-violet-200">
                <HiShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Approved Hospital Procurement Supplier</span>
                <span className="font-mono text-white">({vendorCode})</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Welcome, {vendorName}
              </h1>
              <p className="text-xs sm:text-sm text-violet-200 leading-relaxed font-medium">
                Manage procurement opportunities, submit quotations, track purchase orders, and monitor deliveries from one centralized portal.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={() => setProfileModalOpen(true)}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md font-bold text-xs gap-1.5 shadow-sm"
              >
                <HiOfficeBuilding className="w-4 h-4" />
                <span>Company Profile</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 2. Procurement Summary Cards (6 Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5 sm:gap-4">
          {[
            {
              title: 'Open Opportunities',
              value: data.stats.open_opportunities,
              desc: 'Available RFQs for bidding',
              icon: HiClipboardList,
              gradient: 'from-violet-500 to-indigo-600',
              bgLight: 'bg-violet-50',
              textColor: 'text-violet-700',
              borderColor: 'border-violet-100',
              link: '/vendor/opportunities'
            },
            {
              title: 'Quotations Submitted',
              value: data.stats.quotations_submitted,
              desc: 'Total vendor proposals',
              icon: HiDocumentText,
              gradient: 'from-purple-500 to-pink-600',
              bgLight: 'bg-purple-50',
              textColor: 'text-purple-700',
              borderColor: 'border-purple-100',
              link: '/vendor/quotations'
            },
            {
              title: 'Pending Quotations',
              value: data.stats.pending_quotations,
              desc: 'Awaiting evaluation',
              icon: HiClock,
              gradient: 'from-amber-500 to-orange-600',
              bgLight: 'bg-amber-50',
              textColor: 'text-amber-700',
              borderColor: 'border-amber-100',
              link: '/vendor/quotations'
            },
            {
              title: 'Approved Orders',
              value: data.stats.approved_pos,
              desc: 'Purchase orders awarded',
              icon: HiShoppingBag,
              gradient: 'from-emerald-500 to-teal-600',
              bgLight: 'bg-emerald-50',
              textColor: 'text-emerald-700',
              borderColor: 'border-emerald-100',
              link: '/vendor/purchase-orders'
            },
            {
              title: 'Pending Deliveries',
              value: data.stats.pending_deliveries,
              desc: 'Dispatched / In transit',
              icon: HiTruck,
              gradient: 'from-sky-500 to-blue-600',
              bgLight: 'bg-sky-50',
              textColor: 'text-sky-700',
              borderColor: 'border-sky-100',
              link: '/vendor/deliveries'
            },
            {
              title: 'Completed Orders',
              value: data.stats.completed_orders,
              desc: 'Fulfilled procurements',
              icon: HiCheckCircle,
              gradient: 'from-teal-500 to-emerald-600',
              bgLight: 'bg-teal-50',
              textColor: 'text-teal-700',
              borderColor: 'border-teal-100',
              link: '/vendor/purchase-orders'
            }
          ].map((card, idx) => {
            const Icon = card.icon;
            return (
              <Link
                key={idx}
                to={card.link}
                className={`p-4 bg-white rounded-3xl border ${card.borderColor} shadow-sm hover:shadow-md transition-all group flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-500 leading-tight truncate">
                    {card.title}
                  </span>
                  <div className={`w-8 h-8 rounded-xl ${card.bgLight} ${card.textColor} flex items-center justify-center flex-shrink-0 font-bold group-hover:scale-105 transition-transform`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-black text-slate-900 tracking-tight">
                    {loading ? (
                      <span className="text-slate-300 animate-pulse text-lg">...</span>
                    ) : (
                      card.value
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">{card.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* 3. Main Split Section: Procurement Opportunities & Right Side Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Opportunities & Quotations */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section A: Procurement Opportunities */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs">
                    <HiClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      Procurement Opportunities
                    </h2>
                    <p className="text-[11px] text-slate-400">Open Requests for Quotations (RFQs) open for vendor submission</p>
                  </div>
                </div>
                <Link
                  to="/vendor/opportunities"
                  className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  View All →
                </Link>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
                  <HiRefresh className="w-5 h-5 animate-spin text-violet-500" />
                  <span>Loading opportunities...</span>
                </div>
              ) : data.opportunities.length === 0 ? (
                <div className="p-8 text-center space-y-2 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiClipboardList className="w-8 h-8 text-slate-300 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-700">No procurement opportunities are currently available.</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    When hospital departments issue new purchase requisitions and open RFQs, they will appear here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Procurement Ref #</th>
                        <th className="px-4 py-3">Item / Scope</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Submission Deadline</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {data.opportunities.map((opp) => (
                        <tr key={opp.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-violet-700 whitespace-nowrap">
                            {opp.rfq_number}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 max-w-[200px] truncate">
                            {opp.title}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                              <HiTag className="w-2.5 h-2.5 text-violet-500" />
                              {opp.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {formatDate(opp.due_date)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {opp.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedOpportunity(opp)}
                              className="text-[11px] font-bold text-violet-700 border-violet-200 hover:bg-violet-50 py-1 px-2.5"
                            >
                              <HiEye className="w-3.5 h-3.5" />
                              <span>View Details</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Section B: Recent Quotations */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                    <HiDocumentText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      Recent Quotations
                    </h2>
                    <p className="text-[11px] text-slate-400">Proposals submitted by your company for evaluation</p>
                  </div>
                </div>
                <Link
                  to="/vendor/quotations"
                  className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  View All →
                </Link>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">Loading quotations...</div>
              ) : data.recent_quotations.length === 0 ? (
                <div className="p-8 text-center space-y-2 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiDocumentText className="w-8 h-8 text-slate-300 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-700">No quotations submitted yet.</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    When you submit price bids and technical proposals for open opportunities, they will be listed here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Quotation Ref</th>
                        <th className="px-4 py-3">Procurement Ref</th>
                        <th className="px-4 py-3">Submission Date</th>
                        <th className="px-4 py-3">Quotation Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {data.recent_quotations.map((q) => {
                        let badgeClass = 'bg-slate-100 text-slate-700';
                        if (q.status === 'ACCEPTED') badgeClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                        else if (q.status === 'UNDER_REVIEW' || q.status === 'SUBMITTED') badgeClass = 'bg-amber-50 text-amber-700 border border-amber-200';
                        else if (q.status === 'REJECTED') badgeClass = 'bg-rose-50 text-rose-700 border border-rose-200';

                        return (
                          <tr key={q.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {q.quotation_number}
                            </td>
                            <td className="px-4 py-3 font-mono text-violet-700 whitespace-nowrap">
                              {q.rfq_number}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                              {formatDate(q.submission_date)}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                              {formatCurrency(q.total_amount)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${badgeClass}`}>
                                {q.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedQuote(q)}
                                className="text-[11px] font-bold text-violet-700 border-violet-200 hover:bg-violet-50 py-1 px-2.5"
                              >
                                <HiEye className="w-3.5 h-3.5" />
                                <span>Details</span>
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

            {/* Section C: Recent Purchase Orders */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    <HiShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                      Recent Purchase Orders
                    </h2>
                    <p className="text-[11px] text-slate-400">Awarded hospital contracts and official purchase orders</p>
                  </div>
                </div>
                <Link
                  to="/vendor/purchase-orders"
                  className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                >
                  View All →
                </Link>
              </div>

              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">Loading purchase orders...</div>
              ) : data.recent_purchase_orders.length === 0 ? (
                <div className="p-8 text-center space-y-2 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiShoppingBag className="w-8 h-8 text-slate-300 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-700">No purchase orders available.</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                    Approved purchase orders awarded by the Procurement Officer will appear here for fulfillment.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">PO Number</th>
                        <th className="px-4 py-3">Order Date</th>
                        <th className="px-4 py-3">Total Amount</th>
                        <th className="px-4 py-3">Delivery Due Date</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {data.recent_purchase_orders.map((po) => (
                        <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-violet-700 whitespace-nowrap">
                            {po.po_number}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {formatDate(po.order_date)}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                            {formatCurrency(po.total_amount)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {formatDate(po.expected_delivery_date)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                              {po.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedPO(po)}
                              className="text-[11px] font-bold text-violet-700 border-violet-200 hover:bg-violet-50 py-1 px-2.5"
                            >
                              <HiEye className="w-3.5 h-3.5" />
                              <span>View Order</span>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Supply Categories, Active Deliveries & Notifications */}
          <div className="space-y-6">
            {/* Widget 1: My Supply Categories */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-xs">
                    <HiTag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">My Supply Categories</h3>
                    <p className="text-[10px] text-slate-400">Approved business capability areas</p>
                  </div>
                </div>
                <Link to="/vendor/supply-categories" className="text-[11px] font-bold text-violet-600 hover:text-violet-800">
                  View All →
                </Link>
              </div>

              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading supply categories...</div>
              ) : (!data.vendor?.supplier_category_details || data.vendor.supplier_category_details.length === 0) ? (
                <div className="p-6 text-center space-y-1.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiTag className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No categories assigned.</p>
                  <p className="text-[10px] text-slate-400">Approved capabilities will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {data.vendor.supplier_category_details.map((cat) => (
                      <span
                        key={cat.id}
                        className="px-2.5 py-1 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-800 font-semibold text-xs border border-violet-200/80 inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                        <span>{cat.name}</span>
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 pt-1 leading-relaxed">
                    Used to target and match your company with relevant hospital procurement tenders and RFQs.
                  </p>
                </div>
              )}
            </div>

            {/* Widget 2: Delivery Tracking */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs">
                    <HiTruck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Delivery Tracking</h3>
                    <p className="text-[10px] text-slate-400">Active shipments &amp; expected dates</p>
                  </div>
                </div>
                <Link to="/vendor/deliveries" className="text-[11px] font-bold text-violet-600 hover:text-violet-800">
                  Track →
                </Link>
              </div>

              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading deliveries...</div>
              ) : data.recent_deliveries.length === 0 ? (
                <div className="p-6 text-center space-y-1.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiTruck className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No active deliveries.</p>
                  <p className="text-[10px] text-slate-400">Shipments created against purchase orders will display here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.recent_deliveries.map((del) => (
                    <div key={del.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-violet-700">{del.delivery_number}</span>
                        <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold uppercase">
                          {del.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600">
                        <span>PO Ref: <strong>{del.po_number}</strong></span>
                        <span>Date: <strong>{formatDate(del.delivery_date)}</strong></span>
                      </div>
                      {del.tracking_number && (
                        <p className="text-[10px] text-slate-400 font-mono">
                          Tracking: {del.tracking_number}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Widget 2: Recent Notifications */}
            <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                    <HiBell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Recent Notifications</h3>
                    <p className="text-[10px] text-slate-400">Account and procurement events</p>
                  </div>
                </div>
                <Link to="/vendor/notifications" className="text-[11px] font-bold text-violet-600 hover:text-violet-800">
                  All →
                </Link>
              </div>

              {loading ? (
                <div className="p-6 text-center text-slate-400 text-xs">Loading notifications...</div>
              ) : data.notifications.length === 0 ? (
                <div className="p-6 text-center space-y-1.5 bg-slate-50/60 rounded-2xl border border-slate-100">
                  <HiBell className="w-6 h-6 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No recent notifications.</p>
                  <p className="text-[10px] text-slate-400">Updates regarding RFQs, quotes, and orders will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {data.notifications.map((notif) => (
                    <div key={notif.id} className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-[11px]">{notif.action}</span>
                        <span className="text-[10px] text-slate-400">{formatDate(notif.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{notif.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: COMPANY PROFILE MODAL */}
      <AnimatePresence>
        {profileModalOpen && data.vendor && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold shadow-xs">
                    <HiOfficeBuilding className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">{data.vendor.company_name}</h3>
                    <p className="text-xs text-violet-600 font-mono font-bold">{data.vendor.vendor_code}</p>
                  </div>
                </div>
                <button
                  onClick={() => setProfileModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Status bar */}
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HiCheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-emerald-900">Approved Hospital Vendor</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-white text-emerald-700 font-mono text-[11px] font-bold border border-emerald-200">
                    Active Supplier
                  </span>
                </div>

                {/* Grid 1: Basic Info */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
                  <p className="font-bold text-slate-800 border-b border-slate-200/80 pb-1 flex items-center gap-1.5">
                    <HiUser className="w-3.5 h-3.5 text-violet-500" />
                    <span>Contact Information</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-slate-600 pt-1">
                    <p className="flex justify-between">
                      <span className="text-slate-400">Contact Person:</span>
                      <strong className="text-slate-900">{data.vendor.contact_person || 'N/A'}</strong>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400">Phone:</span>
                      <strong className="text-slate-900">{data.vendor.phone || 'N/A'}</strong>
                    </p>
                  </div>
                  <p className="flex justify-between text-slate-600">
                    <span className="text-slate-400">Business Email:</span>
                    <strong className="text-slate-900">{data.vendor.email}</strong>
                  </p>
                  {data.vendor.address && (
                    <div className="pt-1">
                      <span className="text-slate-400 block mb-0.5">Address:</span>
                      <p className="p-2 bg-white rounded-xl border border-slate-200/60 font-medium text-slate-800">
                        {data.vendor.address}
                      </p>
                    </div>
                  )}
                </div>

                {/* Grid 2: Supplier Categories */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
                  <p className="font-bold text-slate-800 border-b border-slate-200/80 pb-1 flex items-center gap-1.5">
                    <HiTag className="w-3.5 h-3.5 text-violet-500" />
                    <span>Registered Categories</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {data.vendor.supplier_category_details && data.vendor.supplier_category_details.length > 0 ? (
                      data.vendor.supplier_category_details.map((cat) => (
                        <span
                          key={cat.id}
                          className="px-2.5 py-1 rounded-xl bg-violet-100 text-violet-800 font-semibold text-xs border border-violet-200/60"
                        >
                          {cat.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">General Medical Supplier</span>
                    )}
                  </div>
                </div>

                {/* Grid 3: Products Description */}
                {data.vendor.products_services_offered && (
                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1">
                    <p className="font-bold text-slate-800">Products &amp; Services Scope</p>
                    <p className="p-2.5 bg-white rounded-xl border border-slate-200/60 text-slate-700 leading-relaxed font-medium">
                      {data.vendor.products_services_offered}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setProfileModalOpen(false)}
                  className="border-slate-200 text-slate-700"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: OPPORTUNITY DETAILS MODAL */}
      <AnimatePresence>
        {selectedOpportunity && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                    <HiClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{selectedOpportunity.title}</h3>
                    <p className="text-xs font-mono font-bold text-violet-700">{selectedOpportunity.rfq_number}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOpportunity(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Category</p>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedOpportunity.category}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Submission Deadline</p>
                    <p className="font-bold text-rose-600 mt-0.5">{formatDate(selectedOpportunity.due_date)}</p>
                  </div>
                </div>

                {selectedOpportunity.terms_and_conditions && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Terms &amp; Instructions</p>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {selectedOpportunity.terms_and_conditions}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setSelectedOpportunity(null)}
                  className="border-slate-200 text-slate-700"
                >
                  Close
                </Button>
                <Link to="/vendor/quotations">
                  <Button
                    variant="primary"
                    size="md"
                    className="font-bold text-white shadow-md shadow-violet-500/20"
                    style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
                  >
                    Submit Quotation
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: QUOTATION DETAILS MODAL */}
      <AnimatePresence>
        {selectedQuote && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    <HiDocumentText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Quotation Details</h3>
                    <p className="text-xs font-mono font-bold text-violet-700">{selectedQuote.quotation_number}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedQuote(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-slate-700">
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Procurement Ref:</span>
                  <strong className="font-mono text-violet-700">{selectedQuote.rfq_number}</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Total Bidded Amount:</span>
                  <strong className="text-slate-900 font-bold text-sm">{formatCurrency(selectedQuote.total_amount)}</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Evaluation Status:</span>
                  <strong className="text-violet-700 uppercase font-bold">{selectedQuote.status}</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Submission Date:</span>
                  <strong className="text-slate-800">{formatDate(selectedQuote.submission_date)}</strong>
                </p>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button variant="outline" size="md" onClick={() => setSelectedQuote(null)} className="border-slate-200 text-slate-700">
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: PURCHASE ORDER DETAILS MODAL */}
      <AnimatePresence>
        {selectedPO && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <HiShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Purchase Order Details</h3>
                    <p className="text-xs font-mono font-bold text-violet-700">{selectedPO.po_number}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedPO(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2.5 text-xs text-slate-700">
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Order Date:</span>
                  <strong className="text-slate-800">{formatDate(selectedPO.order_date)}</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Total Contract Value:</span>
                  <strong className="text-slate-900 font-bold text-sm">{formatCurrency(selectedPO.total_amount)}</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Expected Delivery Date:</span>
                  <strong className="text-emerald-700 font-bold">{formatDate(selectedPO.expected_delivery_date)}</strong>
                </p>
                <p className="flex justify-between p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-slate-400">Order Status:</span>
                  <strong className="text-emerald-700 uppercase font-bold">{selectedPO.status}</strong>
                </p>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-100">
                <Button variant="outline" size="md" onClick={() => setSelectedPO(null)} className="border-slate-200 text-slate-700">
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </VendorLayout>
  );
};

export default VendorDashboardPage;
