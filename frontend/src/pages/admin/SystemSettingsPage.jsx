import React, { useState, useEffect, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';
import AdminLayout from '../../components/layout/AdminLayout';
import Button from '../../components/common/Button';
import {
  HiCog,
  HiOfficeBuilding,
  HiBell,
  HiDocumentText,
  HiSave,
  HiRefresh,
  HiCheckCircle,
  HiXCircle,
  HiX,
  HiClock,
  HiUser
} from 'react-icons/hi';

const ToggleSwitch = ({ id, label, description, checked, onChange, disabled = false }) => (
  <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 hover:bg-slate-50 transition-colors">
    <div className="flex-grow">
      <label htmlFor={id} className="text-xs font-bold text-slate-800 cursor-pointer select-none">
        {label}
      </label>
      {description && (
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      )}
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${
        checked ? 'bg-violet-600' : 'bg-slate-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

const SystemSettingsPage = () => {
  const [settings, setSettings] = useState({
    hospital_name: '',
    hospital_email: '',
    hospital_phone: '',
    hospital_address: '',
    email_notifications: true,
    vendor_approval_emails: true,
    vendor_rejection_emails: true,
    new_user_credential_emails: true,
    enable_purchase_requisition: true,
    enable_vendor_quotations: true,
    enable_purchase_order_processing: true,
    updated_at: null,
    updated_by_name: null,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await axiosClient.get('/accounts/settings/');
      const data = res.data;
      setSettings({
        hospital_name: data.hospital_name || '',
        hospital_email: data.hospital_email || '',
        hospital_phone: data.hospital_phone || '',
        hospital_address: data.hospital_address || '',
        email_notifications: Boolean(data.email_notifications),
        vendor_approval_emails: Boolean(data.vendor_approval_emails),
        vendor_rejection_emails: Boolean(data.vendor_rejection_emails),
        new_user_credential_emails: Boolean(data.new_user_credential_emails),
        enable_purchase_requisition: Boolean(data.enable_purchase_requisition),
        enable_vendor_quotations: Boolean(data.enable_vendor_quotations),
        enable_purchase_order_processing: Boolean(data.enable_purchase_order_processing),
        updated_at: data.updated_at || null,
        updated_by_name: data.updated_by_name || null,
      });
    } catch (err) {
      setErrorMsg('Failed to load system settings from server. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        hospital_name: settings.hospital_name.trim(),
        hospital_email: settings.hospital_email.trim(),
        hospital_phone: settings.hospital_phone.trim(),
        hospital_address: settings.hospital_address.trim(),
        email_notifications: settings.email_notifications,
        vendor_approval_emails: settings.vendor_approval_emails,
        vendor_rejection_emails: settings.vendor_rejection_emails,
        new_user_credential_emails: settings.new_user_credential_emails,
        enable_purchase_requisition: settings.enable_purchase_requisition,
        enable_vendor_quotations: settings.enable_vendor_quotations,
        enable_purchase_order_processing: settings.enable_purchase_order_processing,
      };

      const res = await axiosClient.put('/accounts/settings/', payload);
      const updated = res.data.settings || res.data;
      setSettings(prev => ({
        ...prev,
        ...updated,
      }));
      setSuccessMsg(res.data.message || 'System settings saved successfully!');
      setTimeout(() => {
        setSuccessMsg('');
      }, 5000);
    } catch (err) {
      const errData = err.response?.data;
      let msg = 'Failed to save system settings. Please verify input values.';
      if (typeof errData === 'object' && errData !== null) {
        const firstKey = Object.keys(errData)[0];
        if (Array.isArray(errData[firstKey])) {
          msg = `${firstKey}: ${errData[firstKey][0]}`;
        } else if (typeof errData[firstKey] === 'string') {
          msg = errData[firstKey];
        }
      }
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title="System Settings"
      subtitle="Configure global hospital information, notification preferences, and procurement parameters."
      onRefresh={fetchSettings}
    >
      <div className="space-y-6 max-w-5xl">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-violet-100 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-md shadow-violet-500/20"
              style={{ background: 'linear-gradient(135deg, #8B7CF8, #6D28D9)' }}
            >
              <HiCog className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">System Settings &amp; Configuration</h2>
              <p className="text-xs text-slate-500">System Admin Portal • Global platform parameters, notification preferences, and configurations</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchSettings}
              disabled={loading || saving}
              className="gap-2 text-xs font-semibold"
            >
              <HiRefresh className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Reload
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              isLoading={saving}
              disabled={loading || saving}
              className="gap-2 text-xs font-bold text-white shadow-md shadow-violet-500/20"
              style={{ background: 'linear-gradient(135deg, #8B7CF8, #7C5FF0)' }}
            >
              <HiSave className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <HiCheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700">
              <HiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <HiXCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-rose-500 hover:text-rose-700">
              <HiX className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Metadata Information Badge */}
        {settings.updated_at && (
          <div className="flex items-center gap-4 px-5 py-2.5 rounded-2xl bg-white border border-violet-100 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <HiClock className="w-4 h-4 text-violet-500" />
              <span>Last updated: <strong className="text-slate-700">{new Date(settings.updated_at).toLocaleString()}</strong></span>
            </div>
            {settings.updated_by_name && (
              <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
                <HiUser className="w-4 h-4 text-violet-500" />
                <span>Modified by: <strong className="text-slate-700">{settings.updated_by_name}</strong></span>
              </div>
            )}
          </div>
        )}

        {/* Settings Form */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* 1. General Settings */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-violet-100 shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-violet-50 pb-4">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                <HiOfficeBuilding className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">1. General Settings</h3>
                <p className="text-[11px] text-slate-500">Hospital identification and communication details</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
              <div className="space-y-1.5">
                <label htmlFor="hospital_name" className="font-bold text-slate-700 block">
                  Hospital Name
                </label>
                <input
                  id="hospital_name"
                  type="text"
                  value={settings.hospital_name}
                  onChange={(e) => setSettings({ ...settings, hospital_name: e.target.value })}
                  placeholder="Enter hospital name"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-200 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="hospital_email" className="font-bold text-slate-700 block">
                  Hospital Email
                </label>
                <input
                  id="hospital_email"
                  type="email"
                  value={settings.hospital_email}
                  onChange={(e) => setSettings({ ...settings, hospital_email: e.target.value })}
                  placeholder="Enter hospital email"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-200 transition-all"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="hospital_phone" className="font-bold text-slate-700 block">
                  Hospital Contact Number
                </label>
                <input
                  id="hospital_phone"
                  type="text"
                  value={settings.hospital_phone}
                  onChange={(e) => setSettings({ ...settings, hospital_phone: e.target.value })}
                  placeholder="Enter contact phone number"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-200 transition-all"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="hospital_address" className="font-bold text-slate-700 block">
                  Hospital Address
                </label>
                <textarea
                  id="hospital_address"
                  rows={3}
                  value={settings.hospital_address}
                  onChange={(e) => setSettings({ ...settings, hospital_address: e.target.value })}
                  placeholder="Enter hospital address"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-violet-500 focus:bg-white focus:ring-2 focus:ring-violet-200 transition-all"
                />
              </div>
            </div>
          </div>

          {/* 2. Notification Settings */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-violet-100 shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-violet-50 pb-4">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                <HiBell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">2. Notification Settings</h3>
                <p className="text-[11px] text-slate-500">Automated email notifications and event triggers</p>
              </div>
            </div>

            <div className="space-y-3">
              <ToggleSwitch
                id="email_notifications"
                label="Email Notifications (Master Toggle)"
                description="Master switch to activate or pause outbound email dispatches across the entire system."
                checked={settings.email_notifications}
                onChange={(checked) => setSettings({ ...settings, email_notifications: checked })}
              />

              <ToggleSwitch
                id="vendor_approval_emails"
                label="Vendor Approval Emails"
                description="Send automated confirmation and welcome emails to suppliers when their registration applications are approved."
                checked={settings.vendor_approval_emails}
                onChange={(checked) => setSettings({ ...settings, vendor_approval_emails: checked })}
              />

              <ToggleSwitch
                id="vendor_rejection_emails"
                label="Vendor Rejection Emails"
                description="Send formal rejection notices with review feedback when supplier applications are declined."
                checked={settings.vendor_rejection_emails}
                onChange={(checked) => setSettings({ ...settings, vendor_rejection_emails: checked })}
              />

              <ToggleSwitch
                id="new_user_credential_emails"
                label="New User Credential Emails"
                description="Automatically dispatch welcome emails containing temporary passwords when an administrator creates a new staff user."
                checked={settings.new_user_credential_emails}
                onChange={(checked) => setSettings({ ...settings, new_user_credential_emails: checked })}
              />
            </div>
          </div>

          {/* 3. Procurement Settings */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-violet-100 shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-violet-50 pb-4">
              <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                <HiDocumentText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">3. Procurement Settings</h3>
                <p className="text-[11px] text-slate-500">Procurement cycle modules and workflow controls</p>
              </div>
            </div>

            <div className="space-y-3">
              <ToggleSwitch
                id="enable_purchase_requisition"
                label="Enable Purchase Requisition"
                description="Allow department staff members to submit internal purchase requisitions for medical and general supplies."
                checked={settings.enable_purchase_requisition}
                onChange={(checked) => setSettings({ ...settings, enable_purchase_requisition: checked })}
              />

              <ToggleSwitch
                id="enable_vendor_quotations"
                label="Enable Vendor Quotations"
                description="Permit active and approved vendors to view published RFQs and submit item quotation bids."
                checked={settings.enable_vendor_quotations}
                onChange={(checked) => setSettings({ ...settings, enable_vendor_quotations: checked })}
              />

              <ToggleSwitch
                id="enable_purchase_order_processing"
                label="Enable Purchase Order Processing"
                description="Enable purchase officers and procurement committee members to create, approve, and track purchase orders."
                checked={settings.enable_purchase_order_processing}
                onChange={(checked) => setSettings({ ...settings, enable_purchase_order_processing: checked })}
              />
            </div>
          </div>

          {/* 4. Save Settings Bottom Action */}
          <div className="flex items-center justify-between gap-4 p-5 rounded-3xl bg-white border border-violet-100 shadow-sm">
            <p className="text-xs text-slate-500">
              Changes will take effect immediately across all system modules once saved.
            </p>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={fetchSettings}
                disabled={loading || saving}
                className="gap-2 text-xs font-semibold"
              >
                <HiRefresh className="w-4 h-4" />
                Reset
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={saving}
                disabled={loading || saving}
                className="gap-2 text-xs font-bold text-white shadow-md shadow-violet-500/20"
                style={{ background: 'linear-gradient(135deg, #8B7CF8, #7C5FF0)' }}
              >
                <HiSave className="w-4 h-4" />
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default SystemSettingsPage;
