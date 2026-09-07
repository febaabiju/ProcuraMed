import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import Hero from '../components/landing/Hero';
import Stats from '../components/landing/Stats';
import AiEngineSection from '../components/landing/AiEngineSection';
import Features from '../components/landing/Features';
import WhySection from '../components/landing/WhySection';
import CtaBanner from '../components/landing/CtaBanner';

const LandingPage = () => {
  const { isAuthenticated, isAdmin, isVendor, user } = useAuth();

  // If an authenticated admin navigates to the home/landing route, automatically redirect to Admin Dashboard
  if (isAuthenticated && isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  // If an authenticated vendor navigates to the home/landing route, automatically redirect to Vendor Dashboard
  if (isAuthenticated && isVendor) {
    return <Navigate to={user?.first_login ? "/vendor/change-password" : "/vendor/dashboard"} replace />;
  }
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8F8FC' }}>
      <Navbar />
      <main className="flex-grow">
        {/* 1. Hero — lavender gradient overlay on hospital image */}
        <Hero />

        {/* 2. Stats — 4 lavender-bordered stat cards */}
        <Stats />

        {/* 3. About — lavender bg, text + dashboard mockup */}
        <AiEngineSection />

        {/* 4. Core Features — 6 pastel feature cards */}
        <Features />

        {/* 5. Why ProcuraMed — 6 benefit cards */}
        <WhySection />

        {/* 6. CTA Banner — lavender gradient */}
        <CtaBanner />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
