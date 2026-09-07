import React, { useState } from 'react';
import Navbar from '../../components/layout/Navbar';
import Button from '../../components/common/Button';
import InputField from '../../components/common/InputField';
import { HiCog, HiShieldCheck, HiSave } from 'react-icons/hi';

const SystemSettingsPage = () => {
  const [successMsg, setSuccessMsg] = useState('');
  const [settings, setSettings] = useState({
    systemTitle: 'ProcuraMed — Hospital Procurement Management System',
    supportEmail: 'admin@procuramed.hospital',
    sessionTimeout: '60',
    requireInitialPasswordChange: true,
    enableVendorRegistration: true,
    autoAuditLogging: true
  });

  const handleSave = (e) => {
    e.preventDefault();
    setSuccessMsg('System settings saved successfully!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Title Bar */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
            <HiCog className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">System Settings &amp; Configuration</h1>
            <p className="text-xs text-slate-500">System Admin Portal • Global platform parameters, security policies, and configurations</p>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <HiShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm space-y-6 text-xs">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700 border-b border-violet-100 pb-1">
              General System Settings
            </h3>

            <InputField
              label="System Title"
              value={settings.systemTitle}
              onChange={(e) => setSettings({ ...settings, systemTitle: e.target.value })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="System Administrator Contact Email"
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
              />

              <InputField
                label="JWT Session Timeout (Minutes)"
                type="number"
                value={settings.sessionTimeout}
                onChange={(e) => setSettings({ ...settings, sessionTimeout: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-violet-700 border-b border-violet-100 pb-1">
              Security &amp; User Policies
            </h3>

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireInitialPasswordChange}
                  onChange={(e) => setSettings({ ...settings, requireInitialPasswordChange: e.target.checked })}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <div>
                  <p className="font-bold text-slate-800">Require Initial Password Change</p>
                  <p className="text-[11px] text-slate-500">Newly created hospital staff must set a new password upon first login</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableVendorRegistration}
                  onChange={(e) => setSettings({ ...settings, enableVendorRegistration: e.target.checked })}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <div>
                  <p className="font-bold text-slate-800">Allow Public Vendor Registration Applications</p>
                  <p className="text-[11px] text-slate-500">Permit external suppliers to submit registration applications for Admin review</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoAuditLogging}
                  onChange={(e) => setSettings({ ...settings, autoAuditLogging: e.target.checked })}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <div>
                  <p className="font-bold text-slate-800">Enable Automatic Audit Logging</p>
                  <p className="text-[11px] text-slate-500">Automatically record user authentication, account creations, and approvals</p>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="gap-2 text-white font-bold"
              style={{ background: 'linear-gradient(135deg, #A78BFA, #7C5FF0)' }}
            >
              <HiSave className="w-4 h-4" /> Save System Settings
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default SystemSettingsPage;
