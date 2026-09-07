import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axiosClient from '../api/axiosClient';
import ProcuraMedLogo from '../components/common/ProcuraMedLogo';
import Button from '../components/common/Button';
import {
  HiLockClosed,
  HiEye,
  HiEyeOff,
  HiCheckCircle,
  HiXCircle,
  HiArrowLeft,
  HiShieldCheck,
  HiRefresh
} from 'react-icons/hi';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid') || '';
  const token = searchParams.get('token') || '';

  const navigate = useNavigate();

  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [associatedUsername, setAssociatedUsername] = useState('');
  const [validationError, setValidationError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      if (!uid || !token) {
        setValidationError('This password reset link is incomplete or missing required security parameters.');
        setTokenValid(false);
        setValidating(false);
        return;
      }

      try {
        const res = await axiosClient.get('/accounts/reset-password/validate/', {
          params: { uid, token }
        });
        if (res.data && res.data.valid) {
          setTokenValid(true);
          setAssociatedUsername(res.data.username || '');
        } else {
          setTokenValid(false);
          setValidationError(res.data?.error || 'This password reset link is invalid or has expired.');
        }
      } catch (err) {
        setTokenValid(false);
        setValidationError(
          err.response?.data?.error ||
          'This password reset link is invalid or has expired. Please request a new one.'
        );
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [uid, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!newPassword) {
      setSubmitError('Please enter your new password.');
      return;
    }

    if (newPassword.length < 8) {
      setSubmitError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setSubmitError('New passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      await axiosClient.post('/accounts/reset-password/confirm/', {
        uid,
        token,
        new_password: newPassword,
        confirm_password: confirmPassword
      });
      setResetSuccess(true);
    } catch (err) {
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'Failed to reset password. The link may have expired or been used already.';
      setSubmitError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Healthcare Background Image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1600&q=80')`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          zIndex: 0,
        }}
      />

      {/* Soft lavender & pastel overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(248,248,252,0.92) 0%, rgba(237,233,254,0.86) 50%, rgba(224,231,255,0.88) 100%)',
          backdropFilter: 'blur(3px)',
          zIndex: 1,
        }}
      />

      {/* Glow background accent */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.30) 0%, rgba(184,216,255,0.20) 70%, transparent 100%)', zIndex: 2 }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white/95 backdrop-blur-md rounded-3xl p-8 sm:p-10 shadow-xl border border-violet-100/80 relative z-10 space-y-6"
        style={{ boxShadow: '0 20px 50px rgba(139,124,248,0.15)' }}
      >
        {/* Back to Login Link */}
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-violet-700 transition-colors"
        >
          <HiArrowLeft className="w-4 h-4" />
          <span>Back to Sign In</span>
        </Link>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-1">
            <ProcuraMedLogo size={52} variant="color" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Procura<span style={{ color: '#8B7CF8' }}>Med</span>
          </h2>
          <p className="text-xs uppercase tracking-wider font-semibold text-violet-600">
            Vendor Portal Password Reset
          </p>
        </div>

        {/* State 1: Validating Link */}
        {validating && (
          <div className="py-12 text-center space-y-3">
            <HiRefresh className="w-8 h-8 animate-spin text-violet-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-600">
              Verifying security link...
            </p>
          </div>
        )}

        {/* State 2: Invalid or Expired Link */}
        {!validating && !tokenValid && (
          <div className="space-y-4 text-center">
            <div className="w-14 h-14 rounded-3xl bg-rose-50 border border-rose-200 text-rose-600 mx-auto flex items-center justify-center">
              <HiXCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">
                Invalid or Expired Reset Link
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                {validationError || 'This password reset link is invalid or has already expired. Password reset links are single-use and expire after 30 minutes.'}
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                className="w-full justify-center font-bold text-white shadow-md shadow-violet-500/20"
                style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
                onClick={() => navigate('/login')}
              >
                Return to Sign In
              </Button>
            </div>
          </div>
        )}

        {/* State 3: Successful Password Reset */}
        {!validating && tokenValid && resetSuccess && (
          <div className="space-y-5 text-center">
            <div className="w-14 h-14 rounded-3xl bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto flex items-center justify-center">
              <HiCheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-extrabold text-slate-900">
                Password Reset Successfully
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Your password has been updated. You can now log in to the ProcuraMed Vendor Portal with your new password.
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                className="w-full justify-center font-bold text-white shadow-md shadow-emerald-500/20"
                style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                onClick={() => navigate('/login')}
              >
                Sign In to ProcuraMed
              </Button>
            </div>
          </div>
        )}

        {/* State 4: Reset Form */}
        {!validating && tokenValid && !resetSuccess && (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {associatedUsername && (
              <div className="p-3 bg-violet-50/70 border border-violet-100 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2 text-violet-950 font-medium text-xs">
                  <HiShieldCheck className="w-4 h-4 text-violet-600 flex-shrink-0" />
                  <span>Account:</span>
                </div>
                <span className="font-mono font-bold text-violet-700 bg-white px-2.5 py-1 rounded-xl border border-violet-200/80 shadow-2xs">
                  @{associatedUsername}
                </span>
              </div>
            )}

            {submitError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <HiXCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{submitError}</span>
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <HiLockClosed className="w-4 h-4" />
                </div>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showNewPassword ? <HiEyeOff className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Must be at least 8 characters long.
              </p>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <HiLockClosed className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? <HiEyeOff className="w-4 h-4" /> : <HiEye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={submitting}
                className="w-full justify-center font-bold text-white shadow-md shadow-violet-500/20"
                style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
              >
                Reset Password
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;
