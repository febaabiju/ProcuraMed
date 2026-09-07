import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import ProcuraMedLogo from '../../components/common/ProcuraMedLogo';
import Button from '../../components/common/Button';
import {
  HiHome,
  HiUsers,
  HiClipboardList,
  HiOfficeBuilding,
  HiLogout,
  HiShieldCheck,
  HiArrowRight,
  HiMenu,
  HiX,
  HiChevronDown,
  HiChevronRight,
  HiCog,
  HiDocumentReport,
  HiClock,
  HiCheckCircle,
  HiRefresh
} from 'react-icons/hi';

const AdminDashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Submenu expandable state
  const [userMenuOpen, setUserMenuOpen] = useState(true);
  const [vendorMenuOpen, setVendorMenuOpen] = useState(true);
  const [systemMenuOpen, setSystemMenuOpen] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/dashboard/stats/');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      setError('Could not connect to dashboard statistics endpoint.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleConfirmLogout = () => {
    logout();
    setShowLogoutModal(false);
    navigate('/login');
  };

  const adminName = user?.full_name || user?.first_name || user?.username || 'Admin';
  const roleTitle = typeof user?.role === 'string' ? user.role : (user?.role?.name || 'System Administrator');

  // Role Breakdown values from DB for the 5 managed roles
  const roleCounts = stats?.role_counts || [];
  const getRoleCount = (name) => {
    const target = name.toLowerCase().replace(/[-_]/g, ' ').trim();
    const item = roleCounts.find(r => {
      const rName = r.role_name?.toLowerCase().replace(/[-_]/g, ' ').trim();
      return rName === target || 
        (target.includes('committee') && rName?.includes('committee')) ||
        (target.includes('staff') && rName?.includes('staff')) ||
        (target.includes('purchase') && rName?.includes('purchase')) ||
        (target.includes('technical') && rName?.includes('technical'));
    });
    return item ? item.count : 0;
  };

  const vendorAppCounts = stats?.vendor_application_counts || { pending: 0, approved: 0, rejected: 0 };
  const totalVendorApps = (vendorAppCounts.pending || 0) + (vendorAppCounts.approved || 0) + (vendorAppCounts.rejected || 0);

  return (
    <div className="min-h-screen bg-[#F8F8FC] flex font-sans text-slate-800">
      {/* Mobile Sidebar Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-64 bg-white border-r border-violet-100 flex flex-col transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Sidebar Brand Header */}
        <div className="p-5 border-b border-violet-50 flex items-center justify-between">
          <Link to="/admin/dashboard" className="flex items-center gap-2.5">
            <ProcuraMedLogo size={34} variant="color" />
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 block leading-none">
                Procura<span style={{ color: '#8B7CF8' }}>Med</span>
              </span>
              <span className="text-[10px] uppercase font-bold text-violet-600 tracking-wider">
                Admin Portal
              </span>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-slate-400 hover:text-slate-600"
          >
            <HiX className="w-5 h-5" />
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-grow p-4 space-y-3 overflow-y-auto text-xs">
          {/* Dashboard Home */}
          <Link
            to="/admin/dashboard"
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold transition-all ${
              location.pathname === '/admin/dashboard'
                ? 'text-white shadow-md shadow-violet-500/20'
                : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
            }`}
            style={
              location.pathname === '/admin/dashboard'
                ? { background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }
                : undefined
            }
          >
            <HiHome className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>

          {/* Group 1: User Management */}
          <div>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <HiUsers className="w-4 h-4 text-violet-500" />
                <span>User Management</span>
              </div>
              {userMenuOpen ? <HiChevronDown className="w-3.5 h-3.5" /> : <HiChevronRight className="w-3.5 h-3.5" />}
            </button>

            {userMenuOpen && (
              <div className="pl-4 pt-1 space-y-1">
                {[
                  { name: 'Department Staff', path: '/admin/users' },
                  { name: 'Purchase Officers', path: '/admin/purchase-officers' },
                  { name: 'Procurement Committee', path: '/admin/procurement-committee' },
                  { name: 'Technical Officers', path: '/admin/technical-officers' },
                ].map((item) => (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className="block px-3 py-1.5 rounded-lg text-slate-600 hover:bg-violet-50 hover:text-violet-700 font-medium transition-colors"
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Group 2: Vendor Management */}
          <div>
            <button
              onClick={() => setVendorMenuOpen(!vendorMenuOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <HiOfficeBuilding className="w-4 h-4 text-violet-500" />
                <span>Vendor Management</span>
              </div>
              {vendorMenuOpen ? <HiChevronDown className="w-3.5 h-3.5" /> : <HiChevronRight className="w-3.5 h-3.5" />}
            </button>

            {vendorMenuOpen && (
              <div className="pl-4 pt-1 space-y-1">
                <Link
                  to="/admin/vendor-applications"
                  onClick={() => setSidebarOpen(false)}
                  className={`block px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    location.pathname === '/admin/vendor-applications'
                      ? 'bg-violet-50 text-violet-700 font-bold'
                      : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                  }`}
                >
                  Vendor Applications
                </Link>
                <Link
                  to="/admin/vendors"
                  onClick={() => setSidebarOpen(false)}
                  className={`block px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    location.pathname === '/admin/vendors'
                      ? 'bg-violet-50 text-violet-700 font-bold'
                      : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                  }`}
                >
                  Approved Vendors
                </Link>
              </div>
            )}
          </div>

          {/* Group 3: System Management */}
          <div>
            <button
              onClick={() => setSystemMenuOpen(!systemMenuOpen)}
              className="w-full flex items-center justify-between px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <HiCog className="w-4 h-4 text-violet-500" />
                <span>System Management</span>
              </div>
              {systemMenuOpen ? <HiChevronDown className="w-3.5 h-3.5" /> : <HiChevronRight className="w-3.5 h-3.5" />}
            </button>

            {systemMenuOpen && (
              <div className="pl-4 pt-1 space-y-1">
                <Link
                  to="/admin/settings"
                  onClick={() => setSidebarOpen(false)}
                  className="block px-3 py-1.5 rounded-lg text-slate-600 hover:bg-violet-50 hover:text-violet-700 font-medium transition-colors"
                >
                  System Settings
                </Link>
                <Link
                  to="/admin/audit-logs"
                  onClick={() => setSidebarOpen(false)}
                  className="block px-3 py-1.5 rounded-lg text-slate-600 hover:bg-violet-50 hover:text-violet-700 font-medium transition-colors"
                >
                  Audit Logs
                </Link>
                <Link
                  to="/admin/reports"
                  onClick={() => setSidebarOpen(false)}
                  className="block px-3 py-1.5 rounded-lg text-slate-600 hover:bg-violet-50 hover:text-violet-700 font-medium transition-colors"
                >
                  System Reports
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-violet-50">
          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <HiLogout className="w-4 h-4 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-violet-100 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
            >
              <HiMenu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                System Administrator Dashboard
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                Hospital Procurement Management &amp; System Control Panel
              </p>
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={fetchStats}
              title="Refresh Data"
              className="p-2 rounded-xl text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
            >
              <HiRefresh className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
              >
                {user?.username?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-none">{adminName}</p>
                <p className="text-[10px] font-semibold text-violet-600 mt-1">{roleTitle}</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogoutModal(true)}
              className="hidden sm:inline-flex gap-1 text-xs text-slate-600 hover:text-rose-600 hover:bg-rose-50 border-slate-200"
            >
              <HiLogout className="w-3.5 h-3.5" />
              <span>Logout</span>
            </Button>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="flex-1 p-4 sm:p-8 space-y-8 max-w-7xl w-full mx-auto">
          {/* Welcome Banner */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl"
            style={{
              background: 'linear-gradient(135deg, #7C5FF0 0%, #8B7CF8 50%, #5B8EDC 100%)',
              boxShadow: '0 15px 40px rgba(139,124,248,0.20)',
            }}
          >
            {/* Decorative background circles */}
            <div
              className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full pointer-events-none"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
            <div
              className="absolute right-32 -top-12 w-48 h-48 rounded-full pointer-events-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
            />

            <div className="relative z-10 max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold tracking-wider uppercase mb-1">
                <HiShieldCheck className="w-4 h-4" /> System Administrator
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
                Welcome back, Admin
              </h2>
              <p className="text-white/85 text-xs sm:text-sm leading-relaxed">
                Manage hospital users, vendors, system activities, and procurement operations from one centralized platform.
              </p>
            </div>
          </motion.div>

          {/* 1. Dashboard Summary Cards (Real DB Data) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              System Overview &amp; Real-Time Metrics
            </h3>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Internal Users */}
              <div className="bg-white rounded-2xl p-5 border border-violet-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500">Total Internal Users</span>
                  <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                    <HiUsers className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900 tracking-tight">
                    {stats?.total_internal_users ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Excludes Vendor Accounts</p>
                </div>
              </div>

              {/* Card 2: Pending Vendor Applications */}
              <div className="bg-white rounded-2xl p-5 border border-violet-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500">Pending Applications</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <HiClipboardList className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-amber-600 tracking-tight">
                    {stats?.pending_vendor_applications ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Awaiting Admin Approval</p>
                </div>
              </div>

              {/* Card 3: Approved Vendors */}
              <div className="bg-white rounded-2xl p-5 border border-violet-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500">Approved Vendors</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <HiOfficeBuilding className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-emerald-600 tracking-tight">
                    {stats?.approved_vendors ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Active Suppliers</p>
                </div>
              </div>

              {/* Card 4: Active Users */}
              <div className="bg-white rounded-2xl p-5 border border-violet-100 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500">Active Internal Users</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <HiCheckCircle className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <p className="text-3xl font-black text-indigo-600 tracking-tight">
                    {stats?.active_internal_users ?? 0}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Active Staff Accounts</p>
                </div>
              </div>
            </div>
          </div>

          {/* 2. User Management Overview & Vendor Application Overview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Roles Breakdown Table (Only 5 Managed Roles - Administrator Excluded) */}
            <div className="bg-white rounded-3xl p-6 border border-violet-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                    <HiUsers className="w-4 h-4" />
                  </div>
                  <h4 className="text-base font-extrabold text-slate-900">User Management Overview</h4>
                </div>
                <Link to="/admin/users" className="text-xs font-bold text-violet-600 hover:underline">
                  Manage Users →
                </Link>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-400 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="px-4 py-2.5 rounded-l-xl">Role Name</th>
                      <th className="px-4 py-2.5 text-right rounded-r-xl">Actual User Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {[
                      'Department Staff',
                      'Purchase Officer',
                      'Vendor',
                      'Procurement Committee',
                      'Technical Officer'
                    ].map((role) => (
                      <tr key={role} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-semibold text-slate-800">{role}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 font-bold text-xs">
                            {getRoleCount(role)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Vendor Application Overview */}
            <div className="bg-white rounded-3xl p-6 border border-violet-100 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <HiClipboardList className="w-4 h-4" />
                    </div>
                    <h4 className="text-base font-extrabold text-slate-900">Vendor Application Overview</h4>
                  </div>
                  <Link to="/admin/vendor-applications" className="text-xs font-bold text-amber-600 hover:underline">
                    Review Applications →
                  </Link>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center mb-6">
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
                    <p className="text-2xl font-black text-amber-700">{vendorAppCounts.pending || 0}</p>
                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mt-1">Pending</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <p className="text-2xl font-black text-emerald-700">{vendorAppCounts.approved || 0}</p>
                    <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mt-1">Approved</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-100">
                    <p className="text-2xl font-black text-rose-700">{vendorAppCounts.rejected || 0}</p>
                    <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider mt-1">Rejected</p>
                  </div>
                </div>

                {totalVendorApps === 0 && (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-xs text-slate-500 font-semibold">No vendor applications yet.</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Link to="/admin/vendor-applications">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
                  >
                    <span>Review Vendor Applications</span>
                    <HiArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* 3. System Activity / Recent Audit Logs Section */}
          <div className="bg-white rounded-3xl p-6 border border-violet-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                  <HiClock className="w-4 h-4" />
                </div>
                <h4 className="text-base font-extrabold text-slate-900">Recent System Activity</h4>
              </div>
              <Link to="/admin/audit-logs" className="text-xs font-bold text-violet-600 hover:underline">
                View Full Log →
              </Link>
            </div>

            {(!stats?.recent_activities || stats.recent_activities.length === 0) ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-500 font-semibold">No system activity recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.recent_activities.slice(0, 5).map((log, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{log.action || log.module}</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">{log.description || `Performed by @${log.user}`}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">{log.created_at}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-6"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <HiLogout className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Logout Confirmation</h3>
                  <p className="text-xs text-slate-500">ProcuraMed Admin Portal</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to logout?
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setShowLogoutModal(false)}
                  className="border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleConfirmLogout}
                  className="bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20"
                >
                  Logout
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboardPage;
