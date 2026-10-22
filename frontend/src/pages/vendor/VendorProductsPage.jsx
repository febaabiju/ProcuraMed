import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import VendorLayout from '../../components/layout/VendorLayout';
import Button from '../../components/common/Button';
import {
  HiCube,
  HiPlus,
  HiSearch,
  HiFilter,
  HiRefresh,
  HiCheckCircle,
  HiXCircle,
  HiInformationCircle,
  HiTag,
  HiPencil,
  HiEye,
  HiX,
  HiExclamation,
  HiSparkles
} from 'react-icons/hi';

const UNIT_OF_MEASURE_OPTIONS = [
  'Piece',
  'Box',
  'Pack',
  'Unit',
  'Set',
  'Vial',
  'Ampoule',
  'Bottle',
  'Kit',
  'Roll',
  'Meter',
  'Pair',
  'Strip',
  'Carton'
];

const VendorProductsPage = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'ACTIVE', 'INACTIVE'

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null); // null = Add, object = Edit
  const [detailProduct, setDetailProduct] = useState(null);
  const [deactivateConfirmProduct, setDeactivateConfirmProduct] = useState(null);

  // Form Fields State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    brand: '',
    model_number: '',
    description: '',
    technical_specifications: '',
    unit_of_measure: 'Piece',
    indicative_price: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Fetch Categories and Products
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [catsRes, prodsRes] = await Promise.all([
        axiosClient.get('/vendors/categories/', { params: { assigned_only: 'true' } }),
        axiosClient.get('/vendors/products/', { params: { page_size: 100 } })
      ]);
      let assignedCats = catsRes.data || [];
      // Fallback if needed
      if (!Array.isArray(assignedCats) || (assignedCats.length === 0 && !catsRes.data)) {
        try {
          const profileRes = await axiosClient.get('/vendors/my-profile/');
          assignedCats = profileRes.data?.supplier_category_details || [];
        } catch {
          // ignore fallback error
        }
      }
      setCategories(assignedCats);
      const prodList = prodsRes.data?.results || prodsRes.data || [];
      setProducts(prodList);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load product catalogue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || amount === '') return 'N/A';
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Filtered products list
  const filteredProducts = products.filter((p) => {
    // Search query
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const match =
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.model_number && p.model_number.toLowerCase().includes(q)) ||
        (p.product_code && p.product_code.toLowerCase().includes(q)) ||
        (p.category_name && p.category_name.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.technical_specifications && p.technical_specifications.toLowerCase().includes(q));
      if (!match) return false;
    }
    // Category filter
    if (selectedCategory) {
      if (String(p.category) !== String(selectedCategory)) return false;
    }
    // Status filter
    if (statusFilter === 'ACTIVE' && !p.is_active) return false;
    if (statusFilter === 'INACTIVE' && p.is_active) return false;

    return true;
  });

  // Open Form Modal (Add / Edit)
  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      category: '',
      brand: '',
      model_number: '',
      description: '',
      technical_specifications: '',
      unit_of_measure: 'Piece',
      indicative_price: '',
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (product) => {
    setEditingProduct(product);
    const prodCatId = product.category?.id || product.category;
    // Show category only if it belongs to the vendor's assigned categories
    const isAssigned = categories.some((c) => String(c.id) === String(prodCatId));
    setFormData({
      name: product.name || '',
      category: isAssigned ? prodCatId : '',
      brand: product.brand || '',
      model_number: product.model_number || '',
      description: product.description || '',
      technical_specifications: product.technical_specifications || '',
      unit_of_measure: product.unit_of_measure || 'Piece',
      indicative_price: product.indicative_price !== null && product.indicative_price !== undefined ? product.indicative_price : '',
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Form Submission (Add or Edit)
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setError('');

    // Frontend validation
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Product name is required.';
    }
    if (categories.length === 0) {
      errors.category = 'No supply categories assigned. Please contact the administrator.';
    } else if (!formData.category) {
      errors.category = 'Supply category is required.';
    } else if (!categories.some((c) => String(c.id) === String(formData.category))) {
      errors.category = 'Selected category is not in your assigned supply categories.';
    }
    if (formData.indicative_price !== '' && Number(formData.indicative_price) < 0) {
      errors.indicative_price = 'Indicative price cannot be negative.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        brand: formData.brand.trim(),
        model_number: formData.model_number.trim(),
        description: formData.description.trim(),
        technical_specifications: formData.technical_specifications.trim(),
        unit_of_measure: formData.unit_of_measure,
        indicative_price: formData.indicative_price !== '' ? formData.indicative_price : null
      };

      let res;
      if (editingProduct) {
        res = await axiosClient.patch(`/vendors/products/${editingProduct.id}/`, payload);
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? res.data : p))
        );
        setSuccessMessage(`Product "${res.data.name}" updated successfully.`);
      } else {
        res = await axiosClient.post('/vendors/products/', payload);
        setProducts((prev) => [res.data, ...prev]);
        setSuccessMessage(`Product "${res.data.name}" added to your catalogue.`);
      }

      setIsFormModalOpen(false);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      const respData = err.response?.data;
      if (respData && typeof respData === 'object') {
        const backendErrors = {};
        for (const [key, val] of Object.entries(respData)) {
          backendErrors[key] = Array.isArray(val) ? val.join(' ') : String(val);
        }
        setFormErrors(backendErrors);
      } else {
        setFormErrors({ non_field_errors: 'Failed to save product. Please try again.' });
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Product Active / Deactive status
  const handleToggleActive = async (product) => {
    setActionLoadingId(product.id);
    try {
      const res = await axiosClient.post(`/vendors/products/${product.id}/toggle-active/`);
      const updated = res.data.product;
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? updated : p))
      );
      setSuccessMessage(res.data.detail || `Status updated for ${product.name}`);
      setDeactivateConfirmProduct(null);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update product status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Stats
  const totalCount = products.length;
  const activeCount = products.filter((p) => p.is_active).length;
  const inactiveCount = totalCount - activeCount;

  return (
    <VendorLayout
      title="My Products"
      subtitle="Manage your company's product catalogue, technical specifications, and indicative pricing available for hospital procurement sourcing."
      onRefresh={fetchData}
    >
      <div className="space-y-6">
        {/* Success Alert Banner */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs"
            >
              <div className="flex items-center gap-2.5">
                <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
              <button onClick={() => setSuccessMessage('')} className="text-emerald-600 hover:text-emerald-800">
                <HiX className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Alert Banner */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
              <HiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header Hero Banner */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-violet-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="flex items-start gap-4 relative z-10">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg shadow-violet-500/20 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #8B7CF8, #6D5BD0)' }}
            >
              <HiCube className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Product Catalogue
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                  {totalCount} Items Listed
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Add products, medical devices, and consumables supplied by your firm. These listings assist the Hospital Procurement Committee when identifying suitable suppliers for purchase requests.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative z-10">
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 text-xs font-bold shadow-md shadow-violet-500/10"
              style={{ background: 'linear-gradient(135deg, #8B7CF8, #6D5BD0)' }}
            >
              <HiPlus className="w-4 h-4" />
              <span>Add Product</span>
            </Button>
          </div>

          <div className="absolute right-0 top-0 w-80 h-full bg-linear-to-l from-violet-50/60 to-transparent pointer-events-none" />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-violet-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Products</span>
              <p className="text-2xl font-black text-slate-900">{totalCount}</p>
              <p className="text-[11px] text-slate-500">In company catalogue</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
              <HiCube className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Active Supply</span>
              <p className="text-2xl font-black text-emerald-700">{activeCount}</p>
              <p className="text-[11px] text-slate-500">Visible to Procurement</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <HiCheckCircle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Deactivated</span>
              <p className="text-2xl font-black text-slate-700">{inactiveCount}</p>
              <p className="text-[11px] text-slate-500">Hidden from sourcing</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold">
              <HiXCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Search, Filter, and Controls Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Field */}
          <div className="relative w-full sm:w-80">
            <HiSearch className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, brand, model, code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-slate-50/50"
            />
          </div>

          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Category Filter */}
            <div className="relative flex-1 sm:flex-none">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full sm:w-48 px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-slate-700 font-medium"
              >
                <option value="">
                  {categories.length === 0 ? 'No Assigned Categories' : `All Categories (${categories.length})`}
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-violet-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  statusFilter === 'ACTIVE'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('INACTIVE')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  statusFilter === 'INACTIVE'
                    ? 'bg-white text-slate-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Inactive
              </button>
            </div>

            {/* Reset Filters */}
            {(searchTerm || selectedCategory || statusFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('');
                  setStatusFilter('ALL');
                }}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg font-medium"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* No Assigned Categories Notice Banner */}
        {!loading && categories.length === 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <HiInformationCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-bold">No supply categories assigned. Please contact the administrator.</p>
                <p className="text-[11px] text-amber-800 font-normal">
                  You must have approved supply categories assigned to your vendor account before you can add products to your catalogue.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Non-binding Price Legal Notice */}
        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 flex items-center gap-2">
          <HiInformationCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <span>
            <strong>Procurement Sourcing Notice:</strong> Indicative prices listed in your catalogue are non-binding estimates used for supplier identification. The Procurement Committee must issue an RFQ for specific requirements, and vendors must submit formal quotations.
          </span>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-2">
            <HiRefresh className="w-8 h-8 animate-spin text-violet-600" />
            <p className="text-xs font-medium">Loading product catalogue...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-3xl border border-dashed border-slate-200 p-8 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 text-violet-500 flex items-center justify-center mx-auto">
              <HiCube className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {searchTerm || selectedCategory || statusFilter !== 'ALL'
                ? 'No matching products found'
                : 'No products in your catalogue yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {searchTerm || selectedCategory || statusFilter !== 'ALL'
                ? 'Try broadening your search term or clearing the active filters.'
                : 'Build your product catalogue so hospital procurement committees can find you when sourcing equipment and clinical supplies.'}
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleOpenAddModal}
                className="text-xs font-bold inline-flex items-center gap-1.5"
                style={{ background: 'linear-gradient(135deg, #8B7CF8, #6D5BD0)' }}
              >
                <HiPlus className="w-4 h-4" />
                <span>Add First Product</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className={`bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                  product.is_active
                    ? 'border-slate-200/80 hover:border-violet-300'
                    : 'border-slate-200 bg-slate-50/50 opacity-80'
                }`}
              >
                <div className="p-5 space-y-3.5">
                  {/* Top Bar: SKU badge & Status Pill */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-violet-50 text-violet-700 border border-violet-100">
                      {product.product_code || `PRD-${product.id}`}
                    </span>
                    {product.is_active ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Category & Title */}
                  <div className="space-y-1">
                    <span className="inline-block text-[10px] uppercase font-bold text-violet-600 tracking-wider">
                      {product.category_name || 'Hospital Supply'}
                    </span>
                    <h4 className="text-base font-black text-slate-900 leading-snug line-clamp-2">
                      {product.name}
                    </h4>
                    {(product.brand || product.model_number) && (
                      <p className="text-[11px] text-slate-500 line-clamp-1 pt-0.5">
                        {product.brand && <strong className="text-slate-700">{product.brand}</strong>}
                        {product.brand && product.model_number && ' • '}
                        {product.model_number && <span>Model: {product.model_number}</span>}
                      </p>
                    )}
                  </div>

                  {/* Description Snippet */}
                  {product.description && (
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      {product.description}
                    </p>
                  )}

                  {/* Pricing & Unit Info */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Indicative Unit Price</span>
                      <span className="text-base font-black text-violet-700">
                        {formatCurrency(product.indicative_price)}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1">/ {product.unit_of_measure || 'Piece'}</span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-white px-2 py-1 rounded-md border border-slate-200">
                      Catalogue Ref
                    </span>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailProduct(product)}
                    className="p-1.5 text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    title="View Technical Details"
                  >
                    <HiEye className="w-4 h-4 text-slate-500" />
                    <span>View</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(product)}
                      className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Edit Product"
                    >
                      <HiPencil className="w-4 h-4 text-indigo-500" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (product.is_active) {
                          setDeactivateConfirmProduct(product);
                        } else {
                          handleToggleActive(product);
                        }
                      }}
                      disabled={actionLoadingId === product.id}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        product.is_active
                          ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      {actionLoadingId === product.id ? (
                        <HiRefresh className="w-3.5 h-3.5 animate-spin" />
                      ) : product.is_active ? (
                        'Deactivate'
                      ) : (
                        'Activate'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Add / Edit Product */}
        <AnimatePresence>
          {isFormModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-6 my-8 max-h-[90vh] overflow-y-auto"
              >
                {/* Modal Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                        {editingProduct ? 'Edit Product' : 'New Product Listing'}
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-slate-900">
                      {editingProduct ? `Edit: ${editingProduct.name}` : 'Add Product to Catalogue'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Enter product specifications, category alignment, and catalogue reference pricing.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsFormModalOpen(false)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Errors Banner */}
                {Object.keys(formErrors).length > 0 && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold space-y-1">
                    <div className="flex items-center gap-2">
                      <HiExclamation className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      <span>Please correct the errors below:</span>
                    </div>
                    <ul className="list-disc list-inside pl-4 space-y-0.5 font-normal text-rose-700">
                      {Object.entries(formErrors).map(([key, msg]) => (
                        <li key={key}>
                          <strong>{key.replace('_', ' ')}:</strong> {msg}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmitForm} className="space-y-5">
                  {/* Product Name (Required) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Product Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Digital Diagnostic Ultrasound System, N95 Surgical Respirator..."
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className={`w-full px-3.5 py-2 text-xs rounded-xl border ${
                        formErrors.name ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-white'
                      } focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-slate-900 font-medium`}
                    />
                    {formErrors.name && <p className="text-[11px] text-rose-600 mt-1">{formErrors.name}</p>}
                  </div>

                  {/* Supply Category (Required) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Supply Category <span className="text-rose-500">*</span>
                    </label>
                    {categories.length === 0 ? (
                      <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2.5">
                        <HiInformationCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                        <span className="font-semibold">
                          No supply categories assigned. Please contact the administrator.
                        </span>
                      </div>
                    ) : (
                      <>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className={`w-full px-3.5 py-2 text-xs rounded-xl border ${
                            formErrors.category ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-white'
                          } focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-slate-900 font-medium`}
                        >
                          <option value="">Select an assigned category</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        {editingProduct &&
                          editingProduct.category &&
                          !categories.some(
                            (c) =>
                              String(c.id) ===
                              String(editingProduct.category?.id || editingProduct.category)
                          ) && (
                            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-1.5 flex items-center gap-1.5">
                              <HiInformationCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              <span>
                                The previously saved category is not among your assigned supply categories. Please select one of your approved categories.
                              </span>
                            </p>
                          )}
                      </>
                    )}
                    {formErrors.category && <p className="text-[11px] text-rose-600 mt-1">{formErrors.category}</p>}
                  </div>

                  {/* Brand & Model Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Brand / Manufacturer
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., GE Healthcare, Philips, 3M..."
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Model Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., LOGIQ-E10, MD-2026-X..."
                        value={formData.model_number}
                        onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-slate-900"
                      />
                    </div>
                  </div>

                  {/* Unit of Measurement & Indicative Price Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Unit of Measurement
                      </label>
                      <select
                        value={formData.unit_of_measure}
                        onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-slate-900"
                      >
                        {UNIT_OF_MEASURE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Indicative Unit Price (₹) <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          ₹
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={formData.indicative_price}
                          onChange={(e) => setFormData({ ...formData, indicative_price: e.target.value })}
                          className={`w-full pl-8 pr-3.5 py-2 text-xs rounded-xl border ${
                            formErrors.indicative_price ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 bg-white'
                          } focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-slate-900`}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Non-binding estimate for sourcing. Formal quotation will be requested on RFQ.
                      </p>
                    </div>
                  </div>

                  {/* Product Description */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Product Description
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Brief overview of product features, intended hospital use, and compliance certifications..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-slate-900"
                    />
                  </div>

                  {/* Technical Specifications */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Technical Specifications
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Technical parameters (e.g., Power: 220V 50Hz, Dimensions, Probe frequencies, ISO/CE standards, Shelf life)..."
                      value={formData.technical_specifications}
                      onChange={(e) => setFormData({ ...formData, technical_specifications: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-violet-500 text-slate-900 font-mono text-[11px]"
                    />
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => setIsFormModalOpen(false)}
                      disabled={formSubmitting}
                      className="text-xs font-semibold"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      disabled={formSubmitting || categories.length === 0}
                      className="text-xs font-bold flex items-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #8B7CF8, #6D5BD0)' }}
                    >
                      {formSubmitting && <HiRefresh className="w-4 h-4 animate-spin" />}
                      <span>{editingProduct ? 'Save Changes' : 'Create Product'}</span>
                    </Button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: View Product Details */}
        <AnimatePresence>
          {detailProduct && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5 my-8 max-h-[90vh] overflow-y-auto"
              >
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-xs font-mono font-bold text-violet-600 block">
                      {detailProduct.product_code || `PRD-${detailProduct.id}`}
                    </span>
                    <h3 className="text-lg font-black text-slate-900 mt-0.5">
                      {detailProduct.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setDetailProduct(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <HiX className="w-5 h-5" />
                  </button>
                </div>

                {/* Details Grid */}
                <div className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Supply Category</span>
                      <span className="font-bold text-slate-800">{detailProduct.category_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                      <span className={`font-bold ${detailProduct.is_active ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {detailProduct.is_active ? 'Active in Catalogue' : 'Inactive / Hidden'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Brand / Manufacturer</span>
                      <span className="font-bold text-slate-800">{detailProduct.brand || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Model Number</span>
                      <span className="font-bold text-slate-800">{detailProduct.model_number || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Indicative Price</span>
                      <span className="font-black text-violet-700 text-sm">
                        {formatCurrency(detailProduct.indicative_price)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Unit of Measurement</span>
                      <span className="font-bold text-slate-800">{detailProduct.unit_of_measure || 'Piece'}</span>
                    </div>
                  </div>

                  {/* Description */}
                  {detailProduct.description && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Product Description
                      </span>
                      <p className="text-slate-700 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                        {detailProduct.description}
                      </p>
                    </div>
                  )}

                  {/* Technical Specs */}
                  {detailProduct.technical_specifications && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Technical Specifications
                      </span>
                      <pre className="text-slate-700 text-[11px] font-mono leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200 whitespace-pre-wrap">
                        {detailProduct.technical_specifications}
                      </pre>
                    </div>
                  )}

                  {/* Legal Notice */}
                  <div className="p-3 rounded-xl bg-violet-50/70 border border-violet-100 text-[11px] text-violet-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <HiSparkles className="w-4 h-4 text-violet-600" />
                      <span>Hospital Sourcing Integration</span>
                    </div>
                    <p className="text-violet-700">
                      This product is catalogued in ProcuraMed and available for the Procurement Committee to search when sourcing medical supplies for approved hospital requisitions.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDetailProduct(null);
                      handleOpenEditModal(detailProduct);
                    }}
                    className="text-xs font-semibold"
                  >
                    Edit Product
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setDetailProduct(null)}
                    className="text-xs font-semibold"
                  >
                    Close
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal: Deactivate Confirmation */}
        <AnimatePresence>
          {deactivateConfirmProduct && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <HiExclamation className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-900">
                    Deactivate "{deactivateConfirmProduct.name}"?
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Deactivating this product will hide it from the Hospital Procurement Committee when identifying suppliers for purchase requests. You can reactivate it anytime.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeactivateConfirmProduct(null)}
                    className="text-xs font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleToggleActive(deactivateConfirmProduct)}
                    className="text-xs font-bold"
                  >
                    Confirm Deactivate
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </VendorLayout>
  );
};

export default VendorProductsPage;
