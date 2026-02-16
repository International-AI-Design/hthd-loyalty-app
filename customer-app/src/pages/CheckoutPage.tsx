import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { checkoutApi } from '../lib/api';
import type { Booking, WalletResponse } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { BottomNav } from '../components/BottomNav';
import { Button, Alert } from '../components/ui';

/** 1 point = $0.10 */
const POINTS_VALUE_CENTS = 10;

type PaymentTab = 'wallet' | 'card' | 'points' | 'split';

export function CheckoutPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { customer, refreshProfile } = useAuth();
  const stateBooking = (location.state as { booking?: Booking } | null)?.booking ?? null;
  const [fetchedBooking, setFetchedBooking] = useState<Booking | null>(null);
  const [isLoadingBooking, setIsLoadingBooking] = useState(!stateBooking);
  const booking = stateBooking ?? fetchedBooking;

  // Fetch booking from API if not passed via router state (deep link / refresh)
  useEffect(() => {
    if (stateBooking || !bookingId) return;
    setIsLoadingBooking(true);
    import('../lib/api').then(({ bookingApi }) => {
      bookingApi.getBookings().then(({ data }) => {
        if (data) {
          const found = data.bookings.find(b => b.id === bookingId) ?? null;
          setFetchedBooking(found);
        }
        setIsLoadingBooking(false);
      });
    });
  }, [stateBooking, bookingId]);

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

  // Points state
  const [pointsBalance, setPointsBalance] = useState(0);
  const [pointsToUse, setPointsToUse] = useState(0);

  // Wallet top-up state
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [topUpAmountCents, setTopUpAmountCents] = useState(0);
  const [isTopUpProcessing, setIsTopUpProcessing] = useState(false);
  const [topUpSuccess, setTopUpSuccess] = useState<string | null>(null);
  const [customTopUpValue, setCustomTopUpValue] = useState('');

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

  // Derived points calculations
  const pointsValueCents = pointsToUse * POINTS_VALUE_CENTS;
  const pointsNeededForTotal = Math.ceil(totalCents / POINTS_VALUE_CENTS);
  const pointsCoversTotal = pointsBalance >= pointsNeededForTotal;
  const pointsCardRemainder = Math.max(0, totalCents - pointsValueCents);

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

  const handleTopUp = async () => {
    if (topUpAmountCents <= 0) return;
    setIsTopUpProcessing(true);
    setError(null);
    const { data, error: err } = await checkoutApi.loadWalletFunds(topUpAmountCents);
    if (data) {
      await loadWallet();
      const msg = `Added ${formatPrice(topUpAmountCents)} to your wallet!`;
      setTopUpSuccess(msg);
      setShowAddFunds(false);
      setTopUpAmountCents(0);
      setCustomTopUpValue('');
      setTimeout(() => setTopUpSuccess(null), 3000);
    } else if (err) {
      setError(err);
    }
    setIsTopUpProcessing(false);
  };

  // Load points balance from customer profile
  useEffect(() => {
    if (customer) {
      setPointsBalance(customer.points_balance);
      // Default: use all points up to the total needed
      setPointsToUse(Math.min(customer.points_balance, pointsNeededForTotal));
    }
  }, [customer, pointsNeededForTotal]);

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
    if (activeTab === 'points') {
      if (pointsCoversTotal) return true; // Full points payment
      // Partial points + card
      return pointsToUse > 0 && pointsCardRemainder > 0 && isCardFormValid;
    }
    if (activeTab === 'split') return splitWalletCents > 0 && splitWalletCents <= walletBalanceCents && isCardFormValid;
    return false;
  })();

  const handlePay = async () => {
    if (!bookingId || !canPay) return;
    setIsProcessing(true);
    setError(null);

    const payload: {
      bookingIds: string[];
      paymentMethod: 'wallet' | 'card' | 'split' | 'points';
      walletAmountCents?: number;
      pointsToRedeem?: number;
    } = {
      bookingIds: [bookingId],
      paymentMethod: activeTab,
    };

    if (activeTab === 'split') {
      payload.walletAmountCents = splitWalletCents;
    } else if (activeTab === 'points') {
      if (pointsCoversTotal) {
        // Full points payment
        payload.pointsToRedeem = pointsNeededForTotal;
      } else {
        // Partial points + card = split with points
        payload.paymentMethod = 'split';
        payload.pointsToRedeem = pointsToUse;
      }
    }

    const { data, error: err } = await checkoutApi.checkout(payload);
    if (data) {
      // Refresh profile so points balance is updated
      refreshProfile();
      navigate(`/checkout/confirmation/${data.paymentId}`, { state: { checkoutResult: data, booking } });
    } else if (err) {
      setError(err);
    }
    setIsProcessing(false);
  };

  if (isLoadingBooking) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <header className="bg-white shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" aria-label="Go back">
                <svg className="w-6 h-6 text-brand-forest" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="flex-1 flex items-center justify-center gap-3">
                <img src="/logo.png" alt="Happy Tail Happy Dog" className="h-8" />
                <h1 className="font-heading text-lg font-bold text-brand-forest">Checkout</h1>
              </div>
              <div className="w-11" />
            </div>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-8 pb-24">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <p className="text-gray-600 mb-4">Booking details not found. Please start from your bookings.</p>
            <Button onClick={() => navigate('/bookings')}>View My Bookings</Button>
          </div>
        </main>
        <BottomNav />
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
        <input type="text" inputMode="numeric" value={cardNumber} onChange={(e) => handleCardNumberChange(e.target.value)} placeholder="4242 4242 4242 4242" className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary min-h-[44px]" autoComplete="cc-number" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Expiry</label>
          <input type="text" inputMode="numeric" value={cardExpiry} onChange={(e) => handleExpiryChange(e.target.value)} placeholder="MM/YY" className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary min-h-[44px]" autoComplete="cc-exp" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
          <input type="text" inputMode="numeric" value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary min-h-[44px]" autoComplete="cc-csc" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Cardholder Name</label>
        <input type="text" value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="John Smith" className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary min-h-[44px]" autoComplete="cc-name" />
      </div>
    </div>
  );

  const tabLabel = (tab: PaymentTab) => {
    switch (tab) {
      case 'wallet': return 'Wallet';
      case 'card': return 'Card';
      case 'points': return 'Points';
      case 'split': return 'Split';
    }
  };

  const payButtonLabel = () => {
    if (activeTab === 'wallet') return `Pay ${formatPrice(totalCents)} with Wallet`;
    if (activeTab === 'points') {
      if (pointsCoversTotal) return `Pay ${formatPrice(totalCents)} with Points`;
      return `Pay ${formatPrice(totalCents)} (Points + Card)`;
    }
    return `Pay ${formatPrice(totalCents)}`;
  };

  return (
    <div className="min-h-screen bg-brand-cream">
      <header className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" aria-label="Go back">
              <svg className="w-6 h-6 text-brand-forest" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div className="flex-1 flex items-center justify-center gap-3">
              <img src="/logo.png" alt="Happy Tail Happy Dog" className="h-8" />
              <h1 className="font-heading text-lg font-bold text-brand-forest">Checkout</h1>
            </div>
            <div className="w-11" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-5">
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        {/* Order Summary */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h2 className="font-heading text-lg font-bold text-brand-forest mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Order Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Service</span>
              <span className="font-semibold text-brand-forest">{booking.serviceType.displayName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Dog{booking.dogs.length > 1 ? 's' : ''}</span>
              <span className="font-semibold text-brand-forest">{booking.dogs.length > 0 ? booking.dogs.map((bd) => bd.dog.name).join(', ') : 'Not provided'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Date</span>
              <span className="font-semibold text-brand-forest">{formatDate(booking.date)}</span>
            </div>
            {booking.startTime && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Time</span>
                <span className="font-semibold text-brand-forest">{formatTime(booking.startTime)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">{booking.serviceType.displayName}</span>
              <span className="text-brand-forest">{formatPrice(totalCents)}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-lg font-bold text-brand-forest">Total</span>
              <span className="text-2xl font-bold text-brand-forest">{formatPrice(totalCents)}</span>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h2 className="font-heading text-lg font-bold text-brand-forest mb-4">Payment Method</h2>
          <div className="flex rounded-xl bg-brand-cream p-1 mb-5">
            {(['wallet', 'card', 'points', 'split'] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-3 px-2 rounded-lg text-sm font-semibold transition-all min-h-[44px] ${activeTab === tab ? 'bg-white text-brand-forest shadow-sm' : 'text-gray-500 hover:text-brand-forest'}`}>
                {tabLabel(tab)}
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
                  <p className="text-2xl font-bold text-brand-forest">{isLoadingWallet ? '...' : formatPrice(walletBalanceCents)}</p>
                </div>
              </div>

              {topUpSuccess && (
                <Alert variant="success">{topUpSuccess}</Alert>
              )}

              {!isLoadingWallet && !walletCoversTotal && (
                <>
                  <Alert variant="warning">Insufficient wallet balance. You need {formatPrice(totalCents - walletBalanceCents)} more.</Alert>
                  {!showAddFunds && (
                    <button
                      onClick={() => setShowAddFunds(true)}
                      className="w-full py-3 px-4 rounded-xl font-semibold text-white bg-brand-primary hover:opacity-90 transition-opacity min-h-[44px]"
                    >
                      Add Funds
                    </button>
                  )}
                </>
              )}

              {walletCoversTotal && <p className="text-sm text-brand-soft-green font-medium text-center">Your wallet covers this payment in full.</p>}

              {showAddFunds && !walletCoversTotal && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
                  <h3 className="font-heading text-base font-bold text-brand-forest">Add Funds to Wallet</h3>

                  {/* Preset amount buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      { label: '$25', cents: 2500 },
                      { label: '$50', cents: 5000 },
                      { label: '$100', cents: 10000 },
                      { label: 'Custom', cents: -1 },
                    ] as const).map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => {
                          if (opt.cents === -1) {
                            setTopUpAmountCents(0);
                            setCustomTopUpValue('');
                          } else {
                            setTopUpAmountCents(opt.cents);
                            setCustomTopUpValue('');
                          }
                        }}
                        className={`py-3 rounded-lg text-sm font-semibold transition-colors min-h-[44px] ${
                          (opt.cents === -1 && customTopUpValue !== '')
                            ? 'bg-brand-primary text-white'
                            : (opt.cents !== -1 && topUpAmountCents === opt.cents && customTopUpValue === '')
                              ? 'bg-brand-primary text-white'
                              : 'bg-white text-brand-forest border border-gray-200 hover:border-brand-primary'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom amount input — show when Custom is selected (topUpAmountCents is 0 and no preset match) or customTopUpValue has content */}
                  {(topUpAmountCents === 0 || customTopUpValue !== '') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Custom Amount</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-base">$</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min={5}
                          max={500}
                          step={0.01}
                          value={customTopUpValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomTopUpValue(val);
                            const parsed = parseFloat(val);
                            if (!isNaN(parsed) && parsed >= 5 && parsed <= 500) {
                              setTopUpAmountCents(Math.round(parsed * 100));
                            } else {
                              setTopUpAmountCents(0);
                            }
                          }}
                          placeholder="5.00 – 500.00"
                          className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary min-h-[44px]"
                        />
                      </div>
                      {customTopUpValue !== '' && (parseFloat(customTopUpValue) < 5 || parseFloat(customTopUpValue) > 500) && (
                        <p className="text-xs text-red-500 mt-1">Amount must be between $5 and $500</p>
                      )}
                    </div>
                  )}

                  {/* Card form for top-up payment */}
                  {topUpAmountCents > 0 && (
                    <>
                      <div className="border-t border-gray-200 pt-4">
                        {renderCardForm()}
                      </div>
                      <button
                        onClick={handleTopUp}
                        disabled={!isCardFormValid || isTopUpProcessing || topUpAmountCents <= 0}
                        className={`w-full py-3 px-4 rounded-xl font-semibold text-white min-h-[44px] transition-opacity ${
                          isCardFormValid && !isTopUpProcessing && topUpAmountCents > 0
                            ? 'bg-brand-primary hover:opacity-90'
                            : 'bg-gray-300 cursor-not-allowed'
                        }`}
                      >
                        {isTopUpProcessing ? 'Processing...' : `Add ${formatPrice(topUpAmountCents)} to Wallet`}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => { setShowAddFunds(false); setTopUpAmountCents(0); setCustomTopUpValue(''); }}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'card' && renderCardForm()}

          {/* Points Payment Tab */}
          {activeTab === 'points' && (
            <div className="space-y-4">
              {/* Points balance display */}
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: '#F5C65D15' }}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F5C65D30' }}>
                  <svg className="w-6 h-6" style={{ color: '#D4A843' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Your Points</p>
                  <p className="text-2xl font-bold text-brand-forest">
                    {pointsBalance.toLocaleString()} pts
                  </p>
                  <p className="text-sm" style={{ color: '#D4A843' }}>
                    Worth {formatPrice(pointsBalance * POINTS_VALUE_CENTS)}
                  </p>
                </div>
              </div>

              {pointsBalance === 0 ? (
                <Alert variant="warning">
                  You don't have any points yet. Earn points by booking services!
                </Alert>
              ) : pointsCoversTotal ? (
                <>
                  <div className="p-4 rounded-xl border-2" style={{ borderColor: '#F5C65D', backgroundColor: '#F5C65D10' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-brand-forest">Full Points Payment</p>
                        <p className="text-sm text-gray-600">
                          Using {pointsNeededForTotal.toLocaleString()} points ({formatPrice(totalCents)})
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F5C65D' }}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Remaining after payment: {(pointsBalance - pointsNeededForTotal).toLocaleString()} points
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Partial points: slider */}
                  <div className="p-4 rounded-xl" style={{ backgroundColor: '#F5C65D10' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-brand-forest">Points to Use</span>
                      <span className="text-sm font-semibold" style={{ color: '#D4A843' }}>
                        {pointsToUse.toLocaleString()} pts ({formatPrice(pointsValueCents)})
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={pointsBalance}
                      step={1}
                      value={pointsToUse}
                      onChange={(e) => setPointsToUse(parseInt(e.target.value, 10))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #F5C65D 0%, #F5C65D ${(pointsToUse / pointsBalance) * 100}%, #e5e7eb ${(pointsToUse / pointsBalance) * 100}%, #e5e7eb 100%)`,
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0 pts</span>
                      <span>{pointsBalance.toLocaleString()} pts</span>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Points applied</span>
                      <span className="font-medium" style={{ color: '#D4A843' }}>
                        -{formatPrice(pointsValueCents)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                      <span className="font-medium text-brand-forest">Remaining on Card</span>
                      <span className="font-bold text-brand-forest">{formatPrice(pointsCardRemainder)}</span>
                    </div>
                  </div>

                  {/* Card form for remainder */}
                  {pointsToUse > 0 && pointsCardRemainder > 0 && renderCardForm()}

                  {pointsToUse === 0 && (
                    <Alert variant="warning">
                      Use the slider above to select how many points to redeem.
                    </Alert>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'split' && (
            <div className="space-y-4">
              <div className="p-4 bg-brand-cream rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-soft-green" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    <span className="font-medium text-brand-forest">From Wallet</span>
                  </div>
                  <span className="text-sm text-gray-500">Balance: {isLoadingWallet ? '...' : formatPrice(walletBalanceCents)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">$</span>
                  <input type="number" min={0} max={Math.min(walletBalanceCents, totalCents) / 100} step={0.01} value={(splitWalletCents / 100).toFixed(2)} onChange={(e) => { const cents = Math.round(parseFloat(e.target.value || '0') * 100); setSplitWalletCents(Math.max(0, Math.min(cents, walletBalanceCents, totalCents))); }} className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary min-h-[44px]" />
                </div>
                <div className="flex gap-2 mt-3">
                  {[25, 50, 75, 100].map((pct) => {
                    const amount = Math.min(Math.round(totalCents * pct / 100), walletBalanceCents);
                    return (
                      <button key={pct} onClick={() => setSplitWalletCents(amount)} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors min-h-[36px] ${splitWalletCents === amount ? 'bg-brand-primary text-white' : 'bg-white text-brand-forest border border-gray-200 hover:border-brand-primary'}`}>
                        {pct}%
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-brand-forest">Remaining on Card</span>
                  <span className="text-lg font-bold text-brand-forest">{formatPrice(splitCardCents)}</span>
                </div>
              </div>
              {splitCardCents > 0 && renderCardForm()}
            </div>
          )}
        </div>

        <Button className="w-full" size="lg" onClick={handlePay} disabled={!canPay || isProcessing} isLoading={isProcessing}>
          {payButtonLabel()}
        </Button>
      </main>
      <BottomNav />
    </div>
  );
}
