import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { checkoutApi } from '../lib/api';
import type { ReceiptData, Booking, CheckoutResult } from '../lib/api';
import { AppShell } from '../components/AppShell';
import { Button, Alert, Toast } from '../components/ui';

export function CheckoutConfirmationPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const passedResult = (location.state as { checkoutResult?: CheckoutResult; booking?: Booking } | null);
  const passedBooking = passedResult?.booking ?? null;

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const formatDate = (dateString: string) => {
    const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  useEffect(() => {
    const loadReceipt = async () => {
      if (!paymentId) return;
      setIsLoading(true);
      const { data, error: err } = await checkoutApi.getReceipt(paymentId);
      if (data) {
        setReceipt(data);
      } else if (err) {
        setError(err);
      }
      setIsLoading(false);
    };
    loadReceipt();
  }, [paymentId]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const timer = setTimeout(() => setHasAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleCopyId = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastMessage('Copied to clipboard!');
      setIsToastVisible(true);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setToastMessage('Copied to clipboard!');
      setIsToastVisible(true);
    }
  };

  const truncateId = (id: string) => {
    if (id.length <= 16) return id;
    return `${id.slice(0, 8)}...${id.slice(-4)}`;
  };

  const paymentMethodLabel = (method: string) => {
    switch (method) {
      case 'wallet': return 'Wallet';
      case 'card': return 'Card';
      case 'split': return 'Wallet + Card';
      default: return method;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <AppShell title="Payment Receipt" showBack>
        <div className="px-4 py-8">
          <Alert variant="error">{error}</Alert>
          <Button className="w-full mt-4" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </AppShell>
    );
  }

  // Use receipt data if loaded, otherwise fall back to passed state
  const totalCents = receipt?.totalCents ?? passedResult?.checkoutResult?.totalCents ?? 0;
  const walletAmountCents = receipt?.walletAmountCents ?? passedResult?.checkoutResult?.walletAmountCents ?? 0;
  const cardAmountCents = receipt?.cardAmountCents ?? passedResult?.checkoutResult?.cardAmountCents ?? 0;
  const paymentMethod = receipt?.paymentMethod ?? (walletAmountCents > 0 && cardAmountCents > 0 ? 'split' : walletAmountCents > 0 ? 'wallet' : 'card');
  const transactionId = receipt?.transactionId ?? passedResult?.checkoutResult?.transactionId ?? paymentId ?? '';
  const createdAt = receipt?.createdAt ?? passedResult?.checkoutResult?.createdAt ?? new Date().toISOString();

  // Booking info from receipt or passed state
  const bookingInfo = receipt?.bookings?.[0];
  const serviceName = bookingInfo?.serviceType ?? passedBooking?.serviceType?.displayName ?? 'Service';
  const bookingDate = bookingInfo?.date ?? passedBooking?.date ?? '';
  const dogNames = bookingInfo?.dogs ?? passedBooking?.dogs?.map((bd) => bd.dog.name) ?? [];

  return (
    <AppShell title="Payment Receipt" showBack>
      <div className="px-4 py-8 space-y-6">
        {/* Success Icon */}
        <div className="text-center">
          <div
            className={`mx-auto w-20 h-20 bg-brand-soft-green/20 rounded-full flex items-center justify-center mb-4 transition-all duration-500 ${
              hasAnimated ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
            }`}
          >
            <svg className="w-10 h-10 text-brand-soft-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2
            className={`font-heading text-2xl font-bold text-brand-navy mb-2 transition-all duration-500 delay-200 ${
              hasAnimated ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            Payment Successful!
          </h2>
          <p className="text-gray-600">Your appointment has been confirmed and paid.</p>
        </div>

        {/* Receipt Card */}
        <div className="bg-white rounded-2xl shadow-md p-5 space-y-4">
          <h3 className="font-heading text-lg font-bold text-brand-navy flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Receipt
          </h3>

          {/* Transaction ID */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600 text-sm">Transaction ID</span>
            <button
              onClick={() => handleCopyId(transactionId)}
              className="flex items-center gap-1 text-sm font-mono text-brand-navy hover:text-brand-blue transition-colors min-h-[44px]"
              title="Copy transaction ID"
            >
              {truncateId(transactionId)}
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          {/* Service & Date */}
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-600">Service</span>
            <span className="font-semibold text-brand-navy capitalize">{serviceName}</span>
          </div>
          {bookingDate && (
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Date</span>
              <span className="font-semibold text-brand-navy">{formatDate(bookingDate)}</span>
            </div>
          )}
          {dogNames.length > 0 && (
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Dog{dogNames.length > 1 ? 's' : ''}</span>
              <span className="font-semibold text-brand-navy">{dogNames.join(', ')}</span>
            </div>
          )}

          {/* Payment Breakdown */}
          <div className="pt-2 space-y-2">
            {walletAmountCents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Wallet</span>
                <span className="text-brand-navy">{formatPrice(walletAmountCents)}</span>
              </div>
            )}
            {cardAmountCents > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Card</span>
                <span className="text-brand-navy">{formatPrice(cardAmountCents)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200">
              <span className="text-lg font-bold text-brand-navy">Total Paid</span>
              <span className="text-xl font-bold text-brand-navy">{formatPrice(totalCents)}</span>
            </div>
          </div>

          {/* Payment Method & Timestamp */}
          <div className="flex justify-between py-2 border-t border-gray-100 text-sm">
            <span className="text-gray-600">Payment Method</span>
            <span className="font-medium text-brand-navy">{paymentMethodLabel(paymentMethod)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Paid At</span>
            <span className="text-brand-navy">{formatTimestamp(createdAt)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button className="w-full" size="lg" onClick={() => navigate('/bookings')}>
            View My Bookings
          </Button>
          <Button variant="outline" className="w-full" size="lg" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
      <Toast
        message={toastMessage}
        isVisible={isToastVisible}
        onHide={() => setIsToastVisible(false)}
      />
    </AppShell>
  );
}
