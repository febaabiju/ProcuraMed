import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const TechnicalOfficerProtectedRoute = ({ children }) => {
  const { isAuthenticated, isTechnicalOfficer, user } = useAuth();
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

  if (!isTechnicalOfficer) {
    return <Navigate to="/login" replace />;
  }

  if (user?.first_login) {
    return <Navigate to="/set-new-password" replace />;
  }

  return children;
};

export default TechnicalOfficerProtectedRoute;
