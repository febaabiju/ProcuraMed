import React from 'react';
import { Link } from 'react-router-dom';
import ProcurementCommitteeLayout from '../../components/layout/ProcurementCommitteeLayout';
import Button from '../../components/common/Button';
import {
  HiClipboardCheck,
  HiCheckCircle,
  HiArchive,
  HiBell,
  HiUserCircle,
  HiArrowLeft
} from 'react-icons/hi';

const pageMeta = {
  '/committee/reviews': {
    title: 'Procurement Reviews',
    subtitle: 'Evaluate high-value requisitions, quotation matrices, and technical assessment outcomes.',
    icon: HiClipboardCheck,
    heading: 'Procurement Reviews Module',
    message: 'Detailed tender evaluation dossiers, bid summaries, and technical compliance sheets.'
  },
  '/committee/decisions': {
    title: 'Committee Decisions',
    subtitle: 'Record quorum verdicts, approvals, rejections, and clarification requests.',
    icon: HiCheckCircle,
    heading: 'Committee Decisions Register',
    message: 'Formal committee determination logs, approval records, and minutes of procurement reviews.'
  },
  '/committee/history': {
    title: 'Procurement History',
    subtitle: 'Access historical committee deliberations, past tender awards, and audit trails.',
    icon: HiArchive,
    heading: 'Procurement History & Archives',
    message: 'Historical purchase approvals, vendor evaluations, and hospital procurement audit records.'
  },
  '/committee/notifications': {
    title: 'Committee Notifications',
    subtitle: 'Stay notified on new review submissions, clarification responses, and quorum updates.',
    icon: HiBell,
    heading: 'Committee Notifications Hub',
    message: 'Real-time alerts on pending procurement dossiers and technical evaluation completions.'
  },
  '/committee/profile': {
    title: 'My Profile',
    subtitle: 'View your committee credentials, employee identification, and governance status.',
    icon: HiUserCircle,
    heading: 'Committee Member Profile',
    message: 'Verified member identity, role designation, contact details, and board affiliation.'
  }
};

const CommitteePlaceholderPage = ({ path }) => {
  const meta = pageMeta[path] || {
    title: 'Committee Module',
    subtitle: 'ProcuraMed Procurement Committee Portal',
    icon: HiClipboardCheck,
    heading: 'Procurement Committee Module',
    message: 'This module is ready for full workflow integration in the next step.'
  };

  const Icon = meta.icon;

  return (
    <ProcurementCommitteeLayout title={meta.title} subtitle={meta.subtitle}>
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
          <Link to="/committee/dashboard">
            <Button
              variant="outline"
              size="md"
              className="gap-2 text-xs font-bold text-violet-700 border-violet-200 hover:bg-violet-50"
            >
              <HiArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </ProcurementCommitteeLayout>
  );
};

export default CommitteePlaceholderPage;
