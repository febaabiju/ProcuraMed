import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import {
  HiUser,
  HiLockClosed,
  HiEye,
  HiEyeOff,
  HiArrowLeft,
  HiMail,
  HiShieldCheck,
  HiCheckCircle,
  HiXCircle,
  HiX
} from 'react-icons/hi';
import ProcuraMedLogo from '../components/common/ProcuraMedLogo';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';

const LoginPage = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { login, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Forgot password modal state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotResultMsg, setForgotResultMsg] = useState('');
  const [forgotError, setForgotError] = useState('');

  const navigate = useNavigate();

  const onSubmit = async (data) => {
    setApiError('');
    setSuccessMsg('');
    const result = await login(data.username, data.password);
    if (result.success) {
      setSuccessMsg('Authentication successful! Redirecting...');
      const userData = result.data?.user;
      const roleName = typeof userData?.role === 'string' ? userData.role : userData?.role?.name;
      const isAdminUser = Boolean(
        userData && (
          roleName?.toLowerCase() === 'system administrator' ||
          roleName?.toLowerCase() === 'admin' ||
          userData.is_staff ||
          userData.is_superuser
        )
      );

      const isVendorUser = Boolean(
        userData && (
          roleName?.toLowerCase() === 'vendor' ||
          userData.is_vendor
        )
      );

      const isStaffUser = Boolean(
        userData && (
          roleName?.toLowerCase() === 'department staff' ||
          roleName?.toLowerCase()?.includes('staff') ||
          roleName?.toLowerCase()?.includes('department')
        ) && !isAdminUser && !isVendorUser
      );

      const isPurchaseOfficerUser = Boolean(
        userData && (
          roleName?.toLowerCase() === 'purchase officer' ||
          roleName?.toLowerCase() === 'procurement officer' ||
          roleName?.toLowerCase()?.includes('purchase')
        ) && !isAdminUser && !isVendorUser && !isStaffUser
      );

      const isCommitteeUser = Boolean(
        userData && (
          roleName?.toLowerCase()?.includes('committee')
        ) && !isAdminUser && !isVendorUser && !isStaffUser && !isPurchaseOfficerUser
      );

      const isTechnicalOfficerUser = Boolean(
        userData && (
          roleName?.toLowerCase()?.includes('technical')
        ) && !isAdminUser && !isVendorUser && !isStaffUser && !isPurchaseOfficerUser && !isCommitteeUser
      );

      setTimeout(() => {
        if (isAdminUser) {
          navigate('/admin/dashboard');
        } else if (isVendorUser) {
          if (userData?.first_login) {
            navigate('/vendor/change-password');
          } else {
            navigate('/vendor/dashboard');
          }
        } else if (isStaffUser) {
          navigate('/staff/dashboard');
        } else if (isPurchaseOfficerUser) {
          navigate('/purchase-officer/dashboard');
        } else if (isCommitteeUser) {
          navigate('/committee/dashboard');
        } else if (isTechnicalOfficerUser) {
          navigate('/technical-officer/dashboard');
        } else {
          navigate('/');
        }
      }, 800);
    } else {
      setApiError(result.error);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotResultMsg('');

    if (!forgotUsername.trim() || !forgotEmail.trim()) {
      setForgotError('Please enter both your username and registered email address.');
      return;
    }

    setForgotLoading(true);
    try {
      const res = await axiosClient.post('/accounts/forgot-password/', {
        username: forgotUsername.trim(),
        email: forgotEmail.trim(),
      });
      setForgotResultMsg(
        res.data.message ||
        'Password reset request submitted successfully. Please contact the system administrator to reset your password.'
      );
    } catch (err) {
      // In case of unexpected network failure
      setForgotResultMsg('Password reset request submitted successfully. Please contact the system administrator to reset your password.');
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setForgotPasswordOpen(false);
    setForgotUsername('');
    setForgotEmail('');
    setForgotResultMsg('');
    setForgotError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Healthcare background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1600&q=80')`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
          zIndex: 0,
        }}
      />

      {/* Soft lavender & pastel blue gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(248,248,252,0.92) 0%, rgba(237,233,254,0.86) 50%, rgba(224,231,255,0.88) 100%)',
          backdropFilter: 'blur(3px)',
          zIndex: 1,
        }}
      />

      {/* Glow background accents */}
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
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-violet-600 transition-colors"
        >
          <HiArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center mb-1">
            <ProcuraMedLogo size={46} variant="color" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Sign In to ProcuraMed
          </h1>
          <p className="text-xs text-slate-500">
            Hospital Staff &amp; Approved Vendor Login Portal
          </p>
        </div>

        {/* Error Alert */}
        {apiError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
            <HiXCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
            <HiCheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <InputField
            label="Username or Email"
            placeholder="admin / proc_officer / vendor_username"
            icon={HiUser}
            required
            error={errors.username?.message}
            {...register('username', { required: 'Username or Email is required' })}
          />

          <div className="relative">
            <InputField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              icon={HiLockClosed}
              required
              error={errors.password?.message}
              {...register('password', { required: 'Password is required' })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-9 text-slate-400 hover:text-violet-600 focus:outline-none transition-colors"
            >
              {showPassword ? <HiEyeOff className="w-5 h-5" /> : <HiEye className="w-5 h-5" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setForgotResultMsg('');
                setForgotError('');
                setForgotPasswordOpen(true);
              }}
              className="text-violet-600 hover:underline font-semibold"
            >
              Forgot Password?
            </button>
          </div>

          <Button
            type="submit"
            size="lg"
            isLoading={loading}
            className="w-full mt-2 text-white font-bold"
            style={{
              background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)',
              boxShadow: '0 4px 14px rgba(139,124,248,0.35)',
            }}
          >
            Sign In to Portal
          </Button>
        </form>

        {/* Footer Link */}
        <div className="text-center pt-2 text-xs text-slate-500 border-t border-slate-100">
          Medical Equipment Supplier?{' '}
          <Link to="/vendor-register" className="text-violet-600 font-bold hover:underline">
            Apply as Vendor Supplier
          </Link>
        </div>
      </motion.div>

      {/* FORGOT PASSWORD MODAL */}
      <AnimatePresence>
        {forgotPasswordOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                    <HiLockClosed className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Forgot Password</h3>
                    <p className="text-xs text-slate-500">Submit a password reset request</p>
                  </div>
                </div>
                <button
                  onClick={closeForgotPasswordModal}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              {forgotResultMsg ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                    <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                      <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                      <span>Request Submitted</span>
                    </p>
                    <p className="leading-relaxed font-medium">
                      {forgotResultMsg}
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-700">Next Steps:</p>
                    <p>1. The Hospital System Administrator will verify your vendor account status.</p>
                    <p>2. A secure temporary password will be generated for your account.</p>
                    <p>3. You will be required to change your password upon your next login.</p>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      variant="primary"
                      size="md"
                      onClick={closeForgotPasswordModal}
                      className="font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
                    >
                      Back to Login
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4 text-xs">
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Enter your username and registered business email address to submit a password reset request to the ProcuraMed system administrator.
                  </p>

                  {forgotError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                      <HiXCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Enter Username <span className="text-rose-500">*</span>
                    </label>
                    <InputField
                      type="text"
                      placeholder="e.g. vendor001 / medtech_supplies"
                      icon={HiUser}
                      value={forgotUsername}
                      onChange={(e) => setForgotUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Enter Registered Email Address <span className="text-rose-500">*</span>
                    </label>
                    <InputField
                      type="email"
                      placeholder="e.g. contact@medtech.com"
                      icon={HiMail}
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="p-3 bg-violet-50/70 rounded-xl border border-violet-100 flex items-start gap-2 text-violet-900 text-[11px]">
                    <HiShieldCheck className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                    <span>
                      Vendor password resets are securely managed by the system administrator to maintain strict procurement governance.
                    </span>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={closeForgotPasswordModal}
                      className="border-slate-200 text-slate-700"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      isLoading={forgotLoading}
                      className="font-bold text-white shadow-md shadow-violet-500/20"
                      style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
                    >
                      Submit Request
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoginPage;
