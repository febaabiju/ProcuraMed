import React from 'react';
import { motion } from 'framer-motion';

const features = [
  {
    emoji: '📝',
    bg: '#FDF4FF',
    iconBg: '#F3E8FF',
    title: 'Requisition Management',
    description: 'Department staff create digital purchase requests with item details, quantity, estimated cost, and supporting documents.',
  },
  {
    emoji: '🏢',
    bg: '#EFF6FF',
    iconBg: '#DBEAFE',
    title: 'Vendor Management',
    description: 'Maintain a verified database of approved suppliers with performance records, certifications, and contact details.',
  },
  {
    emoji: '⚖️',
    bg: '#F5F3FF',
    iconBg: '#EDE9FE',
    title: 'Quotation Management',
    description: 'Collect and compare multiple supplier quotations side-by-side to select the most suitable offer for the hospital.',
  },
  {
    emoji: '🛒',
    bg: '#FFF7ED',
    iconBg: '#FFEDD5',
    title: 'Purchase Orders',
    description: 'Convert approved quotations into official purchase orders issued directly to vendors with delivery timelines.',
  },
  {
    emoji: '📦',
    bg: '#F0FDF4',
    iconBg: '#DCFCE7',
    title: 'Inventory & Verification',
    description: 'Inspect received goods against purchase order specifications and update inventory records upon acceptance.',
  },
  {
    emoji: '💳',
    bg: '#EFF6FF',
    iconBg: '#DBEAFE',
    title: 'Invoice & Payment Tracking',
    description: 'Validate vendor invoices against purchase orders and delivery receipts before authorizing final payment.',
  },
];

const Features = () => {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
          <span
            className="inline-block px-4 py-1.5 rounded-md text-white text-xs font-bold uppercase tracking-widest"
            style={{ background: 'linear-gradient(135deg, #8B7CF8, #6D56E8)' }}
          >
            Core Features
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Everything Your Procurement Team Needs
          </h2>
          <p className="text-slate-500 text-base leading-relaxed">
            Comprehensive tools built specifically for hospital procurement workflows.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: idx * 0.07 }}
              className="rounded-2xl p-7 group transition-all hover:-translate-y-1"
              style={{
                background: item.bg,
                border: '1px solid rgba(139,124,248,0.10)',
                boxShadow: '0 2px 12px rgba(139,124,248,0.06)',
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 text-xl group-hover:scale-110 transition-transform"
                style={{ background: item.iconBg }}
              >
                {item.emoji}
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-2">{item.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default Features;
