import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const DepartmentStaffProtectedRoute = ({ children }) => {
  const { isAuthenticated, isDepartmentStaff, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isDepartmentStaff) {
    return <Navigate to="/login" replace />;
  }

  if (user?.first_login) {
    return <Navigate to="/set-new-password" replace />;
  }

  return children;
};

export default DepartmentStaffProtectedRoute;
