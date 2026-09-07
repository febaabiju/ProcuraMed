import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import ProcuraMedLogo from '../../components/common/ProcuraMedLogo';
import InputField from '../../components/common/InputField';
import Button from '../../components/common/Button';
import { HiLockClosed, HiEye, HiEyeOff, HiShieldCheck, HiCheckCircle, HiXCircle } from 'react-icons/hi';

const VendorChangePasswordPage = () => {
  const { user, setUser, logout } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please verify and re-enter.');
      return;
    }

    setLoading(true);
    try {
      const res = await axiosClient.post('/accounts/users/force_change_password/', {
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      // Update local auth context user
      if (user) {
        const updatedUser = { ...user, first_login: false };
        sessionStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }

      setSuccess('Password updated successfully! Entering Vendor Dashboard...');
      setTimeout(() => {
        navigate('/vendor/dashboard');
      }, 1000);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to update password. Please try again.';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background layer */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(248,248,252,0.95) 0%, rgba(237,233,254,0.90) 50%, rgba(224,231,255,0.92) 100%)',
          backdropFilter: 'blur(3px)',
          zIndex: 1,
        }}
      />

      {/* Accents glow */}
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
            Welcome, <strong className="text-slate-800">@{user?.username || 'Vendor'}</strong>. Please choose a new permanent password for your supplier account before proceeding.
          </p>
        </div>

        {/* Security Alert Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <HiShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            Your account was initialized or reset with a temporary password. You must set a permanent secure password to activate dashboard access.
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
            <HiXCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Notification */}
        {success && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
            <HiCheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <InputField
              label="New Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              icon={HiLockClosed}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
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
              label="Confirm New Password"
              type={showConfirm ? 'text' : 'password'}
              placeholder="••••••••"
              icon={HiLockClosed}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3.5 top-9 text-slate-400 hover:text-violet-600 focus:outline-none transition-colors"
            >
              {showConfirm ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
            </button>
          </div>

          <Button
            type="submit"
            size="lg"
            isLoading={loading}
            className="w-full mt-3 text-white font-bold"
            style={{
              background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)',
              boxShadow: '0 4px 14px rgba(139,124,248,0.35)',
            }}
          >
            Update Password &amp; Enter Dashboard
          </Button>
        </form>

        <div className="text-center pt-2 text-xs border-t border-slate-100">
          <button
            type="button"
            onClick={logout}
            className="text-slate-400 hover:text-slate-600 font-semibold"
          >
            Sign out of account
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default VendorChangePasswordPage;
