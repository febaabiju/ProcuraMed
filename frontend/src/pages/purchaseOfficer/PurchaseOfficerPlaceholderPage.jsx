import React from 'react';
import { Link } from 'react-router-dom';
import PurchaseOfficerLayout from '../../components/layout/PurchaseOfficerLayout';
import Button from '../../components/common/Button';
import {
  HiClipboardList,
  HiTag,
  HiDocumentText,
  HiShoppingBag,
  HiOfficeBuilding,
  HiTruck,
  HiBell,
  HiUserCircle,
  HiArrowLeft
} from 'react-icons/hi';

const pageMeta = {
  '/purchase-officer/requisitions': {
    title: 'Purchase Requisitions',
    subtitle: 'Review and process purchase requests submitted by hospital department staff.',
    icon: HiClipboardList,
    heading: 'Purchase Requisitions Management',
    message: 'Manage incoming department requisitions, verify budget scopes, and convert them to RFQs.'
  },
  '/purchase-officer/opportunities': {
    title: 'Procurement Opportunities',
    subtitle: 'Publish Requests for Quotations (RFQs) and invite qualified hospital vendors.',
    icon: HiTag,
    heading: 'Procurement Opportunities (RFQs)',
    message: 'Draft bidding specifications, set submission deadlines, and coordinate vendor participation.'
  },
  '/purchase-officer/quotations': {
    title: 'Quotation Management',
    subtitle: 'Review and evaluate price proposals submitted by approved hospital vendors.',
    icon: HiDocumentText,
    heading: 'Vendor Quotations Management',
    message: 'Compare commercial bids, review technical compliance, and submit dossiers for committee review.'
  },
  '/purchase-officer/purchase-orders': {
    title: 'Purchase Orders',
    subtitle: 'Generate and monitor official hospital purchase orders issued to awarded suppliers.',
    icon: HiShoppingBag,
    heading: 'Purchase Orders Management',
    message: 'Issue contract POs, track vendor acknowledgments, and manage procurement disbursements.'
  },
  '/purchase-officer/vendors': {
    title: 'Vendor Management',
    subtitle: 'Coordinate with approved medical suppliers, device manufacturers, and service contractors.',
    icon: HiOfficeBuilding,
    heading: 'Supplier Directory & Management',
    message: 'Access approved supplier profiles, category capabilities, and supplier contact information.'
  },
  '/purchase-officer/deliveries': {
    title: 'Deliveries Monitoring',
    subtitle: 'Track active hospital shipments, consignment dispatches, and technical delivery inspections.',
    icon: HiTruck,
    heading: 'Delivery Tracking & Logistics',
    message: 'Monitor shipment logistics, verify consignment notes, and coordinate inventory handovers.'
  },
  '/purchase-officer/notifications': {
    title: 'Procurement Notifications',
    subtitle: 'Real-time alerts on requisitions, quotations, committee decisions, and delivery statuses.',
    icon: HiBell,
    heading: 'Procurement Notifications Hub',
    message: 'Stay updated on critical procurement lifecycle events, RFQ submissions, and committee verdicts.'
  },
  '/purchase-officer/profile': {
    title: 'My Profile',
    subtitle: 'View your Purchase Officer credentials, employee ID, and assigned procurement workspace.',
    icon: HiUserCircle,
    heading: 'Purchase Officer Profile',
    message: 'Verified officer identification, employment details, and role access settings.'
  }
};

const PurchaseOfficerPlaceholderPage = ({ path }) => {
  const meta = pageMeta[path] || {
    title: 'Procurement Module',
    subtitle: 'ProcuraMed Purchase Officer Portal',
    icon: HiClipboardList,
    heading: 'Purchase Officer Module',
    message: 'This module is ready for full workflow integration in the next step.'
  };

  const Icon = meta.icon;

  return (
    <PurchaseOfficerLayout title={meta.title} subtitle={meta.subtitle}>
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
          <Link to="/purchase-officer/dashboard">
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
    </PurchaseOfficerLayout>
  );
};

export default PurchaseOfficerPlaceholderPage;
