import React from 'react';
import { Link } from 'react-router-dom';
import DepartmentStaffLayout from '../../components/layout/DepartmentStaffLayout';
import Button from '../../components/common/Button';
import {
  HiClipboardList,
  HiDocumentAdd,
  HiBell,
  HiUserCircle,
  HiArrowLeft
} from 'react-icons/hi';

const pageMeta = {
  '/staff/requests': {
    title: 'My Purchase Requests',
    subtitle: 'View and track all procurement requests initiated by your department.',
    icon: HiClipboardList,
    heading: 'Purchase Requests Module',
    message: 'Manage, search, and monitor your submitted hospital requisitions.'
  },
  '/staff/create-request': {
    title: 'Create Purchase Request',
    subtitle: 'Initiate a new procurement requisition for hospital equipment, supplies, or services.',
    icon: HiDocumentAdd,
    heading: 'Create Purchase Request Module',
    message: 'Fill out item specifications, justifications, estimated budgets, and priority levels.'
  },
  '/staff/notifications': {
    title: 'Staff Notifications',
    subtitle: 'Stay updated on purchase request reviews, approvals, and order completions.',
    icon: HiBell,
    heading: 'Notifications Hub',
    message: 'Real-time alerts regarding requisition status, committee decisions, and procurement deliveries.'
  },
  '/staff/profile': {
    title: 'My Profile',
    subtitle: 'View your department staff credentials, employee ID, and personal information.',
    icon: HiUserCircle,
    heading: 'Staff Profile & Credentials',
    message: 'Verified employee details, contact phone, assigned hospital department, and role status.'
  }
};

const StaffPlaceholderPage = ({ path }) => {
  const meta = pageMeta[path] || {
    title: 'Staff Module',
    subtitle: 'ProcuraMed Department Staff Portal',
    icon: HiClipboardList,
    heading: 'Department Staff Portal Module',
    message: 'This module is ready for full workflow integration in the next step.'
  };

  const Icon = meta.icon;

  return (
    <DepartmentStaffLayout title={meta.title} subtitle={meta.subtitle}>
      <div className="bg-white rounded-3xl border border-violet-100 shadow-sm p-12 text-center space-y-4 max-w-2xl mx-auto my-8">
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center text-white mx-auto shadow-lg shadow-violet-500/20"
          style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
        >
          <Icon className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{meta.heading}</h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
            {meta.message}
          </p>
        </div>

        <div className="pt-4 flex justify-center gap-3">
          <Link to="/staff/dashboard">
            <Button
              variant="outline"
              size="md"
              className="gap-2 text-xs font-bold text-violet-700 border-violet-200 hover:bg-violet-50"
            >
              <HiArrowLeft className="w-4 h-4" />
              <span>Back to Staff Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </DepartmentStaffLayout>
  );
};

export default StaffPlaceholderPage;
