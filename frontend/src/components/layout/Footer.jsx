import React from 'react';
import { Link } from 'react-router-dom';
import { HiPhone, HiLocationMarker, HiMail } from 'react-icons/hi';
import ProcuraMedLogo from '../common/ProcuraMedLogo';

const Footer = () => {
  return (
    <footer className="bg-slate-900 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-10">

          {/* Brand Column */}
          <div className="md:col-span-1 lg:col-span-1 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <ProcuraMedLogo size={34} variant="color" />
              <span className="text-xl font-bold text-white">ProcuraMed</span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
              A hospital procurement management system developed as an MCA academic project to digitize and streamline the purchasing lifecycle.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-5 uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-3">
              {[
                { label: 'Home',         href: '#home' },
                { label: 'About',        href: '#about' },
                { label: 'Features',     href: '#features' },
                { label: 'Contact',      href: '#contact' },
                { label: 'Vendor Login', href: '/login' },
              ].map(link => (
                <li key={link.label}>
                  {link.href.startsWith('#') ? (
                    <a href={link.href} className="hover:text-violet-400 transition-colors">{link.label}</a>
                  ) : (
                    <Link to={link.href} className="hover:text-violet-400 transition-colors">{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Platform Links */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-5 uppercase tracking-wider">Platform</h4>
            <ul className="space-y-3">
              {[
                'Requisition Management',
                'Vendor Management',
                'Quotation Comparison',
                'Purchase Orders',
                'Inventory Verification',
                'Invoice & Payment',
              ].map(item => (
                <li key={item}>
                  <a href="#features" className="hover:text-violet-400 transition-colors">{item}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div id="contact">
            <h4 className="text-white font-semibold text-sm mb-5 uppercase tracking-wider">Contact</h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <HiMail className="w-4 h-4 flex-shrink-0" style={{ color: '#8B7CF8' }} />
                <a href="mailto:procuramed2026@gmail.com" className="text-sm hover:text-violet-400 transition-colors">
                  procuramed2026@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-3">
                <HiLocationMarker className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#8B7CF8' }} />
                <span className="text-sm leading-snug">Kottayam, Kerala, India</span>
              </li>
              <li className="flex items-center gap-3">
                <HiPhone className="w-4 h-4 flex-shrink-0" style={{ color: '#8B7CF8' }} />
                <span className="text-sm">+91 9876543210</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-7 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <p>© {new Date().getFullYear()} ProcuraMed — Hospital Procurement Management System. MCA Academic Project.</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-slate-400 transition-colors">Terms of Use</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
