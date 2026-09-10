import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import axiosClient from '../api/axiosClient';
import { VENDOR_VALIDATION_RULES } from '../utils/vendorValidation';
import {
  HiShieldCheck as IconShield,
  HiUser as IconUser,
  HiMail as IconMail,
  HiPhone as IconPhone,
  HiLocationMarker as IconLocation,
  HiDocumentText as IconDoc,
  HiUpload as IconUpload,
  HiCheckCircle as IconCheck,
  HiArrowLeft as IconBack
} from 'react-icons/hi';
import ProcuraMedLogo from '../components/common/ProcuraMedLogo';
import InputField from '../components/common/InputField';
import Button from '../components/common/Button';

const DEFAULT_CATEGORIES = [
  'Medical Equipment & Devices',
  'Biomedical Equipment',
  'Medical Consumables',
  'Laboratory Equipment & Supplies',
  'Surgical Instruments',
  'Diagnostic Equipment',
  'Radiology & Imaging Equipment',
  'ICU & Critical Care Equipment',
  'Hospital Furniture & Fixtures',
  'IT Hardware & Software',
  'Maintenance & Technical Services',
  'General Hospital Supplies',
  'Cleaning & Housekeeping Supplies',
  'Other'
];

const VendorRegisterPage = () => {
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors }
  } = useForm({
    mode: 'onSubmit',
    reValidateMode: 'onChange'
  });
  const { submitVendorApplication, loading, isAuthenticated, isAdmin, isVendor, user } = useAuth();

  // If already authenticated, automatically redirect to appropriate dashboard
  if (isAuthenticated) {
    if (isAdmin) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (isVendor) {
      return <Navigate to={user?.first_login ? "/vendor/change-password" : "/vendor/dashboard"} replace />;
    }
  }
  const [apiError, setApiError] = useState('');
  const [catError, setCatError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [applicationData, setApplicationData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await axiosClient.get('/vendors/categories/');
        const cats = res.data.results || res.data || [];
        if (cats.length > 0) {
          const sortedCats = [...cats].sort((a, b) => {
            const indexA = DEFAULT_CATEGORIES.indexOf(a.name);
            const indexB = DEFAULT_CATEGORIES.indexOf(b.name);
            return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
          });
          setCategories(sortedCats);
        } else {
          setCategories(DEFAULT_CATEGORIES.map((c, i) => ({ id: i + 1, name: c })));
        }
      } catch (e) {
        setCategories(DEFAULT_CATEGORIES.map((c, i) => ({ id: i + 1, name: c })));
      }
    };
    loadCategories();
  }, []);

  const toggleCategory = (catId) => {
    let updated;
    if (selectedCategories.includes(catId)) {
      updated = selectedCategories.filter(id => id !== catId);
    } else {
      updated = [...selectedCategories, catId];
    }
    setSelectedCategories(updated);
    if (updated.length > 0) {
      setCatError('');
    }
  };

  const onSubmit = async (data) => {
    setApiError('');
    
    // Category validation
    if (selectedCategories.length === 0) {
      setCatError('At least one supplier category must be selected.');
      return;
    } else {
      setCatError('');
    }

    // Certificate file validation
    if (!data.certificate_file || !data.certificate_file[0]) {
      setError('certificate_file', {
        type: 'manual',
        message: 'Business License / Registration Certificate is required'
      });
      return;
    }

    const file = data.certificate_file[0];
    const fileNameLower = (file.name || '').toLowerCase();
    if (!fileNameLower.endsWith('.pdf')) {
      setError('certificate_file', {
        type: 'manual',
        message: 'Only PDF files (.pdf) are allowed for the certificate'
      });
      return;
    }

    const formData = new FormData();
    formData.append('company_name', (data.company_name || '').trim());
    formData.append('contact_person', (data.contact_person || '').trim());
    formData.append('email', (data.email || '').trim());
    formData.append('phone', (data.phone || '').trim());
    formData.append('address', (data.address || '').trim());
    formData.append('products_services_offered', (data.products_services_offered || '').trim());

    selectedCategories.forEach(catId => {
      formData.append('supplier_categories', catId);
    });

    formData.append('certificate_file', file);

    const result = await submitVendorApplication(formData);
    if (result.success) {
      setApplicationData(result.data);
      setSubmitted(true);
    } else {
      if (result.errorData && typeof result.errorData === 'object') {
        let hasFieldErrors = false;
        Object.keys(result.errorData).forEach(field => {
          const val = result.errorData[field];
          const msg = Array.isArray(val) ? val[0] : (typeof val === 'string' ? val : JSON.stringify(val));
          if (field === 'supplier_categories') {
            setCatError(msg);
            hasFieldErrors = true;
          } else if (['company_name', 'contact_person', 'email', 'phone', 'address', 'products_services_offered', 'certificate_file'].includes(field)) {
            setError(field, { type: 'server', message: msg });
            hasFieldErrors = true;
          }
        });
        if (!hasFieldErrors && result.error) {
          setApiError(result.error);
        }
      } else {
        setApiError(result.error || 'Failed to submit application.');
      }
    }
  };

  const onInvalid = () => {
    if (selectedCategories.length === 0) {
      setCatError('At least one supplier category must be selected.');
    }
  };

  const phoneRegistration = register('phone', VENDOR_VALIDATION_RULES.phone);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden font-sans">
      
      {/* Healthcare background image */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1600&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
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

      {/* Glow background accent */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl h-[30rem] rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.25) 0%, rgba(184,216,255,0.18) 70%, transparent 100%)', zIndex: 2 }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-10 shadow-xl border border-violet-100/80 relative z-10 space-y-6"
        style={{ boxShadow: '0 20px 50px rgba(139,124,248,0.15)' }}
      >
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-violet-600 transition-colors"
        >
          <IconBack className="w-4 h-4" /> Back to Home
        </Link>

        {submitted ? (
          /* Success Screen */
          <div className="text-center space-y-6 py-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 mb-2">
              <IconCheck className="w-10 h-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Application Submitted Successfully!
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                Thank you for applying to become a registered supplier for ProcuraMed Hospital Network.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-3 text-xs">
              <div className="flex justify-between border-b border-slate-200/80 pb-2">
                <span className="text-slate-500 font-medium">Company Name:</span>
                <span className="font-bold text-slate-900">{applicationData?.company_name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/80 pb-2">
                <span className="text-slate-500 font-medium">Contact Email:</span>
                <span className="font-bold text-slate-900">{applicationData?.email}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-500 font-medium">Status:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                  Pending Admin Approval
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-violet-50 border border-violet-100 text-violet-900 text-xs font-medium text-left flex items-start gap-3">
              <IconShield className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Next Step:</strong> After approving the vendor application, the System Administrator creates the vendor login account by assigning an initial password. The vendor must change the password during the first login. Only approved vendors are allowed to access the procurement portal.
              </span>
            </div>

            <Link to="/">
              <Button
                size="lg"
                className="w-full mt-4 text-white font-bold"
                style={{
                  background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)',
                  boxShadow: '0 4px 14px rgba(139,124,248,0.35)',
                }}
              >
                Return to Homepage
              </Button>
            </Link>
          </div>
        ) : (
          /* Application Form */
          <>
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center mb-1">
                <ProcuraMedLogo size={46} variant="color" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Vendor Supplier Application
              </h1>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                Apply to become an approved supplier for ProcuraMed Hospital Network.
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

            <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-5">
              
              {/* Section 1: Company Information */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700 border-b border-violet-100 pb-1">
                  Company Information
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Company Name"
                    placeholder="e.g. MedTech Solutions Ltd"
                    icon={IconDoc}
                    required
                    error={errors.company_name?.message}
                    {...register('company_name', VENDOR_VALIDATION_RULES.company_name)}
                  />

                  <InputField
                    label="Contact Person"
                    placeholder="e.g. John Doe"
                    icon={IconUser}
                    required
                    error={errors.contact_person?.message}
                    {...register('contact_person', VENDOR_VALIDATION_RULES.contact_person)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Business Email"
                    type="email"
                    placeholder="e.g. company@gmail.com"
                    icon={IconMail}
                    required
                    error={errors.email?.message}
                    {...register('email', VENDOR_VALIDATION_RULES.email)}
                  />

                  <InputField
                    label="Phone Number"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 9876543210"
                    icon={IconPhone}
                    required
                    maxLength={10}
                    error={errors.phone?.message}
                    {...phoneRegistration}
                    onKeyDown={(e) => {
                      const allowedKeys = [
                        'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
                        'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
                        'Home', 'End'
                      ];
                      if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey || e.altKey) {
                        return;
                      }
                      if (!/^[0-9]$/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '').slice(0, 10);
                      e.target.value = cleaned;
                      phoneRegistration.onChange(e);
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasteData = (e.clipboardData || window.clipboardData)?.getData('text') || '';
                      const cleanedPaste = pasteData.replace(/\D/g, '').slice(0, 10);
                      const target = e.target;
                      const currentVal = target.value || '';
                      const start = target.selectionStart || 0;
                      const end = target.selectionEnd || 0;
                      const combined = (currentVal.slice(0, start) + cleanedPaste + currentVal.slice(end)).replace(/\D/g, '').slice(0, 10);
                      target.value = combined;
                      phoneRegistration.onChange(e);
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Company Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute top-3 left-3.5 text-slate-400">
                      <IconLocation className="w-5 h-5" />
                    </div>
                    <textarea
                      rows={2}
                      placeholder="Full business address with postal code"
                      className={`w-full pl-11 pr-4 py-2.5 bg-slate-50/50 focus:bg-white border ${
                        errors.address
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/30'
                          : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500/20'
                      } rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 transition-all`}
                      {...register('address', VENDOR_VALIDATION_RULES.address)}
                    />
                  </div>
                  {errors.address && (
                    <p className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
                      <svg className="h-3.5 w-3.5 fill-current flex-shrink-0" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.address.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Section 2: Business Information */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700 border-b border-violet-100 pb-1">
                  Business Information
                </h3>

                {/* Multi-select Supplier Categories */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Supplier Categories <span className="text-rose-500">*</span>
                    <span className="text-slate-400 font-normal lowercase ml-1.5">(Select all categories provided by your company)</span>
                  </label>
                  <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/70 p-3 rounded-2xl border ${
                    catError ? 'border-rose-300 ring-2 ring-rose-200/50' : 'border-violet-100'
                  } max-h-48 overflow-y-auto`}>
                    {categories.map((cat) => {
                      const isChecked = selectedCategories.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          onClick={() => toggleCategory(cat.id)}
                          className={`flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium cursor-pointer transition-all border ${
                            isChecked
                              ? 'bg-violet-50 border-violet-400 text-violet-900 font-bold shadow-sm'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                          />
                          <span>{cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {catError && (
                    <p className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
                      <svg className="h-3.5 w-3.5 fill-current flex-shrink-0" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {catError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Products / Services Offered <span className="text-rose-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mb-1.5">
                    Briefly describe the products or services supplied by your company.
                  </p>
                  <div className="relative">
                    <div className="absolute top-3 left-3.5 text-slate-400">
                      <IconDoc className="w-5 h-5" />
                    </div>
                    <textarea
                      rows={3}
                      placeholder="e.g. ICU ventilators, defibrillators, surgical consumables, ultrasound devices, etc."
                      className={`w-full pl-11 pr-4 py-2.5 bg-slate-50/50 focus:bg-white border ${
                        errors.products_services_offered
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/30'
                          : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500/20'
                      } rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 transition-all`}
                      {...register('products_services_offered', VENDOR_VALIDATION_RULES.products_services_offered)}
                    />
                  </div>
                  {errors.products_services_offered && (
                    <p className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
                      <svg className="h-3.5 w-3.5 fill-current flex-shrink-0" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.products_services_offered.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Business License / Registration Certificate Upload <span className="text-rose-500">*</span>
                  </label>
                  <div className={`relative border-2 border-dashed ${
                    errors.certificate_file
                      ? 'border-rose-300 bg-rose-50/20'
                      : 'border-violet-200 hover:border-violet-400 bg-violet-50/20 hover:bg-violet-50/50'
                  } rounded-2xl p-4 text-center transition-colors`}>
                    <input
                      type="file"
                      accept=".pdf"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      {...register('certificate_file', {
                        ...VENDOR_VALIDATION_RULES.certificate_file,
                        onChange: (e) => {
                          if (e.target.files && e.target.files[0]) {
                            setFileName(e.target.files[0].name);
                          } else {
                            setFileName('');
                          }
                        }
                      })}
                    />
                    <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                      <IconUpload className="w-6 h-6 text-violet-600" />
                      <p className="text-xs font-medium text-slate-700">
                        {fileName ? <span className="text-violet-700 font-bold">{fileName}</span> : 'Click or drag file to upload business license/certificate'}
                      </p>
                      <p className="text-[10px] text-slate-400">PDF document only (.pdf)</p>
                    </div>
                  </div>
                  {errors.certificate_file && (
                    <p className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
                      <svg className="h-3.5 w-3.5 fill-current flex-shrink-0" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.certificate_file.message}
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                size="lg"
                isLoading={loading}
                className="w-full mt-4 text-white font-bold"
                style={{
                  background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)',
                  boxShadow: '0 4px 14px rgba(139,124,248,0.35)',
                }}
              >
                Submit Application for Approval
              </Button>
            </form>

            <div className="text-center pt-2 text-xs text-slate-500 border-t border-slate-100">
              Already an approved supplier or hospital staff?{' '}
              <Link to="/login" className="text-violet-600 font-bold hover:underline">
                Sign In
              </Link>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default VendorRegisterPage;
