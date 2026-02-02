import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Select, Alert, Modal } from '../components/ui';
import { adminCustomersListApi, adminPointsApi, adminRedemptionsApi } from '../lib/api';
import type {
  CustomerDetail,
  CustomerTransaction,
  CustomerRedemption,
  AddPointsResponse,
  CreateRedemptionResponse,
} from '../lib/api';

const SERVICE_TYPES = [
  { value: 'daycare', label: 'Daycare' },
  { value: 'boarding', label: 'Boarding' },
  { value: 'grooming', label: 'Grooming (1.5x points)' },
];

const REWARD_TIERS = [
  { points: 100, discount: 10 },
  { points: 250, discount: 25 },
  { points: 500, discount: 50 },
];

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { staff, logout } = useAuth();
  const navigate = useNavigate();

  // Customer data
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [pendingRedemptions, setPendingRedemptions] = useState<CustomerRedemption[]>([]);
  const [completedRedemptions, setCompletedRedemptions] = useState<CustomerRedemption[]>([]);

  // Loading/error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transactions pagination
  const [transactionOffset, setTransactionOffset] = useState(0);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false);
  const transactionLimit = 10;

  // Add points modal state
  const [showAddPointsModal, setShowAddPointsModal] = useState(false);
  const [dollarAmount, setDollarAmount] = useState('');
  const [serviceType, setServiceType] = useState<'daycare' | 'boarding' | 'grooming'>('daycare');
  const [isSubmittingPoints, setIsSubmittingPoints] = useState(false);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [pointsSuccess, setPointsSuccess] = useState<AddPointsResponse | null>(null);

  // Redeem points modal state
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<{ points: number; discount: number } | null>(null);
  const [isProcessingRedemption, setIsProcessingRedemption] = useState(false);
  const [redemptionError, setRedemptionError] = useState<string | null>(null);
  const [redemptionSuccess, setRedemptionSuccess] = useState<CreateRedemptionResponse | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    const result = await adminCustomersListApi.get(id);
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setCustomer(result.data);
    }
  }, [id]);

  const fetchTransactions = useCallback(async (offset = 0) => {
    if (!id) return;
    const result = await adminCustomersListApi.getTransactions(id, {
      limit: transactionLimit,
      offset,
    });
    if (result.data) {
      if (offset === 0) {
        setTransactions(result.data.transactions);
      } else {
        setTransactions((prev) => [...prev, ...result.data!.transactions]);
      }
      setTransactionTotal(result.data.pagination.total);
      setHasMoreTransactions(result.data.pagination.has_more);
      setTransactionOffset(offset + result.data.transactions.length);
    }
  }, [id]);

  const fetchRedemptions = useCallback(async () => {
    if (!id) return;
    const result = await adminCustomersListApi.getRedemptions(id);
    if (result.data) {
      setPendingRedemptions(result.data.pending);
      setCompletedRedemptions(result.data.completed);
    }
  }, [id]);

  const loadAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    await Promise.all([fetchCustomer(), fetchTransactions(0), fetchRedemptions()]);
    setIsLoading(false);
  }, [fetchCustomer, fetchTransactions, fetchRedemptions]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleLoadMoreTransactions = () => {
    fetchTransactions(transactionOffset);
  };

  const calculatePoints = (amount: number, service: string): number => {
    const multiplier = service === 'grooming' ? 1.5 : 1;
    return Math.floor(amount * multiplier);
  };

  const handleAddPoints = async () => {
    if (!customer) return;

    const amount = parseFloat(dollarAmount);
    if (isNaN(amount) || amount <= 0) {
      setPointsError('Please enter a valid dollar amount');
      return;
    }

    setIsSubmittingPoints(true);
    setPointsError(null);

    const result = await adminPointsApi.add({
      customer_id: customer.id,
      dollar_amount: amount,
      service_type: serviceType,
    });

    setIsSubmittingPoints(false);

    if (result.error) {
      setPointsError(result.error);
    } else if (result.data) {
      setPointsSuccess(result.data);
      setCustomer({
        ...customer,
        points_balance: result.data.customer.new_balance,
      });
      setDollarAmount('');
      setServiceType('daycare');
      // Refresh transactions
      fetchTransactions(0);
    }
  };

  const handleCloseAddPointsModal = () => {
    setShowAddPointsModal(false);
    setDollarAmount('');
    setServiceType('daycare');
    setPointsError(null);
    setPointsSuccess(null);
  };

  const handleSelectRedemptionTier = (tier: { points: number; discount: number }) => {
    setSelectedTier(tier);
    setShowRedeemModal(true);
    setRedemptionError(null);
    setRedemptionSuccess(null);
  };

  const handleProcessRedemption = async () => {
    if (!customer || !selectedTier) return;

    setIsProcessingRedemption(true);
    setRedemptionError(null);

    const result = await adminRedemptionsApi.create({
      customer_id: customer.id,
      reward_tier: String(selectedTier.points) as '100' | '250' | '500',
    });

    setIsProcessingRedemption(false);

    if (result.error) {
      setRedemptionError(result.error);
    } else if (result.data) {
      setRedemptionSuccess(result.data);
      setCustomer({
        ...customer,
        points_balance: result.data.customer.new_balance,
      });
      // Refresh transactions and redemptions
      fetchTransactions(0);
      fetchRedemptions();
    }
  };

  const handleCloseRedeemModal = () => {
    setShowRedeemModal(false);
    setSelectedTier(null);
    setRedemptionError(null);
    setRedemptionSuccess(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const parsedAmount = parseFloat(dollarAmount) || 0;
  const previewPoints = parsedAmount > 0 ? calculatePoints(parsedAmount, serviceType) : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-green-600"></div>
          <p className="mt-2 text-gray-500">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-green-600">Happy Tail Happy Dog</h1>
                <p className="text-sm text-gray-600">Admin Portal</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Button variant="outline" size="sm" onClick={() => navigate('/customers')}>
                  Customers
                </Button>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <Alert variant="error">{error || 'Customer not found'}</Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-green-600">Happy Tail Happy Dog</h1>
              <p className="text-sm text-gray-600">Admin Portal</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate('/customers')}>
                Customers
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                Dashboard
              </Button>
              <span className="hidden sm:inline text-gray-700 text-sm">
                {staff?.first_name}
                <span className="ml-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full capitalize">
                  {staff?.role}
                </span>
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Customer Profile Card */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{customer.name}</h2>
              <p className="text-gray-600">{customer.email}</p>
              <p className="text-gray-600">{customer.phone}</p>
              <p className="text-sm text-gray-500 mt-2">
                Member since {formatDate(customer.join_date)}
              </p>
              <p className="text-sm text-gray-500">
                Referral Code: <span className="font-mono font-medium">{customer.referral_code}</span>
              </p>
            </div>
            <div className="text-left sm:text-right bg-green-50 sm:bg-transparent p-3 sm:p-0 rounded-lg">
              <p className="text-sm text-gray-600">Points Balance</p>
              <p className="text-3xl sm:text-4xl font-bold text-green-600">
                {customer.points_balance.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">points</p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <Button onClick={() => setShowAddPointsModal(true)} className="w-full sm:w-auto">
              Add Points
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setSelectedTier(null);
                setRedemptionError(null);
                setRedemptionSuccess(null);
                setShowRedeemModal(true);
              }}
              disabled={customer.points_balance < 100}
            >
              Process Redemption
            </Button>
          </div>
        </div>

        {/* Referral Information */}
        {(customer.referred_by || customer.referrals.length > 0) && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Referral Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Who referred this customer */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Referred By</h4>
                {customer.referred_by ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-green-700 font-medium text-sm">
                        {customer.referred_by.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <button
                        onClick={() => navigate(`/customers/${customer.referred_by!.id}`)}
                        className="text-green-600 hover:text-green-700 font-medium hover:underline"
                      >
                        {customer.referred_by.name}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No referrer</p>
                )}
              </div>

              {/* Customers this person has referred */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Referred Customers ({customer.referrals.length})
                </h4>
                {customer.referrals.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {customer.referrals.map((referral) => (
                      <div
                        key={referral.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                            <span className="text-green-700 font-medium text-xs">
                              {referral.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase()}
                            </span>
                          </div>
                          <button
                            onClick={() => navigate(`/customers/${referral.id}`)}
                            className="text-green-600 hover:text-green-700 font-medium text-sm hover:underline"
                          >
                            {referral.name}
                          </button>
                        </div>
                        <span className="text-xs text-gray-500">
                          Joined {formatDate(referral.join_date)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No referrals yet</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Points Transactions */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Points Transactions</h3>
              <span className="text-sm text-gray-500">{transactionTotal} total</span>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No transactions yet.
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 border-b border-gray-100 last:border-0 gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-base">{txn.description}</p>
                      <p className="text-sm text-gray-500">{formatDateTime(txn.date)}</p>
                      {txn.service_type && (
                        <span className="text-xs text-gray-400 capitalize">{txn.service_type}</span>
                      )}
                    </div>
                    <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
                      <p
                        className={`font-semibold text-lg ${
                          txn.points_amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {txn.points_amount >= 0 ? '+' : ''}
                        {txn.points_amount.toLocaleString()} pts
                      </p>
                      {txn.dollar_amount && (
                        <p className="text-sm text-gray-400">${txn.dollar_amount.toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasMoreTransactions && (
              <div className="mt-4 text-center">
                <Button variant="outline" size="sm" onClick={handleLoadMoreTransactions}>
                  Load More
                </Button>
              </div>
            )}
          </div>

          {/* Redemptions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Redemptions</h3>

            {/* Pending Redemptions */}
            {pendingRedemptions.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Pending</h4>
                <div className="space-y-2">
                  {pendingRedemptions.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-lg border-2 border-yellow-400 bg-yellow-50"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-mono font-bold text-lg">{r.redemption_code}</p>
                          <p className="text-sm text-gray-500">{formatDateTime(r.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-600">${r.discount_value}</p>
                          <p className="text-xs text-gray-500">{r.reward_tier} pts</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Redemptions */}
            {completedRedemptions.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Completed</h4>
                <div className="space-y-2">
                  {completedRedemptions.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-lg border border-gray-200 bg-gray-50"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-mono font-medium text-gray-600">{r.redemption_code}</p>
                          <p className="text-sm text-gray-400">
                            Completed {r.approved_at ? formatDateTime(r.approved_at) : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-600">${r.discount_value}</p>
                          <p className="text-xs text-gray-400">{r.reward_tier} pts</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pendingRedemptions.length === 0 && completedRedemptions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No redemptions yet.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add Points Modal */}
      <Modal
        isOpen={showAddPointsModal}
        onClose={handleCloseAddPointsModal}
        title="Add Points"
      >
        <div>
          <div className="mb-4">
            <p className="text-gray-600">
              Adding points for <span className="font-semibold">{customer.name}</span>
            </p>
            <p className="text-sm text-gray-500">
              Current balance: {customer.points_balance.toLocaleString()} pts
            </p>
          </div>

          {pointsSuccess && (
            <Alert variant="success" className="mb-4">
              <strong>Points added successfully!</strong>
              <p className="text-sm mt-1">
                {pointsSuccess.transaction.points_earned} points earned. New balance:{' '}
                {pointsSuccess.customer.new_balance.toLocaleString()} pts
              </p>
            </Alert>
          )}

          {pointsError && (
            <Alert variant="error" className="mb-4">{pointsError}</Alert>
          )}

          <div className="space-y-4 mb-4">
            <Input
              label="Dollar Amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={dollarAmount}
              onChange={(e) => setDollarAmount(e.target.value)}
            />
            <Select
              label="Service Type"
              options={SERVICE_TYPES}
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as 'daycare' | 'boarding' | 'grooming')}
            />
          </div>

          {previewPoints > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-600">Points to be earned</p>
                  {serviceType === 'grooming' && (
                    <p className="text-sm text-green-600 font-medium">1.5x bonus!</p>
                  )}
                </div>
                <p className="text-2xl font-bold text-green-600">+{previewPoints.toLocaleString()}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleCloseAddPointsModal}>
              {pointsSuccess ? 'Close' : 'Cancel'}
            </Button>
            {!pointsSuccess && (
              <Button
                className="flex-1"
                onClick={handleAddPoints}
                isLoading={isSubmittingPoints}
                disabled={!dollarAmount || parsedAmount <= 0}
              >
                Add {previewPoints > 0 ? `${previewPoints.toLocaleString()} Points` : 'Points'}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Redeem Points Modal */}
      <Modal
        isOpen={showRedeemModal}
        onClose={handleCloseRedeemModal}
        title="Process Redemption"
      >
        <div>
          <div className="mb-4">
            <p className="text-gray-600">
              Processing redemption for <span className="font-semibold">{customer.name}</span>
            </p>
            <p className="text-sm text-gray-500">
              Current balance: {customer.points_balance.toLocaleString()} pts
            </p>
          </div>

          {redemptionSuccess && (
            <Alert variant="success" className="mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <strong>Redemption processed!</strong>
                  <p className="text-sm mt-1">
                    New balance: {redemptionSuccess.customer.new_balance.toLocaleString()} pts
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">Discount to apply</p>
                  <p className="text-2xl font-bold">${redemptionSuccess.discount_to_apply}</p>
                </div>
              </div>
            </Alert>
          )}

          {redemptionError && (
            <Alert variant="error" className="mb-4">{redemptionError}</Alert>
          )}

          {!selectedTier && !redemptionSuccess && (
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">Select a reward tier:</p>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {REWARD_TIERS.map((tier) => {
                  const canAfford = customer.points_balance >= tier.points;
                  const pointsNeeded = tier.points - customer.points_balance;

                  return (
                    <button
                      key={tier.points}
                      onClick={() => canAfford && handleSelectRedemptionTier(tier)}
                      disabled={!canAfford}
                      className={`p-3 sm:p-4 rounded-lg border-2 text-center transition-all min-h-[80px] ${
                        canAfford
                          ? 'border-green-500 bg-green-50 hover:bg-green-100 cursor-pointer'
                          : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <div className="text-lg sm:text-xl font-bold">${tier.discount}</div>
                      <div className={`text-sm ${canAfford ? 'text-green-700' : 'text-gray-400'}`}>
                        {tier.points} pts
                      </div>
                      {!canAfford && (
                        <div className="text-xs text-red-500 mt-1">
                          Need {pointsNeeded}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedTier && !redemptionSuccess && (
            <div className="mb-4">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Points to Deduct</span>
                  <span className="font-medium text-red-600">-{selectedTier.points}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Balance After</span>
                  <span className="font-medium">
                    {(customer.points_balance - selectedTier.points).toLocaleString()} pts
                  </span>
                </div>
                <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                  <span className="text-gray-600 font-medium">Discount to Apply</span>
                  <span className="text-xl font-bold text-green-600">${selectedTier.discount}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setSelectedTier(null)}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleProcessRedemption}
                  isLoading={isProcessingRedemption}
                >
                  Confirm Redemption
                </Button>
              </div>
            </div>
          )}

          {(redemptionSuccess || (!selectedTier && !redemptionSuccess)) && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleCloseRedeemModal}>
                {redemptionSuccess ? 'Close' : 'Cancel'}
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
