import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { HiMenu, HiX, HiLogout, HiArrowRight, HiUsers, HiClipboardList, HiOfficeBuilding, HiHome } from 'react-icons/hi';
import { motion, AnimatePresence } from 'framer-motion';
import ProcuraMedLogo from '../common/ProcuraMedLogo';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isAuthenticated, isAdmin, isVendor, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-violet-100/80 shadow-sm shadow-violet-100/50">
      <div className="w-full max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between h-16">

          {/* Logo (Far Left) */}
          <div className="flex-1 flex justify-start items-center">
            <Link to={isAdmin ? "/admin/dashboard" : isVendor ? "/vendor/dashboard" : "/"} className="flex items-center gap-2.5 group">
              <ProcuraMedLogo size={36} variant="color" className="group-hover:scale-105 transition-transform duration-200" />
              <span className="text-xl font-bold tracking-tight" style={{ color: '#8B7CF8' }}>
                ProcuraMed
              </span>
            </Link>
          </div>

          {/* Desktop Nav Links (Perfectly Centered) */}
          <nav className="hidden md:flex items-center justify-center gap-8 text-sm font-medium text-slate-600">
            <a href="#home"     className="hover:text-violet-600 transition-colors">Home</a>
            <a href="#about"    className="hover:text-violet-600 transition-colors">About</a>
            <a href="#features" className="hover:text-violet-600 transition-colors">Features</a>
            <a href="#contact"  className="hover:text-violet-600 transition-colors">Contact</a>

            {isAdmin && (
              <div className="flex items-center gap-4 pl-4 border-l border-violet-100">
                <Link to="/admin/dashboard"           className="hover:text-violet-600 transition-colors flex items-center gap-1"><HiHome className="w-4 h-4" /> Dashboard</Link>
                <Link to="/admin/users"               className="hover:text-violet-600 transition-colors flex items-center gap-1"><HiUsers className="w-4 h-4" /> Staff</Link>
                <Link to="/admin/vendor-applications" className="hover:text-violet-600 transition-colors flex items-center gap-1"><HiClipboardList className="w-4 h-4" /> Applications</Link>
                <Link to="/admin/vendors"             className="hover:text-violet-600 transition-colors flex items-center gap-1"><HiOfficeBuilding className="w-4 h-4" /> Vendors</Link>
              </div>
            )}

            {isVendor && (
              <div className="flex items-center gap-4 pl-4 border-l border-violet-100">
                <Link to="/vendor/dashboard" className="hover:text-violet-600 transition-colors flex items-center gap-1"><HiHome className="w-4 h-4" /> Vendor Portal</Link>
              </div>
            )}
          </nav>

          {/* Desktop CTAs (Far Right) */}
          <div className="hidden md:flex flex-1 justify-end items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-100">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs text-white"
                    style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}>
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 leading-none">{user?.username}</p>
                    <p className="text-[10px] font-semibold" style={{ color: '#8B7CF8' }}>{user?.role || 'Staff'}</p>
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all"
                >
                  <HiLogout className="w-4 h-4" /> Logout
                </button>
              </div>
            ) : (
              <>
                <Link to="/login">
                  <button className="px-5 py-2 rounded-xl text-sm font-semibold border transition-all hover:bg-violet-50"
                    style={{ color: '#8B7CF8', borderColor: '#C4BBFB' }}>
                    Login
                  </button>
                </Link>
                <Link to="/vendor-register">
                  <button
                    className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 hover:shadow-lg flex items-center gap-1.5"
                    style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)', boxShadow: '0 4px 14px rgba(139,124,248,0.35)' }}
                  >
                    Become a Vendor <HiArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Hamburger */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-500 hover:bg-violet-50 focus:outline-none transition-colors"
            >
              {mobileMenuOpen ? <HiX className="w-6 h-6" /> : <HiMenu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-white border-t border-violet-100 px-4 py-4 space-y-1"
          >
            {['Home', 'About', 'Features', 'Contact'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors"
              >
                {item}
              </a>
            ))}
            <Link
              to="/vendor-register"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors"
            >
              Become a Vendor
            </Link>
            {isAdmin && (
              <>
                <Link to="/admin/users"               onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-700">Manage Staff</Link>
                <Link to="/admin/vendor-applications" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-violet-50 hover:text-violet-700">Vendor Applications</Link>
              </>
            )}
            <div className="pt-3 border-t border-violet-100 flex flex-col gap-2">
              {isAuthenticated ? (
                <button onClick={logout} className="w-full py-2.5 rounded-xl text-sm font-semibold text-rose-600 border border-rose-100 hover:bg-rose-50 transition-colors">
                  Logout ({user?.username})
                </button>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    <button className="w-full py-2.5 rounded-xl text-sm font-semibold border" style={{ color: '#8B7CF8', borderColor: '#C4BBFB' }}>Login</button>
                  </Link>
                  <Link to="/vendor-register" onClick={() => setMobileMenuOpen(false)}>
                    <button className="w-full py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}>Become a Vendor</button>
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
