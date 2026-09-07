import React from 'react';
import { Link } from 'react-router-dom';
import { HiArrowRight } from 'react-icons/hi';

const CtaBanner = () => {
  return (
    <section id="contact" className="py-20 relative overflow-hidden">
      {/* Lavender → violet → blue gradient (matches Figma) */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, #7C5FF0 0%, #8B7CF8 50%, #5B8EDC 100%)' }}
      />

      {/* Decorative soft circles */}
      <div
        className="absolute top-1/2 right-14 -translate-y-1/2 w-80 h-80 rounded-full"
        style={{ border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)' }}
      />
      <div
        className="absolute top-1/2 right-36 -translate-y-1/2 w-52 h-52 rounded-full"
        style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)' }}
      />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6" style={{ zIndex: 1 }}>
        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
          Ready to Transform Your
          <br className="hidden sm:inline" />
          Procurement Process?
        </h2>
        <p className="text-white/75 max-w-xl mx-auto text-base leading-relaxed">
          ProcuraMed brings transparency, efficiency, and accountability to hospital procurement operations.
          Login as hospital staff or apply as a verified supplier.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link to="/login">
            <button
              className="px-9 py-3.5 rounded-2xl text-sm font-bold transition-all hover:scale-105 hover:shadow-lg min-w-[180px] flex items-center justify-center gap-2"
              style={{ background: 'white', color: '#7C5FF0' }}
            >
              Login to Portal <HiArrowRight className="w-4 h-4" />
            </button>
          </Link>
          <Link to="/vendor-register">
            <button
              className="px-9 py-3.5 rounded-2xl text-sm font-bold text-white border-2 border-white/30 hover:bg-white/10 transition-all hover:scale-105 min-w-[180px]"
            >
              Become a Vendor
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default CtaBanner;
