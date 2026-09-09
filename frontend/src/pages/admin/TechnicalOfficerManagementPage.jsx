import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/common/Button';
import InputField from '../../components/common/InputField';
import {
  HiUserAdd,
  HiSearch,
  HiUsers,
  HiCog,
  HiCheckCircle,
  HiXCircle,
  HiEye,
  HiPencil,
  HiPhone,
  HiMail,
  HiFilter,
  HiX,
  HiCheck,
  HiShieldCheck
} from 'react-icons/hi';

export const TECHNICAL_SPECIALIZATIONS = [
  'Biomedical Equipment',
  'Medical & Surgical Equipment',
  'Laboratory & Diagnostic Equipment',
  'Radiology & Medical Imaging',
  'Critical Care & Life-Support Equipment',
  'IT & Healthcare Technology'
];

const TechnicalOfficerManagementPage = () => {
  // State
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [specFilter, setSpecFilter] = useState('');

  // Specialization state for Create and Edit forms
  const [createSpecs, setCreateSpecs] = useState([]);
  const [editSpecs, setEditSpecs] = useState([]);
  const [specError, setSpecError] = useState('');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [toggleConfirmModalOpen, setToggleConfirmModalOpen] = useState(false);

  // Selected user state
  const [selectedUser, setSelectedUser] = useState(null);

  // Notification state
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form hooks
  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    formState: { errors: errorsCreate }
  } = useForm();

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit }
  } = useForm();

  const fetchUsersData = async () => {
    setLoading(true);
    setActionError('');
    try {
      const [usersRes, rolesRes] = await Promise.all([
        axiosClient.get('/accounts/users/', { params: { page_size: 500 } }),
        axiosClient.get('/accounts/roles/', { params: { page_size: 100 } })
      ]);
      setUsers(usersRes.data.results || usersRes.data || []);
      setRoles(rolesRes.data.results || rolesRes.data || []);
    } catch (err) {
      setActionError('Failed to load technical officer records from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, []);

  // Find Technical Officer role object
  const technicalRoleObj =
    roles.find(r => r.name?.toLowerCase() === 'technical officer') ||
    roles.find(r => r.name?.toLowerCase().includes('technical'));

  // Toggle specialization item helper
  const toggleCreateSpec = (item) => {
    if (createSpecs.includes(item)) {
      setCreateSpecs(createSpecs.filter(s => s !== item));
    } else {
      setCreateSpecs([...createSpecs, item]);
      setSpecError('');
    }
  };

  const toggleEditSpec = (item) => {
    if (editSpecs.includes(item)) {
      setEditSpecs(editSpecs.filter(s => s !== item));
    } else {
      setEditSpecs([...editSpecs, item]);
    }
  };

  // Handle Technical Officer Creation
  const handleCreateOfficer = async (data) => {
    setActionError('');
    setActionSuccess('');

    if (createSpecs.length === 0) {
      setSpecError('Please select at least one technical specialization.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employee_id: data.employee_id.trim(),
        username: data.username.trim(),
        email: data.email.trim(),
        first_name: data.first_name.trim(),
        last_name: data.last_name.trim(),
        date_of_birth: data.date_of_birth || null,
        gender: data.gender || null,
        phone: data.phone.trim(),
        technical_specializations: createSpecs,
        role: technicalRoleObj ? technicalRoleObj.id : null,
        department: null,
        is_active: true,
        first_login: true
      };

      const res = await axiosClient.post('/accounts/users/', payload);
      setActionSuccess(`Technical officer account successfully created for ${res.data.username || data.username}! Login credentials and temporary password have been emailed to ${data.email}.`);
      setCreateModalOpen(false);
      resetCreate();
      setCreateSpecs([]);
      fetchUsersData();
    } catch (err) {
      const errData = err.response?.data;
      if (errData) {
        if (typeof errData === 'string') {
          setActionError(errData);
        } else {
          // Flatten dictionary of field errors
          const errorMessages = Object.entries(errData).map(([key, val]) => {
            const fieldLabel = key.replace('_', ' ').toUpperCase();
            const msg = Array.isArray(val) ? val.join(' ') : val;
            return `${fieldLabel}: ${msg}`;
          });
          setActionError(errorMessages.join(' | '));
        }
      } else {
        setActionError('Failed to create technical officer account. Please verify input fields.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Technical Officer Edit
  const handleEditOfficer = async (data) => {
    if (!selectedUser) return;
    setActionError('');
    setActionSuccess('');

    if (editSpecs.length === 0) {
      setActionError('Please select at least one technical specialization.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        technical_specializations: editSpecs,
      };

      await axiosClient.patch(`/accounts/users/${selectedUser.id}/`, payload);
      setActionSuccess(`Technical officer specialization updated for ${selectedUser.username}!`);
      setEditModalOpen(false);
      setSelectedUser(null);
      fetchUsersData();
    } catch (err) {
      const errData = err.response?.data;
      if (errData) {
        if (typeof errData === 'string') setActionError(errData);
        else setActionError(Object.values(errData).flat().join(' '));
      } else {
        setActionError('Failed to update technical officer specialization.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Toggle Active/Inactive Status
  const handleConfirmToggleStatus = async () => {
    if (!selectedUser) return;
    setActionError('');
    setActionSuccess('');
    setSubmitting(true);

    try {
      const res = await axiosClient.post(`/accounts/users/${selectedUser.id}/toggle_status/`);
      const newStatus = res.data.is_active ? 'activated' : 'deactivated';
      setActionSuccess(`Account for ${selectedUser.username} has been ${newStatus}.`);
      setToggleConfirmModalOpen(false);
      setSelectedUser(null);
      fetchUsersData();
    } catch (err) {
      setActionError('Failed to update user account status.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal with user data
  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditSpecs(Array.isArray(user.technical_specializations) ? user.technical_specializations : []);
    setEditModalOpen(true);
  };

  // Open View Modal
  const openViewModal = (user) => {
    setSelectedUser(user);
    setViewModalOpen(true);
  };

  // Open Toggle Status Modal
  const openToggleModal = (user) => {
    setSelectedUser(user);
    setToggleConfirmModalOpen(true);
  };

  // Filter Technical Officers by role and search criteria
  const filteredUsers = users.filter((u) => {
    const roleName = u.role?.name?.toLowerCase() || '';
    const isVendor = roleName === 'vendor';
    const isAdmin = u.username === 'admin' || roleName === 'system administrator';

    if (isVendor || isAdmin) return false;

    // Must be a Technical Officer
    const isTechnicalOfficer = roleName.includes('technical');

    if (!isTechnicalOfficer) return false;

    // Search filter
    const matchesSearch =
      (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.employee_id && u.employee_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.first_name && u.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.last_name && u.last_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()));

    // Specialization filter
    const userSpecs = Array.isArray(u.technical_specializations) ? u.technical_specializations : [];
    const matchesSpec = specFilter === '' || userSpecs.some(s => s.toLowerCase().includes(specFilter.toLowerCase()));

    // Status filter
    const matchesStatus = statusFilter !== '' ? (statusFilter === 'active' ? u.is_active : !u.is_active) : true;

    return matchesSearch && matchesSpec && matchesStatus;
  }).sort((a, b) => (a.id || 0) - (b.id || 0));

  return (
    <AdminLayout
      title="Technical Officer Management"
      subtitle="Create and manage technical officers responsible for technical evaluation of equipment, procurement requirements, and vendor quotations."
      onRefresh={fetchUsersData}
    >
      <div className="space-y-6">
        {/* Top Header Card & Action Button */}
        <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-md shadow-violet-500/20"
              style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
            >
              <HiCog className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Technical Officer Management
              </h2>
              <p className="text-xs text-slate-500">
                Hospital Procurement Platform • Technical Evaluation &amp; Inspection Personnel
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setActionError('');
              setActionSuccess('');
              setSpecError('');
              setCreateSpecs([]);
              setCreateModalOpen(true);
            }}
            className="gap-2 shadow-md shadow-violet-500/20 font-bold"
            style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
          >
            <HiUserAdd className="w-4 h-4" />
            <span>+ Add Technical Officer</span>
          </Button>
        </div>

        {/* Notifications */}
        {actionSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button onClick={() => setActionSuccess('')} className="text-emerald-500 hover:text-emerald-700">
              <HiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HiXCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
            <button onClick={() => setActionError('')} className="text-rose-500 hover:text-rose-700">
              <HiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search & Filters Card */}
        <div className="bg-white p-5 rounded-3xl border border-violet-100 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <HiFilter className="w-4 h-4 text-violet-500" />
            <span>Search &amp; Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search input */}
            <div className="relative">
              <HiSearch className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Employee ID, Name, Username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors"
              />
            </div>

            {/* Specialization Filter */}
            <div>
              <select
                value={specFilter}
                onChange={(e) => setSpecFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors"
              >
                <option value="">All Specializations</option>
                {TECHNICAL_SPECIALIZATIONS.map((spec) => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors"
              >
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Database-Driven Technical Officers Table / Empty State */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs font-semibold">
              Loading technical officer records...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-violet-50 text-violet-600 mx-auto flex items-center justify-center font-bold">
                <HiCog className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">No technical officer accounts found.</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Technical officer accounts created by the System Administrator will appear here.
              </p>
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setSpecError('');
                    setCreateSpecs([]);
                    setCreateModalOpen(true);
                  }}
                  className="gap-2 font-bold"
                  style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
                >
                  <HiUserAdd className="w-4 h-4" />
                  <span>+ Add Technical Officer</span>
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Employee</th>
                    <th className="px-6 py-3.5">Employee ID</th>
                    <th className="px-6 py-3.5">Username</th>
                    <th className="px-6 py-3.5 min-w-[220px]">Specialization</th>
                    <th className="px-6 py-3.5">Contact</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-center whitespace-nowrap min-w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredUsers.map((u) => {
                    const specs = Array.isArray(u.technical_specializations) ? u.technical_specializations : [];
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Employee Info */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs">
                              {u.first_name ? u.first_name.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{u.full_name || `${u.first_name} ${u.last_name}`.trim() || u.username}</p>
                            </div>
                          </div>
                        </td>

                        {/* Employee ID */}
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-violet-700 text-[11px]">{u.employee_id || '—'}</span>
                        </td>

                        {/* Username */}
                        <td className="px-6 py-4">
                          <span className="text-slate-700 font-semibold">@{u.username}</span>
                        </td>

                        {/* Specialization */}
                        <td className="px-6 py-4">
                          {specs.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 max-w-xs">
                              {specs.map((spec, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md bg-violet-50 border border-violet-100 text-violet-700 font-medium text-[10px]"
                                >
                                  {spec}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">General Technical</span>
                          )}
                        </td>

                        {/* Contact */}
                        <td className="px-6 py-4 text-slate-600 space-y-0.5">
                          <p className="flex items-center gap-1">
                            <HiMail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{u.email || 'N/A'}</span>
                          </p>
                          {u.phone && (
                            <p className="flex items-center gap-1 text-[11px] text-slate-400">
                              <HiPhone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{u.phone}</span>
                            </p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          {u.is_active ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] uppercase inline-flex items-center gap-1">
                              <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600" /> ACTIVE
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px] uppercase inline-flex items-center gap-1">
                              <HiXCircle className="w-3.5 h-3.5 text-rose-600" /> INACTIVE
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openViewModal(u)}
                              title="View Details"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors inline-flex items-center justify-center"
                            >
                              <HiEye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(u)}
                              title="Edit Officer"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors inline-flex items-center justify-center"
                            >
                              <HiPencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openToggleModal(u)}
                              title={u.is_active ? 'Deactivate Officer' : 'Activate Officer'}
                              className={`p-1.5 rounded-lg transition-colors inline-flex items-center justify-center ${
                                u.is_active
                                  ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {u.is_active ? <HiXCircle className="w-4 h-4" /> : <HiCheckCircle className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CREATE TECHNICAL OFFICER MODAL */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                    <HiUserAdd className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Add Technical Officer</h3>
                    <p className="text-xs text-slate-500">Create new technical evaluation personnel account</p>
                  </div>
                </div>
                <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitCreate(handleCreateOfficer)} className="space-y-4 text-xs">
                {/* Locked Role display */}
                <div className="p-3 bg-violet-50 rounded-2xl border border-violet-100 flex items-center justify-between">
                  <span className="font-bold text-slate-600">Assigned User Role:</span>
                  <span className="px-2.5 py-1 rounded-full bg-violet-600 text-white font-bold text-[11px]">
                    Technical Officer
                  </span>
                </div>

                {/* Personal Details */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Personal Details</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField
                      label="Employee ID *"
                      placeholder="e.g. TO101"
                      {...registerCreate('employee_id', { required: 'Employee ID is required' })}
                      error={errorsCreate.employee_id?.message}
                    />

                    <InputField
                      label="Username *"
                      placeholder="e.g. jdoe_tech"
                      {...registerCreate('username', { required: 'Username is required' })}
                      error={errorsCreate.username?.message}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField
                      label="First Name *"
                      placeholder="Robert"
                      {...registerCreate('first_name', { required: 'First name is required' })}
                      error={errorsCreate.first_name?.message}
                    />

                    <InputField
                      label="Last Name *"
                      placeholder="Vance"
                      {...registerCreate('last_name', { required: 'Last name is required' })}
                      error={errorsCreate.last_name?.message}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField
                      label="Date of Birth"
                      type="date"
                      {...registerCreate('date_of_birth')}
                    />

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Gender
                      </label>
                      <select
                        {...registerCreate('gender')}
                        className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                      >
                        <option value="">Select Gender...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Contact Details */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Contact Details</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InputField
                      label="Email Address *"
                      type="email"
                      placeholder="rvance@hospital.com"
                      {...registerCreate('email', { required: 'Email address is required' })}
                      error={errorsCreate.email?.message}
                    />

                    <InputField
                      label="Phone Number *"
                      placeholder="+1 555-0199"
                      {...registerCreate('phone', { required: 'Phone number is required' })}
                      error={errorsCreate.phone?.message}
                    />
                  </div>
                </div>

                {/* Professional Details: Technical Specialization / Evaluation Area */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Technical Specialization / Evaluation Area <span className="text-rose-500">*</span>
                    </p>
                    <span className="text-[11px] font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                      {createSpecs.length} selected
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Select all categories this Technical Officer is qualified to evaluate:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200/80">
                    {TECHNICAL_SPECIALIZATIONS.map((spec) => {
                      const isSelected = createSpecs.includes(spec);
                      return (
                        <button
                          key={spec}
                          type="button"
                          onClick={() => toggleCreateSpec(spec)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left text-xs transition-all ${
                            isSelected
                              ? 'bg-violet-600 text-white font-semibold shadow-xs shadow-violet-500/20'
                              : 'bg-white text-slate-700 hover:bg-violet-50/70 border border-slate-200'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected ? 'bg-white text-violet-700' : 'border border-slate-300'
                          }`}>
                            {isSelected && <HiCheck className="w-3 h-3 stroke-2" />}
                          </div>
                          <span className="leading-tight text-[11px]">{spec}</span>
                        </button>
                      );
                    })}
                  </div>
                  {specError && (
                    <p className="text-rose-500 text-[11px] font-semibold mt-1">{specError}</p>
                  )}
                </div>

                {/* Automatic Credentials Notice */}
                <div className="p-3 bg-violet-50/70 rounded-2xl border border-violet-100 flex items-start gap-2.5 text-xs text-slate-600">
                  <div className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-[10px] mt-0.5">
                    i
                  </div>
                  <div>
                    <span className="font-bold text-slate-800">Automatic Credential Delivery:</span> A secure temporary password will be automatically generated and emailed to the officer's registered email address. The user will be required to set a new password on their first login.
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setCreateModalOpen(false)}
                    className="border-slate-200 text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={submitting}
                    className="font-bold text-white shadow-md shadow-violet-500/20"
                    style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
                  >
                    Create Account
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT TECHNICAL OFFICER MODAL */}
      <AnimatePresence>
        {editModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <HiPencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Edit Technical Officer</h3>
                    <p className="text-xs text-slate-500">@{selectedUser.username} • {selectedUser.employee_id}</p>
                  </div>
                </div>
                <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleEditOfficer(); }} className="space-y-4 text-xs">
                {/* Read-Only Notice Banner */}
                <div className="p-3 bg-violet-50/70 border border-violet-100 rounded-2xl text-[11px] text-violet-800 flex items-center gap-2">
                  <HiShieldCheck className="w-4 h-4 text-violet-600 flex-shrink-0" />
                  <span>Profile details and account identifiers are read-only. Only the Technical Specialization can be modified.</span>
                </div>

                {/* Name Details (Read-only) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="First Name"
                    value={selectedUser.first_name || ''}
                    disabled
                    readOnly
                    className="bg-slate-100/70 text-slate-500 cursor-not-allowed"
                  />
                  <InputField
                    label="Last Name"
                    value={selectedUser.last_name || ''}
                    disabled
                    readOnly
                    className="bg-slate-100/70 text-slate-500 cursor-not-allowed"
                  />
                </div>

                {/* Account Identifiers (Read-only) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="Employee ID"
                    value={selectedUser.employee_id || 'N/A'}
                    disabled
                    readOnly
                    className="bg-slate-100/70 text-slate-500 cursor-not-allowed"
                  />
                  <InputField
                    label="Username"
                    value={`@${selectedUser.username || ''}`}
                    disabled
                    readOnly
                    className="bg-slate-100/70 text-slate-500 cursor-not-allowed"
                  />
                </div>

                {/* Contact Information (Read-only) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="Email Address"
                    type="email"
                    value={selectedUser.email || 'N/A'}
                    disabled
                    readOnly
                    className="bg-slate-100/70 text-slate-500 cursor-not-allowed"
                  />
                  <InputField
                    label="Phone Number"
                    value={selectedUser.phone || 'N/A'}
                    disabled
                    readOnly
                    className="bg-slate-100/70 text-slate-500 cursor-not-allowed"
                  />
                </div>

                {/* Personal Information (Read-only) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="Date of Birth"
                    value={selectedUser.date_of_birth || 'N/A'}
                    disabled
                    readOnly
                    className="bg-slate-100/70 text-slate-500 cursor-not-allowed"
                  />
                  <InputField
                    label="Gender"
                    value={selectedUser.gender || 'N/A'}
                    disabled
                    readOnly
                    className="bg-slate-100/70 text-slate-500 cursor-not-allowed"
                  />
                </div>

                {/* Professional Details: Technical Specializations in Edit Modal */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Technical Specialization / Evaluation Area <span className="text-rose-500">*</span>
                    </p>
                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {editSpecs.length} selected
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Select all categories this Technical Officer is qualified to evaluate:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-2xl border border-slate-200/80">
                    {TECHNICAL_SPECIALIZATIONS.map((spec) => {
                      const isSelected = editSpecs.includes(spec);
                      return (
                        <button
                          key={spec}
                          type="button"
                          onClick={() => toggleEditSpec(spec)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl text-left text-xs transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white font-semibold shadow-xs shadow-indigo-500/20'
                              : 'bg-white text-slate-700 hover:bg-indigo-50/70 border border-slate-200'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected ? 'bg-white text-indigo-700' : 'border border-slate-300'
                          }`}>
                            {isSelected && <HiCheck className="w-3 h-3 stroke-2" />}
                          </div>
                          <span className="leading-tight text-[11px]">{spec}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={() => setEditModalOpen(false)}
                    className="border-slate-200 text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={submitting}
                    className="font-bold text-white shadow-md shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VIEW DETAILS MODAL */}
      <AnimatePresence>
        {viewModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm">
                    {selectedUser.first_name ? selectedUser.first_name.charAt(0).toUpperCase() : selectedUser.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">{selectedUser.full_name || selectedUser.username}</h3>
                    <p className="text-xs text-slate-500">@{selectedUser.username}</p>
                  </div>
                </div>
                <button onClick={() => setViewModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Employee ID</p>
                    <p className="font-bold font-mono text-violet-700 mt-0.5">{selectedUser.employee_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">System Role</p>
                    <p className="font-bold text-slate-800 mt-0.5">Technical Officer</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Account Status</p>
                    <p className={`font-bold mt-0.5 ${selectedUser.is_active ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {selectedUser.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Evaluation Scope</p>
                    <p className="font-semibold text-slate-800 mt-0.5">Technical &amp; Quotations</p>
                  </div>
                </div>

                {/* Assigned Specializations */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Technical Specializations</p>
                  {Array.isArray(selectedUser.technical_specializations) && selectedUser.technical_specializations.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {selectedUser.technical_specializations.map((spec, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-violet-100 text-violet-800 font-semibold text-xs border border-violet-200/60"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-slate-500 italic text-[11px]">No specific specializations assigned.</p>
                  )}
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Date of Birth</p>
                      <p className="font-semibold text-slate-800 mt-0.5">{selectedUser.date_of_birth || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Gender</p>
                      <p className="font-semibold text-slate-800 mt-0.5">{selectedUser.gender || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Email Address</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedUser.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Phone Number</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedUser.phone || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setViewModalOpen(false)}
                  className="border-slate-200 text-slate-700"
                >
                  Close
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOGGLE STATUS CONFIRMATION MODAL */}
      <AnimatePresence>
        {toggleConfirmModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  selectedUser.is_active ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {selectedUser.is_active ? <HiXCircle className="w-6 h-6" /> : <HiCheckCircle className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {selectedUser.is_active ? 'Deactivate Technical Officer?' : 'Activate Technical Officer?'}
                  </h3>
                  <p className="text-xs text-slate-500">@{selectedUser.username}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {selectedUser.is_active
                  ? `Deactivating ${selectedUser.full_name || selectedUser.username} will prevent them from being assigned technical evaluation requests until reactivated by an Administrator.`
                  : `Activating ${selectedUser.full_name || selectedUser.username} will restore their access to technical evaluation workflows.`}
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setToggleConfirmModalOpen(false)}
                  className="border-slate-200 text-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  variant={selectedUser.is_active ? 'danger' : 'primary'}
                  size="md"
                  isLoading={submitting}
                  onClick={handleConfirmToggleStatus}
                  className={!selectedUser.is_active ? 'bg-emerald-600 hover:bg-emerald-700 text-white font-bold' : 'font-bold'}
                >
                  {selectedUser.is_active ? 'Confirm Deactivate' : 'Confirm Activate'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
};

export default TechnicalOfficerManagementPage;
