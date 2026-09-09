import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import axiosClient from '../../api/axiosClient';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/common/Button';
import InputField from '../../components/common/InputField';
import { USER_VALIDATION_RULES, applyServerFieldErrors } from '../../utils/userValidation';
import {
  HiUserAdd,
  HiSearch,
  HiUsers,
  HiCheckCircle,
  HiXCircle,
  HiEye,
  HiPencil,
  HiPhone,
  HiMail,
  HiShieldCheck,
  HiOfficeBuilding,
  HiFilter,
  HiX,
  HiRefresh
} from 'react-icons/hi';

const HOSPITAL_DEPARTMENTS = [
  'Medical & Surgical Equipment',
  'Biomedical Engineering',
  'Laboratory & Diagnostic Services',
  'Radiology & Imaging',
  'Medical Consumables',
  'Critical Care & Emergency Services',
  'Operation Theatre & Sterilization',
  'Facilities & Maintenance',
  'Housekeeping & Laundry',
  'IT & Digital Services',
  'Furniture, Office & General Supplies',
  'Central Stores & Logistics'
];

const UserManagementPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // URL search query to determine role target (default: 'Department Staff')
  const queryParams = new URLSearchParams(location.search);
  const targetRoleName = queryParams.get('role') || 'Department Staff';

  useEffect(() => {
    const lower = targetRoleName.toLowerCase();
    if (lower.includes('committee')) {
      navigate('/admin/procurement-committee', { replace: true });
    } else if (lower.includes('technical')) {
      navigate('/admin/technical-officers', { replace: true });
    } else if (lower.includes('procurement') || lower.includes('purchase')) {
      navigate('/admin/purchase-officers', { replace: true });
    }
  }, [targetRoleName, navigate]);

  // State
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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
  const { register: registerCreate, handleSubmit: handleSubmitCreate, reset: resetCreate, setError: setErrorCreate, formState: { errors: errorsCreate } } = useForm({ mode: 'onChange' });
  const { register: registerEdit, handleSubmit: handleSubmitEdit, reset: resetEdit, formState: { errors: errorsEdit } } = useForm();

  const fetchUsersData = async () => {
    setLoading(true);
    setActionError('');
    try {
      const [usersRes, rolesRes, deptsRes] = await Promise.all([
        axiosClient.get('/accounts/users/', { params: { page_size: 500 } }),
        axiosClient.get('/accounts/roles/', { params: { page_size: 100 } }),
        axiosClient.get('/accounts/departments/', { params: { page_size: 100 } })
      ]);
      setUsers(usersRes.data.results || usersRes.data || []);
      setRoles(rolesRes.data.results || rolesRes.data || []);
      setDepartments(deptsRes.data.results || deptsRes.data || []);
    } catch (err) {
      setActionError('Failed to load user data from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, [targetRoleName]);

  // Find target role object
  const currentRoleObj = roles.find(
    r => r.name?.toLowerCase() === targetRoleName.toLowerCase()
  ) || roles.find(r => r.name?.toLowerCase().includes('department'));

  // Handle Staff Account Creation
  const handleCreateStaff = async (data) => {
    setActionError('');
    setActionSuccess('');

    setSubmitting(true);
    try {
      let createDeptId = data.department ? parseInt(data.department, 10) : null;
      if (isNaN(createDeptId) || !createDeptId) {
        const found = departments.find(d => d.name?.toLowerCase() === String(data.department).toLowerCase());
        createDeptId = found ? found.id : null;
      }

      const payload = {
        employee_id: data.employee_id,
        username: data.username,
        email: data.email,
        first_name: data.first_name,
        last_name: data.last_name,
        date_of_birth: data.date_of_birth || null,
        gender: data.gender || null,
        phone: data.phone,
        department: createDeptId,
        role: currentRoleObj ? currentRoleObj.id : null,
        is_active: true,
        first_login: true
      };

      const res = await axiosClient.post('/accounts/users/', payload);
      setActionSuccess(`Staff account successfully created for ${res.data.username || data.username}! Login credentials and temporary password have been emailed to ${data.email}.`);
      setCreateModalOpen(false);
      resetCreate();
      fetchUsersData();
    } catch (err) {
      const errData = err.response?.data;
      if (errData) {
        applyServerFieldErrors(errData, setErrorCreate);
        if (typeof errData === 'string') {
          setActionError(errData);
        } else {
          // Flatten dictionary of field errors (e.g., username, email, employee_id duplicates)
          const errorMessages = Object.entries(errData).map(([key, val]) => {
            const fieldLabel = key.replace('_', ' ').toUpperCase();
            const msg = Array.isArray(val) ? val.join(' ') : val;
            return `${fieldLabel}: ${msg}`;
          });
          setActionError(errorMessages.join(' | '));
        }
      } else {
        setActionError('Failed to create staff account. Please verify input fields.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Staff Edit
  const handleEditStaff = async (data) => {
    if (!selectedUser) return;
    setActionError('');
    setActionSuccess('');
    setSubmitting(true);

    try {
      let deptId = data.department ? parseInt(data.department, 10) : null;
      if (isNaN(deptId)) {
        const found = departments.find(d => d.name?.toLowerCase() === String(data.department).toLowerCase());
        deptId = found ? found.id : null;
      }

      // Strictly allow Admin to edit ONLY the assigned Department
      const payload = {
        department: deptId,
      };

      await axiosClient.patch(`/accounts/users/${selectedUser.id}/`, payload);
      setActionSuccess(`Department assignment updated successfully for ${selectedUser.username}!`);
      setEditModalOpen(false);
      setSelectedUser(null);
      fetchUsersData();
    } catch (err) {
      const errData = err.response?.data;
      if (errData) {
        if (typeof errData === 'string') setActionError(errData);
        else setActionError(Object.values(errData).flat().join(' '));
      } else {
        setActionError('Failed to update staff department.');
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

  // Open Edit Modal with user data (Department Only)
  const openEditModal = (user) => {
    setSelectedUser(user);
    const userDeptId = typeof user.department === 'object' && user.department !== null
      ? user.department.id
      : (typeof user.department === 'number'
          ? user.department
          : (departments.find(d => d.name?.toLowerCase() === String(user.department || '').toLowerCase())?.id || ''));
    resetEdit({
      department: userDeptId || ''
    });
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

  // Filter staff members by target role and search criteria
  const filteredUsers = users.filter((u) => {
    const roleName = u.role?.name?.toLowerCase() || '';
    const isVendor = roleName === 'vendor';
    const isAdmin = u.username === 'admin' || roleName === 'system administrator';

    // Exclude Vendors and System Admin from Staff listing
    if (isVendor || isAdmin) return false;

    // Match target role (if targetRoleName specified, e.g. Department Staff)
    const matchesTargetRole = targetRoleName
      ? (roleName.includes(targetRoleName.toLowerCase()) || (targetRoleName.toLowerCase() === 'department staff' && (roleName === '' || roleName.includes('staff') || roleName.includes('department'))))
      : true;

    if (!matchesTargetRole) return false;

    // Search filter
    const matchesSearch =
      (u.username && u.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.employee_id && u.employee_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.first_name && u.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.last_name && u.last_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()));

    // Department filter
    const matchesDept = deptFilter ? (u.department?.id === parseInt(deptFilter) || u.department === parseInt(deptFilter)) : true;

    // Status filter
    const matchesStatus = statusFilter !== '' ? (statusFilter === 'active' ? u.is_active : !u.is_active) : true;

    return matchesSearch && matchesDept && matchesStatus;
  }).sort((a, b) => (a.id || 0) - (b.id || 0));

  return (
    <AdminLayout
      title="Department Staff Management"
      subtitle="Create and manage department staff accounts across the hospital."
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
              <HiUsers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Department Staff Management
              </h2>
              <p className="text-xs text-slate-500">
                Hospital Procurement Platform • Administrator Control Panel
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setActionError('');
              setActionSuccess('');
              setCreateModalOpen(true);
            }}
            className="gap-2 shadow-md shadow-violet-500/20 font-bold"
            style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
          >
            <HiUserAdd className="w-4 h-4" />
            <span>+ Add Department Staff</span>
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

            {/* Department Filter */}
            <div>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-colors"
              >
                <option value="">All Departments</option>
                {HOSPITAL_DEPARTMENTS.map((deptName) => {
                  const deptObj = departments.find((d) => d.name?.toLowerCase() === deptName.toLowerCase());
                  return (
                    <option key={deptName} value={deptObj ? deptObj.id : deptName}>
                      {deptName}
                    </option>
                  );
                })}
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

        {/* Database-Driven Staff Table / Empty State */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs font-semibold">
              Loading department staff records...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-violet-50 text-violet-600 mx-auto flex items-center justify-center font-bold">
                <HiUsers className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">No department staff accounts found.</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Staff accounts created by the System Administrator will appear here.
              </p>
              <div className="pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setCreateModalOpen(true)}
                  className="gap-2 font-bold"
                  style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
                >
                  <HiUserAdd className="w-4 h-4" />
                  <span>+ Add Department Staff</span>
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
                    <th className="px-6 py-3.5">Department</th>
                    <th className="px-6 py-3.5">Contact</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Employee Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs">
                            {u.first_name ? u.first_name.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                          </div>
                          <p className="font-bold text-slate-900">{u.full_name || `${u.first_name} ${u.last_name}`.trim() || u.username}</p>
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

                      {/* Department */}
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {u.department?.name || 'General Medical'}
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
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openViewModal(u)}
                          title="View Details"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                        >
                          <HiEye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(u)}
                          title="Edit Staff"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <HiPencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openToggleModal(u)}
                          title={u.is_active ? 'Deactivate Account' : 'Activate Account'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.is_active
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {u.is_active ? <HiXCircle className="w-4 h-4" /> : <HiCheckCircle className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CREATE STAFF MODAL */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                    <HiUserAdd className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Add Department Staff</h3>
                    <p className="text-xs text-slate-500">Create new internal staff account</p>
                  </div>
                </div>
                <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitCreate(handleCreateStaff)} className="space-y-4 text-xs">
                {/* Locked Role display */}
                <div className="p-3 bg-violet-50 rounded-2xl border border-violet-100 flex items-center justify-between">
                  <span className="font-bold text-slate-600">Assigned User Role:</span>
                  <span className="px-2.5 py-1 rounded-full bg-violet-600 text-white font-bold text-[11px]">
                    Department Staff
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="Employee ID *"
                    placeholder="e.g. EMP101"
                    {...registerCreate('employee_id', USER_VALIDATION_RULES.employee_id)}
                    error={errorsCreate.employee_id?.message}
                  />

                  <InputField
                    label="Username *"
                    placeholder="e.g. user_1"
                    {...registerCreate('username', USER_VALIDATION_RULES.username)}
                    error={errorsCreate.username?.message}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="First Name *"
                    placeholder="John"
                    {...registerCreate('first_name', USER_VALIDATION_RULES.first_name)}
                    error={errorsCreate.first_name?.message}
                  />

                  <InputField
                    label="Last Name *"
                    placeholder="Doe"
                    {...registerCreate('last_name', USER_VALIDATION_RULES.last_name)}
                    error={errorsCreate.last_name?.message}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="Date of Birth (DOB) *"
                    type="date"
                    min="1950-01-01"
                    max="2006-12-31"
                    {...registerCreate('date_of_birth', USER_VALIDATION_RULES.date_of_birth)}
                    error={errorsCreate.date_of_birth?.message}
                  />

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Gender <span className="text-rose-500">*</span>
                    </label>
                    <select
                      {...registerCreate('gender', USER_VALIDATION_RULES.gender)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 ${
                        errorsCreate.gender
                          ? 'border border-rose-300 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900'
                          : 'border border-slate-200 bg-slate-50 focus:bg-white focus:border-violet-500 focus:ring-violet-500/20'
                      }`}
                    >
                      <option value="">Select Gender...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                    {errorsCreate.gender && (
                      <p className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
                        <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {errorsCreate.gender.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InputField
                    label="Email Address *"
                    type="email"
                    placeholder="user.name@gmail.com"
                    {...registerCreate('email', USER_VALIDATION_RULES.email)}
                    error={errorsCreate.email?.message}
                  />

                  <InputField
                    label="Phone Number *"
                    placeholder="9876543210"
                    {...registerCreate('phone', USER_VALIDATION_RULES.phone)}
                    error={errorsCreate.phone?.message}
                  />
                </div>

                {/* Department Select */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hospital Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    {...registerCreate('department', USER_VALIDATION_RULES.department)}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 ${
                      errorsCreate.department
                        ? 'border border-rose-300 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900'
                        : 'border border-slate-200 bg-slate-50 focus:bg-white focus:border-violet-500 focus:ring-violet-500/20'
                    }`}
                  >
                    <option value="">Select Department...</option>
                    {HOSPITAL_DEPARTMENTS.map((deptName) => {
                      const deptObj = departments.find((d) => d.name?.toLowerCase() === deptName.toLowerCase());
                      return (
                        <option key={deptName} value={deptObj ? deptObj.id : deptName}>
                          {deptName}
                        </option>
                      );
                    })}
                  </select>
                  {errorsCreate.department && (
                    <p className="text-xs text-rose-600 flex items-center gap-1 font-medium mt-1">
                      <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errorsCreate.department.message}
                    </p>
                  )}
                </div>

                {/* Automatic Credentials Notice */}
                <div className="p-3 bg-violet-50/70 rounded-2xl border border-violet-100 flex items-start gap-2.5 text-xs text-slate-600">
                  <div className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center flex-shrink-0 font-bold text-[10px] mt-0.5">
                    i
                  </div>
                  <div>
                    <span className="font-bold text-slate-800">Automatic Credential Delivery:</span> A secure temporary password will be automatically generated and emailed to the user's registered email address. The user will be required to set a new password on their first login.
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
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

      {/* EDIT STAFF MODAL */}
      <AnimatePresence>
        {editModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <HiPencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Edit Department Staff</h3>
                    <p className="text-xs text-slate-500">@{selectedUser.username} • {selectedUser.employee_id}</p>
                  </div>
                </div>
                <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <HiX className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitEdit(handleEditStaff)} className="space-y-4 text-xs">
                <div className="p-3 bg-violet-50/70 border border-violet-100 rounded-2xl text-[11px] text-violet-800 flex items-center gap-2">
                  <HiShieldCheck className="w-4 h-4 text-violet-600 flex-shrink-0" />
                  <span>Profile details and account identifiers are read-only. Only the assigned Department can be modified.</span>
                </div>

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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hospital Department <span className="text-violet-600 font-bold">*</span>
                  </label>
                  <select
                    {...registerEdit('department', { required: 'Please select a department' })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  >
                    <option value="">Select Department...</option>
                    {HOSPITAL_DEPARTMENTS.map((deptName) => {
                      const deptObj = departments.find((d) => d.name?.toLowerCase() === deptName.toLowerCase());
                      return (
                        <option key={deptName} value={deptObj ? deptObj.id : deptName}>
                          {deptName}
                        </option>
                      );
                    })}
                  </select>
                  {errorsEdit.department && (
                    <p className="text-xs text-rose-600 mt-1 font-medium">{errorsEdit.department.message}</p>
                  )}
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
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-violet-100 space-y-5"
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
                    <p className="font-bold text-slate-800 mt-0.5">{selectedUser.role?.name || 'Department Staff'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Department</p>
                    <p className="font-bold text-slate-800 mt-0.5">{selectedUser.department?.name || 'Unassigned'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Account Status</p>
                    <p className={`font-bold mt-0.5 ${selectedUser.is_active ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {selectedUser.is_active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Date of Birth (DOB)</p>
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
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                  selectedUser.is_active ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {selectedUser.is_active ? <HiXCircle className="w-6 h-6" /> : <HiCheckCircle className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {selectedUser.is_active ? 'Deactivate Staff Account?' : 'Activate Staff Account?'}
                  </h3>
                  <p className="text-xs text-slate-500">@{selectedUser.username}</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {selectedUser.is_active
                  ? `Deactivating ${selectedUser.full_name || selectedUser.username} will prevent them from logging in to the Department Staff portal until reactivated by an Administrator.`
                  : `Activating ${selectedUser.full_name || selectedUser.username} will restore their access to the Department Staff portal.`}
              </p>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => setToggleConfirmModalOpen(false)}
                  className="border-slate-200 text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  isLoading={submitting}
                  onClick={handleConfirmToggleStatus}
                  className={selectedUser.is_active ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}
                >
                  {selectedUser.is_active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
};

export default UserManagementPage;
