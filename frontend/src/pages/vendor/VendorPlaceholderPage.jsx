import React from 'react';
import { Link } from 'react-router-dom';
import VendorLayout from '../../components/layout/VendorLayout';
import Button from '../../components/common/Button';
import {
  HiClipboardList,
  HiDocumentText,
  HiShoppingBag,
  HiTruck,
  HiCreditCard,
  HiBell,
  HiOfficeBuilding,
  HiArrowLeft
} from 'react-icons/hi';

const pageMeta = {
  '/vendor/opportunities': {
    title: 'Purchase Requests / Opportunities',
    subtitle: 'Browse active hospital RFQs and open procurement bidding opportunities.',
    icon: HiClipboardList,
    heading: 'Procurement Opportunities Module',
    message: 'Explore published RFQs from hospital departments and submit competitive vendor bids.'
  },
  '/vendor/quotations': {
    title: 'Quotations Management',
    subtitle: 'Manage and track all price proposals and quotations submitted to hospital procurement.',
    icon: HiDocumentText,
    heading: 'Vendor Quotations Module',
    message: 'Review quotation submissions, status evaluations, and pricing details.'
  },
  '/vendor/purchase-orders': {
    title: 'Purchase Orders',
    subtitle: 'Track awarded hospital purchase contracts and official purchase orders.',
    icon: HiShoppingBag,
    heading: 'Purchase Orders Module',
    message: 'View issued POs, confirm order acknowledgments, and manage fulfillment schedules.'
  },
  '/vendor/deliveries': {
    title: 'Deliveries Tracking',
    subtitle: 'Monitor hospital shipment dispatches, tracking numbers, and delivery verifications.',
    icon: HiTruck,
    heading: 'Delivery Tracking Module',
    message: 'Dispatch shipments against active POs and monitor inspection verifications.'
  },
  '/vendor/invoices': {
    title: 'Invoices & Payments',
    subtitle: 'Submit invoices against fulfilled purchase orders and track payment status.',
    icon: HiCreditCard,
    heading: 'Invoices & Payments Module',
    message: 'Generate invoices for delivered goods and track hospital finance disbursements.'
  },
  '/vendor/notifications': {
    title: 'Messages & Notifications',
    subtitle: 'Stay updated on new procurement opportunities, quotation evaluations, and order updates.',
    icon: HiBell,
    heading: 'Vendor Notifications Hub',
    message: 'Real-time alerts regarding RFQ publications, award decisions, and delivery status.'
  },
  '/vendor/profile': {
    title: 'Company Profile',
    subtitle: 'View and manage registered business credentials, compliance documents, and categories.',
    icon: HiOfficeBuilding,
    heading: 'Vendor Company Profile',
    message: 'Verified vendor registration details, licensing documentation, and contact profiles.'
  }
};

const VendorPlaceholderPage = ({ path }) => {
  const meta = pageMeta[path] || {
    title: 'Vendor Section',
    subtitle: 'ProcuraMed Vendor Portal',
    icon: HiClipboardList,
    heading: 'Vendor Portal Module',
    message: 'This module is ready for full workflow integration in the next step.'
  };

  const Icon = meta.icon;

  return (
    <VendorLayout title={meta.title} subtitle={meta.subtitle}>
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
          <Link to="/vendor/dashboard">
            <Button
              variant="outline"
              size="md"
              className="gap-2 text-xs font-bold text-violet-700 border-violet-200 hover:bg-violet-50"
            >
              <HiArrowLeft className="w-4 h-4" />
              <span>Back to Vendor Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>
    </VendorLayout>
  );
};

export default VendorPlaceholderPage;
