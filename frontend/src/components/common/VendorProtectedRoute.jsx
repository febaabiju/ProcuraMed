import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const VendorProtectedRoute = ({ children, allowFirstLogin = false }) => {
  const { isAuthenticated, isVendor, user } = useAuth();
  const token = sessionStorage.getItem('access_token');

  useEffect(() => {
    const handlePageShow = () => {
      if (!sessionStorage.getItem('access_token')) {
        window.location.replace('/login');
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  if (!token || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isVendor) {
    return <Navigate to="/login" replace />;
  }

  if (user?.first_login && !allowFirstLogin) {
    return <Navigate to="/vendor/change-password" replace />;
  }

  if (!user?.first_login && allowFirstLogin) {
    return <Navigate to="/vendor/dashboard" replace />;
  }

  return children;
};

export default VendorProtectedRoute;
