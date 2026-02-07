import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { checkoutApi } from '../lib/api';
import type { Booking, WalletResponse } from '../lib/api';
import { Button, Alert } from '../components/ui';

type PaymentTab = 'wallet' | 'card' | 'split';

export function CheckoutPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const booking = (location.state as { booking?: Booking } | null)?.booking ?? null;

  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);
  const [activeTab, setActiveTab] = useState<PaymentTab>('card');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');
  const [splitWalletCents, setSplitWalletCents] = useState(0);

  const totalCents = booking?.totalCents ?? 0;
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const formatDate = (dateString: string) => {
    const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours, 10);
    return `${h % 12 || 12}:${minutes} ${h >= 12 ? 'PM' : 'AM'}`;
  };

  const loadWallet = useCallback(async () => {
    setIsLoadingWallet(true);
    const { data } = await checkoutApi.getWallet();
    if (data) {
      setWallet(data);
      setSplitWalletCents(Math.min(data.balance_cents, totalCents));
      if (data.balance_cents >= totalCents && totalCents > 0) setActiveTab('wallet');
    }
    setIsLoadingWallet(false);
  }, [totalCents]);

  useEffect(() => { loadWallet(); }, [loadWallet]);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const handleCardNumberChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    setCardNumber(digits.replace(/(\d{4})(?=\d)/g, '$1 '));
  };

  const handleExpiryChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setCardExpiry(digits.length >= 3 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits);
  };

  const walletBalanceCents = wallet?.balance_cents ?? 0;
  const walletCoversTotal = walletBalanceCents >= totalCents;
  const isCardFormValid = cardNumber.replace(/\s/g, '').length === 16 && cardExpiry.length === 5 && cardCvv.length >= 3 && cardName.trim().length > 0;
  const splitCardCents = totalCents - splitWalletCents;

  const canPay = (() => {
    if (totalCents === 0) return false;
    if (activeTab === 'wallet') return walletCoversTotal;
    if (activeTab === 'card') return isCardFormValid;
    if (activeTab === 'split') return splitWalletCents > 0 && splitWalletCents <= walletBalanceCents && isCardFormValid;
    return false;
  })();

  const handlePay = async () => {
    if (!bookingId || !canPay) return;
    setIsProcessing(true);
    setError(null);

    const payload: { bookingIds: string[]; paymentMethod: 'wallet' | 'card' | 'split'; walletAmountCents?: number } = {
      bookingIds: [bookingId],
      paymentMethod: activeTab,
    };
    if (activeTab === 'split') payload.walletAmountCents = splitWalletCents;

    const { data, error: err } = await checkoutApi.checkout(payload);
    if (data) {
      navigate(`/checkout/confirmation/${data.paymentId}`, { state: { checkoutResult: data, booking } });
    } else if (err) {
      setError(err);
    }
    setIsProcessing(false);
  };

  if (!booking) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <header className="bg-white shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" aria-label="Go back">
                <svg className="w-6 h-6 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="flex-1 flex items-center justify-center gap-3">
                <img src="/logo.png" alt="Happy Tail Happy Dog" className="h-8" />
                <h1 className="font-heading text-lg font-bold text-brand-navy">Checkout</h1>
              </div>
              <div className="w-11" />
            </div>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-8">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-600 mb-4">Booking details not found. Please start from your bookings.</p>
            <Button onClick={() => navigate('/bookings')}>View My Bookings</Button>
          </div>
        </main>
      </div>
    );
  }

  const renderCardForm = () => (
    <div className="space-y-3">
      <div className="bg-brand-cream/50 rounded-xl p-3">
        <p className="text-xs text-gray-500 text-center">Payment simulation &#8212; no real charges will be made</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Card Number</label>
        <input type="text" inputMode="numeric" value={cardNumber} onChange={(e) => handleCardNumberChange(e.target.value)} placeholder="4242 4242 4242 4242" className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal min-h-[44px]" autoComplete="cc-number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expiry</label>
          <input type="text" inputMode="numeric" value={cardExpiry} onChange={(e) => handleExpiryChange(e.target.value)} placeholder="MM/YY" className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal min-h-[44px]" autoComplete="cc-exp" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
          <input type="text" inputMode="numeric" value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal min-h-[44px]" autoComplete="cc-csc" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cardholder Name</label>
        <input type="text" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="John Smith" className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal min-h-[44px]" autoComplete="cc-name" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-brand-cream">
      <header className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" aria-label="Go back">
              <svg className="w-6 h-6 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex-1 flex items-center justify-center gap-3">
              <img src="/logo.png" alt="Happy Tail Happy Dog" className="h-8" />
              <h1 className="font-heading text-lg font-bold text-brand-navy">Checkout</h1>
            </div>
            <div className="w-11" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        {/* Order Summary */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h2 className="font-heading text-lg font-bold text-brand-navy mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Order Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Service</span>
              <span className="font-semibold text-brand-navy">{booking.serviceType.displayName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Dog{booking.dogs.length > 1 ? 's' : ''}</span>
              <span className="font-semibold text-brand-navy">{booking.dogs.map((bd) => bd.dog.name).join(', ')}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Date</span>
              <span className="font-semibold text-brand-navy">{formatDate(booking.date)}</span>
            </div>
            {booking.startTime && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Time</span>
                <span className="font-semibold text-brand-navy">{formatTime(booking.startTime)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">{booking.serviceType.displayName}</span>
              <span className="text-brand-navy">{formatPrice(totalCents)}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-lg font-bold text-brand-navy">Total</span>
              <span className="text-2xl font-bold text-brand-navy">{formatPrice(totalCents)}</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h2 className="font-heading text-lg font-bold text-brand-navy mb-4">Payment Method</h2>
          <div className="flex rounded-xl bg-brand-cream p-1 mb-5">
            {(['wallet', 'card', 'split'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 px-2 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${activeTab === tab ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500 hover:text-brand-navy'}`}>
                {tab === 'wallet' ? 'Wallet' : tab === 'card' ? 'Card' : 'Split'}
              </button>
            ))}
          </div>

          {activeTab === 'wallet' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-brand-cream rounded-xl">
                <div className="w-12 h-12 bg-brand-soft-green/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-brand-soft-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Wallet Balance</p>
                  <p className="text-2xl font-bold text-brand-navy">{isLoadingWallet ? '...' : formatPrice(walletBalanceCents)}</p>
                </div>
              </div>
              {!isLoadingWallet && !walletCoversTotal && (
                <Alert variant="warning">Insufficient wallet balance. You need {formatPrice(totalCents - walletBalanceCents)} more. Try paying by card or using a split payment.</Alert>
              )}
              {walletCoversTotal && <p className="text-sm text-brand-soft-green font-medium text-center">Your wallet covers this payment in full.</p>}
            </div>
          )}

          {activeTab === 'card' && renderCardForm()}

          {activeTab === 'split' && (
            <div className="space-y-4">
              <div className="p-4 bg-brand-cream rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-soft-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    <span className="font-medium text-brand-navy">From Wallet</span>
                  </div>
                  <span className="text-sm text-gray-500">Balance: {isLoadingWallet ? '...' : formatPrice(walletBalanceCents)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">$</span>
                  <input type="number" min={0} max={Math.min(walletBalanceCents, totalCents) / 100} step={0.01} value={(splitWalletCents / 100).toFixed(2)} onChange={(e) => { const cents = Math.round(parseFloat(e.target.value || '0') * 100); setSplitWalletCents(Math.max(0, Math.min(cents, walletBalanceCents, totalCents))); }} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal min-h-[44px]" />
                </div>
                <div className="flex gap-2 mt-3">
                  {[25, 50, 75, 100].map((pct) => {
                    const amount = Math.min(Math.round(totalCents * pct / 100), walletBalanceCents);
                    return (
                      <button key={pct} onClick={() => setSplitWalletCents(amount)} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${splitWalletCents === amount ? 'bg-brand-teal text-white' : 'bg-white text-brand-navy border border-gray-200 hover:border-brand-teal'}`}>
                        {pct}%
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-brand-navy">Remaining on Card</span>
                  <span className="text-lg font-bold text-brand-navy">{formatPrice(splitCardCents)}</span>
                </div>
              </div>
              {splitCardCents > 0 && renderCardForm()}
            </div>
          )}
        </div>

        <Button className="w-full" size="lg" onClick={handlePay} disabled={!canPay || isProcessing} isLoading={isProcessing}>
          {activeTab === 'wallet' ? `Pay ${formatPrice(totalCents)} with Wallet` : `Pay ${formatPrice(totalCents)}`}
        </Button>
      </main>
    </div>
  );
}
