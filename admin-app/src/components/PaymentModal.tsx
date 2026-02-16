import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Modal, Alert } from './ui';
import { adminCheckoutApi } from '../lib/api';
import type { AdminBooking, CheckoutResponse } from '../lib/api';

type PaymentMethod = 'wallet' | 'card' | 'cash' | 'split';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: AdminBooking;
  onPaymentComplete?: (result: CheckoutResponse) => void;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDateRange(startDate: string, endDate?: string): string {
  const start = new Date(startDate + 'T00:00:00');
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!endDate || endDate === startDate) return startStr;
  const end = new Date(endDate + 'T00:00:00');
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startStr} - ${endStr}`;
}

const SERVICE_COLORS: Record<string, string> = {
  daycare: 'bg-brand-blue/10 text-brand-blue-dark',
  boarding: 'bg-brand-navy/10 text-brand-navy',
  grooming: 'bg-brand-coral/10 text-brand-coral',
};

export function PaymentModal({ isOpen, onClose, booking, onPaymentComplete }: PaymentModalProps) {
  const { staff } = useAuth();
  const canProcessPayment = staff?.role === 'owner' || staff?.role === 'manager';

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [cashReceived, setCashReceived] = useState('');
  const [walletSplitAmount, setWalletSplitAmount] = useState('');
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);

  const [step, setStep] = useState<'select' | 'confirm' | 'success' | 'error'>('select');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentResult, setPaymentResult] = useState<CheckoutResponse | null>(null);

  const totalCents = booking.totalCents;
  const dogNames = booking.dogs.map((d) => d.dog.name).join(', ');

  useEffect(() => {
    if ((paymentMethod === 'wallet' || paymentMethod === 'split') && isOpen) {
      setIsLoadingWallet(true);
      adminCheckoutApi.getWalletBalance(booking.customerId).then((result) => {
        setIsLoadingWallet(false);
        if (result.data) {
          setWalletBalance(result.data.balanceCents);
        } else {
          // Don't fabricate a balance — show wallet as unavailable
          setWalletBalance(null);
        }
      });
    }
  }, [paymentMethod, booking.customerId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod('card');
      setCashReceived('');
      setWalletSplitAmount('');
      setStep('select');
      setError(null);
      setPaymentResult(null);
      setWalletBalance(null);
    }
  }, [isOpen]);

  const handleConfirmPayment = () => {
    setError(null);
    if (paymentMethod === 'cash') {
      const received = parseFloat(cashReceived) * 100;
      if (isNaN(received) || received < totalCents) {
        setError('Cash received must be at least the total amount');
        return;
      }
    }
    if (paymentMethod === 'split') {
      const walletAmt = parseFloat(walletSplitAmount) * 100;
      if (isNaN(walletAmt) || walletAmt <= 0) {
        setError('Please enter a valid wallet amount');
        return;
      }
      if (walletBalance !== null && walletAmt > walletBalance) {
        setError('Wallet amount exceeds available balance');
        return;
      }
      if (walletAmt >= totalCents) {
        setError('Wallet amount must be less than total (use Wallet payment instead)');
        return;
      }
    }
    if (paymentMethod === 'wallet' && walletBalance !== null && walletBalance < totalCents) {
      setError('Insufficient wallet balance');
      return;
    }
    setStep('confirm');
  };

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    setError(null);
    const data: {
      bookingIds: string[];
      paymentMethod: PaymentMethod;
      walletAmount?: number;
      cashReceived?: number;
    } = { bookingIds: [booking.id], paymentMethod };
    if (paymentMethod === 'cash') {
      data.cashReceived = Math.round(parseFloat(cashReceived) * 100);
    }
    if (paymentMethod === 'split') {
      data.walletAmount = Math.round(parseFloat(walletSplitAmount) * 100);
    }
    const result = await adminCheckoutApi.processPayment(data);
    setIsProcessing(false);
    if (result.error) {
      setError(result.error);
      setStep('error');
    } else if (result.data) {
      setPaymentResult(result.data);
      setStep('success');
      onPaymentComplete?.(result.data);
    }
  };

  const handlePrint = () => { window.print(); };

  const cashReceivedCents = parseFloat(cashReceived) * 100 || 0;
  const changeDue = paymentMethod === 'cash' ? Math.max(0, cashReceivedCents - totalCents) : 0;
  const walletSplitCents = parseFloat(walletSplitAmount) * 100 || 0;
  const cardSplitCents = paymentMethod === 'split' ? Math.max(0, totalCents - walletSplitCents) : 0;
  const serviceColorClass = SERVICE_COLORS[booking.serviceType.name] || 'bg-gray-100 text-gray-700';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Process Payment">
      <div className="print:p-0">
        <div className="mb-4 p-3 bg-brand-cream rounded-lg">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="font-semibold text-brand-navy">
                {booking.customer.firstName} {booking.customer.lastName}
              </h3>
              <p className="text-sm text-gray-500">{dogNames}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${serviceColorClass}`}>
              {booking.serviceType.displayName}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {formatDateRange(booking.date, booking.endDate)}
              {booking.startTime && ` at ${booking.startTime}`}
            </span>
            <span className="text-lg font-bold text-brand-navy">{formatCents(totalCents)}</span>
          </div>
        </div>

        {!canProcessPayment && (
          <Alert variant="warning" className="mb-4">
            Only owners and managers can process payments. Contact a manager for assistance.
          </Alert>
        )}

        {step === 'select' && canProcessPayment && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {(['card', 'wallet', 'cash', 'split'] as const).map((method) => {
                  const labels: Record<PaymentMethod, string> = { card: 'Card', wallet: 'Wallet', cash: 'Cash', split: 'Split' };
                  const icons: Record<PaymentMethod, string> = {
                    card: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
                    wallet: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
                    cash: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
                    split: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
                  };
                  return (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-colors min-h-[44px] ${
                        paymentMethod === method
                          ? 'border-brand-blue bg-brand-blue/5 text-brand-navy'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icons[method]} />
                      </svg>
                      {labels[method]}
                    </button>
                  );
                })}
              </div>
            </div>

            {(paymentMethod === 'wallet' || paymentMethod === 'split') && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Wallet Balance</span>
                  {isLoadingWallet ? (
                    <span className="text-sm text-gray-400">Loading...</span>
                  ) : walletBalance !== null ? (
                    <span className={`text-sm font-semibold ${walletBalance >= totalCents ? 'text-brand-soft-green' : 'text-brand-coral'}`}>
                      {formatCents(walletBalance)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">Unavailable</span>
                  )}
                </div>
                {paymentMethod === 'wallet' && walletBalance !== null && walletBalance < totalCents && (
                  <p className="text-xs text-brand-coral mt-1">
                    Insufficient balance. Need {formatCents(totalCents - walletBalance)} more.
                  </p>
                )}
              </div>
            )}

            {paymentMethod === 'cash' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Received</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full pl-7 pr-3 py-3 border border-gray-300 rounded-lg text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
                  />
                </div>
                {cashReceivedCents > 0 && cashReceivedCents >= totalCents && (
                  <div className="mt-2 p-2 bg-brand-soft-green/10 rounded-md">
                    <span className="text-sm font-medium text-brand-soft-green">
                      Change due: {formatCents(changeDue)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'split' && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={walletSplitAmount}
                      onChange={(e) => setWalletSplitAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-3 border border-gray-300 rounded-lg text-base min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-blue focus:border-brand-blue"
                    />
                  </div>
                </div>
                {walletSplitCents > 0 && (
                  <div className="p-2 bg-gray-50 rounded-md">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Remaining (card/cash)</span>
                      <span className="font-medium text-brand-navy">{formatCents(cardSplitCents)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <Alert variant="error" className="mb-4">{error}</Alert>}

            <button
              onClick={handleConfirmPayment}
              disabled={(paymentMethod === 'wallet' && walletBalance !== null && walletBalance < totalCents) || isLoadingWallet}
              className="w-full min-h-[48px] px-4 py-3 bg-brand-blue text-white rounded-lg font-semibold text-base hover:bg-brand-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Confirm
            </button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <div className="mb-4 p-4 bg-brand-golden-yellow/10 border-2 border-brand-golden-yellow rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-1">Confirm Payment</p>
              <p className="text-3xl font-bold text-brand-navy">{formatCents(totalCents)}</p>
              <p className="text-sm text-gray-500 mt-1 capitalize">
                via {paymentMethod === 'split' ? 'Split (Wallet + Card)' : paymentMethod}
              </p>
            </div>
            {paymentMethod === 'cash' && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cash Received</span>
                  <span className="font-medium">{formatCents(cashReceivedCents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Change Due</span>
                  <span className="font-medium text-brand-soft-green">{formatCents(changeDue)}</span>
                </div>
              </div>
            )}
            {paymentMethod === 'split' && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">From Wallet</span>
                  <span className="font-medium">{formatCents(walletSplitCents)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">From Card/Cash</span>
                  <span className="font-medium">{formatCents(cardSplitCents)}</span>
                </div>
              </div>
            )}
            {error && <Alert variant="error" className="mb-4">{error}</Alert>}
            <div className="flex gap-3">
              <button
                onClick={() => { setStep('select'); setError(null); }}
                className="flex-1 min-h-[44px] px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleProcessPayment}
                disabled={isProcessing}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-brand-blue text-white rounded-lg font-semibold hover:bg-brand-blue-dark transition-colors disabled:opacity-50"
              >
                {isProcessing ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  `Charge ${formatCents(totalCents)}`
                )}
              </button>
            </div>
          </>
        )}

        {step === 'success' && paymentResult && (
          <div className="print:block" id="payment-receipt">
            <div className="mb-4 p-4 bg-brand-soft-green/10 border-2 border-brand-soft-green rounded-lg text-center">
              <svg className="w-12 h-12 text-brand-soft-green mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-bold text-brand-navy">Payment Successful</p>
              <p className="text-sm text-gray-500">Transaction {paymentResult.transactionId}</p>
            </div>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg space-y-2 text-sm">
              <div className="text-center border-b border-gray-200 pb-2 mb-2">
                <p className="font-heading font-bold text-brand-navy">Happy Tail Happy Dog</p>
                <p className="text-xs text-gray-400">4352 Cherokee St, Denver, CO 80216</p>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Customer</span>
                <span className="font-medium">{booking.customer.firstName} {booking.customer.lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Service</span>
                <span className="font-medium">{booking.serviceType.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Dogs</span>
                <span className="font-medium">{dogNames}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date</span>
                <span className="font-medium">{formatDateRange(booking.date, booking.endDate)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Method</span>
                  <span className="font-medium capitalize">{paymentResult.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-base font-bold mt-1">
                  <span className="text-brand-navy">Total Charged</span>
                  <span className="text-brand-navy">{formatCents(paymentResult.totalCharged)}</span>
                </div>
                {paymentResult.changeDue !== undefined && paymentResult.changeDue > 0 && (
                  <div className="flex justify-between text-brand-soft-green">
                    <span>Change Due</span>
                    <span className="font-medium">{formatCents(paymentResult.changeDue)}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 print:hidden">
              <button
                onClick={handlePrint}
                className="flex-1 min-h-[44px] px-4 py-2.5 border-2 border-brand-navy text-brand-navy rounded-lg font-medium hover:bg-brand-navy/5 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Receipt
              </button>
              <button
                onClick={onClose}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-brand-blue text-white rounded-lg font-semibold hover:bg-brand-blue-dark transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {step === 'error' && (
          <>
            <Alert variant="error" className="mb-4">
              <p className="font-medium">Payment Failed</p>
              <p className="text-sm mt-1">{error}</p>
            </Alert>
            <div className="flex gap-3">
              <button
                onClick={() => { setStep('select'); setError(null); }}
                className="flex-1 min-h-[44px] px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={onClose}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
