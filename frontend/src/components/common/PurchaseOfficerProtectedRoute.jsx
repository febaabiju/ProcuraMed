import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const PurchaseOfficerProtectedRoute = ({ children }) => {
  const { isAuthenticated, isPurchaseOfficer } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isPurchaseOfficer) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default PurchaseOfficerProtectedRoute;
