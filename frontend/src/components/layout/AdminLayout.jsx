import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import ProcuraMedLogo from '../common/ProcuraMedLogo';
import Button from '../common/Button';
import {
  HiHome,
  HiUsers,
  HiClipboardList,
  HiOfficeBuilding,
  HiLogout,
  HiShieldCheck,
  HiMenu,
  HiX,
  HiChevronDown,
  HiChevronRight,
  HiCog,
  HiDocumentReport,
  HiClock,
  HiRefresh
} from 'react-icons/hi';

const AdminLayout = ({ children, title = 'System Administrator Portal', subtitle = 'Hospital Procurement Management & System Control Panel', onRefresh }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Submenu expandable state
  const [userMenuOpen, setUserMenuOpen] = useState(true);
  const [vendorMenuOpen, setVendorMenuOpen] = useState(true);
  const [systemMenuOpen, setSystemMenuOpen] = useState(true);

  const handleConfirmLogout = () => {
    logout();
    setShowLogoutModal(false);
    navigate('/login', { replace: true });
  };

  const adminName = user?.full_name || user?.first_name || user?.username || 'Admin';
  const roleTitle = typeof user?.role === 'string' ? user.role : (user?.role?.name || 'System Administrator');

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
                ].map((item) => {
                  let isActive = false;
                  if (item.name === 'Department Staff') {
                    isActive = location.pathname === '/admin/users' && (!new URLSearchParams(location.search).get('role') || new URLSearchParams(location.search).get('role')?.toLowerCase().includes('department'));
                  } else if (item.name === 'Purchase Officers') {
                    isActive = location.pathname.startsWith('/admin/purchase-officer');
                  } else if (item.name === 'Procurement Committee') {
                    isActive = location.pathname.startsWith('/admin/procurement-committee');
                  } else if (item.name === 'Technical Officers') {
                    isActive = location.pathname.startsWith('/admin/technical-officer');
                  } else {
                    const roleQuery = item.path.split('role=')[1]?.replace('%20', ' ');
                    isActive = location.pathname === '/admin/users' && new URLSearchParams(location.search).get('role') === roleQuery;
                  }

                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`block px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        isActive
                          ? 'bg-violet-50 text-violet-700 font-bold'
                          : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
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
                  className={`block px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    location.pathname === '/admin/settings'
                      ? 'bg-violet-50 text-violet-700 font-bold'
                      : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                  }`}
                >
                  System Settings
                </Link>
                <Link
                  to="/admin/audit-logs"
                  onClick={() => setSidebarOpen(false)}
                  className={`block px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    location.pathname === '/admin/audit-logs'
                      ? 'bg-violet-50 text-violet-700 font-bold'
                      : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                  }`}
                >
                  Audit Logs
                </Link>
                <Link
                  to="/admin/reports"
                  onClick={() => setSidebarOpen(false)}
                  className={`block px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    location.pathname === '/admin/reports'
                      ? 'bg-violet-50 text-violet-700 font-bold'
                      : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                  }`}
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
                {title}
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                {subtitle}
              </p>
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            {onRefresh && (
              <button
                onClick={onRefresh}
                title="Refresh Data"
                className="p-2 rounded-xl text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
              >
                <HiRefresh className="w-4 h-4" />
              </button>
            )}

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

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {children}
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

export default AdminLayout;
