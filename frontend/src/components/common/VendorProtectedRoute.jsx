import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const VendorProtectedRoute = ({ children, allowFirstLogin = false }) => {
  const { isAuthenticated, isVendor, user } = useAuth();

  if (!isAuthenticated) {
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
