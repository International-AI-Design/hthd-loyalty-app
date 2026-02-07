import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { customerApi, bookingApi } from '../lib/api';
import type { PointsTransaction, Redemption, ReferredCustomer, Dog, Visit, Booking } from '../lib/api';
import { Button, Modal, Alert, Toast } from '../components/ui';
import { ReferralModal } from '../components/ReferralModal';
import { Walkthrough } from '../components/Walkthrough';
import { AppShell } from '../components/AppShell';
import { useNavigate } from 'react-router-dom';

const POINTS_CAP = 500;

const REWARD_TIERS = [
  { points: 100, discount: 10 },
  { points: 250, discount: 25 },
  { points: 500, discount: 50 },
];

// --- Skeleton loaders ---

function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-brand-sand/60 rounded-2xl ${className}`} />;
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-5 space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonPulse key={i} className={`h-4 ${i === 0 ? 'w-1/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

// --- Main component ---

export function DashboardPage() {
  const { customer, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingRedemptions, setPendingRedemptions] = useState<Redemption[]>([]);
  const [completedRedemptions, setCompletedRedemptions] = useState<Redemption[]>([]);
  const [isLoadingRedemptions, setIsLoadingRedemptions] = useState(true);
  const [referralCount, setReferralCount] = useState(0);
  const [referralBonusPoints, setReferralBonusPoints] = useState(0);
  const [_referredCustomers, setReferredCustomers] = useState<ReferredCustomer[]>([]);
  const [_isLoadingReferrals, setIsLoadingReferrals] = useState(true);
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [isLoadingDogs, setIsLoadingDogs] = useState(true);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState(true);
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);

  // Redemption flow
  const [selectedTier, setSelectedTier] = useState<{ points: number; discount: number } | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redemptionCode, setRedemptionCode] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [redemptionError, setRedemptionError] = useState<string | null>(null);

  // Referral modal
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setIsToastVisible(true);
  }, []);

  // Walkthrough
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const WALKTHROUGH_KEY = 'hthd_walkthrough_seen';
  const HAS_VISITED_KEY = 'hthd_has_visited';

  // --- Fetch functions ---

  const fetchTransactions = useCallback(async () => {
    const { data } = await customerApi.getTransactions(10, 0);
    if (data) setTransactions(data.transactions);
    setIsLoadingTransactions(false);
  }, []);

  const fetchRedemptions = useCallback(async () => {
    const { data } = await customerApi.getRedemptions();
    if (data) {
      setPendingRedemptions(data.pending);
      setCompletedRedemptions(data.completed);
    }
    setIsLoadingRedemptions(false);
  }, []);

  const fetchReferralStats = useCallback(async () => {
    const { data } = await customerApi.getReferralStats();
    if (data) {
      setReferralCount(data.referral_count);
      setReferralBonusPoints(data.total_bonus_points);
      setReferredCustomers(data.referred_customers);
    }
    setIsLoadingReferrals(false);
  }, []);

  const fetchDogs = useCallback(async () => {
    const { data } = await customerApi.getDogs();
    if (data) setDogs(data.dogs);
    setIsLoadingDogs(false);
  }, []);

  const fetchVisits = useCallback(async () => {
    const { data } = await customerApi.getVisits(5, 0);
    if (data) setVisits(data.visits);
    setIsLoadingVisits(false);
  }, []);

  const fetchBookings = useCallback(async () => {
    const [pendingRes, confirmedRes] = await Promise.all([
      bookingApi.getBookings({ status: 'pending', limit: 2 }),
      bookingApi.getBookings({ status: 'confirmed', limit: 2 }),
    ]);
    const pending = pendingRes.data?.bookings || [];
    const confirmed = confirmedRes.data?.bookings || [];
    const combined = [...pending, ...confirmed]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
    setUpcomingBookings(combined);
    setIsLoadingBookings(false);
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchRedemptions();
    fetchReferralStats();
    fetchDogs();
    fetchVisits();
    fetchBookings();
  }, [fetchTransactions, fetchRedemptions, fetchReferralStats, fetchDogs, fetchVisits, fetchBookings]);

  // --- Scroll to top + first visit ---

  useEffect(() => {
    window.scrollTo(0, 0);
    const hasVisited = localStorage.getItem(HAS_VISITED_KEY);
    if (!hasVisited) {
      setIsFirstVisit(true);
      localStorage.setItem(HAS_VISITED_KEY, String(true));
    }
  }, []);

  // --- Walkthrough trigger ---

  const dataLoaded = customer && !isLoadingTransactions && !isLoadingRedemptions;

  useEffect(() => {
    if (!dataLoaded) return;
    const hasSeenWalkthrough = localStorage.getItem(WALKTHROUGH_KEY);
    const isFirstLogin = localStorage.getItem('hthd_first_login');
    if (!hasSeenWalkthrough && isFirstLogin) {
      setTimeout(() => setShowWalkthrough(true), 500);
      localStorage.removeItem('hthd_first_login');
    }
  }, [dataLoaded]);

  const handleWalkthroughComplete = () => {
    localStorage.setItem(WALKTHROUGH_KEY, 'true');
    setShowWalkthrough(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleWalkthroughSkip = () => {
    localStorage.setItem(WALKTHROUGH_KEY, 'true');
    setShowWalkthrough(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- Handlers ---

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refreshProfile(),
      fetchTransactions(),
      fetchRedemptions(),
      fetchReferralStats(),
      fetchDogs(),
      fetchVisits(),
      fetchBookings(),
    ]);
    setIsRefreshing(false);
    showToast('All caught up!');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleTierClick = (tier: { points: number; discount: number }) => {
    if (customer && customer.points_balance >= tier.points) {
      setSelectedTier(tier);
      setRedemptionError(null);
      setIsConfirmModalOpen(true);
    }
  };

  const handleConfirmRedemption = async () => {
    if (!selectedTier) return;
    setIsRedeeming(true);
    setRedemptionError(null);
    const { data, error } = await customerApi.requestRedemption(selectedTier.points);
    if (error) {
      setRedemptionError(error);
      setIsRedeeming(false);
      return;
    }
    if (data) {
      setRedemptionCode(data.redemption.redemption_code);
      setIsConfirmModalOpen(false);
      setIsSuccessModalOpen(true);
      refreshProfile();
      fetchTransactions();
      fetchRedemptions();
    }
    setIsRedeeming(false);
  };

  const handleCloseSuccessModal = () => {
    setIsSuccessModalOpen(false);
    setRedemptionCode(null);
    setSelectedTier(null);
  };

  const handleShareCode = async () => {
    if (!customer || isSharing) return;
    setIsSharing(true);
    const referralUrl = `${window.location.origin}/register?ref=${customer.referral_code}`;
    if (navigator.share) {
      const shareData = { title: 'Join Happy Tail Happy Dog Rewards!', url: referralUrl };
      try {
        if (navigator.canShare?.(shareData)) {
          await navigator.share(shareData);
        } else {
          await navigator.share({
            ...shareData,
            text: `Join me at Happy Tail Happy Dog! Use code ${customer.referral_code} for rewards.`,
          });
        }
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(referralUrl);
        showToast('Link copied to clipboard!');
      } catch {
        const textArea = document.createElement('textarea');
        textArea.value = referralUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showToast('Link copied to clipboard!');
      }
    }
    setTimeout(() => setIsSharing(false), 1000);
  };

  // --- Computed values ---

  const getNextRewardInfo = () => {
    const balance = customer?.points_balance || 0;
    for (const tier of REWARD_TIERS) {
      if (balance < tier.points) {
        return { needed: tier.points - balance, nextTier: tier.points, discount: tier.discount };
      }
    }
    return null;
  };

  const nextReward = getNextRewardInfo();

  const pointsProgress = useMemo(() => {
    if (!customer) return 0;
    const balance = customer.points_balance;
    // Find current tier bracket
    let prevTier = 0;
    for (const tier of REWARD_TIERS) {
      if (balance < tier.points) {
        return ((balance - prevTier) / (tier.points - prevTier)) * 100;
      }
      prevTier = tier.points;
    }
    return 100;
  }, [customer]);

  // Check for "pet day" — any booking today
  const todayBooking = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return upcomingBookings.find((b) => b.date === todayStr) || null;
  }, [upcomingBookings]);

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const formatDate = (dateString: string) => {
    const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateShort = (dateString: string) => {
    const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatRelativeDate = (dateString: string) => {
    const date = dateString.includes('T') ? new Date(dateString) : new Date(dateString + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return formatDateShort(dateString);
    return formatDate(dateString);
  };

  const getServiceEmoji = (type: string) => {
    const lower = type.toLowerCase();
    if (lower.includes('groom')) return '\u2728';
    if (lower.includes('board')) return '\u{1F319}';
    if (lower.includes('daycare') || lower.includes('day care')) return '\u2600\uFE0F';
    return '\u{1F43E}';
  };

  if (!customer) return null;

  // --- Render ---

  return (
    <AppShell
      headerRight={
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-xl hover:bg-brand-sand/50 transition-colors"
          aria-label="Refresh"
        >
          <svg
            className={`w-5 h-5 text-brand-forest ${isRefreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      }
    >
      <div className="px-4 pt-4 pb-8 space-y-5 font-body">

        {/* ============================================================
            SECTION 1: Hero - Greeting + Points Balance
            ============================================================ */}
        <section
          id="points-balance"
          className="animate-fade-in rounded-3xl shadow-warm-lg overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #62A2C3 0%, #3B7FA3 55%, #1B365D 100%)',
          }}
        >
          <div className="px-6 pt-6 pb-5">
            {/* Greeting row */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-white/70 font-body text-sm tracking-wide">
                  {greeting}
                </p>
                <button
                  onClick={() => navigate('/settings')}
                  className="font-heading text-2xl font-semibold text-white mt-0.5 text-left hover:text-white/90 transition-colors"
                >
                  {isFirstVisit ? 'Welcome!' : customer.first_name}
                </button>
              </div>
              {/* Decorative paw */}
              <button
                onClick={() => navigate('/my-pets')}
                className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-lg hover:bg-white/25 transition-colors"
              >
                {'\u{1F43E}'}
              </button>
            </div>

            {/* Points display */}
            <button
              onClick={() => navigate('/rewards')}
              className="w-full text-center py-3 hover:bg-white/5 rounded-2xl transition-colors"
            >
              <p className="text-white/60 text-xs font-body uppercase tracking-widest mb-1">
                Points Balance
              </p>
              <p className="text-5xl font-heading font-bold text-white tabular-nums leading-none">
                {customer.points_balance.toLocaleString()}
              </p>
              {nextReward && (
                <p className="text-white/70 text-sm mt-2 font-body">
                  {nextReward.needed} more to unlock ${nextReward.discount} off
                </p>
              )}
              {!nextReward && customer.points_balance >= POINTS_CAP && (
                <p className="text-white/80 text-sm mt-2 font-body font-medium">
                  Max points reached -- redeem below!
                </p>
              )}
            </button>
          </div>

          {/* Points cap warnings */}
          {customer.points_balance >= POINTS_CAP && (
            <div className="bg-white/15 backdrop-blur-sm px-6 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="text-lg flex-shrink-0">{'\u{1F389}'}</span>
                <p className="text-white/90 text-sm font-body">
                  You&apos;ve maxed out! Redeem your {POINTS_CAP} points for a $50 grooming discount to keep earning.
                </p>
              </div>
            </div>
          )}
          {customer.points_balance >= 450 && customer.points_balance < POINTS_CAP && (
            <div className="bg-white/10 backdrop-blur-sm px-6 py-3">
              <div className="flex items-center gap-2.5">
                <span className="text-lg flex-shrink-0">{'\u{1F525}'}</span>
                <p className="text-white/80 text-sm font-body">
                  Only {POINTS_CAP - customer.points_balance} points from the cap. Consider redeeming so you don&apos;t miss earning more!
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ============================================================
            SECTION 2: Pet Day Banner (if booking today)
            ============================================================ */}
        {todayBooking && (
          <section className="animate-slide-up">
            <button
              onClick={() => navigate('/bookings')}
              className="w-full bg-brand-sage/15 border-2 border-brand-sage/40 rounded-3xl p-5 text-left transition-all active:scale-[0.98] min-h-[44px]"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-brand-sage/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">{getServiceEmoji(todayBooking.serviceType.displayName)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-brand-sage animate-pulse-warm" />
                    <p className="font-body text-xs font-semibold uppercase tracking-wider text-brand-sage-dark">
                      Today&apos;s Pet Day
                    </p>
                  </div>
                  <p className="font-heading text-lg font-semibold text-brand-forest truncate">
                    {todayBooking.serviceType.displayName}
                  </p>
                  {todayBooking.dogs.length > 0 && (
                    <p className="font-pet text-sm text-brand-forest-muted mt-0.5">
                      {todayBooking.dogs.map((bd) => bd.dog.name).join(' & ')}
                    </p>
                  )}
                </div>
                <svg className="w-5 h-5 text-brand-sage-dark flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </section>
        )}

        {/* ============================================================
            SECTION 3: Quick Actions Grid
            ============================================================ */}
        <section className="animate-slide-up grid grid-cols-2 gap-3">
          {[
            {
              label: 'Reports',
              path: '/report-cards',
              color: 'bg-brand-amber/10',
              iconColor: 'text-brand-amber-dark',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ),
            },
            {
              label: 'Refer',
              action: () => setIsReferralModalOpen(true),
              color: 'bg-brand-primary/10',
              iconColor: 'text-brand-primary-dark',
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ),
            },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action || (() => navigate(item.path!))}
              className="flex flex-col items-center gap-2 py-3 rounded-2xl bg-white shadow-warm-sm border border-brand-sand/30 active:scale-95 transition-transform min-h-[76px]"
            >
              <div className={`w-11 h-11 rounded-xl ${item.color} flex items-center justify-center ${item.iconColor}`}>
                {item.icon}
              </div>
              <span className="text-xs font-body font-medium text-brand-forest">{item.label}</span>
            </button>
          ))}
        </section>

        {/* ============================================================
            SECTION 4: Upcoming Bookings
            ============================================================ */}
        {isLoadingBookings ? (
          <CardSkeleton lines={2} />
        ) : (
          <section className="animate-slide-up bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-semibold text-brand-forest">Upcoming</h2>
              {upcomingBookings.length > 0 && (
                <button
                  onClick={() => navigate('/bookings')}
                  className="text-sm font-body font-medium text-brand-primary hover:text-brand-primary-dark transition-colors min-h-[44px] flex items-center"
                >
                  View all
                </button>
              )}
            </div>

            {upcomingBookings.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 rounded-2xl bg-brand-cream mx-auto flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-brand-forest-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                  </svg>
                </div>
                <p className="text-brand-forest-muted font-body text-sm mb-2">No upcoming bookings</p>
                <button
                  onClick={() => navigate('/book')}
                  className="font-body text-sm font-semibold text-brand-primary hover:text-brand-primary-dark transition-colors min-h-[44px]"
                >
                  Book your first appointment
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingBookings.map((booking, idx) => (
                  <button
                    key={booking.id}
                    onClick={() => navigate('/bookings')}
                    className="w-full flex items-center gap-4 p-3.5 rounded-2xl bg-brand-cream/60 hover:bg-brand-cream transition-colors text-left min-h-[64px]"
                  >
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center gap-1 self-stretch py-1">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        booking.status === 'confirmed' ? 'bg-brand-sage' : 'bg-brand-amber'
                      }`} />
                      {idx < upcomingBookings.length - 1 && (
                        <div className="w-px flex-1 bg-brand-sand" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-semibold text-brand-forest text-sm">
                        {booking.serviceType.displayName}
                      </p>
                      <p className="font-body text-xs text-brand-forest-muted mt-0.5">
                        {formatRelativeDate(booking.date)}
                        {booking.dogs.length > 0 && (
                          <span className="font-pet"> &middot; {booking.dogs.map((bd) => bd.dog.name).join(', ')}</span>
                        )}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-body font-semibold capitalize ${
                      booking.status === 'confirmed'
                        ? 'bg-brand-sage/15 text-brand-sage-dark'
                        : 'bg-brand-amber/15 text-brand-amber-dark'
                    }`}>
                      {booking.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ============================================================
            SECTION 5: My Pups - Horizontal Scroll
            ============================================================ */}
        {isLoadingDogs ? (
          <CardSkeleton lines={2} />
        ) : (
          <section className="animate-slide-up">
            <div className="flex items-center justify-between mb-3 px-0.5">
              <h2 className="font-heading text-lg font-semibold text-brand-forest">My Pups</h2>
              {dogs.length > 0 && (
                <button
                  onClick={() => navigate('/my-pets')}
                  className="text-sm font-body font-medium text-brand-primary hover:text-brand-primary-dark transition-colors min-h-[44px] flex items-center"
                >
                  See all
                </button>
              )}
            </div>

            {dogs.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-5 text-center">
                <div className="w-14 h-14 rounded-2xl bg-brand-cream mx-auto flex items-center justify-center mb-3">
                  <span className="text-2xl">{'\u{1F436}'}</span>
                </div>
                <p className="text-brand-forest-muted font-body text-sm mb-2">No pups added yet</p>
                <button
                  onClick={() => navigate('/book')}
                  className="font-body text-sm font-semibold text-brand-primary hover:text-brand-primary-dark transition-colors min-h-[44px]"
                >
                  Add your dog when you book
                </button>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {dogs.map((dog) => (
                  <button
                    key={dog.id}
                    onClick={() => navigate(`/dogs/${dog.id}`)}
                    className="flex-shrink-0 w-28 flex flex-col items-center gap-2 p-4 bg-white rounded-3xl shadow-warm border border-brand-sand/50 active:scale-95 transition-transform min-h-[44px]"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary/80 to-brand-amber/70 flex items-center justify-center text-white font-heading font-bold text-xl shadow-warm-sm">
                      {dog.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-center w-full">
                      <p className="font-pet font-semibold text-brand-forest text-sm truncate">
                        {dog.name}
                      </p>
                      {dog.breed && (
                        <p className="font-body text-[11px] text-brand-forest-muted truncate mt-0.5">
                          {dog.breed}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ============================================================
            SECTION 6: Rewards Progress
            ============================================================ */}
        <section id="reward-tiers" className="animate-slide-up bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg font-semibold text-brand-forest">Rewards</h2>
            {pendingRedemptions.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-amber/15 text-brand-amber-dark text-xs font-body font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-amber" />
                {pendingRedemptions.length} active
              </span>
            )}
          </div>

          {/* Progress bar to next tier */}
          {nextReward && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-body text-brand-forest-muted">
                  {customer.points_balance} pts
                </span>
                <span className="text-xs font-body font-semibold text-brand-primary">
                  {nextReward.nextTier} pts = ${nextReward.discount} off
                </span>
              </div>
              <div className="h-3 bg-brand-sand/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.max(pointsProgress, 4)}%`,
                    background: 'linear-gradient(90deg, #62A2C3, #1B365D)',
                  }}
                />
              </div>
              <p className="text-xs font-body text-brand-forest-muted mt-1.5 text-center">
                {nextReward.needed} points to go
              </p>
            </div>
          )}

          {/* Tier cards */}
          <div className="grid grid-cols-3 gap-2.5">
            {REWARD_TIERS.map((tier) => {
              const canAfford = customer.points_balance >= tier.points;
              return (
                <button
                  key={tier.points}
                  onClick={() => handleTierClick(tier)}
                  disabled={!canAfford}
                  className={`rounded-2xl p-3.5 border-2 transition-all text-center min-h-[44px] ${
                    canAfford
                      ? 'border-brand-primary/30 bg-brand-cream/50 hover:border-brand-primary hover:shadow-warm active:scale-95 cursor-pointer'
                      : 'border-brand-sand/50 bg-brand-sand/20 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <p className={`text-2xl font-heading font-bold ${canAfford ? 'text-brand-forest' : 'text-brand-forest-muted'}`}>
                    ${tier.discount}
                  </p>
                  <p className="text-[11px] font-body text-brand-forest-muted mt-0.5">off grooming</p>
                  <div className="mt-2 pt-2 border-t border-brand-sand/50">
                    <p className={`text-xs font-body font-semibold ${canAfford ? 'text-brand-primary' : 'text-brand-forest-muted'}`}>
                      {tier.points} pts
                    </p>
                    {canAfford ? (
                      <p className="text-[10px] font-body font-semibold text-brand-sage-dark mt-0.5">
                        Tap to redeem
                      </p>
                    ) : (
                      <p className="text-[10px] font-body text-brand-forest-muted mt-0.5">
                        {(tier.points - customer.points_balance).toLocaleString()} more
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active redemption codes inline */}
          {!isLoadingRedemptions && pendingRedemptions.length > 0 && (
            <div className="mt-5 space-y-3">
              <p className="text-xs font-body font-semibold text-brand-forest-muted uppercase tracking-wider">
                Active Codes
              </p>
              {pendingRedemptions.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-brand-amber/8 border border-brand-amber/25"
                >
                  <div>
                    <p className="font-mono font-bold text-brand-forest tracking-wider text-lg">
                      {r.redemption_code}
                    </p>
                    <p className="text-xs font-body text-brand-forest-muted mt-0.5">
                      ${r.discount_value} off &middot; Show at checkout
                    </p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-brand-amber/15 text-brand-amber-dark text-[11px] font-body font-semibold">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Redemption history */}
          {completedRedemptions.length > 0 && (
            <div className="mt-4 pt-4 border-t border-brand-sand/50">
              <p className="text-xs font-body font-semibold text-brand-forest-muted uppercase tracking-wider mb-3">
                History
              </p>
              <div className="space-y-2">
                {completedRedemptions.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-brand-sage/15 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-brand-sage-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-body text-brand-forest">${r.discount_value} discount</p>
                        <p className="text-[11px] font-body text-brand-forest-muted">
                          {formatDate(r.approved_at || r.created_at)}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs font-body text-brand-forest-muted">
                      -{r.reward_tier.toLocaleString()} pts
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ============================================================
            SECTION 7: Refer Friends Banner
            ============================================================ */}
        <section id="refer-tile" className="animate-slide-up">
          <button
            onClick={() => setIsReferralModalOpen(true)}
            className="w-full rounded-3xl shadow-warm border border-brand-sand/50 overflow-hidden text-left active:scale-[0.98] transition-transform min-h-[88px]"
            style={{
              background: 'linear-gradient(135deg, #8BA888 0%, #6F8E6C 100%)',
            }}
          >
            <div className="px-6 py-5 flex items-center gap-4">
              <div className="flex-1">
                <h3 className="font-heading text-lg font-semibold text-white">
                  Share the love
                </h3>
                <p className="font-body text-sm text-white/75 mt-1">
                  Invite friends, earn 100 points each
                </p>
                {referralCount > 0 && (
                  <p className="font-body text-xs text-white/60 mt-1.5">
                    {referralCount} {referralCount === 1 ? 'friend' : 'friends'} referred &middot; +{referralBonusPoints} pts earned
                  </p>
                )}
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </button>
        </section>

        {/* ============================================================
            SECTION 8: Recent Visits
            ============================================================ */}
        {isLoadingVisits ? (
          <CardSkeleton />
        ) : visits.length > 0 && (
          <section className="animate-slide-up bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-5">
            <h2 className="font-heading text-lg font-semibold text-brand-forest mb-4">Recent Visits</h2>
            <div className="space-y-3">
              {visits.map((visit) => (
                <div
                  key={visit.id}
                  className="flex items-center justify-between py-3 border-b border-brand-sand/30 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      visit.service_type === 'grooming'
                        ? 'bg-brand-amber/12'
                        : visit.service_type === 'boarding'
                        ? 'bg-brand-sage/12'
                        : 'bg-brand-primary/10'
                    }`}>
                      <span className="text-base">
                        {getServiceEmoji(visit.service_type)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-body text-sm font-medium text-brand-forest capitalize truncate">
                        {visit.service_type}
                        {visit.description && (
                          <span className="text-brand-forest-muted font-normal"> &middot; {visit.description}</span>
                        )}
                      </p>
                      <p className="font-body text-xs text-brand-forest-muted mt-0.5">
                        {formatDate(visit.visit_date)} &middot; ${visit.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <span className="font-body text-sm font-semibold text-brand-sage-dark flex-shrink-0 ml-3">
                    +{visit.points_earned} pts
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ============================================================
            SECTION 9: Recent Activity (Transactions)
            ============================================================ */}
        {isLoadingTransactions ? (
          <CardSkeleton />
        ) : transactions.length > 0 && (
          <section className="animate-slide-up bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-5">
            <h2 className="font-heading text-lg font-semibold text-brand-forest mb-4">Activity</h2>
            <div className="space-y-2.5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between py-2.5 border-b border-brand-sand/30 last:border-0 last:pb-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-brand-forest truncate">{tx.description}</p>
                    <p className="font-body text-xs text-brand-forest-muted mt-0.5">{formatDate(tx.date)}</p>
                  </div>
                  <span className={`font-body text-sm font-semibold flex-shrink-0 ml-3 tabular-nums ${
                    tx.points_amount > 0 ? 'text-brand-sage-dark' : 'text-brand-error'
                  }`}>
                    {tx.points_amount > 0 ? '+' : ''}{tx.points_amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ============================================================
            SECTION 10: Sign Out
            ============================================================ */}
        <section className="pt-4 pb-2">
          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 font-body text-sm text-brand-forest-muted hover:text-brand-error font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px] rounded-2xl"
          >
            <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </section>
      </div>

      {/* =============================================================
          MODALS
          ============================================================= */}

      {/* Confirm Redemption Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Redemption"
      >
        {selectedTier && (
          <div className="space-y-4">
            <p className="font-body text-brand-forest">
              You are about to redeem <span className="font-semibold">{selectedTier.points.toLocaleString()} points</span> for
              a <span className="font-semibold text-brand-sage-dark">${selectedTier.discount} grooming discount</span>.
            </p>
            <p className="font-body text-sm text-brand-forest-muted">
              This will create a redemption code that you can show at checkout. Points will be deducted when you use the code.
            </p>
            {redemptionError && (
              <Alert variant="error">{redemptionError}</Alert>
            )}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isRedeeming}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmRedemption}
                isLoading={isRedeeming}
              >
                Confirm Redemption
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={isSuccessModalOpen}
        onClose={handleCloseSuccessModal}
        title="Redemption Code Ready!"
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-brand-sage/15 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-brand-sage-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-body text-brand-forest mb-4">
              Show this code at checkout to receive your{' '}
              <span className="font-semibold text-brand-sage-dark">${selectedTier?.discount} discount</span>:
            </p>
            <div className="bg-brand-cream rounded-2xl p-4 mb-4 border border-brand-sand/50">
              <p className="text-3xl font-mono font-bold text-brand-forest tracking-wider">
                {redemptionCode}
              </p>
            </div>
            <p className="text-sm font-body text-brand-forest-muted">
              This code is pending and will be completed when you use it at checkout.
            </p>
          </div>
          <Button className="w-full" onClick={handleCloseSuccessModal}>
            Done
          </Button>
        </div>
      </Modal>

      {/* Referral Modal */}
      <ReferralModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
        referralCode={customer.referral_code}
        referralCount={referralCount}
        bonusPoints={referralBonusPoints}
        onShare={handleShareCode}
      />

      {/* First-Login Walkthrough */}
      {showWalkthrough && (
        <Walkthrough
          steps={[
            {
              targetId: 'points-balance',
              title: 'Your Points Balance',
              message: "You've got 25 points just for signing up! Earn more with every visit.",
            },
            {
              targetId: 'reward-tiers',
              title: 'Redeem Rewards',
              message: nextReward
                ? `You're only ${nextReward.needed} points away from a $${nextReward.discount} discount!`
                : 'You have enough points to redeem a reward right now!',
            },
            {
              targetId: 'refer-tile',
              title: 'Invite Friends',
              message: 'Share with friends and earn 100 bonus points for each one who joins!',
            },
          ]}
          onComplete={handleWalkthroughComplete}
          onSkip={handleWalkthroughSkip}
        />
      )}

      {/* Toast */}
      <Toast
        message={toastMessage}
        isVisible={isToastVisible}
        onHide={() => setIsToastVisible(false)}
      />
    </AppShell>
  );
}
