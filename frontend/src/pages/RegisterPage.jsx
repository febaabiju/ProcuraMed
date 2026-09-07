import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { HiShieldCheck, HiUser, HiMail, HiLockClosed, HiPhone, HiOfficeBuilding, HiUserGroup, HiArrowLeft } from 'react-icons/hi';
import InputField from '../components/common/InputField';
import SelectField from '../components/common/SelectField';
import Button from '../components/common/Button';
import axiosClient from '../api/axiosClient';

const RegisterPage = () => {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { register: registerUser, loading } = useAuth();
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [apiError, setApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch available roles & departments from backend
    const fetchMetadata = async () => {
      try {
        const [rolesRes, deptsRes] = await Promise.all([
          axiosClient.get('/accounts/roles/'),
          axiosClient.get('/accounts/departments/')
        ]);
        if (rolesRes.data.results) {
          setRoles(rolesRes.data.results.map(r => ({ value: r.id, label: r.name })));
        } else if (Array.isArray(rolesRes.data)) {
          setRoles(rolesRes.data.map(r => ({ value: r.id, label: r.name })));
        }

        if (deptsRes.data.results) {
          setDepartments(deptsRes.data.results.map(d => ({ value: d.id, label: `${d.name} (${d.code || 'DEPT'})` })));
        } else if (Array.isArray(deptsRes.data)) {
          setDepartments(deptsRes.data.map(d => ({ value: d.id, label: `${d.name} (${d.code || 'DEPT'})` })));
        }
      } catch (err) {
        // Preset fallbacks if backend requires initial seed
        setRoles([
          { value: 1, label: 'Department Staff' },
          { value: 2, label: 'Purchase Officer' },
          { value: 3, label: 'Procurement Committee' },
          { value: 4, label: 'Technical Officer' },
          { value: 5, label: 'Vendor' },
        ]);
        setDepartments([
          { value: 1, label: 'Cardiology' },
          { value: 2, label: 'Radiology & Imaging' },
          { value: 3, label: 'IT & Bio-Medical Infrastructure' },
          { value: 4, label: 'Intensive Care Unit (ICU)' },
          { value: 5, label: 'Maintenance & Facility' },
        ]);
      }
    };
    fetchMetadata();
  }, []);

  const onSubmit = async (data) => {
    setApiError('');
    setSuccessMsg('');

    const payload = {
      username: data.username,
      email: data.email,
      password: data.password,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      role: data.role ? parseInt(data.role) : null,
      department: data.department ? parseInt(data.department) : null,
      is_active: true
    };

    const result = await registerUser(payload);
    if (result.success) {
      setSuccessMsg('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } else {
      setApiError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 py-12 relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl h-[500px] bg-gradient-to-tr from-teal-600/20 via-blue-600/10 to-transparent blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-xl bg-white rounded-3xl p-8 sm:p-10 shadow-2xl border border-slate-200/80 relative z-10 space-y-6"
      >
        {/* Back Button */}
        <Link to="/" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-teal-600 transition-colors">
          <HiArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 mb-1">
            <HiShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            User Account Registration
          </h1>
          <p className="text-xs text-slate-500">
            Register your role and department to participate in hospital procurement operations.
          </p>
        </div>

        {/* Error Alert */}
        {apiError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
            <svg className="w-4 h-4 text-rose-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{apiError}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
            <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{successMsg}</span>
          </div>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="First Name"
              placeholder="Dr. Feba"
              icon={HiUser}
              required
              error={errors.first_name?.message}
              {...register('first_name', { required: 'First name is required' })}
            />
            <InputField
              label="Last Name"
              placeholder="Biju"
              icon={HiUser}
              required
              error={errors.last_name?.message}
              {...register('last_name', { required: 'Last name is required' })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Username"
              placeholder="feba_cardiology"
              icon={HiUser}
              required
              error={errors.username?.message}
              {...register('username', { required: 'Username is required' })}
            />
            <InputField
              label="Email Address"
              type="email"
              placeholder="feba@procuramed.com"
              icon={HiMail}
              required
              error={errors.email?.message}
              {...register('email', { 
                required: 'Email is required',
                pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' }
              })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Phone Number"
              placeholder="+91 9876543210"
              icon={HiPhone}
              error={errors.phone?.message}
              {...register('phone')}
            />
            <InputField
              label="Password"
              type="password"
              placeholder="••••••••"
              icon={HiLockClosed}
              required
              error={errors.password?.message}
              {...register('password', { 
                required: 'Password is required',
                minLength: { value: 6, message: 'Password must be at least 6 characters' }
              })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label="Role Allocation"
              icon={HiUserGroup}
              options={roles}
              placeholder="Select System Role"
              required
              error={errors.role?.message}
              {...register('role', { required: 'Role selection is required' })}
            />
            <SelectField
              label="Department Mapping"
              icon={HiOfficeBuilding}
              options={departments}
              placeholder="Select Hospital Department"
              error={errors.department?.message}
              {...register('department')}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={loading}
            className="w-full mt-4"
          >
            Create User Account
          </Button>

        </form>

        {/* Footer Link */}
        <div className="text-center pt-2 text-xs text-slate-500 border-t border-slate-100">
          Already registered?{' '}
          <Link to="/login" className="text-teal-600 font-bold hover:underline">
            Sign In Here
          </Link>
        </div>

      </motion.div>
    </div>
  );
};

export default RegisterPage;
