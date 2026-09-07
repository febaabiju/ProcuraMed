import React from 'react';
import { motion } from 'framer-motion';

/* ── Dashboard Mockup (right side illustration) ── */
const DashboardMockup = () => (
  <div className="relative w-full pb-8">
    <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 20px 60px rgba(139,124,248,0.18)', border: '1px solid #EDE9FE' }}>

      {/* Browser chrome */}
      <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #8B7CF8, #6D56E8)' }}>
        <span className="w-3 h-3 rounded-full bg-violet-300/60" />
        <span className="w-3 h-3 rounded-full bg-violet-300/60" />
        <span className="w-3 h-3 rounded-full bg-violet-300/60" />
        <div className="flex-1 mx-4 bg-white/20 rounded-full h-5" />
        <div className="w-7 h-7 rounded-full bg-violet-300/40 flex items-center justify-center">
          <span className="text-[10px] text-white font-bold">A</span>
        </div>
      </div>

      <div className="p-4 bg-violet-50/60">
        {/* Stat pills */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[['95%','Accuracy'],['200+','Suppliers'],['40%','Faster'],['500+','Requests']].map(([val, lbl]) => (
            <div key={lbl} className="rounded-xl p-2.5 text-center" style={{ background: 'linear-gradient(135deg, #8B7CF8, #6D56E8)' }}>
              <p className="text-white text-sm font-black">{val}</p>
              <p className="text-violet-200 text-[9px] font-medium">{lbl}</p>
            </div>
          ))}
        </div>

        {/* Two panels */}
        <div className="grid grid-cols-2 gap-3">
          {/* Bar chart panel */}
          <div className="bg-white rounded-xl p-3" style={{ border: '1px solid #EDE9FE' }}>
            <p className="text-[10px] font-bold text-slate-700 mb-2">Procurement Trend</p>
            <div className="flex items-end gap-1 h-14">
              {[40, 55, 35, 62, 70, 50, 80].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm transition-all"
                  style={{
                    height: `${h}%`,
                    background: i === 6 ? '#8B7CF8' : '#C4BBFB',
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1.5">
              {['J','F','M','A','M','J','J'].map((m, i) => (
                <span key={i} className="text-[7px] text-slate-400">{m}</span>
              ))}
            </div>
          </div>

          {/* AI Insights donut */}
          <div className="bg-white rounded-xl p-3" style={{ border: '1px solid #EDE9FE' }}>
            <p className="text-[10px] font-bold text-slate-700 mb-1.5">AI Insights</p>
            <div className="flex items-center justify-center mb-1">
              <div className="relative w-14 h-14">
                <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                  <circle cx="28" cy="28" r="21" fill="none" stroke="#EDE9FE" strokeWidth="9" />
                  <circle cx="28" cy="28" r="21" fill="none" stroke="#8B7CF8" strokeWidth="9"
                    strokeDasharray="105 27" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-black" style={{ color: '#8B7CF8' }}>A+</span>
                  <span className="text-[7px] text-slate-400">Score</span>
                </div>
              </div>
            </div>
            <div className="space-y-0.5">
              {['Best Vendor','Low Cost','Fast Delivery'].map((label, i) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#8B7CF8' }} />
                  <span className="text-[7px] text-slate-500">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Floating accuracy badge */}
    <div
      className="absolute -bottom-2 -left-4 rounded-2xl px-5 py-3 bg-white"
      style={{ boxShadow: '0 8px 30px rgba(139,124,248,0.22)', border: '1px solid #EDE9FE' }}
    >
      <p className="text-2xl font-black leading-none" style={{ color: '#8B7CF8' }}>98.2%</p>
      <p className="text-[11px] text-slate-500 font-medium mt-0.5">Procurement Accuracy</p>
    </div>
  </div>
);

const featureTags = [
  { emoji: '📊', label: 'Centralized Data Management' },
  { emoji: '🏥', label: 'Real-Time Inventory Tracking' },
  { emoji: '📈', label: 'Vendor Performance Records' },
];

const AiEngineSection = () => {
  return (
    <section id="about" className="py-20" style={{ background: '#F3F0FF' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left — Text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <span
              className="inline-block px-3 py-1.5 rounded-md text-white text-xs font-bold uppercase tracking-widest"
              style={{ background: 'linear-gradient(135deg, #8B7CF8, #6D56E8)' }}
            >
              About ProcuraMed
            </span>

            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
              Smart Procurement for
              <br />Modern Healthcare
            </h2>

            <p className="text-slate-600 leading-relaxed text-base">
              ProcuraMed is designed to digitize and simplify procurement activities within hospitals. It centralizes the entire purchasing lifecycle — from department requisitions and multi-level approvals to vendor selection, delivery verification, and invoice matching.
            </p>

            <p className="text-slate-600 leading-relaxed text-base">
              Supporting roles such as Department Staff, Procurement Officers, Technical Officers, Finance Teams, and System Administrators — ensuring accountability and transparency throughout every stage.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              {featureTags.map((tag) => (
                <div
                  key={tag.label}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-sm text-slate-700 font-medium transition-all hover:border-violet-300 hover:-translate-y-0.5"
                  style={{ border: '1px solid #EDE9FE', boxShadow: '0 2px 8px rgba(139,124,248,0.08)' }}
                >
                  <span>{tag.emoji}</span>
                  <span>{tag.label}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — Dashboard Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <DashboardMockup />
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default AiEngineSection;
