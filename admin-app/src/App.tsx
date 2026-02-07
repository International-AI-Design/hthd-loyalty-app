import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
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
} from './pages';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
              <ProtectedRoute>
                <Layout>
                  <GroomingPricingPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/bundles"
            element={
              <ProtectedRoute>
                <Layout>
                  <BundleManagementPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute>
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
              <ProtectedRoute>
                <Layout>
                  <GingrSyncPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
          {/* Catch-all: redirect unknown routes to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
