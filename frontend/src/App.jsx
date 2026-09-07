import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AdminProtectedRoute from './components/common/AdminProtectedRoute';
import VendorProtectedRoute from './components/common/VendorProtectedRoute';
import DepartmentStaffProtectedRoute from './components/common/DepartmentStaffProtectedRoute';
import PurchaseOfficerProtectedRoute from './components/common/PurchaseOfficerProtectedRoute';
import ProcurementCommitteeProtectedRoute from './components/common/ProcurementCommitteeProtectedRoute';
import TechnicalOfficerProtectedRoute from './components/common/TechnicalOfficerProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VendorRegisterPage from './pages/VendorRegisterPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import PurchaseOfficerManagementPage from './pages/admin/PurchaseOfficerManagementPage';
import ProcurementCommitteeManagementPage from './pages/admin/ProcurementCommitteeManagementPage';
import TechnicalOfficerManagementPage from './pages/admin/TechnicalOfficerManagementPage';
import VendorApplicationsPage from './pages/admin/VendorApplicationsPage';
import VendorManagementPage from './pages/admin/VendorManagementPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import SystemReportsPage from './pages/admin/SystemReportsPage';
import SystemSettingsPage from './pages/admin/SystemSettingsPage';
import VendorDashboardPage from './pages/vendor/VendorDashboardPage';
import VendorSupplyCategoriesPage from './pages/vendor/VendorSupplyCategoriesPage';
import VendorChangePasswordPage from './pages/vendor/VendorChangePasswordPage';
import VendorPlaceholderPage from './pages/vendor/VendorPlaceholderPage';
import DepartmentStaffDashboardPage from './pages/staff/DepartmentStaffDashboardPage';
import StaffPlaceholderPage from './pages/staff/StaffPlaceholderPage';
import PurchaseOfficerDashboardPage from './pages/purchaseOfficer/PurchaseOfficerDashboardPage';
import PurchaseOfficerPlaceholderPage from './pages/purchaseOfficer/PurchaseOfficerPlaceholderPage';
import ProcurementCommitteeDashboardPage from './pages/committee/ProcurementCommitteeDashboardPage';
import CommitteePlaceholderPage from './pages/committee/CommitteePlaceholderPage';
import TechnicalOfficerDashboardPage from './pages/technicalOfficer/TechnicalOfficerDashboardPage';
import TechnicalOfficerPlaceholderPage from './pages/technicalOfficer/TechnicalOfficerPlaceholderPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/vendor-register" element={<VendorRegisterPage />} />
          <Route path="/register" element={<Navigate to="/vendor-register" replace />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          
          {/* Technical Officer Protected Routes */}
          <Route
            path="/technical-officer/dashboard"
            element={
              <TechnicalOfficerProtectedRoute>
                <TechnicalOfficerDashboardPage />
              </TechnicalOfficerProtectedRoute>
            }
          />
          <Route
            path="/technical-officer"
            element={<Navigate to="/technical-officer/dashboard" replace />}
          />
          <Route
            path="/technical-officer/evaluations"
            element={
              <TechnicalOfficerProtectedRoute>
                <TechnicalOfficerPlaceholderPage path="/technical-officer/evaluations" />
              </TechnicalOfficerProtectedRoute>
            }
          />
          <Route
            path="/technical-officer/assigned-reviews"
            element={
              <TechnicalOfficerProtectedRoute>
                <TechnicalOfficerPlaceholderPage path="/technical-officer/assigned-reviews" />
              </TechnicalOfficerProtectedRoute>
            }
          />
          <Route
            path="/technical-officer/history"
            element={
              <TechnicalOfficerProtectedRoute>
                <TechnicalOfficerPlaceholderPage path="/technical-officer/history" />
              </TechnicalOfficerProtectedRoute>
            }
          />
          <Route
            path="/technical-officer/notifications"
            element={
              <TechnicalOfficerProtectedRoute>
                <TechnicalOfficerPlaceholderPage path="/technical-officer/notifications" />
              </TechnicalOfficerProtectedRoute>
            }
          />
          <Route
            path="/technical-officer/profile"
            element={
              <TechnicalOfficerProtectedRoute>
                <TechnicalOfficerPlaceholderPage path="/technical-officer/profile" />
              </TechnicalOfficerProtectedRoute>
            }
          />
          
          {/* Procurement Committee Protected Routes */}
          <Route
            path="/committee/dashboard"
            element={
              <ProcurementCommitteeProtectedRoute>
                <ProcurementCommitteeDashboardPage />
              </ProcurementCommitteeProtectedRoute>
            }
          />
          <Route
            path="/committee"
            element={<Navigate to="/committee/dashboard" replace />}
          />
          <Route
            path="/committee/reviews"
            element={
              <ProcurementCommitteeProtectedRoute>
                <CommitteePlaceholderPage path="/committee/reviews" />
              </ProcurementCommitteeProtectedRoute>
            }
          />
          <Route
            path="/committee/decisions"
            element={
              <ProcurementCommitteeProtectedRoute>
                <CommitteePlaceholderPage path="/committee/decisions" />
              </ProcurementCommitteeProtectedRoute>
            }
          />
          <Route
            path="/committee/history"
            element={
              <ProcurementCommitteeProtectedRoute>
                <CommitteePlaceholderPage path="/committee/history" />
              </ProcurementCommitteeProtectedRoute>
            }
          />
          <Route
            path="/committee/notifications"
            element={
              <ProcurementCommitteeProtectedRoute>
                <CommitteePlaceholderPage path="/committee/notifications" />
              </ProcurementCommitteeProtectedRoute>
            }
          />
          <Route
            path="/committee/profile"
            element={
              <ProcurementCommitteeProtectedRoute>
                <CommitteePlaceholderPage path="/committee/profile" />
              </ProcurementCommitteeProtectedRoute>
            }
          />
          
          {/* Purchase Officer Protected Routes */}
          <Route
            path="/purchase-officer/dashboard"
            element={
              <PurchaseOfficerProtectedRoute>
                <PurchaseOfficerDashboardPage />
              </PurchaseOfficerProtectedRoute>
            }
          />
          <Route
            path="/purchase-officer"
            element={<Navigate to="/purchase-officer/dashboard" replace />}
          />
          <Route
            path="/purchase-officer/requisitions"
            element={
              <PurchaseOfficerProtectedRoute>
                <PurchaseOfficerPlaceholderPage path="/purchase-officer/requisitions" />
              </PurchaseOfficerProtectedRoute>
            }
          />
          <Route
            path="/purchase-officer/opportunities"
            element={
              <PurchaseOfficerProtectedRoute>
                <PurchaseOfficerPlaceholderPage path="/purchase-officer/opportunities" />
              </PurchaseOfficerProtectedRoute>
            }
          />
          <Route
            path="/purchase-officer/quotations"
            element={
              <PurchaseOfficerProtectedRoute>
                <PurchaseOfficerPlaceholderPage path="/purchase-officer/quotations" />
              </PurchaseOfficerProtectedRoute>
            }
          />
          <Route
            path="/purchase-officer/purchase-orders"
            element={
              <PurchaseOfficerProtectedRoute>
                <PurchaseOfficerPlaceholderPage path="/purchase-officer/purchase-orders" />
              </PurchaseOfficerProtectedRoute>
            }
          />
          <Route
            path="/purchase-officer/vendors"
            element={
              <PurchaseOfficerProtectedRoute>
                <PurchaseOfficerPlaceholderPage path="/purchase-officer/vendors" />
              </PurchaseOfficerProtectedRoute>
            }
          />
          <Route
            path="/purchase-officer/deliveries"
            element={
              <PurchaseOfficerProtectedRoute>
                <PurchaseOfficerPlaceholderPage path="/purchase-officer/deliveries" />
              </PurchaseOfficerProtectedRoute>
            }
          />
          <Route
            path="/purchase-officer/notifications"
            element={
              <PurchaseOfficerProtectedRoute>
                <PurchaseOfficerPlaceholderPage path="/purchase-officer/notifications" />
              </PurchaseOfficerProtectedRoute>
            }
          />
          <Route
            path="/purchase-officer/profile"
            element={
              <PurchaseOfficerProtectedRoute>
                <PurchaseOfficerPlaceholderPage path="/purchase-officer/profile" />
              </PurchaseOfficerProtectedRoute>
            }
          />
          
          {/* Department Staff Protected Routes */}
          <Route
            path="/staff/dashboard"
            element={
              <DepartmentStaffProtectedRoute>
                <DepartmentStaffDashboardPage />
              </DepartmentStaffProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={<Navigate to="/staff/dashboard" replace />}
          />
          <Route
            path="/staff/requests"
            element={
              <DepartmentStaffProtectedRoute>
                <StaffPlaceholderPage path="/staff/requests" />
              </DepartmentStaffProtectedRoute>
            }
          />
          <Route
            path="/staff/create-request"
            element={
              <DepartmentStaffProtectedRoute>
                <StaffPlaceholderPage path="/staff/create-request" />
              </DepartmentStaffProtectedRoute>
            }
          />
          <Route
            path="/staff/notifications"
            element={
              <DepartmentStaffProtectedRoute>
                <StaffPlaceholderPage path="/staff/notifications" />
              </DepartmentStaffProtectedRoute>
            }
          />
          <Route
            path="/staff/profile"
            element={
              <DepartmentStaffProtectedRoute>
                <StaffPlaceholderPage path="/staff/profile" />
              </DepartmentStaffProtectedRoute>
            }
          />
          
          {/* Vendor Protected Routes */}
          <Route
            path="/vendor/change-password"
            element={
              <VendorProtectedRoute allowFirstLogin={true}>
                <VendorChangePasswordPage />
              </VendorProtectedRoute>
            }
          />
          <Route
            path="/vendor/dashboard"
            element={
              <VendorProtectedRoute>
                <VendorDashboardPage />
              </VendorProtectedRoute>
            }
          />
          <Route
            path="/vendor/supply-categories"
            element={
              <VendorProtectedRoute>
                <VendorSupplyCategoriesPage />
              </VendorProtectedRoute>
            }
          />
          <Route
            path="/vendor"
            element={<Navigate to="/vendor/dashboard" replace />}
          />
          <Route
            path="/vendor/opportunities"
            element={
              <VendorProtectedRoute>
                <VendorPlaceholderPage path="/vendor/opportunities" />
              </VendorProtectedRoute>
            }
          />
          <Route
            path="/vendor/quotations"
            element={
              <VendorProtectedRoute>
                <VendorPlaceholderPage path="/vendor/quotations" />
              </VendorProtectedRoute>
            }
          />
          <Route
            path="/vendor/purchase-orders"
            element={
              <VendorProtectedRoute>
                <VendorPlaceholderPage path="/vendor/purchase-orders" />
              </VendorProtectedRoute>
            }
          />
          <Route
            path="/vendor/deliveries"
            element={
              <VendorProtectedRoute>
                <VendorPlaceholderPage path="/vendor/deliveries" />
              </VendorProtectedRoute>
            }
          />
          <Route
            path="/vendor/invoices"
            element={
              <VendorProtectedRoute>
                <VendorPlaceholderPage path="/vendor/invoices" />
              </VendorProtectedRoute>
            }
          />
          <Route
            path="/vendor/notifications"
            element={
              <VendorProtectedRoute>
                <VendorPlaceholderPage path="/vendor/notifications" />
              </VendorProtectedRoute>
            }
          />
          <Route
            path="/vendor/profile"
            element={
              <VendorProtectedRoute>
                <VendorPlaceholderPage path="/vendor/profile" />
              </VendorProtectedRoute>
            }
          />

          {/* Admin Protected Routes */}
          <Route
            path="/admin"
            element={<Navigate to="/admin/dashboard" replace />}
          />
          <Route
            path="/admin/dashboard"
            element={
              <AdminProtectedRoute>
                <AdminDashboardPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminProtectedRoute>
                <UserManagementPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/purchase-officers"
            element={
              <AdminProtectedRoute>
                <PurchaseOfficerManagementPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/purchase-officer"
            element={<Navigate to="/admin/purchase-officers" replace />}
          />
          <Route
            path="/admin/procurement-committee"
            element={
              <AdminProtectedRoute>
                <ProcurementCommitteeManagementPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/procurement-committee-members"
            element={<Navigate to="/admin/procurement-committee" replace />}
          />
          <Route
            path="/admin/technical-officers"
            element={
              <AdminProtectedRoute>
                <TechnicalOfficerManagementPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/technical-officer"
            element={<Navigate to="/admin/technical-officers" replace />}
          />
          <Route
            path="/admin/vendor-applications"
            element={
              <AdminProtectedRoute>
                <VendorApplicationsPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/vendors"
            element={
              <AdminProtectedRoute>
                <VendorManagementPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <AdminProtectedRoute>
                <AuditLogsPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <AdminProtectedRoute>
                <SystemReportsPage />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminProtectedRoute>
                <SystemSettingsPage />
              </AdminProtectedRoute>
            }
          />

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
