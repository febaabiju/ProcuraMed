import React, { createContext, useContext, useState } from 'react';
import axiosClient from '../api/axiosClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Clear any legacy persistent localStorage data so project restarts always start logged out
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');

    // Use session-based storage so closing the browser/session does not leave the app logged in
    const savedUser = sessionStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const response = await axiosClient.post('/accounts/login/', { username, password });
      const { access, refresh, user: userData } = response.data;
      
      sessionStorage.setItem('access_token', access);
      sessionStorage.setItem('refresh_token', refresh);
      sessionStorage.setItem('user', JSON.stringify(userData));
      
      setUser(userData);
      return { success: true, data: response.data };
    } catch (error) {
      const data = error.response?.data;
      let message = 'Invalid credentials. Please verify your login details.';
      if (typeof data?.detail === 'string') {
        message = data.detail;
      } else if (Array.isArray(data?.detail) && data.detail.length > 0) {
        message = data.detail[0];
      } else if (typeof data?.error === 'string') {
        message = data.error;
      } else if (typeof data?.message === 'string') {
        message = data.message;
      } else if (typeof data === 'string') {
        message = data;
      }
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const submitVendorApplication = async (formData) => {
    setLoading(true);
    try {
      const response = await axiosClient.post('/vendors/applications/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return { success: true, data: response.data };
    } catch (error) {
      const errData = error.response?.data;
      let message = 'Application submission failed. Please check your details.';
      if (errData) {
        if (typeof errData === 'string') message = errData;
        else message = Object.values(errData).flat().join(' ');
      }
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
  const isAdmin = Boolean(
    user && (
      roleName?.toLowerCase() === 'system administrator' || 
      roleName?.toLowerCase() === 'admin' || 
      user.is_staff || 
      user.is_superuser
    )
  );

  const isVendor = Boolean(
    user && (
      roleName?.toLowerCase() === 'vendor' || 
      user.is_vendor
    )
  );

  const isDepartmentStaff = Boolean(
    user && (
      roleName?.toLowerCase() === 'department staff' ||
      roleName?.toLowerCase()?.includes('staff') ||
      roleName?.toLowerCase()?.includes('department')
    ) && !isAdmin && !isVendor
  );

  const isPurchaseOfficer = Boolean(
    user && (
      roleName?.toLowerCase() === 'purchase officer' ||
      roleName?.toLowerCase() === 'procurement officer' ||
      roleName?.toLowerCase()?.includes('purchase')
    ) && !isAdmin && !isVendor
  );

  const isCommitteeMember = Boolean(
    user && (
      roleName?.toLowerCase()?.includes('committee')
    ) && !isAdmin && !isVendor
  );

  const isTechnicalOfficer = Boolean(
    user && (
      roleName?.toLowerCase()?.includes('technical')
    ) && !isAdmin && !isVendor
  );

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      loading,
      login,
      submitVendorApplication,
      logout,
      isAuthenticated: !!user,
      isAdmin,
      isVendor,
      isDepartmentStaff,
      isPurchaseOfficer,
      isCommitteeMember,
      isTechnicalOfficer
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
