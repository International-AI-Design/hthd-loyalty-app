import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { customerApi } from '../lib/api';
import type { PointsTransaction, Redemption, ReferredCustomer } from '../lib/api';
import { AppShell } from '../components/AppShell';
import { Button, Modal, Toast } from '../components/ui';

const REWARD_TIERS = [
  { points: 100, discount: 10, label: 'Bronze' },
  { points: 250, discount: 25, label: 'Silver' },
  { points: 500, discount: 50, label: 'Gold' },
];

function formatDate(dateString: string): string {
  const date = dateString.includes('T')
    ? new Date(dateString)
    : new Date(dateString + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = prevRef.current;
    const end = value;
    const diff = end - start;
    if (diff === 0) return;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = end;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

export function RewardsPage() {
  const { customer, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [pendingRedemptions, setPendingRedemptions] = useState<Redemption[]>([]);
  const [completedRedemptions, setCompletedRedemptions] = useState<Redemption[]>([]);
  const [isLoadingRedemptions, setIsLoadingRedemptions] = useState(true);
  const [referralCount, setReferralCount] = useState(0);
  const [referralBonusPoints, setReferralBonusPoints] = useState(0);
  const [referredCustomers, setReferredCustomers] = useState<ReferredCustomer[]>([]);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(true);

  // Redemption flow states
  const [selectedTier, setSelectedTier] = useState<(typeof REWARD_TIERS)[number] | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [_redemptionCode, setRedemptionCode] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [redemptionError, setRedemptionError] = useState<string | null>(null);

  // Activity feed expansion
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Toast + share
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setIsToastVisible(true);
  }, []);

  // Data fetching
  const fetchTransactions = useCallback(async () => {
    const { data } = await customerApi.getTransactions(20, 0);
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

  useEffect(() => {
    fetchTransactions();
    fetchRedemptions();
    fetchReferralStats();
  }, [fetchTransactions, fetchRedemptions, fetchReferralStats]);

  // Redemption flow
  const handleTierClick = (tier: (typeof REWARD_TIERS)[number]) => {
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

  // Referral sharing
  const handleShareCode = async () => {
    if (!customer || isSharing) return;
    setIsSharing(true);

    const referralUrl = `${window.location.origin}/register?ref=${customer.referral_code}`;

    if (navigator.share) {
      const shareData = {
        title: 'Join Happy Tail Happy Dog Rewards!',
        url: referralUrl,
      };
      try {
        if (navigator.canShare?.(shareData)) {
          await navigator.share(shareData);
        } else {
          await navigator.share({
            ...shareData,
            text: `Join me at Happy Tail Happy Dog! Use code ${customer.referral_code} for rewards.`,
          });
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
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

  if (!customer) return null;

  const balance = customer.points_balance;

  // Calculate progress to next tier
  const getProgressInfo = () => {
    for (const tier of REWARD_TIERS) {
      if (balance < tier.points) {
        return {
          currentPoints: balance,
          nextTierPoints: tier.points,
          nextTierDiscount: tier.discount,
          nextTierLabel: tier.label,
          progress: (balance / tier.points) * 100,
          pointsNeeded: tier.points - balance,
        };
      }
    }
    // Maxed out
    return {
      currentPoints: balance,
      nextTierPoints: REWARD_TIERS[REWARD_TIERS.length - 1].points,
      nextTierDiscount: REWARD_TIERS[REWARD_TIERS.length - 1].discount,
      nextTierLabel: 'Gold',
      progress: 100,
      pointsNeeded: 0,
    };
  };

  const progressInfo = getProgressInfo();

  // Determine current tier label
  const getCurrentTierLabel = () => {
    if (balance >= 500) return 'Gold';
    if (balance >= 250) return 'Silver';
    if (balance >= 100) return 'Bronze';
    return 'Member';
  };

  const currentTierLabel = getCurrentTierLabel();

  return (
    <AppShell title="Rewards" showBack>
      <div className="px-4 pt-6 pb-8 space-y-6">

        {/* ==============================
            POINTS BALANCE HERO
            ============================== */}
        <div className="bg-gradient-to-br from-brand-primary via-brand-primary-dark to-brand-amber-dark
          rounded-3xl shadow-warm-lg p-6 text-center relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 mb-3">
              <svg className="w-3.5 h-3.5 text-brand-amber-light" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <span className="text-white/90 text-xs font-semibold tracking-wide uppercase">{currentTierLabel}</span>
            </div>

            <p className="text-white/70 text-sm font-medium uppercase tracking-wider">Your Points</p>
            <p className="text-5xl sm:text-6xl font-heading font-bold text-white mt-1 tabular-nums">
              <AnimatedCounter value={balance} />
            </p>
            <p className="text-white/60 text-sm mt-1">points available</p>
          </div>
        </div>

        {/* ==============================
            PROGRESS BAR TO NEXT TIER
            ============================== */}
        <div className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-heading text-base font-semibold text-brand-forest">
              {progressInfo.pointsNeeded > 0
                ? 'Next Reward'
                : 'Max Tier Reached!'
              }
            </h3>
            {progressInfo.pointsNeeded > 0 && (
              <span className="text-sm font-medium text-brand-primary">
                {progressInfo.pointsNeeded} pts to go
              </span>
            )}
          </div>

          {/* Tier markers */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5 text-[10px] text-brand-forest-muted font-medium">
              <span>0</span>
              {REWARD_TIERS.map((tier) => (
                <span key={tier.points} className={balance >= tier.points ? 'text-brand-primary font-bold' : ''}>
                  {tier.points}
                </span>
              ))}
            </div>

            {/* Track */}
            <div className="w-full h-3 bg-brand-sand/60 rounded-full overflow-hidden relative">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-amber transition-all duration-1000 ease-out"
                style={{ width: `${Math.min((balance / 500) * 100, 100)}%` }}
              />
              {/* Tier markers on track */}
              {REWARD_TIERS.map((tier) => (
                <div
                  key={tier.points}
                  className="absolute top-0 h-full w-0.5 bg-white/60"
                  style={{ left: `${(tier.points / 500) * 100}%` }}
                />
              ))}
            </div>
          </div>

          {progressInfo.pointsNeeded > 0 && (
            <p className="text-xs text-brand-forest-muted mt-2.5">
              Earn {progressInfo.pointsNeeded} more points to unlock a{' '}
              <span className="font-semibold text-brand-primary">${progressInfo.nextTierDiscount} discount</span>
            </p>
          )}
        </div>

        {/* ==============================
            REWARD TIER CARDS
            ============================== */}
        <div>
          <h3 className="font-heading text-lg font-semibold text-brand-forest mb-3 px-1">
            Redeem Points
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {REWARD_TIERS.map((tier) => {
              const canAfford = balance >= tier.points;
              return (
                <button
                  key={tier.points}
                  onClick={() => handleTierClick(tier)}
                  disabled={!canAfford}
                  className={`rounded-3xl p-4 border-2 transition-all duration-200 text-center min-h-[140px]
                    flex flex-col items-center justify-center gap-1
                    ${canAfford
                      ? 'border-brand-primary/30 bg-white shadow-warm hover:shadow-warm-lg hover:border-brand-primary active:scale-[0.97] cursor-pointer'
                      : 'border-brand-sand bg-brand-cream/50 opacity-60 cursor-not-allowed'
                    }`}
                >
                  {/* Tier icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${
                    canAfford ? 'bg-brand-primary/10' : 'bg-brand-sand/60'
                  }`}>
                    <svg
                      className={`w-5 h-5 ${canAfford ? 'text-brand-primary' : 'text-brand-forest-muted'}`}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>

                  <p className={`text-2xl font-heading font-bold ${canAfford ? 'text-brand-forest' : 'text-brand-forest-muted'}`}>
                    ${tier.discount}
                  </p>
                  <p className="text-[11px] text-brand-forest-muted leading-tight">
                    {tier.label}
                  </p>
                  <div className="mt-1 pt-1 border-t border-brand-sand/40 w-full">
                    <p className={`text-xs font-semibold ${canAfford ? 'text-brand-primary' : 'text-brand-forest-muted'}`}>
                      {tier.points} pts
                    </p>
                    {!canAfford && (
                      <p className="text-[10px] text-brand-forest-muted mt-0.5">
                        {tier.points - balance} more
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ==============================
            PENDING REDEMPTIONS
            ============================== */}
        {isLoadingRedemptions ? (
          <div className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-6">
            <div className="flex justify-center py-6">
              <div className="w-8 h-8 rounded-full border-3 border-brand-sand border-t-brand-primary animate-spin" />
            </div>
          </div>
        ) : pendingRedemptions.length > 0 && (
          <div>
            <h3 className="font-heading text-lg font-semibold text-brand-forest mb-3 px-1">
              Active Rewards
            </h3>
            <div className="space-y-3">
              {pendingRedemptions.map((redemption) => (
                <div
                  key={redemption.id}
                  className="bg-white rounded-3xl shadow-warm border-2 border-brand-amber/30 p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-amber/10 text-brand-amber-dark">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-amber animate-pulse" />
                      Ready to Use
                    </span>
                    <span className="text-xs text-brand-forest-muted">
                      {formatDate(redemption.created_at)}
                    </span>
                  </div>
                  <div className="text-center py-2">
                    <p className="text-lg font-heading font-semibold text-brand-sage">
                      ${redemption.discount_value} grooming discount
                    </p>
                    <p className="text-xs text-brand-forest-muted mt-1">
                      {redemption.reward_tier.toLocaleString()} points redeemed
                    </p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-brand-sand/30 text-center space-y-2">
                    <p className="text-xs text-brand-forest-muted">
                      This discount will be automatically applied at checkout.
                    </p>
                    <button
                      onClick={() => navigate('/book')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-semibold
                        bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20
                        transition-colors duration-200 min-h-[44px]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                      Book Now to Use Discount
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==============================
            COMPLETED REDEMPTIONS
            ============================== */}
        {!isLoadingRedemptions && completedRedemptions.length > 0 && (
          <div>
            <h3 className="font-heading text-lg font-semibold text-brand-forest mb-3 px-1">
              Redemption History
            </h3>
            <div className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 overflow-hidden">
              {completedRedemptions.map((redemption, i) => (
                <div
                  key={redemption.id}
                  className={`flex items-center justify-between px-5 py-4 ${
                    i < completedRedemptions.length - 1 ? 'border-b border-brand-sand/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-brand-sage/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4.5 h-4.5 text-brand-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-brand-forest text-sm">
                        ${redemption.discount_value} discount used
                      </p>
                      <p className="text-xs text-brand-forest-muted truncate">
                        {redemption.redemption_code} &middot; {formatDate(redemption.approved_at || redemption.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-brand-forest-muted flex-shrink-0 ml-2">
                    -{redemption.reward_tier.toLocaleString()} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==============================
            REFERRAL SECTION
            ============================== */}
        <div className="bg-gradient-to-br from-brand-sage/20 to-brand-sage/5 rounded-3xl border border-brand-sage/20 p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-sage/15 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-brand-sage-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-heading text-lg font-semibold text-brand-forest">
                Refer Friends
              </h3>
              <p className="text-sm text-brand-forest-light mt-0.5">
                Earn 100 bonus points for each friend who joins
              </p>
            </div>
          </div>

          {/* Referral code + share button */}
          <div className="mt-4 bg-white rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-brand-forest-muted font-semibold">Your Code</p>
                <p className="text-xl font-mono font-bold text-brand-forest tracking-wider mt-0.5">
                  {customer.referral_code}
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleShareCode}
                disabled={isSharing}
                className="flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                </svg>
                Share
              </Button>
            </div>
          </div>

          {/* Referral stats */}
          {!isLoadingReferrals && referralCount > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-3 text-center">
                <p className="text-2xl font-heading font-bold text-brand-forest">{referralCount}</p>
                <p className="text-[11px] text-brand-forest-muted">Friends Referred</p>
              </div>
              <div className="bg-white rounded-2xl p-3 text-center">
                <p className="text-2xl font-heading font-bold text-brand-sage">+{referralBonusPoints.toLocaleString()}</p>
                <p className="text-[11px] text-brand-forest-muted">Bonus Points</p>
              </div>
            </div>
          )}

          {/* Referred customers list */}
          {!isLoadingReferrals && referredCustomers.length > 0 && (
            <div className="mt-3 space-y-2">
              {referredCustomers.map((referral) => (
                <div
                  key={referral.id}
                  className="flex items-center justify-between bg-white rounded-xl px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-brand-sage/15 flex items-center justify-center text-brand-sage-dark font-semibold text-xs">
                      {referral.first_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-brand-forest text-sm">{referral.first_name}</span>
                  </div>
                  <span className="text-xs text-brand-forest-muted">
                    {formatDate(referral.joined_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ==============================
            POINTS HISTORY
            ============================== */}
        <div>
          <h3 className="font-heading text-lg font-semibold text-brand-forest mb-3 px-1">
            Points History
          </h3>

          {isLoadingTransactions ? (
            <div className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-6">
              <div className="flex justify-center py-6">
                <div className="w-8 h-8 rounded-full border-3 border-brand-sand border-t-brand-primary animate-spin" />
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-brand-cream rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-brand-forest-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-brand-forest-muted text-sm">No transactions yet</p>
              <p className="text-brand-forest-muted/70 text-xs mt-1">Visit us to start earning points!</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-warm border border-brand-sand/50 overflow-hidden">
              {transactions.map((tx, i) => {
                const isPurchase = tx.type === 'purchase' || tx.type === 'earn' || tx.type === 'booking';
                const isRedemption = tx.type === 'redemption' || tx.type === 'redeem';
                const isExpandable = isPurchase || isRedemption;
                const isExpanded = expandedTxId === tx.id;

                return (
                  <div
                    key={tx.id}
                    className={`${
                      i < transactions.length - 1 ? 'border-b border-brand-sand/20' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => isExpandable ? setExpandedTxId(isExpanded ? null : tx.id) : undefined}
                      className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors duration-150 ${
                        isExpandable ? 'cursor-pointer hover:bg-brand-cream/40 active:bg-brand-cream/60' : 'cursor-default'
                      }`}
                      aria-expanded={isExpandable ? isExpanded : undefined}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          tx.points_amount > 0
                            ? 'bg-brand-sage/10'
                            : 'bg-brand-error/10'
                        }`}>
                          {tx.points_amount > 0 ? (
                            <svg className="w-4 h-4 text-brand-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19.5v-15m0 0l-6.75 6.75M12 4.5l6.75 6.75" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-brand-error" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-brand-forest truncate">{tx.description}</p>
                          <p className="text-xs text-brand-forest-muted">{formatDate(tx.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span className={`text-sm font-bold tabular-nums ${
                          tx.points_amount > 0 ? 'text-brand-sage-dark' : 'text-brand-error'
                        }`}>
                          {tx.points_amount > 0 ? '+' : ''}{tx.points_amount.toLocaleString()}
                        </span>
                        {isExpandable && (
                          <svg
                            className={`w-4 h-4 text-brand-forest-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </div>
                    </button>
                    {/* Expandable detail panel */}
                    {isExpandable && isExpanded && (
                      <div className="px-5 pb-4 pt-0">
                        <div className="bg-brand-cream/60 rounded-2xl p-4 space-y-2">
                          <div className="flex justify-between text-xs">
                            <span className="text-brand-forest-muted">Date</span>
                            <span className="text-brand-forest font-medium">{formatDate(tx.date)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-brand-forest-muted">Type</span>
                            <span className="text-brand-forest font-medium capitalize">
                              {isPurchase ? 'Service Purchase' : 'Points Redemption'}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-brand-forest-muted">Points {tx.points_amount > 0 ? 'Earned' : 'Used'}</span>
                            <span className={`font-semibold ${tx.points_amount > 0 ? 'text-brand-sage-dark' : 'text-brand-error'}`}>
                              {tx.points_amount > 0 ? '+' : ''}{tx.points_amount.toLocaleString()} pts
                            </span>
                          </div>
                          {isPurchase && tx.points_amount > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-brand-forest-muted">Est. Amount Paid</span>
                              <span className="text-brand-forest font-medium">
                                ${(tx.points_amount).toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs">
                            <span className="text-brand-forest-muted">Description</span>
                            <span className="text-brand-forest font-medium text-right max-w-[60%]">{tx.description}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Earn more CTA */}
        <div className="pt-2">
          <button
            onClick={() => navigate('/book')}
            className="w-full bg-brand-cream hover:bg-brand-sand rounded-3xl border border-brand-sand/50
              p-5 flex items-center justify-center gap-3 transition-all duration-200
              min-h-[56px] active:scale-[0.98]"
          >
            <svg className="w-5 h-5 text-brand-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="font-semibold text-brand-forest text-sm">Book a visit to earn more points</span>
          </button>
        </div>
      </div>

      {/* ==============================
          CONFIRMATION MODAL
          ============================== */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Redemption"
      >
        {selectedTier && (
          <div className="space-y-4">
            <div className="bg-brand-cream rounded-2xl p-4 text-center">
              <p className="text-3xl font-heading font-bold text-brand-forest">${selectedTier.discount}</p>
              <p className="text-sm text-brand-forest-muted mt-1">grooming discount</p>
            </div>
            <p className="text-brand-forest-light text-sm">
              You are about to redeem{' '}
              <span className="font-semibold text-brand-forest">{selectedTier.points.toLocaleString()} points</span>{' '}
              for a{' '}
              <span className="font-semibold text-brand-sage">${selectedTier.discount} grooming discount</span>.
            </p>
            <p className="text-brand-forest-muted text-xs">
              Your discount will be automatically applied at your next checkout. Points will be deducted immediately.
            </p>
            {redemptionError && (
              <div className="bg-brand-error/10 border border-brand-error/20 rounded-2xl p-3">
                <p className="text-sm text-brand-error">{redemptionError}</p>
              </div>
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
                Confirm
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ==============================
          SUCCESS MODAL
          ============================== */}
      <Modal
        isOpen={isSuccessModalOpen}
        onClose={handleCloseSuccessModal}
        title="Discount Ready!"
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-brand-sage/15 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-brand-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-brand-forest-light text-sm mb-2">
              Your{' '}
              <span className="font-semibold text-brand-sage">${selectedTier?.discount} discount</span>{' '}
              is ready!
            </p>
            <p className="text-xs text-brand-forest-muted mb-4">
              It will be automatically applied at your next checkout. No code needed.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleCloseSuccessModal}>
              Done
            </Button>
            <Button className="flex-1" onClick={() => { handleCloseSuccessModal(); navigate('/book'); }}>
              Book Now
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      <Toast
        message={toastMessage}
        isVisible={isToastVisible}
        onHide={() => setIsToastVisible(false)}
        type={toastType}
      />
    </AppShell>
  );
}
