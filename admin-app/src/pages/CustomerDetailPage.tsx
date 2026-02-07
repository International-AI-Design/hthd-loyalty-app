import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Select, Alert, Modal } from '../components/ui';
import { adminCustomersListApi, adminPointsApi, adminRedemptionsApi, adminDogApi } from '../lib/api';
import type {
  CustomerDetail,
  CustomerTransaction,
  CustomerRedemption,
  CustomerDog,
  AddPointsResponse,
  CreateRedemptionResponse,
} from '../lib/api';

const POINTS_CAP = 500;

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

const SIZE_LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xl: 'X-Large',
};

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

  // Dogs expanded state
  const [expandedDogId, setExpandedDogId] = useState<string | null>(null);

  // Behavior note modal
  const [showBehaviorNoteModal, setShowBehaviorNoteModal] = useState(false);
  const [behaviorNoteDogId, setBehaviorNoteDogId] = useState<string | null>(null);
  const [behaviorNoteText, setBehaviorNoteText] = useState('');
  const [behaviorNoteType, setBehaviorNoteType] = useState<'positive' | 'concern' | 'info'>('info');
  const [isSubmittingBehaviorNote, setIsSubmittingBehaviorNote] = useState(false);
  const [behaviorNoteSuccess, setBehaviorNoteSuccess] = useState(false);

  // Booking history pagination (for recent/past bookings from the customer object)
  const [bookingHistoryPage, setBookingHistoryPage] = useState(1);
  const bookingHistoryLimit = 10;

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

  // Behavior note handlers
  const handleOpenBehaviorNote = (dogId: string) => {
    setBehaviorNoteDogId(dogId);
    setBehaviorNoteText('');
    setBehaviorNoteType('info');
    setBehaviorNoteSuccess(false);
    setShowBehaviorNoteModal(true);
  };

  const handleSubmitBehaviorNote = async () => {
    if (!behaviorNoteDogId || !behaviorNoteText.trim()) return;
    setIsSubmittingBehaviorNote(true);
    const result = await adminDogApi.addBehaviorNote(behaviorNoteDogId, {
      note: behaviorNoteText.trim(),
      type: behaviorNoteType,
    });
    setIsSubmittingBehaviorNote(false);
    if (!result.error) {
      setBehaviorNoteSuccess(true);
      setBehaviorNoteText('');
    }
  };

  const handleCloseBehaviorNoteModal = () => {
    setShowBehaviorNoteModal(false);
    setBehaviorNoteDogId(null);
    setBehaviorNoteText('');
    setBehaviorNoteSuccess(false);
  };

  // Paginated booking history
  const paginatedRecentBookings = customer
    ? (customer.recent_bookings || []).slice(0, bookingHistoryPage * bookingHistoryLimit)
    : [];
  const hasMoreBookingHistory = customer
    ? (customer.recent_bookings || []).length > bookingHistoryPage * bookingHistoryLimit
    : false;

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

  const calculateAge = (birthDate: string): string => {
    const birth = new Date(birthDate);
    const now = new Date();
    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    const adjustedYears = months < 0 || (months === 0 && now.getDate() < birth.getDate()) ? years - 1 : years;
    if (adjustedYears < 1) {
      const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
      return totalMonths <= 1 ? '< 1 month' : totalMonths + ' months';
    }
    return adjustedYears === 1 ? '1 year' : adjustedYears + ' years';
  };

  const getVaccinationStatus = (dog: CustomerDog): { label: string; color: string } => {
    if (!dog.vaccinations || dog.vaccinations.length === 0) {
      return { label: 'No records', color: 'bg-gray-100 text-gray-600' };
    }
    const now = new Date();
    const hasExpired = dog.vaccinations.some(
      (v) => v.expires_at && new Date(v.expires_at) < now
    );
    const hasUnverified = dog.vaccinations.some((v) => !v.verified);
    if (hasExpired) {
      return { label: 'Expired', color: 'bg-red-100 text-red-700' };
    }
    if (hasUnverified) {
      return { label: 'Needs verification', color: 'bg-yellow-100 text-yellow-700' };
    }
    return { label: 'Up to date', color: 'bg-green-100 text-green-700' };
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
              <p className={`text-3xl sm:text-4xl font-bold ${customer.points_balance >= POINTS_CAP ? "text-amber-600" : "text-green-600"}`}>
                {customer.points_balance.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">points</p>
              {customer.points_balance >= POINTS_CAP && (
                <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                  AT CAP ({POINTS_CAP})
                </span>
              )}
              {customer.points_balance >= 450 && customer.points_balance < POINTS_CAP && (
                <span className="inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Near cap ({POINTS_CAP - customer.points_balance} to max)
                </span>
              )}
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

        {/* Dogs Section */}
        {customer.dogs && customer.dogs.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Dogs ({customer.dogs.length})
            </h3>
            <div className="space-y-3">
              {customer.dogs.map((dog) => (
                <div key={dog.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Dog summary row */}
                  <button
                    onClick={() => setExpandedDogId(expandedDogId === dog.id ? null : dog.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors min-h-[56px]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#62A2C3]/15 flex items-center justify-center flex-shrink-0">
                        {dog.photo_url ? (
                          <img src={dog.photo_url} alt={dog.name} className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <svg className="w-5 h-5 text-[#62A2C3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{dog.name}</p>
                        <p className="text-xs text-gray-500">
                          {dog.breed || 'Unknown breed'}
                          {dog.size_category && ` · ${dog.size_category}`}
                          {dog.weight && ` · ${dog.weight} lbs`}
                          {dog.birth_date && ` · ${calculateAge(dog.birth_date)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const vaxStatus = getVaccinationStatus(dog);
                        return (
                          <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${vaxStatus.color}`}>
                            {vaxStatus.label}
                          </span>
                        );
                      })()}
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${expandedDogId === dog.id ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {expandedDogId === dog.id && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {dog.birth_date && (
                          <div>
                            <p className="text-xs text-gray-500">Birthday</p>
                            <p className="text-sm font-medium text-gray-900">{formatDate(dog.birth_date)}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500">Neutered/Spayed</p>
                          <p className="text-sm font-medium text-gray-900">{dog.is_neutered ? 'Yes' : 'No'}</p>
                        </div>
                        {dog.temperament && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">Temperament</p>
                            <p className="text-sm font-medium text-gray-900">{dog.temperament}</p>
                          </div>
                        )}
                        {dog.care_instructions && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">Care Instructions</p>
                            <p className="text-sm text-gray-700">{dog.care_instructions}</p>
                          </div>
                        )}
                        {dog.notes && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">Notes</p>
                            <p className="text-sm text-gray-700">{dog.notes}</p>
                          </div>
                        )}
                      </div>

                      {/* Vaccination Status */}
                      {dog.vaccinations && dog.vaccinations.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-500 mb-2">Vaccinations</p>
                          <div className="space-y-1.5">
                            {dog.vaccinations.map((vax) => {
                              const isExpired = vax.expires_at && new Date(vax.expires_at) < new Date();
                              return (
                                <div key={vax.id} className="flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                      isExpired ? 'bg-red-500' : vax.verified ? 'bg-green-500' : 'bg-yellow-500'
                                    }`} />
                                    <span className="text-gray-700 capitalize">{vax.name.replace('_', ' ')}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-gray-500">
                                    {vax.expires_at && (
                                      <span className={isExpired ? 'text-red-600 font-medium' : ''}>
                                        {isExpired ? 'Expired' : 'Exp'} {formatDate(vax.expires_at)}
                                      </span>
                                    )}
                                    {vax.verified && (
                                      <span className="text-green-600">Verified</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {dog.vaccinations && dog.vaccinations.length === 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-500 mb-1">Vaccinations</p>
                          <p className="text-sm text-gray-400 italic">No vaccination records on file</p>
                        </div>
                      )}

                      <button
                        onClick={() => handleOpenBehaviorNote(dog.id)}
                        className="px-3 py-2 text-sm font-medium text-[#1B365D] border border-[#1B365D]/20 rounded-lg hover:bg-[#1B365D]/5 transition-colors min-h-[40px]"
                      >
                        + Add Behavior Note
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Bookings Section */}
        {customer.upcoming_bookings && customer.upcoming_bookings.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Upcoming Bookings ({customer.upcoming_bookings.length})
            </h3>
            <div className="space-y-3">
              {customer.upcoming_bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-gray-200 gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatDate(booking.date)}
                      </span>
                      {booking.start_time && (
                        <span className="text-xs text-gray-500">at {booking.start_time}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{booking.service_display_name || booking.service_name}</p>
                    {booking.dogs.length > 0 && (
                      <p className="text-xs text-gray-500">
                        {booking.dogs.map((d) => d.name).join(', ')}
                      </p>
                    )}
                    {booking.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">
                        {booking.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                      booking.status === 'confirmed'
                        ? 'bg-green-100 text-green-700'
                        : booking.status === 'checked_in'
                        ? 'bg-blue-100 text-blue-700'
                        : booking.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {booking.status.replace('_', ' ')}
                    </span>
                    {booking.total_cents > 0 && (
                      <span className="text-sm font-medium text-gray-700">
                        ${(booking.total_cents / 100).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Booking History Section */}
        {customer.recent_bookings && customer.recent_bookings.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Booking History</h3>
              <span className="text-sm text-gray-500">{customer.recent_bookings.length} total</span>
            </div>
            <div className="space-y-2">
              {paginatedRecentBookings.map((booking) => (
                <div
                  key={booking.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-gray-100 last:border-0 gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(booking.date)}
                      </p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        booking.status === 'checked_out' || booking.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : booking.status === 'cancelled'
                          ? 'bg-red-100 text-red-600'
                          : booking.status === 'no_show'
                          ? 'bg-gray-200 text-gray-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {booking.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{booking.service_display_name || booking.service_name}</p>
                    {booking.dogs.length > 0 && (
                      <p className="text-xs text-gray-400">
                        {booking.dogs.map((d) => d.name).join(', ')}
                      </p>
                    )}
                    {booking.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic">
                        {booking.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    {booking.total_cents > 0 && (
                      <p className="text-sm font-medium text-gray-700">
                        ${(booking.total_cents / 100).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {hasMoreBookingHistory && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBookingHistoryPage((p) => p + 1)}
                >
                  Load More
                </Button>
              </div>
            )}
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
            {customer.points_balance >= POINTS_CAP && (
              <div className="mt-2 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-sm font-medium">Customer is at the {POINTS_CAP}-point cap. No additional points can be earned until they redeem.</p>
              </div>
            )}
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

      {/* Behavior Note Modal */}
      <Modal
        isOpen={showBehaviorNoteModal}
        onClose={handleCloseBehaviorNoteModal}
        title="Add Behavior Note"
      >
        <div>
          {behaviorNoteSuccess ? (
            <>
              <Alert variant="success" className="mb-4">
                Behavior note added successfully.
              </Alert>
              <div className="flex justify-end">
                <Button variant="outline" onClick={handleCloseBehaviorNoteModal}>
                  Close
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-4">
                <p className="text-gray-600 text-sm mb-3">
                  Add a behavior note for{' '}
                  <span className="font-semibold">
                    {customer.dogs?.find((d) => d.id === behaviorNoteDogId)?.name || 'this dog'}
                  </span>
                </p>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note Type</label>
                  <div className="flex gap-2">
                    {(['positive', 'concern', 'info'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setBehaviorNoteType(type)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors min-h-[40px] ${
                          behaviorNoteType === type
                            ? type === 'positive'
                              ? 'bg-green-100 text-green-700 border-2 border-green-400'
                              : type === 'concern'
                              ? 'bg-red-100 text-red-700 border-2 border-red-400'
                              : 'bg-blue-100 text-blue-700 border-2 border-blue-400'
                            : 'bg-gray-100 text-gray-600 border-2 border-transparent'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <textarea
                    rows={4}
                    value={behaviorNoteText}
                    onChange={(e) => setBehaviorNoteText(e.target.value)}
                    placeholder="Describe the behavior observation..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#62A2C3] focus:border-[#62A2C3]"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleCloseBehaviorNoteModal}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmitBehaviorNote}
                  isLoading={isSubmittingBehaviorNote}
                  disabled={!behaviorNoteText.trim()}
                >
                  Add Note
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
