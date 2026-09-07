import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const TechnicalOfficerProtectedRoute = ({ children }) => {
  const { isAuthenticated, isTechnicalOfficer } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isTechnicalOfficer) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default TechnicalOfficerProtectedRoute;
