import React, { useState, useEffect } from 'react';
import axiosClient from '../../api/axiosClient';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import {
  HiUser,
  HiMail,
  HiShieldCheck,
  HiClock,
  HiCheckCircle,
  HiInformationCircle,
  HiRefresh,
  HiX
} from 'react-icons/hi';

const ProcurementCommitteeProfilePage = () => {
  const [data, setData] = useState({
    user: null,
    stats: {
      pending_committee_reviews: 0,
      approved_cases: 0,
      returned_clarifications: 0,
      total_decisions: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProfileData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/procurement/committee-dashboard/');
      setData({
        user: res.data.user || null,
        stats: res.data.stats || {
          pending_committee_reviews: 0,
          approved_cases: 0,
          returned_clarifications: 0,
          total_decisions: 0
        }
      });
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load committee profile information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const user = data.user;
  const fullName = user?.full_name || user?.first_name || 'Committee Member';
  const employeeId = user?.employee_id || 'PC101';

  return (
    <ProcurementCommitteeLayout
      title="My Profile"
      subtitle="View your account details, governance role, contact information, and committee activity."
      committeeUser={user}
      onRefresh={fetchProfileData}
    >
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Error Alert with Retry */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <HiInformationCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchProfileData}
                className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition"
              >
                Retry
              </button>
              <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
                <HiX className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-2 bg-white rounded-3xl border border-slate-200">
            <HiRefresh className="w-5 h-5 animate-spin text-violet-500" />
            <span>Loading profile details...</span>
          </div>
        ) : !user ? (
          <div className="p-12 text-center text-slate-500 text-xs bg-white rounded-3xl border border-slate-200 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <HiInformationCircle className="w-6 h-6" />
            </div>
            <p className="font-bold text-slate-800">
              {error || 'No profile information available.'}
            </p>
            <button
              onClick={fetchProfileData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors"
            >
              <HiRefresh className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Primary Profile Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <div
                className="w-24 h-24 rounded-3xl flex items-center justify-center font-black text-white text-3xl shadow-lg flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #8B7CF8, #6366F1)' }}
              >
                {fullName.charAt(0).toUpperCase()}
              </div>

              <div className="space-y-2 text-center sm:text-left flex-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-violet-100 text-violet-800 border border-violet-200">
                    Procurement Committee Member
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    ID: {employeeId}
                  </span>
                </div>

                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  {fullName}
                </h1>
                <p className="text-xs font-mono text-violet-600 font-bold">
                  @{user.username}
                </p>
                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                  Responsible for reviewing high-value medical procurement requisitions, inspecting technical officer evaluations, and issuing formal committee approvals or clarification requests.
                </p>
              </div>
            </div>

            {/* Committee Governance & Activity Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600">Pending Review</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <HiClock className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {data.stats.pending_committee_reviews}
                </div>
                <p className="text-[11px] text-amber-700 font-semibold mt-1">Awaiting committee review</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600">Approved Procurements</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <HiCheckCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {data.stats.approved_cases}
                </div>
                <p className="text-[11px] text-emerald-700 font-semibold mt-1">Sanctioned purchase requests</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600">Total Decisions</span>
                  <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
                    <HiShieldCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {data.stats.total_decisions}
                </div>
                <p className="text-[11px] text-slate-500 font-semibold mt-1">Actions executed</p>
              </div>
            </div>

            {/* Profile Information Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Member Details */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 text-xs">
                <h3 className="font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <HiUser className="w-4 h-4 text-violet-500" />
                  <span>Personal & Employment Details</span>
                </h3>

                <div className="space-y-3 text-slate-600">
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-400 font-medium">Employee ID:</span>
                    <strong className="text-slate-900 font-mono">{employeeId}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-400 font-medium">Designated Role:</span>
                    <strong className="text-violet-700">{user.role}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-400 font-medium">Gender:</span>
                    <strong className="text-slate-900">{user.gender || 'Not specified'}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400 font-medium">Date of Birth:</span>
                    <strong className="text-slate-900">{formatDate(user.date_of_birth)}</strong>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 text-xs">
                <h3 className="font-extrabold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                  <HiMail className="w-4 h-4 text-violet-500" />
                  <span>Contact Information</span>
                </h3>

                <div className="space-y-3 text-slate-600">
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-400 font-medium">Email Address:</span>
                    <strong className="text-slate-900">{user.email}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-400 font-medium">Phone Number:</span>
                    <strong className="text-slate-900">{user.phone || 'N/A'}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400 font-medium">Portal Access:</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active Member
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProcurementCommitteeLayout>
  );
};

export default ProcurementCommitteeProfilePage;
