import React from 'react';
import { motion } from 'framer-motion';

const stats = [
  { emoji: '📋', value: '500+', label: 'Purchase Requests Processed' },
  { emoji: '🎯', value: '95%',  label: 'Procurement Accuracy' },
  { emoji: '🤝', value: '200+', label: 'Suppliers Managed' },
  { emoji: '⚡', value: '40%',  label: 'Faster Decisions' },
];

const Stats = () => {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((st, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: idx * 0.08 }}
              className="bg-white rounded-2xl p-6 flex flex-col items-center text-center transition-all hover:-translate-y-1"
              style={{
                border: '1px solid #EDE9FE',
                boxShadow: '0 4px 20px rgba(139, 124, 248, 0.08)',
              }}
            >
              <span className="text-3xl mb-3">{st.emoji}</span>
              <p className="text-4xl font-black tracking-tight leading-none mb-1.5" style={{ color: '#8B7CF8' }}>
                {st.value}
              </p>
              <p className="text-xs text-slate-500 font-medium leading-snug">{st.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
