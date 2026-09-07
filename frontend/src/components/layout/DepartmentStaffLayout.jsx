import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import ProcuraMedLogo from '../common/ProcuraMedLogo';
import Button from '../common/Button';
import {
  HiHome,
  HiClipboardList,
  HiDocumentAdd,
  HiBell,
  HiUserCircle,
  HiLogout,
  HiMenu,
  HiX,
  HiRefresh,
  HiOfficeBuilding,
  HiBadgeCheck
} from 'react-icons/hi';

const DepartmentStaffLayout = ({
  children,
  title = 'Department Staff Dashboard',
  subtitle = "Create and monitor your department's purchase requests and track procurement progress.",
  staffUser = null,
  onRefresh
}) => {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleConfirmLogout = () => {
    logout();
    setShowLogoutModal(false);
    navigate('/login');
  };

  const currentUser = staffUser || authUser;
  const displayName = currentUser?.full_name || currentUser?.first_name || currentUser?.username || 'Department Staff';
  const employeeId = currentUser?.employee_id || 'DS-STAFF';
  const departmentName = currentUser?.department_name || currentUser?.department || 'Hospital Department';
  const usernameHandle = currentUser?.username ? `@${currentUser.username}` : '@staff';

  const navItems = [
    { name: 'Dashboard', path: '/staff/dashboard', icon: HiHome },
    { name: 'My Purchase Requests', path: '/staff/requests', icon: HiClipboardList },
    { name: 'Create Purchase Request', path: '/staff/create-request', icon: HiDocumentAdd },
    { name: 'Notifications', path: '/staff/notifications', icon: HiBell },
    { name: 'My Profile', path: '/staff/profile', icon: HiUserCircle },
  ];

  return (
    <div className="min-h-screen bg-[#F8F8FC] flex font-sans text-slate-800">
      {/* Mobile Sidebar Backdrop */}
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
          <Link to="/staff/dashboard" className="flex items-center gap-2.5">
            <ProcuraMedLogo size={34} variant="color" />
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 block leading-none">
                Procura<span style={{ color: '#8B7CF8' }}>Med</span>
              </span>
              <span className="text-[10px] uppercase font-bold text-violet-600 tracking-wider">
                Staff Portal
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
        <nav className="flex-grow p-4 space-y-1.5 overflow-y-auto text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-semibold transition-all ${
                  isActive
                    ? 'text-white shadow-md shadow-violet-500/20'
                    : 'text-slate-600 hover:bg-violet-50 hover:text-violet-700'
                }`}
                style={
                  isActive
                    ? { background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }
                    : undefined
                }
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-violet-500'}`} />
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer - Department Badge & Logout */}
        <div className="p-4 border-t border-violet-50 space-y-2.5">
          <div className="p-2.5 bg-violet-50/80 rounded-2xl border border-violet-100 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0 font-bold">
              <HiOfficeBuilding className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold text-violet-900 leading-tight uppercase truncate">{departmentName}</p>
              <p className="text-[9px] text-violet-600 font-mono font-semibold">{employeeId}</p>
            </div>
          </div>

          <button
            onClick={() => setShowLogoutModal(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <HiLogout className="w-4 h-4 text-rose-500" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Body */}
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
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {title}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-bold uppercase">
                  <HiBadgeCheck className="w-3 h-3 text-violet-600" />
                  {departmentName}
                </span>
              </div>
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

            <Link
              to="/staff/notifications"
              title="Notifications"
              className="p-2 rounded-xl text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors relative"
            >
              <HiBell className="w-4 h-4" />
            </Link>

            <Link
              to="/staff/profile"
              className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs text-white shadow-sm"
                style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
              >
                {displayName?.charAt(0).toUpperCase() || 'S'}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-none truncate max-w-[140px]">{displayName}</p>
                <p className="text-[10px] font-semibold text-violet-600 mt-1">{usernameHandle} • {employeeId}</p>
              </div>
            </Link>

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

        {/* Page Content View */}
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
                  <p className="text-xs text-slate-500">Department Staff Portal</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 leading-relaxed">
                Are you sure you want to log out of the Department Staff Portal?
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
                  className="bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 font-bold"
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

export default DepartmentStaffLayout;
