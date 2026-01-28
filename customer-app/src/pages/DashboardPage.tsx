import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { customerApi } from '../lib/api';
import type { PointsTransaction, Redemption, ReferredCustomer } from '../lib/api';
import { Button, Modal, Alert } from '../components/ui';
import { useNavigate } from 'react-router-dom';

const REWARD_TIERS = [
  { points: 100, discount: 10 },
  { points: 250, discount: 25 },
  { points: 500, discount: 50 },
];

export function DashboardPage() {
  const { customer, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Redemptions state
  const [pendingRedemptions, setPendingRedemptions] = useState<Redemption[]>([]);
  const [completedRedemptions, setCompletedRedemptions] = useState<Redemption[]>([]);
  const [isLoadingRedemptions, setIsLoadingRedemptions] = useState(true);

  // Referral stats state
  const [referralCount, setReferralCount] = useState(0);
  const [referralBonusPoints, setReferralBonusPoints] = useState(0);
  const [referredCustomers, setReferredCustomers] = useState<ReferredCustomer[]>([]);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(true);

  // Redemption state
  const [selectedTier, setSelectedTier] = useState<{ points: number; discount: number } | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redemptionCode, setRedemptionCode] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [redemptionError, setRedemptionError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    const { data } = await customerApi.getTransactions(10, 0);
    if (data) {
      setTransactions(data.transactions);
    }
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshProfile(), fetchTransactions(), fetchRedemptions(), fetchReferralStats()]);
    setIsRefreshing(false);
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
      // Refresh profile to update points balance and redemptions list
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

  // Share referral code state
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  const handleShareCode = async () => {
    if (!customer) return;

    const shareData = {
      title: 'Join Happy Tail Happy Dog Rewards!',
      text: `Use my referral code ${customer.referral_code} when you sign up at Happy Tail Happy Dog and we both earn rewards! Your pup deserves the best.`,
      url: `${window.location.origin}/register?ref=${customer.referral_code}`,
    };

    // Check if Web Share API is available
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        // User successfully shared (or at least opened share tray)
      } catch (error) {
        // User cancelled or share failed - this is normal, no need to show error
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error);
        }
      }
    } else {
      // Fallback: copy to clipboard
      const shareText = `${shareData.text}\n\n${shareData.url}`;
      try {
        await navigator.clipboard.writeText(shareText);
        setShareSuccess('Copied to clipboard!');
        setTimeout(() => setShareSuccess(null), 3000);
      } catch (error) {
        console.error('Clipboard write failed:', error);
        // Final fallback - select text for manual copy
        const textArea = document.createElement('textarea');
        textArea.value = shareText;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setShareSuccess('Copied to clipboard!');
        setTimeout(() => setShareSuccess(null), 3000);
      }
    }
  };

  if (!customer) {
    return null;
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTransactionColor = (amount: number) => {
    if (amount > 0) return 'text-green-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-brand-navy font-heading">Happy Tail Happy Dog</h1>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Points Balance Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-700">
              Welcome back, {customer.first_name}!
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <svg
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
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
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
          <div className="py-6">
            <p className="text-gray-600 text-sm uppercase tracking-wide">Your Points Balance</p>
            <p className="text-6xl font-bold text-brand-teal mt-2">
              {customer.points_balance.toLocaleString()}
            </p>
            <p className="text-gray-500 mt-1">points</p>
          </div>
          {/* Referral Code Section */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-gray-600 text-sm mb-3">
              Your referral code: <span className="font-mono font-bold text-brand-navy">{customer.referral_code}</span>
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={handleShareCode}
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Share Your Code
            </Button>
            {shareSuccess && (
              <p className="text-sm text-brand-soft-green mt-2 font-medium">{shareSuccess}</p>
            )}
          </div>
        </div>

        {/* My Referrals Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-brand-teal"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            My Referrals
          </h3>
          {isLoadingReferrals ? (
            <div className="flex justify-center py-8">
              <svg
                className="animate-spin h-8 w-8 text-brand-teal"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          ) : referralCount === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
              <p className="mt-2">No referrals yet</p>
              <p className="text-sm">Share your code above to earn 100 bonus points for each friend who joins!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Stats Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-brand-warm-white rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-brand-navy">{referralCount}</p>
                  <p className="text-sm text-gray-600">Friends Referred</p>
                </div>
                <div className="bg-brand-warm-white rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-brand-teal">+{referralBonusPoints.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Bonus Points Earned</p>
                </div>
              </div>

              {/* Referred Customers List */}
              {referredCustomers.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Your Referrals</h4>
                  <div className="space-y-2">
                    {referredCustomers.map((referral) => (
                      <div
                        key={referral.id}
                        className="flex items-center justify-between py-2 px-3 bg-brand-cream rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-brand-teal rounded-full flex items-center justify-center text-white font-medium text-sm">
                            {referral.first_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-brand-navy">{referral.first_name}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatDate(referral.joined_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Redeem Points / Reward Tiers */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Redeem Points</h3>
          <p className="text-gray-600 text-sm mb-4">
            Click a reward tier to redeem your points for a grooming discount!
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {REWARD_TIERS.map((tier) => {
              const canAfford = customer.points_balance >= tier.points;
              return (
                <button
                  key={tier.points}
                  onClick={() => handleTierClick(tier)}
                  disabled={!canAfford}
                  className={`rounded-xl p-4 border-2 transition-all text-left w-full shadow-md ${
                    canAfford
                      ? 'border-brand-teal bg-white hover:bg-brand-cream hover:border-brand-teal-dark cursor-pointer'
                      : 'border-gray-300 bg-gray-100 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="text-center">
                    <p className="text-3xl font-bold text-brand-navy">${tier.discount}</p>
                    <p className="text-sm text-gray-600 mt-1">grooming discount</p>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p
                        className={`text-lg font-semibold ${
                          canAfford ? 'text-brand-teal' : 'text-gray-500'
                        }`}
                      >
                        {tier.points.toLocaleString()} pts
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {canAfford ? (
                          <span className="text-brand-teal font-medium">Tap to redeem</span>
                        ) : (
                          `${(tier.points - customer.points_balance).toLocaleString()} more needed`
                        )}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Redemptions */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Redemption Codes</h3>
          {isLoadingRedemptions ? (
            <div className="flex justify-center py-8">
              <svg
                className="animate-spin h-8 w-8 text-brand-teal"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          ) : pendingRedemptions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                />
              </svg>
              <p className="mt-2">No active redemption codes</p>
              <p className="text-sm">Request a redemption above to get a discount code!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRedemptions.map((redemption) => (
                <div
                  key={redemption.id}
                  className="border-2 border-yellow-400 bg-yellow-50 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Pending
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDate(redemption.created_at)}
                    </span>
                  </div>
                  <div className="text-center py-2">
                    <p className="text-3xl font-mono font-bold text-gray-900 tracking-wider">
                      {redemption.redemption_code}
                    </p>
                    <p className="text-lg font-semibold text-green-600 mt-2">
                      ${redemption.discount_value} grooming discount
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {redemption.reward_tier.toLocaleString()} points
                    </p>
                  </div>
                  <p className="text-sm text-center text-gray-600 mt-2">
                    Show this code at checkout
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Redemption History */}
        {completedRedemptions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Redemption History</h3>
            <div className="space-y-3">
              {completedRedemptions.map((redemption) => (
                <div
                  key={redemption.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        ${redemption.discount_value} discount redeemed
                      </p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Completed
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Code: {redemption.redemption_code} • {formatDate(redemption.approved_at || redemption.created_at)}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    -{redemption.reward_tier.toLocaleString()} pts
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          {isLoadingTransactions ? (
            <div className="flex justify-center py-8">
              <svg
                className="animate-spin h-8 w-8 text-brand-teal"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              <p className="mt-2">No transactions yet</p>
              <p className="text-sm">Visit us to start earning points!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{transaction.description}</p>
                    <p className="text-sm text-gray-500">{formatDate(transaction.date)}</p>
                  </div>
                  <div
                    className={`text-lg font-semibold ${getTransactionColor(
                      transaction.points_amount
                    )}`}
                  >
                    {transaction.points_amount > 0 ? '+' : ''}
                    {transaction.points_amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Redemption"
      >
        {selectedTier && (
          <div className="space-y-4">
            <p className="text-gray-700">
              You are about to redeem <span className="font-semibold">{selectedTier.points.toLocaleString()} points</span> for
              a <span className="font-semibold text-green-600">${selectedTier.discount} grooming discount</span>.
            </p>
            <p className="text-gray-600 text-sm">
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

      {/* Success Modal with Redemption Code */}
      <Modal
        isOpen={isSuccessModalOpen}
        onClose={handleCloseSuccessModal}
        title="Redemption Code Ready!"
      >
        <div className="space-y-4">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-700 mb-4">
              Show this code at checkout to receive your{' '}
              <span className="font-semibold text-green-600">${selectedTier?.discount} discount</span>:
            </p>
            <div className="bg-gray-100 rounded-xl p-4 mb-4">
              <p className="text-3xl font-mono font-bold text-gray-900 tracking-wider">
                {redemptionCode}
              </p>
            </div>
            <p className="text-sm text-gray-500">
              This code is pending and will be completed when you use it at checkout.
            </p>
          </div>
          <Button className="w-full" onClick={handleCloseSuccessModal}>
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );
}
