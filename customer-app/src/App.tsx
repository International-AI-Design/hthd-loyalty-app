import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import { RegisterPage, LoginPage, ClaimPage, DashboardPage, ForgotPasswordPage, BookingPage, BookingsPage, CheckoutPage, CheckoutConfirmationPage, PrivacyPolicyPage, TermsPage, DogProfilePage, MessagingPage, ReportCardsPage, MyPetsPage, RewardsPage, SettingsPage, ActivityFeedPage, AgreementsPage, BadgesPage } from './pages';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/claim" element={<ClaimPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/book"
            element={
              <ProtectedRoute>
                <BookingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute>
                <PageErrorBoundary title="Bookings">
                  <BookingsPage />
                </PageErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkout/confirmation/:paymentId"
            element={
              <ProtectedRoute>
                <PageErrorBoundary title="Confirmation">
                  <CheckoutConfirmationPage />
                </PageErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkout/:bookingId"
            element={
              <ProtectedRoute>
                <PageErrorBoundary title="Checkout">
                  <CheckoutPage />
                </PageErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dogs/:dogId"
            element={
              <ProtectedRoute>
                <PageErrorBoundary title="Pet Profile">
                  <DogProfilePage />
                </PageErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MessagingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/report-cards"
            element={
              <ProtectedRoute>
                <ReportCardsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-pets"
            element={
              <ProtectedRoute>
                <PageErrorBoundary title="My Pets">
                  <MyPetsPage />
                </PageErrorBoundary>
              </ProtectedRoute>
            }
          />
          <Route
            path="/rewards"
            element={
              <ProtectedRoute>
                <RewardsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/activity"
            element={
              <ProtectedRoute>
                <ActivityFeedPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agreements"
            element={
              <ProtectedRoute>
                <AgreementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/badges"
            element={
              <ProtectedRoute>
                <BadgesPage />
              </ProtectedRoute>
            }
          />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/" element={<Navigate to="/register" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
