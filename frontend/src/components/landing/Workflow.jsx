import React from 'react';
import { motion } from 'framer-motion';

const steps = [
  { num: '01', icon: '🏥', label: 'Department Request', desc: 'Hospital departments submit purchase requisitions specifying required items, quantities, and justification.' },
  { num: '02', icon: '✅', label: 'Approval',            desc: 'The Procurement Committee reviews and authorizes requests after verifying budget availability.' },
  { num: '03', icon: '🏢', label: 'Vendor Selection',   desc: 'Procurement Officers issue an RFQ to approved and shortlisted suppliers.' },
  { num: '04', icon: '📄', label: 'Quotation',           desc: 'Vendors submit itemized quotations; the system compares them side-by-side.' },
  { num: '05', icon: '🛒', label: 'Purchase Order',      desc: 'The most suitable vendor is selected and a formal Purchase Order is issued.' },
  { num: '06', icon: '🚚', label: 'Delivery',            desc: 'The vendor dispatches goods and updates shipment status in the system.' },
  { num: '07', icon: '🔍', label: 'Verification',        desc: 'Technical Officers inspect delivered items against specifications and record findings.' },
  { num: '08', icon: '💳', label: 'Payment',             desc: 'Finance validates the invoice against PO and delivery receipt, then authorizes payment.' },
];

const Workflow = () => {
  return (
    <section id="workflow" className="py-20 bg-indigo-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14 space-y-4">
          <span className="inline-block px-4 py-1.5 rounded-md bg-indigo-600 text-white text-xs font-bold uppercase tracking-widest">
            Procurement Workflow
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            How ProcuraMed Works
          </h2>
          <p className="text-gray-500 text-base leading-relaxed">
            A structured 8-step process connecting all hospital departments with vendors through a transparent procurement chain.
          </p>
        </div>

        {/* Steps — horizontal flow with arrows on desktop, stacked on mobile */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="hidden lg:block absolute top-[52px] left-[8%] right-[8%] h-0.5 bg-indigo-200 z-0" />

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 relative z-10">
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.06 }}
                className="flex flex-col items-center text-center group"
              >
                {/* Circle */}
                <div className="w-[60px] h-[60px] rounded-full bg-white border-2 border-indigo-200 group-hover:border-indigo-500 group-hover:bg-indigo-600 flex items-center justify-center text-2xl shadow-sm transition-all mb-3">
                  <span className="group-hover:grayscale-0 transition-all">{step.icon}</span>
                </div>
                <span className="text-[10px] font-bold text-indigo-400 mb-0.5">{step.num}</span>
                <p className="text-xs font-bold text-gray-800 leading-tight">{step.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Step details cards below */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.3 + idx * 0.05 }}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{step.icon}</span>
                  <div>
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wide block">Step {step.num}</span>
                    <p className="text-sm font-bold text-gray-900">{step.label}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default Workflow;
