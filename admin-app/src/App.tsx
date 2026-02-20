import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AimProvider } from './contexts/AimContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { NotificationToast } from './components/notifications/NotificationToast';
import {
  LoginPage,
  DashboardPage,
  LoyaltyPage,
  CustomersPage,
  CustomerDetailPage,
  GingrSyncPage,
  SchedulePage,
  StaffSchedulePage,
  GroomingPricingPage,
  BundleManagementPage,
  StaffPage,
  MessagingPage,
  AIMonitoringPage,
} from './pages';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AimProvider>
        <NotificationProvider>
        <ErrorBoundary>
        <NotificationToast />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/schedule"
            element={
              <ProtectedRoute>
                <Layout>
                  <SchedulePage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <Layout>
                  <CustomersPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <CustomerDetailPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/grooming-pricing"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                <Layout>
                  <GroomingPricingPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bundles"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                <Layout>
                  <BundleManagementPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <Layout>
                  <StaffPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff-schedule"
            element={
              <ProtectedRoute>
                <Layout>
                  <StaffSchedulePage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/loyalty"
            element={
              <ProtectedRoute>
                <Layout>
                  <LoyaltyPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/gingr-sync"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                <Layout>
                  <GingrSyncPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <Layout>
                  <MessagingPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-monitoring"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}>
                <Layout>
                  <AIMonitoringPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
          {/* Catch-all: redirect unknown routes to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </ErrorBoundary>
        </NotificationProvider>
        </AimProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
