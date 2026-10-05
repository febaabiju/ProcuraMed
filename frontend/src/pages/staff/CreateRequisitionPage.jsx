import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import DepartmentStaffLayout from '../../components/layout/DepartmentStaffLayout';
import Button from '../../components/common/Button';
import InputField from '../../components/common/InputField';
import SelectField from '../../components/common/SelectField';
import { formatINR } from '../../utils/currencyFormatter';
import {
  HiDocumentAdd,
  HiClipboardCheck,
  HiPlus,
  HiTrash,
  HiArrowLeft,
  HiArrowRight,
  HiCheck,
  HiExclamationCircle,
  HiOfficeBuilding,
  HiPaperClip,
  HiX,
  HiInformationCircle
} from 'react-icons/hi';

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low Priority' },
  { value: 'MEDIUM', label: 'Medium Priority (Normal)' },
  { value: 'HIGH', label: 'High Priority' },
  { value: 'URGENT', label: 'Urgent (Emergency / Critical)' },
];

const CreateRequisitionPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id') || searchParams.get('edit');

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [requisitionStatus, setRequisitionStatus] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [reqNumber, setReqNumber] = useState('');

  // Department name (locked to logged in staff member)
  const userDeptName =
    user?.department_name ||
    user?.department?.name ||
    (typeof user?.department === 'string' ? user.department : 'Medical & Clinical Services');

  // Allowed categories strictly fetched from backend for authenticated user's department
  const [allowedCategories, setAllowedCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      try {
        const res = await axiosClient.get('/procurement/requisitions/department-categories/');
        if (isMounted && res.data?.allowed_categories) {
          setAllowedCategories(res.data.allowed_categories);
        }
      } catch (err) {
        console.error('Failed to load department categories from backend:', err);
      } finally {
        if (isMounted) setLoadingCategories(false);
      }
    };
    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, []);

  // Step 1: Requisition Details
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [justification, setJustification] = useState('');
  const [supportingDocument, setSupportingDocument] = useState(null);
  const [existingDocUrl, setExistingDocUrl] = useState(null);
  const [fileError, setFileError] = useState('');

  // Minimum selectable date: today (YYYY-MM-DD)
  const todayStr = new Date().toLocaleDateString('en-CA');

  // Step 2: Multi-Item Specifications (New items start unselected)
  const [items, setItems] = useState([
    {
      id: 1,
      item_name: '',
      category: '',
      quantity: 1,
      specifications: '',
      estimated_unit_price: '',
      required_date: '',
    },
  ]);

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState({});

  // If editing an existing draft, fetch its data
  useEffect(() => {
    if (editId) {
      const fetchDraft = async () => {
        setLoading(true);
        try {
          const res = await axiosClient.get(`/procurement/requisitions/${editId}/`);
          const d = res.data;
          if (d.status !== 'DRAFT' && d.status !== 'RETURNED') {
            setPageError(`This requisition is currently in "${d.status}" status and cannot be edited.`);
            return;
          }
          setRequisitionStatus(d.status);
          setReturnReason(d.review_comments || '');
          setReqNumber(d.req_number || '');
          setTitle(d.title || '');
          setPriority(d.priority || 'MEDIUM');
          setJustification(d.justification || '');
          if (d.supporting_document) {
            setExistingDocUrl(d.supporting_document);
          }
          if (d.items && d.items.length > 0) {
            setItems(
              d.items.map((it, idx) => ({
                id: it.id || idx + 1,
                item_name: it.item_name || '',
                category: it.category || '',
                quantity: it.quantity || 1,
                specifications: it.specifications || '',
                estimated_unit_price: it.estimated_unit_price || '',
                required_date: it.required_date || '',
              }))
            );
          }
        } catch (err) {
          setPageError(err.response?.data?.detail || 'Failed to load requisition details for editing.');
        } finally {
          setLoading(false);
        }
      };
      fetchDraft();
    }
  }, [editId]);

  // File handling with validation (Allowed: PDF only; max 10MB)
  const handleFileChange = (e) => {
    setFileError('');
    const file = e.target.files[0];
    if (!file) return;

    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (ext !== '.pdf') {
      setFileError("Invalid file format. Only PDF documents (.pdf) are allowed as supporting documents.");
      e.target.value = '';
      return;
    }

    if (file.type && file.type !== 'application/pdf') {
      setFileError("Invalid file type. Only PDF documents (.pdf) are allowed as supporting documents.");
      e.target.value = '';
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setFileError('File size exceeds the 10 MB limit. Please select a smaller file.');
      e.target.value = '';
      return;
    }

    setSupportingDocument(file);
  };

  const removeFile = () => {
    setSupportingDocument(null);
    setExistingDocUrl(null);
    setFileError('');
  };

  // Item list handlers
  const addItem = () => {
    const nextId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
    setItems([
      ...items,
      {
        id: nextId,
        item_name: '',
        category: '',
        quantity: 1,
        specifications: '',
        estimated_unit_price: '',
        required_date: '',
      },
    ]);
  };

  const updateItem = (id, field, value) => {
    setItems(
      items.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
    if (fieldErrors[`item_${id}_${field}`]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[`item_${id}_${field}`];
        return next;
      });
    }
  };

  const removeItem = (id) => {
    if (items.length <= 1) return;
    setItems(items.filter((item) => item.id !== id));
  };

  // Calculations
  const calculateLineTotal = (item) => {
    const qty = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.estimated_unit_price) || 0;
    return qty * price;
  };

  const calculateGrandTotal = () => {
    return items.reduce((acc, curr) => acc + calculateLineTotal(curr), 0);
  };

  // Step 1 Validation
  const validateStep1 = () => {
    const errors = {};
    if (!title.trim()) {
      errors.title = 'Requisition title / purpose is required.';
    }
    if (!justification.trim()) {
      errors.justification = 'Reason and justification are required.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Step 2 Validation (for proceeding to Review or Submitting)
  const validateStep2 = () => {
    const errors = {};
    if (items.length === 0) {
      errors.general = 'At least one item must be included in the requisition.';
    }

    items.forEach((item, index) => {
      if (!item.item_name || !item.item_name.trim()) {
        errors[`item_${item.id}_item_name`] = `Item #${index + 1}: Name is required.`;
      }
      if (!item.category || !item.category.trim()) {
        errors[`item_${item.id}_category`] = `Item #${index + 1}: Please select a category.`;
      } else if (allowedCategories.length > 0 && !allowedCategories.includes(item.category)) {
        errors[`item_${item.id}_category`] = `Item #${index + 1}: Selected category is not allowed for your department (${userDeptName}). Please select an allowed category.`;
      }
      const qty = parseInt(item.quantity, 10);
      if (isNaN(qty) || qty <= 0) {
        errors[`item_${item.id}_quantity`] = `Item #${index + 1}: Quantity must be >= 1.`;
      }
      const price = parseFloat(item.estimated_unit_price);
      if (isNaN(price) || price < 0) {
        errors[`item_${item.id}_estimated_unit_price`] = `Item #${index + 1}: Unit price cannot be negative.`;
      }
      if (item.required_date && item.required_date < todayStr) {
        errors[`item_${item.id}_required_date`] = `Item #${index + 1}: Required date cannot be in the past. Minimum allowed date is today.`;
      }
    });

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextToItems = () => {
    if (validateStep1()) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNextToReview = () => {
    if (validateStep2()) {
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Prepare Payload
  const buildFormData = (statusToSet) => {
    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('priority', priority);
    formData.append('justification', justification.trim());
    formData.append('status', statusToSet);

    // Filter and sanitize items
    const formattedItems = items.map((it) => ({
      item_name: it.item_name.trim(),
      category: it.category ? it.category.trim() : '',
      quantity: parseInt(it.quantity, 10) || 1,
      specifications: it.specifications ? it.specifications.trim() : '',
      estimated_unit_price: it.estimated_unit_price !== '' ? parseFloat(it.estimated_unit_price) : 0,
      required_date: it.required_date || null,
    }));

    formData.append('items', JSON.stringify(formattedItems));

    if (supportingDocument) {
      formData.append('supporting_document', supportingDocument);
    }

    return formData;
  };

  // Save as Draft
  const handleSaveDraft = async () => {
    setPageError('');
    if (!title.trim()) {
      setFieldErrors({ title: 'Please enter at least a requisition title to save as draft.' });
      setCurrentStep(1);
      return;
    }

    setLoading(true);
    try {
      const formData = buildFormData('DRAFT');
      if (editId) {
        await axiosClient.patch(`/procurement/requisitions/${editId}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await axiosClient.post('/procurement/requisitions/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setSuccessMessage('Requisition saved as Draft successfully!');
      setTimeout(() => {
        navigate('/staff/requests');
      }, 1200);
    } catch (err) {
      const data = err.response?.data;
      if (typeof data === 'object') {
        const firstErr = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(' | ');
        setPageError(firstErr);
      } else {
        setPageError('Failed to save draft. Please check your information and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Submit Requisition
  const handleSubmitRequisition = async () => {
    setPageError('');
    if (!validateStep1()) {
      setCurrentStep(1);
      return;
    }
    if (!validateStep2()) {
      setCurrentStep(2);
      return;
    }

    setLoading(true);
    try {
      const formData = buildFormData('SUBMITTED');
      if (editId) {
        await axiosClient.patch(`/procurement/requisitions/${editId}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await axiosClient.post('/procurement/requisitions/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setSuccessMessage(
        requisitionStatus === 'RETURNED'
          ? 'Purchase Requisition corrected and resubmitted successfully! Status is now "Submitted".'
          : 'Purchase Requisition submitted successfully! Status is now "Submitted".'
      );
      setTimeout(() => {
        navigate('/staff/requests');
      }, 1500);
    } catch (err) {
      const data = err.response?.data;
      if (typeof data === 'object') {
        const firstErr = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join(' | ');
        setPageError(firstErr);
      } else {
        setPageError('Failed to submit requisition. Please review form entries.');
      }
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: '1. Requisition Details' },
    { num: 2, label: '2. Add Items & Specs' },
    { num: 3, label: '3. Review & Submit' },
  ];

  return (
    <DepartmentStaffLayout
      title={editId ? 'Edit Purchase Request' : 'Create Purchase Requisition'}
      subtitle="Initiate a formal procurement request with multiple items, budget estimates, and justification."
    >
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        {/* Step Navigation Indicator */}
        <div className="bg-white rounded-2xl border border-violet-100 p-4 shadow-xs">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {steps.map((step) => {
              const isCurrent = currentStep === step.num;
              const isPassed = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => {
                    if (step.num === 1) setCurrentStep(1);
                    else if (step.num === 2 && validateStep1()) setCurrentStep(2);
                    else if (step.num === 3 && validateStep1() && validateStep2()) setCurrentStep(3);
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                    isCurrent
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                      : isPassed
                      ? 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                      : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      isCurrent
                        ? 'bg-white text-violet-700'
                        : isPassed
                        ? 'bg-violet-200 text-violet-800'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {isPassed ? <HiCheck className="w-3.5 h-3.5" /> : step.num}
                  </span>
                  <span className="truncate">{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Notifications */}
        {pageError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <HiExclamationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{pageError}</span>
            </div>
            <button onClick={() => setPageError('')} className="text-rose-500 hover:text-rose-700">
              <HiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
            <HiCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Return for Correction Alert Banner */}
        {requisitionStatus === 'RETURNED' && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-1.5 shadow-xs">
            <div className="flex items-center gap-2 text-amber-900 font-bold">
              <HiExclamationCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <span>Purchase Officer Returned Requisition ({reqNumber}) for Correction</span>
            </div>
            <p className="text-amber-900 bg-white/80 p-3 rounded-xl border border-amber-100 font-medium leading-relaxed">
              {returnReason || 'Please modify the requested items, quantities, or specifications as requested and resubmit.'}
            </p>
            <p className="text-[11px] text-amber-700">
              Update the details below and proceed to Step 3 to resubmit. Historical review logs will remain preserved.
            </p>
          </div>
        )}

        {/* STEP 1: REQUISITION DETAILS */}
        {currentStep === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-violet-100 p-6 sm:p-8 shadow-xs space-y-6"
          >
            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-black text-slate-900">Step 1: General Requisition Details</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define the purpose, urgency, and clinical justification for this procurement request.
                </p>
              </div>
              {/* Locked Department Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-xs font-bold text-violet-900">
                <HiOfficeBuilding className="w-4 h-4 text-violet-600" />
                <span>Department: <strong className="text-violet-700">{userDeptName}</strong> (Assigned)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Title / Purpose */}
              <div className="md:col-span-2 space-y-1.5">
                <InputField
                  label="Requisition Title / Purpose"
                  required
                  placeholder="e.g., Monthly Replenishment of Surgical Sterile Consumables"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (fieldErrors.title) setFieldErrors({ ...fieldErrors, title: null });
                  }}
                  error={fieldErrors.title}
                />
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <SelectField
                  label="Priority Level"
                  required
                  options={PRIORITY_OPTIONS}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                />
              </div>
            </div>

            {/* Department (Disabled Read-Only Confirmation) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                  <HiOfficeBuilding className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 block">Assigned Requesting Department</span>
                  <span className="text-slate-600">
                    Automatically assigned to <strong>{userDeptName}</strong>. Staff cannot modify department assignment.
                  </span>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-600 self-start sm:self-auto">
                LOCKED TO STAFF ACCOUNT
              </span>
            </div>

            {/* Justification */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Reason / Clinical Justification <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                placeholder="Detail why this procurement is required (e.g., increased patient capacity, emergency stock, routine scheduled replenishment, replacement of expired inventory)..."
                value={justification}
                onChange={(e) => {
                  setJustification(e.target.value);
                  if (fieldErrors.justification) setFieldErrors({ ...fieldErrors, justification: null });
                }}
                className={`block w-full rounded-2xl border text-sm p-4 transition-all duration-200 focus:outline-none focus:ring-2 ${
                  fieldErrors.justification
                    ? 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-500 focus:ring-rose-500/20'
                    : 'border-slate-200 text-slate-900 focus:border-violet-500 focus:ring-violet-500/20 bg-white hover:border-slate-300'
                }`}
              />
              {fieldErrors.justification && (
                <p className="text-xs text-rose-600 font-medium">{fieldErrors.justification}</p>
              )}
            </div>

            {/* Supporting Document Upload (Optional) */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Supporting Document <span className="text-slate-400 font-normal">(Optional: Spec sheet, quote reference, or approval memo)</span>
              </label>

              {supportingDocument || existingDocUrl ? (
                <div className="p-3.5 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 truncate">
                    <HiPaperClip className="w-5 h-5 text-violet-600 flex-shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-bold text-violet-950 truncate">
                        {supportingDocument ? supportingDocument.name : 'Attached Document'}
                      </p>
                      {supportingDocument && (
                        <p className="text-[11px] text-violet-600 font-medium">
                          {(supportingDocument.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      )}
                      {existingDocUrl && !supportingDocument && (
                        <a
                          href={existingDocUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-violet-700 underline font-bold"
                        >
                          View Existing Document
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-1.5 rounded-lg bg-white text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <HiX className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-200 hover:border-violet-400 rounded-2xl p-6 text-center transition-colors bg-slate-50/50">
                  <HiPaperClip className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Upload supporting documentation</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Accepted format: PDF only (.pdf) (Maximum file size: 10 MB)
                  </p>
                  <label className="mt-3 inline-block">
                    <span className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs inline-flex items-center gap-1.5">
                      <HiPlus className="w-3.5 h-3.5" />
                      Browse PDF File
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleFileChange}
                      accept=".pdf"
                    />
                  </label>
                </div>
              )}

              {fileError && (
                <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
                  <HiExclamationCircle className="w-4 h-4" />
                  {fileError}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <Link to="/staff/requests">
                <Button variant="outline" size="md" className="text-xs">
                  Cancel
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleSaveDraft}
                  isLoading={loading}
                  className="text-xs font-bold border-violet-200 text-violet-700"
                >
                  Save as Draft
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleNextToItems}
                  className="text-xs font-bold gap-1.5"
                >
                  <span>Next: Add Items & Specs</span>
                  <HiArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 2: MULTI-ITEM SPECIFICATIONS */}
        {currentStep === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-violet-100 p-6 sm:p-8 shadow-xs space-y-6"
          >
            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-black text-slate-900">Step 2: Add Requisition Items</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Specify products, quantities, technical specifications, and estimated unit costs.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={addItem}
                className="gap-1 text-xs font-bold self-start sm:self-auto"
              >
                <HiPlus className="w-4 h-4" />
                <span>+ Add Item</span>
              </Button>
            </div>

            {fieldErrors.general && (
              <p className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {fieldErrors.general}
              </p>
            )}

            {/* Items List */}
            <div className="space-y-5">
              {items.map((item, idx) => {
                const lineTotal = calculateLineTotal(item);
                return (
                  <div
                    key={item.id}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 relative"
                  >
                    <div className="flex items-center justify-between">
                      <div className="inline-flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Item #{idx + 1}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-violet-900">
                          Line Total: {formatINR(lineTotal)}
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Remove item"
                          >
                            <HiTrash className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Item Name */}
                      <div className="md:col-span-2">
                        <InputField
                          label="Item / Product Name"
                          required
                          placeholder="e.g., Surgical Gloves Powder-Free Size 7.5"
                          value={item.item_name}
                          onChange={(e) => updateItem(item.id, 'item_name', e.target.value)}
                          error={fieldErrors[`item_${item.id}_item_name`]}
                        />
                      </div>

                      {/* Category */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                          Category <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={item.category || ''}
                          onChange={(e) => updateItem(item.id, 'category', e.target.value)}
                          className={`block w-full rounded-xl border ${
                            fieldErrors[`item_${item.id}_category`]
                              ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20'
                              : 'border-slate-200 focus:border-violet-500 focus:ring-violet-500/20'
                          } text-sm py-3 px-3.5 bg-white text-slate-900 focus:outline-none focus:ring-2`}
                        >
                          <option value="">-- Select Category --</option>
                          {allowedCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          {/* If viewing/editing an existing draft with an unallowed legacy category, show it so it displays correctly */}
                          {item.category && !allowedCategories.includes(item.category) && (
                            <option key={item.category} value={item.category}>
                              {item.category} (Legacy - Disallowed)
                            </option>
                          )}
                        </select>
                        {fieldErrors[`item_${item.id}_category`] && (
                          <p className="mt-1.5 text-xs text-rose-500 font-medium">
                            {fieldErrors[`item_${item.id}_category`]}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Quantity */}
                      <div>
                        <InputField
                          label="Quantity"
                          type="number"
                          min="1"
                          required
                          placeholder="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                          error={fieldErrors[`item_${item.id}_quantity`]}
                        />
                      </div>

                      {/* Estimated Unit Price */}
                      <div>
                        <InputField
                          label="Estimated Unit Price (₹)"
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          placeholder="0.00"
                          value={item.estimated_unit_price}
                          onChange={(e) => updateItem(item.id, 'estimated_unit_price', e.target.value)}
                          error={fieldErrors[`item_${item.id}_estimated_unit_price`]}
                        />
                      </div>

                      {/* Required Date */}
                      <div>
                        <InputField
                          label="Required Date"
                          type="date"
                          min={todayStr}
                          value={item.required_date}
                          onChange={(e) => updateItem(item.id, 'required_date', e.target.value)}
                          error={fieldErrors[`item_${item.id}_required_date`]}
                        />
                      </div>
                    </div>

                    {/* Specifications */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Detailed Specifications <span className="text-slate-400 font-normal">(Model, grade, dimensions, clinical standards)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Nitrile, textured grip, EN 455 standard, box of 100"
                        value={item.specifications}
                        onChange={(e) => updateItem(item.id, 'specifications', e.target.value)}
                        className="block w-full rounded-xl border border-slate-200 text-sm py-2.5 px-3.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:border-violet-500 focus:ring-violet-500/20"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total Budget Summary Banner */}
            <div className="p-4 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-violet-950 uppercase tracking-wider block">
                  Requisition Total Estimated Budget
                </span>
                <span className="text-xs text-violet-700">
                  {items.length} item{items.length !== 1 ? 's' : ''} in this requisition
                </span>
              </div>
              <span className="text-xl sm:text-2xl font-black text-violet-900 font-mono">
                {formatINR(calculateGrandTotal())}
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={() => setCurrentStep(1)}
                className="text-xs font-bold gap-1.5"
              >
                <HiArrowLeft className="w-4 h-4" />
                <span>Back: Requisition Details</span>
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleSaveDraft}
                  isLoading={loading}
                  className="text-xs font-bold border-violet-200 text-violet-700"
                >
                  Save as Draft
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleNextToReview}
                  className="text-xs font-bold gap-1.5"
                >
                  <span>Next: Review Requisition</span>
                  <HiArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* STEP 3: REVIEW & SUBMIT */}
        {currentStep === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-violet-100 p-6 sm:p-8 shadow-xs space-y-6"
          >
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900">Step 3: Review Requisition Before Submission</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify all procurement details, quantities, and justification before sending.
              </p>
            </div>

            {/* Overview Card */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                <div>
                  <span className="text-[11px] uppercase font-bold text-slate-500 block">Title / Purpose</span>
                  <h3 className="text-base font-black text-slate-900 mt-0.5">{title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-violet-100 text-violet-800 font-bold">
                    {priority} Priority
                  </span>
                  <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-bold">
                    Dept: {userDeptName}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] uppercase font-bold text-slate-500 block">Clinical / Department Justification</span>
                <p className="text-slate-800 mt-1 leading-relaxed whitespace-pre-wrap">{justification}</p>
              </div>

              {supportingDocument && (
                <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 text-violet-800 font-bold">
                  <HiPaperClip className="w-4 h-4 text-violet-600" />
                  <span>Attached Document: {supportingDocument.name} ({(supportingDocument.size / (1024 * 1024)).toFixed(2)} MB)</span>
                </div>
              )}
            </div>

            {/* Items Summary Table */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Itemized Procurement List ({items.length} item{items.length !== 1 ? 's' : ''})
              </h3>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-3.5">#</th>
                      <th className="py-3 px-3.5">Item Name</th>
                      <th className="py-3 px-3.5">Category</th>
                      <th className="py-3 px-3.5">Specifications</th>
                      <th className="py-3 px-3.5 text-center">Qty</th>
                      <th className="py-3 px-3.5 text-right">Est. Unit Price</th>
                      <th className="py-3 px-3.5 text-right">Line Total</th>
                      <th className="py-3 px-3.5">Required Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3.5 font-bold text-slate-500">{idx + 1}</td>
                        <td className="py-3 px-3.5 font-bold text-slate-900">{item.item_name}</td>
                        <td className="py-3 px-3.5 text-slate-600">{item.category}</td>
                        <td className="py-3 px-3.5 text-slate-500 max-w-xs truncate">{item.specifications || 'N/A'}</td>
                        <td className="py-3 px-3.5 text-center font-bold text-slate-900">{item.quantity}</td>
                        <td className="py-3 px-3.5 text-right font-mono text-slate-700">
                          {formatINR(item.estimated_unit_price)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-violet-900">
                          {formatINR(calculateLineTotal(item))}
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 font-medium">
                          {item.required_date || 'Flexible'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-violet-50/80 border-t-2 border-violet-200 font-bold">
                    <tr>
                      <td colSpan={6} className="py-3.5 px-3.5 text-right uppercase tracking-wider text-violet-900">
                        Grand Total Estimated Budget:
                      </td>
                      <td className="py-3.5 px-3.5 text-right font-mono text-base font-black text-violet-950">
                        {formatINR(calculateGrandTotal())}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Submission Notice */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
              <HiInformationCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Important Notice Upon Submission</strong>
                <p className="mt-0.5 leading-relaxed text-amber-800">
                  Once submitted, the requisition status becomes <strong>"Submitted"</strong> and will appear under{' '}
                  <strong>"My Requisitions"</strong>. Department Staff cannot modify submitted requisitions. If you still need to make changes later, please click <strong>"Save as Draft"</strong> instead.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <Button
                variant="outline"
                size="md"
                onClick={() => setCurrentStep(2)}
                className="text-xs font-bold gap-1.5"
              >
                <HiArrowLeft className="w-4 h-4" />
                <span>Back to Edit Items</span>
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={handleSaveDraft}
                  isLoading={loading}
                  className="text-xs font-bold border-violet-200 text-violet-700"
                >
                  Save as Draft
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSubmitRequisition}
                  isLoading={loading}
                  className="text-xs font-bold bg-violet-600 hover:bg-violet-700 gap-1.5 shadow-md shadow-violet-600/30"
                >
                  <HiClipboardCheck className="w-4 h-4" />
                  <span>Submit Requisition</span>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </DepartmentStaffLayout>
  );
};

export default CreateRequisitionPage;
