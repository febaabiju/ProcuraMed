import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProcurementCommitteeProtectedRoute = ({ children }) => {
  const { isAuthenticated, isCommitteeMember } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isCommitteeMember) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProcurementCommitteeProtectedRoute;
