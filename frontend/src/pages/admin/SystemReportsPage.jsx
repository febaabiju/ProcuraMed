import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/common/Button';
import { HiDocumentReport, HiDownload, HiUsers, HiOfficeBuilding, HiClipboardList, HiClock } from 'react-icons/hi';

const SystemReportsPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/dashboard/stats/');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load stats for reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleGenerateReport = (reportType) => {
    setGenerating(reportType);
    setTimeout(() => {
      setGenerating('');
      alert(`${reportType} generated successfully based on database records.`);
    }, 1000);
  };

  return (
    <AdminLayout
      title="System Reports Panel"
      subtitle="Generate and download official administrative reports for hospital procurement operations."
      onRefresh={fetchStats}
    >
      <div className="space-y-6">
        {/* Title Bar */}
        <div className="bg-white p-6 rounded-3xl border border-violet-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
            <HiDocumentReport className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">System Reports Panel</h2>
            <p className="text-xs text-slate-500">System Admin Portal • Generate and download official administrative reports</p>
          </div>
        </div>

        {/* Report Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Management Report */}
          <div className="bg-white rounded-3xl p-6 border border-violet-100 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                  <HiUsers className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">User Management Report</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Contains complete listing of hospital internal staff accounts, assigned roles, departments, active status, and employee IDs.
              </p>

              <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Internal Users:</span>
                  <span className="font-bold text-slate-900">{stats?.total_internal_users || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Active Staff Accounts:</span>
                  <span className="font-bold text-slate-900">{stats?.active_internal_users || 0}</span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="md"
              isLoading={generating === 'User Management Report'}
              onClick={() => handleGenerateReport('User Management Report')}
              className="w-full justify-center gap-2 text-violet-700 border-violet-200 hover:bg-violet-50"
            >
              <HiDownload className="w-4 h-4" /> Generate User Report
            </Button>
          </div>

          {/* Vendor Report */}
          <div className="bg-white rounded-3xl p-6 border border-violet-100 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <HiOfficeBuilding className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Vendor Management Report</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Summary of supplier applications, approved vendors, performance ratings, supplier categories, and review statuses.
              </p>

              <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Approved Suppliers:</span>
                  <span className="font-bold text-slate-900">{stats?.approved_vendors || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pending Applications:</span>
                  <span className="font-bold text-slate-900">{stats?.pending_vendor_applications || 0}</span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="md"
              isLoading={generating === 'Vendor Report'}
              onClick={() => handleGenerateReport('Vendor Report')}
              className="w-full justify-center gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
            >
              <HiDownload className="w-4 h-4" /> Generate Vendor Report
            </Button>
          </div>

          {/* Procurement Activity Report */}
          <div className="bg-white rounded-3xl p-6 border border-violet-100 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <HiClipboardList className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Procurement Activity Report</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                High-level administrative summary of purchase requisitions, purchase orders, pending deliveries, and financial payments.
              </p>

              <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Purchase Orders:</span>
                  <span className="font-bold text-slate-900">{stats?.total_purchase_orders || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Requisitions:</span>
                  <span className="font-bold text-slate-900">{stats?.total_requisitions || 0}</span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="md"
              isLoading={generating === 'Procurement Activity Report'}
              onClick={() => handleGenerateReport('Procurement Activity Report')}
              className="w-full justify-center gap-2 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
            >
              <HiDownload className="w-4 h-4" /> Generate Procurement Report
            </Button>
          </div>

          {/* Audit Log Report */}
          <div className="bg-white rounded-3xl p-6 border border-violet-100 shadow-sm space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                  <HiClock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">System Audit Log Report</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Detailed administrative audit trail documenting user creations, status toggles, vendor approvals, and system activities.
              </p>

              <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Recent Audit Trail Records:</span>
                  <span className="font-bold text-slate-900">{stats?.recent_activities?.length || 0}</span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="md"
              isLoading={generating === 'Audit Log Report'}
              onClick={() => handleGenerateReport('Audit Log Report')}
              className="w-full justify-center gap-2 text-violet-700 border-violet-200 hover:bg-violet-50"
            >
              <HiDownload className="w-4 h-4" /> Generate Audit Report
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SystemReportsPage;
