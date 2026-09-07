import React from 'react';
import { Link } from 'react-router-dom';
import TechnicalOfficerLayout from '../../components/layout/TechnicalOfficerLayout';
import Button from '../../components/common/Button';
import {
  HiBeaker,
  HiClipboardCheck,
  HiArchive,
  HiBell,
  HiUserCircle,
  HiArrowLeft
} from 'react-icons/hi';

const pageMeta = {
  '/technical-officer/evaluations': {
    title: 'Technical Evaluations',
    subtitle: 'Perform equipment specification checks, compliance matrices, and technical scoring.',
    icon: HiBeaker,
    heading: 'Technical Evaluations Module',
    message: 'Detailed equipment specification checklists, vendor proposal evaluations, and compliance rubrics.'
  },
  '/technical-officer/assigned-reviews': {
    title: 'Assigned Reviews',
    subtitle: 'Manage and prioritize technical evaluations assigned to your specialization.',
    icon: HiClipboardCheck,
    heading: 'Assigned Reviews Register',
    message: 'Queue of pending medical equipment evaluations, deadline tracking, and specification sheets.'
  },
  '/technical-officer/history': {
    title: 'Evaluation History',
    subtitle: 'Access past technical recommendations, compliance outcomes, and archived reports.',
    icon: HiArchive,
    heading: 'Technical Evaluation History & Archives',
    message: 'Historical equipment assessments, vendor compliance records, and committee recommendation logs.'
  },
  '/technical-officer/notifications': {
    title: 'Technical Notifications',
    subtitle: 'Real-time alerts on newly assigned evaluations, deadline reminders, and clarification queries.',
    icon: HiBell,
    heading: 'Technical Notifications Hub',
    message: 'Alerts on tender submissions, committee queries, and equipment specification updates.'
  },
  '/technical-officer/profile': {
    title: 'My Profile',
    subtitle: 'View your officer credentials, technical specializations, and unit details.',
    icon: HiUserCircle,
    heading: 'Technical Officer Profile',
    message: 'Verified employee identification, certified specialization domains, contact info, and evaluation unit status.'
  }
};

const TechnicalOfficerPlaceholderPage = ({ path }) => {
  const meta = pageMeta[path] || {
    title: 'Technical Module',
    subtitle: 'ProcuraMed Technical Officer Portal',
    icon: HiBeaker,
    heading: 'Technical Evaluation Module',
    message: 'This module is ready for full workflow integration in the next step.'
  };

  const Icon = meta.icon;

  return (
    <TechnicalOfficerLayout title={meta.title} subtitle={meta.subtitle}>
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
          <Link to="/technical-officer/dashboard">
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
    </TechnicalOfficerLayout>
  );
};

export default TechnicalOfficerPlaceholderPage;
