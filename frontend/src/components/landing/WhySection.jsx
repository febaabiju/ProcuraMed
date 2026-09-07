import React from 'react';
import { motion } from 'framer-motion';

const benefits = [
  { icon: '🏛️', title: 'Centralized Procurement',      desc: 'All purchase requests, approvals, orders, and documents stored in one unified platform across every hospital department.' },
  { icon: '⚡', title: 'Faster Approval Process',        desc: 'Structured multi-level approval workflows reduce manual follow-ups and eliminate delays between departments.' },
  { icon: '🔍', title: 'Vendor Transparency',            desc: 'Maintain verified supplier profiles with performance ratings, certifications, and compliance documentation.' },
  { icon: '📁', title: 'Digital Document Management',   desc: 'Upload, manage, and retrieve purchase orders, invoices, inspection reports, and contracts in one place.' },
  { icon: '📦', title: 'Inventory Tracking',             desc: 'Monitor received items, verify against purchase orders, and maintain accurate stock records post-delivery.' },
  { icon: '🔐', title: 'Secure User Management',        desc: 'Role-based access ensures every user sees only what they need — staff, officers, vendors, or administrators.' },
];

const WhySection = () => {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <span
            className="inline-block px-4 py-1.5 rounded-md text-white text-xs font-bold uppercase tracking-widest"
            style={{ background: 'linear-gradient(135deg, #8B7CF8, #6D56E8)' }}
          >
            Why ProcuraMed
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Built for Hospital Procurement Realities
          </h2>
          <p className="text-slate-500 text-base leading-relaxed">
            Designed to reflect how hospital procurement actually works — across roles, departments, and vendors.
          </p>
        </div>

        {/* Benefit Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.07 }}
              className="flex gap-4 p-6 rounded-2xl bg-white transition-all group hover:-translate-y-1 cursor-default"
              style={{
                border: '1px solid #EDE9FE',
                boxShadow: '0 2px 14px rgba(139,124,248,0.07)',
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-transform group-hover:scale-110"
                style={{ background: '#F3F0FF' }}
              >
                {item.icon}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">{item.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default WhySection;
