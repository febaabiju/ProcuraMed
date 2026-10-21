import React, { useState, useEffect, useMemo } from 'react';
import axiosClient from '../../api/axiosClient';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import {
  HiBell,
  HiCheckCircle,
  HiClipboardCheck,
  HiDocumentText,
  HiSearch,
  HiX,
  HiRefresh,
  HiInformationCircle,
  HiShieldCheck
} from 'react-icons/hi';

const ProcurementCommitteeNotificationsPage = () => {
  const [data, setData] = useState({
    user: null,
    notifications: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('ALL');

  const fetchNotifications = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/committee-dashboard/');
      setData({
        user: res.data.user || null,
        notifications: res.data.notifications || []
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load committee notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getModuleIcon = (module) => {
    switch (module?.toLowerCase()) {
      case 'approval':
      case 'committee':
      case 'procurement committee':
        return <HiShieldCheck className="w-5 h-5 text-violet-600" />;
      case 'requisition':
        return <HiClipboardCheck className="w-5 h-5 text-indigo-600" />;
      case 'purchase_order':
      case 'rfq':
      case 'quotation':
        return <HiDocumentText className="w-5 h-5 text-emerald-600" />;
      default:
        return <HiBell className="w-5 h-5 text-amber-600" />;
    }
  };

  const filteredNotifications = useMemo(() => {
    return data.notifications.filter(item => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesAction = item.action?.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        const matchesModule = item.module?.toLowerCase().includes(q);
        if (!matchesAction && !matchesDesc && !matchesModule) return false;
      }
      if (selectedModule !== 'ALL' && item.module?.toLowerCase() !== selectedModule.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [data.notifications, searchQuery, selectedModule]);

  return (
    <ProcurementCommitteeLayout
      title="Notifications"
      subtitle="Audit logs, workflow notifications, and system events related to procurement committee actions."
      committeeUser={data.user}
      onRefresh={fetchNotifications}
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Error Alert */}
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

        {/* Page Header Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                <HiBell className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Notifications & Audit Feed
              </h1>
            </div>
            <p className="text-xs text-slate-500">
              Real-time audit log of procurement approvals, recommendations, and status updates across the hospital.
            </p>
          </div>

          <button
            onClick={fetchNotifications}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2 self-start sm:self-auto transition-colors"
          >
            <HiRefresh className="w-4 h-4" />
            <span>Refresh Feed</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center gap-3 text-xs">
          <div className="relative flex-1 w-full">
            <HiSearch className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search notifications by keywords, module, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-violet-500 bg-slate-50/50 text-slate-800 placeholder-slate-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <HiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            {['ALL', 'approval', 'requisition', 'committee'].map((mod) => (
              <button
                key={mod}
                onClick={() => setSelectedModule(mod)}
                className={`px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                  selectedModule === mod
                    ? 'bg-violet-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {mod === 'ALL' ? 'All Modules' : mod}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
              <HiRefresh className="w-5 h-5 animate-spin text-violet-500" />
              <span>Loading notifications...</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-12 text-center space-y-3 bg-slate-50/50 rounded-2xl">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <HiBell className="w-6 h-6" />
              </div>
              <h4 className="text-xs font-bold text-slate-800">
                No notifications found.
              </h4>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                System events and workflow notifications will be recorded here automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredNotifications.map((notif) => (
                <div key={notif.id} className="py-4 flex items-start gap-3.5 first:pt-0 last:pb-0 hover:bg-slate-50/60 transition-colors p-3 rounded-2xl">
                  <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center flex-shrink-0 border border-violet-100">
                    {getModuleIcon(notif.module)}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-slate-900 text-xs truncate">
                        {notif.action}
                      </span>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {formatDate(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {notif.description}
                    </p>
                    <div className="pt-1">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                        {notif.module}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProcurementCommitteeLayout>
  );
};

export default ProcurementCommitteeNotificationsPage;
