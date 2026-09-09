import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import ProcuraMedLogo from '../components/common/ProcuraMedLogo';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';
import { HiLockClosed, HiEye, HiEyeOff, HiShieldCheck, HiCheckCircle, HiXCircle } from 'react-icons/hi';

const SetNewPasswordPage = () => {
  const {
    user,
    setUser,
    isAuthenticated,
    isDepartmentStaff,
    isPurchaseOfficer,
    isCommitteeMember,
    isTechnicalOfficer,
    logout
  } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  // Redirect unauthenticated users to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user has already completed first login, redirect to their assigned dashboard
  if (user && !user.first_login) {
    if (isDepartmentStaff) return <Navigate to="/staff/dashboard" replace />;
    if (isPurchaseOfficer) return <Navigate to="/purchase-officer/dashboard" replace />;
    if (isCommitteeMember) return <Navigate to="/committee/dashboard" replace />;
    if (isTechnicalOfficer) return <Navigate to="/technical-officer/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  const getDashboardPath = () => {
    if (isDepartmentStaff) return '/staff/dashboard';
    if (isPurchaseOfficer) return '/purchase-officer/dashboard';
    if (isCommitteeMember) return '/committee/dashboard';
    if (isTechnicalOfficer) return '/technical-officer/dashboard';
    return '/';
  };

  const getRoleDisplayName = () => {
    const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
    return roleName || 'Hospital Staff';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword.trim()) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify and try again.');
      return;
    }

    setLoading(true);
    try {
      await axiosClient.post('/accounts/users/force_change_password/', {
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      // Update auth context state to clear first_login
      if (user) {
        const updatedUser = { ...user, first_login: false };
        sessionStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }

      setSuccess('Password updated successfully! Redirecting to your dashboard...');
      setTimeout(() => {
        navigate(getDashboardPath(), { replace: true });
      }, 1000);
    } catch (err) {
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Failed to update password. Please check requirements and try again.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background healthcare image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1600&q=80')`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          zIndex: 0,
        }}
      />

      {/* Gradient Overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(248,248,252,0.94) 0%, rgba(237,233,254,0.88) 50%, rgba(224,231,255,0.90) 100%)',
          backdropFilter: 'blur(3px)',
          zIndex: 1,
        }}
      />

      {/* Soft Glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.35) 0%, rgba(184,216,255,0.25) 70%, transparent 100%)', zIndex: 2 }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl p-8 sm:p-10 shadow-xl border border-violet-100/80 relative z-10 space-y-6"
        style={{ boxShadow: '0 20px 50px rgba(139,124,248,0.15)' }}
      >
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center mb-1">
            <ProcuraMedLogo size={46} variant="color" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Set New Password
          </h1>
          <p className="text-xs text-slate-500">
            Welcome, <strong className="text-slate-800">@{user?.username}</strong> ({getRoleDisplayName()}).
            <br />Please set your permanent password to complete account setup.
          </p>
        </div>

        {/* Security Alert / Notice */}
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-800 text-xs flex items-start gap-2.5">
          <HiShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">First-Time Sign In:</span> You logged in using an automatically generated temporary password. You must set a personal password before accessing your dashboard.
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
            <HiXCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
            <HiCheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <InputField
              label="New Password *"
              type={showPassword ? 'text' : 'password'}
              placeholder="Minimum 6 characters"
              icon={HiLockClosed}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-9 text-slate-400 hover:text-violet-600 focus:outline-none transition-colors"
            >
              {showPassword ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
            </button>
          </div>

          <div className="relative">
            <InputField
              label="Confirm New Password *"
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter your new password"
              icon={HiLockClosed}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3.5 top-9 text-slate-400 hover:text-violet-600 focus:outline-none transition-colors"
            >
              {showConfirm ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
            </button>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-bold shadow-lg shadow-violet-500/25"
              style={{ background: 'linear-gradient(135deg, #7C5FF0, #4F46E5)' }}
              isLoading={loading}
            >
              Save Password &amp; Continue
            </Button>
          </div>
        </form>

        <div className="text-center pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={logout}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            Sign out and return to login
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SetNewPasswordPage;
