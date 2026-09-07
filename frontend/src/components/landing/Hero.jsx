import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const Hero = () => {
  return (
    <section
      id="home"
      className="relative flex items-center overflow-hidden min-h-[calc(100vh-64px)] lg:h-[calc(100vh-64px)] py-8 lg:py-0"
      style={{ background: '#f5f2ff' }}
    >

      {/* ── Hospital background image: full cover, positioned right ── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url('/images/hero1.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'right center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
        }}
      />

      {/* ── Subtle lavender gradient overlay toward left side only ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(
              to right,
              rgba(245, 242, 255, 0.88) 0%,
              rgba(245, 242, 255, 0.75) 35%,
              rgba(245, 242, 255, 0.40) 65%,
              rgba(245, 242, 255, 0.12) 85%,
              rgba(245, 242, 255, 0.00) 100%
            )
          `,
          zIndex: 1,
        }}
      />

      {/* ── Hero content: moved slightly further to the left ── */}
      <div
        className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:pl-8 lg:pr-12"
        style={{ zIndex: 2 }}
      >
        <div className="max-w-[620px] space-y-6 sm:space-y-7">

          {/* Pill badge with darker purple text */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2.5 px-4 sm:px-5 py-2 rounded-full text-[11px] sm:text-xs font-bold tracking-widest uppercase"
            style={{
              background: 'rgba(167, 110, 238, 0.14)',
              border: '1px solid rgba(167, 110, 238, 0.35)',
              color: '#432175',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
              style={{ background: '#7C43F5' }}
            />
            INTELLIGENT HOSPITAL PROCUREMENT DECISION SUPPORT PLATFORM
          </motion.div>

          {/* Main heading: Navy Blue + Amethyst/Purple Gradient */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="font-black tracking-tight leading-[1.08]"
            style={{
              fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)',
            }}
          >
            <span style={{ color: '#1B1642' }}>Smarter Procurement.</span>
            <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #5B38E6 0%, #8B62F0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'inline-block',
              }}
            >
              Better Healthcare.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base sm:text-lg leading-relaxed font-medium"
            style={{ color: '#4a3d6e', maxWidth: '540px' }}
          >
            ProcuraMed digitizes and streamlines hospital purchasing activities —
            connecting purchase requisitions, approval workflows, vendor management,
            quotation comparisons, purchase orders, inventory coordination,
            financial tracking, and AI-assisted decision support into one unified platform.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center gap-4 pt-1"
          >
            <Link to="/login">
              <button
                className="px-8 py-3.5 rounded-2xl text-sm font-bold transition-all hover:scale-105 shadow-lg shadow-purple-200 min-w-[140px]"
                style={{ background: '#A76EEE', color: '#ffffff' }}
              >
                Login
              </button>
            </Link>
            <Link to="/vendor-register">
              <button
                className="px-8 py-3.5 rounded-2xl text-sm font-bold transition-all hover:scale-105 min-w-[160px]"
                style={{
                  background: 'rgba(255, 255, 255, 0.40)',
                  color: '#6B3FA0',
                  border: '2px solid rgba(167, 110, 238, 0.45)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                Become a Vendor
              </button>
            </Link>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default Hero;
