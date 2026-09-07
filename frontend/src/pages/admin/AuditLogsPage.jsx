import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/common/Button';
import { HiClock, HiSearch, HiRefresh, HiShieldCheck } from 'react-icons/hi';

const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  const fetchAuditLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/accounts/audit-logs/', { params: { page_size: 500 } });
      setLogs(res.data.results || res.data || []);
    } catch (err) {
      setError('Failed to fetch audit log records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const filteredLogs = logs
    .filter((log) => {
      const term = searchTerm.toLowerCase();
      return (
        (log.user_name && log.user_name.toLowerCase().includes(term)) ||
        (log.action && log.action.toLowerCase().includes(term)) ||
        (log.module && log.module.toLowerCase().includes(term)) ||
        (log.description && log.description.toLowerCase().includes(term))
      );
    })
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0) || (b.id || 0) - (a.id || 0));

  return (
    <AdminLayout
      title="System Audit Logs"
      subtitle="Security, user action, and system activity logs across the platform."
      onRefresh={fetchAuditLogs}
    >
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-violet-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <HiClock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">System Audit Logs</h2>
              <p className="text-xs text-slate-500">System Admin Portal • Detailed audit trail of administrative activities</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white p-4 rounded-2xl border border-violet-100 shadow-sm">
          <div className="relative">
            <HiSearch className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search audit logs by user, action, module, description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            />
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="bg-white rounded-3xl border border-violet-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs font-semibold">Loading audit logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center font-bold mb-2">
                <HiShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">No system activity recorded yet.</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                System activities, user creation, and authentication logs will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-4">Timestamp</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Module</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono text-slate-500">{log.created_at}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">@{log.user_name || 'System'}</td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-semibold">{log.module}</td>
                      <td className="px-6 py-4 text-slate-600">{log.description || '—'}</td>
                      <td className="px-6 py-4 font-mono text-slate-400 text-[11px]">{log.ip_address || '127.0.0.1'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AuditLogsPage;
