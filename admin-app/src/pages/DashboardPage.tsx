import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Select, Alert, Modal } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { adminCustomersApi, adminPointsApi, adminRedemptionsApi, adminDemoApi } from '../lib/api';
import type { CustomerSearchResult, AddPointsResponse, RedemptionLookupResponse, CompleteRedemptionResponse, CreateRedemptionResponse, DemoResetResponse } from '../lib/api';

const SERVICE_TYPES = [
  { value: 'daycare', label: 'Daycare' },
  { value: 'boarding', label: 'Boarding' },
  { value: 'grooming', label: 'Grooming (1.5x points)' },
];

// Reward tier configuration
const REWARD_TIERS = [
  { points: 100, discount: 10 },
  { points: 250, discount: 25 },
  { points: 500, discount: 50 },
];

export function DashboardPage() {
  const { staff, logout } = useAuth();
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Selected customer state
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);

  // Points form state
  const [dollarAmount, setDollarAmount] = useState('');
  const [serviceType, setServiceType] = useState<'daycare' | 'boarding' | 'grooming'>('daycare');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<AddPointsResponse | null>(null);

  // Redemption lookup state
  const [redemptionCode, setRedemptionCode] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [redemptionResult, setRedemptionResult] = useState<RedemptionLookupResponse | null>(null);

  // Redemption completion state
  const [isCompleting, setIsCompleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [completionResult, setCompletionResult] = useState<CompleteRedemptionResponse | null>(null);

  // Direct redemption state (for selected customer)
  const [selectedRedemptionTier, setSelectedRedemptionTier] = useState<{ points: number; discount: number } | null>(null);
  const [showDirectRedemptionModal, setShowDirectRedemptionModal] = useState(false);
  const [isProcessingDirectRedemption, setIsProcessingDirectRedemption] = useState(false);
  const [directRedemptionError, setDirectRedemptionError] = useState<string | null>(null);
  const [directRedemptionResult, setDirectRedemptionResult] = useState<CreateRedemptionResponse | null>(null);

  // Quick phone lookup state
  const [quickPhone, setQuickPhone] = useState('');
  const [quickResults, setQuickResults] = useState<CustomerSearchResult[]>([]);
  const [isQuickSearching, setIsQuickSearching] = useState(false);

  // Demo reset state
  const [showDemoResetModal, setShowDemoResetModal] = useState(false);
  const [isResettingDemo, setIsResettingDemo] = useState(false);
  const [demoResetResult, setDemoResetResult] = useState<DemoResetResponse | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchError('Please enter a phone, email, or name to search');
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    const result = await adminCustomersApi.search(searchQuery.trim());

    setIsSearching(false);

    if (result.error) {
      setSearchError(result.error);
      setSearchResults([]);
    } else if (result.data) {
      setSearchResults(result.data.customers);
    }
  }, [searchQuery]);

  const handleSelectCustomer = (customer: CustomerSearchResult) => {
    setSelectedCustomer(customer);
    setSearchResults([]);
    setHasSearched(false);
    setSearchQuery('');
    setSuccessResult(null);
    setSubmitError(null);
    setDollarAmount('');
    setServiceType('daycare');
  };

  const handleClearSelection = () => {
    setSelectedCustomer(null);
    setDollarAmount('');
    setServiceType('daycare');
    setSuccessResult(null);
    setSubmitError(null);
    // Clear direct redemption state
    setSelectedRedemptionTier(null);
    setDirectRedemptionError(null);
    setDirectRedemptionResult(null);
  };

  const calculatePoints = (amount: number, service: string): number => {
    const multiplier = service === 'grooming' ? 1.5 : 1;
    return Math.floor(amount * multiplier);
  };

  const handleAddPoints = async () => {
    if (!selectedCustomer) return;

    const amount = parseFloat(dollarAmount);
    if (isNaN(amount) || amount <= 0) {
      setSubmitError('Please enter a valid dollar amount');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const result = await adminPointsApi.add({
      customer_id: selectedCustomer.id,
      dollar_amount: amount,
      service_type: serviceType,
    });

    setIsSubmitting(false);

    if (result.error) {
      setSubmitError(result.error);
    } else if (result.data) {
      setSuccessResult(result.data);
      // Update selected customer with new balance
      setSelectedCustomer({
        ...selectedCustomer,
        points_balance: result.data.customer.new_balance,
      });
      // Clear the form for next entry
      setDollarAmount('');
      setServiceType('daycare');
    }
  };

  const parsedAmount = parseFloat(dollarAmount) || 0;
  const previewPoints = parsedAmount > 0 ? calculatePoints(parsedAmount, serviceType) : 0;

  const handleRedemptionLookup = useCallback(async () => {
    if (!redemptionCode.trim()) {
      setLookupError('Please enter a redemption code');
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);
    setRedemptionResult(null);
    setCompletionResult(null);

    const result = await adminRedemptionsApi.lookup(redemptionCode.trim());

    setIsLookingUp(false);

    if (result.error) {
      setLookupError(result.error);
    } else if (result.data) {
      setRedemptionResult(result.data);
    }
  }, [redemptionCode]);

  const handleCompleteRedemption = async () => {
    if (!redemptionResult) return;

    setIsCompleting(true);

    const result = await adminRedemptionsApi.complete(redemptionResult.redemption_code);

    setIsCompleting(false);
    setShowConfirmModal(false);

    if (result.error) {
      setLookupError(result.error);
    } else if (result.data) {
      setCompletionResult(result.data);
      setRedemptionResult(null);
      setRedemptionCode('');
    }
  };

  const handleClearRedemption = () => {
    setRedemptionCode('');
    setRedemptionResult(null);
    setLookupError(null);
    setCompletionResult(null);
  };

  // Direct redemption handlers
  const handleSelectRedemptionTier = (tier: { points: number; discount: number }) => {
    setSelectedRedemptionTier(tier);
    setShowDirectRedemptionModal(true);
    setDirectRedemptionError(null);
  };

  const handleProcessDirectRedemption = async () => {
    if (!selectedCustomer || !selectedRedemptionTier) return;

    setIsProcessingDirectRedemption(true);
    setDirectRedemptionError(null);

    const result = await adminRedemptionsApi.create({
      customer_id: selectedCustomer.id,
      reward_tier: String(selectedRedemptionTier.points) as '100' | '250' | '500',
    });

    setIsProcessingDirectRedemption(false);
    setShowDirectRedemptionModal(false);

    if (result.error) {
      setDirectRedemptionError(result.error);
    } else if (result.data) {
      setDirectRedemptionResult(result.data);
      // Update selected customer with new balance
      setSelectedCustomer({
        ...selectedCustomer,
        points_balance: result.data.customer.new_balance,
      });
    }
    setSelectedRedemptionTier(null);
  };

  const handleClearDirectRedemption = () => {
    setDirectRedemptionResult(null);
    setDirectRedemptionError(null);
  };

  // Quick phone lookup - instant search as you type
  const handleQuickPhoneChange = useCallback(async (phone: string) => {
    setQuickPhone(phone);

    // Only search if we have at least 4 digits
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < 4) {
      setQuickResults([]);
      return;
    }

    setIsQuickSearching(true);
    const result = await adminCustomersApi.search(digitsOnly);
    setIsQuickSearching(false);

    if (result.data) {
      setQuickResults(result.data.customers);
    } else {
      setQuickResults([]);
    }
  }, []);

  const handleQuickSelect = (customer: CustomerSearchResult) => {
    handleSelectCustomer(customer);
    setQuickPhone('');
    setQuickResults([]);
  };

  const handleDemoReset = async () => {
    setIsResettingDemo(true);
    const result = await adminDemoApi.reset();
    setIsResettingDemo(false);

    if (result.data) {
      setDemoResetResult(result.data);
    }
  };

  const handleCloseDemoResetModal = () => {
    setShowDemoResetModal(false);
    setDemoResetResult(null);
  };

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
              <Button variant="outline" size="sm" onClick={() => navigate('/gingr-sync')}>
                Gingr Sync
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/customers')}>
                Customers
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowDemoResetModal(true)} className="text-orange-600 border-orange-300 hover:bg-orange-50">
                Reset Demo
              </Button>
              <span className="hidden sm:inline text-gray-700 text-sm">
                {staff?.first_name}
                <span className="ml-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full capitalize">
                  {staff?.role}
                </span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Quick Phone Lookup - Checkout Speed */}
        {!selectedCustomer && (
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-2">Quick Lookup</h2>
            <p className="text-green-100 text-sm mb-4">Enter last 4+ digits of phone for instant lookup</p>
            <div className="flex gap-4 items-start">
              <div className="flex-1 relative">
                <Input
                  placeholder="Last 4 digits of phone..."
                  value={quickPhone}
                  onChange={(e) => handleQuickPhoneChange(e.target.value)}
                  className="text-lg placeholder:text-gray-500"
                />
                {isQuickSearching && (
                  <div className="absolute right-3 top-3">
                    <svg className="animate-spin h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
                {/* Inline results */}
                {quickResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-10 max-h-80 overflow-y-auto">
                    {quickResults.map((customer) => (
                      <button
                        key={customer.id}
                        onClick={() => handleQuickSelect(customer)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-green-50 border-b border-gray-100 last:border-0 transition-colors"
                      >
                        <div className="text-left">
                          <p className="font-medium text-gray-900">{customer.name}</p>
                          <p className="text-sm text-gray-500">{customer.phone}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">{customer.points_balance.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">points</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {quickPhone.replace(/\D/g, '').length >= 4 && quickResults.length === 0 && !isQuickSearching && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 text-center text-gray-500 z-10">
                    No customers found
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Customer Search Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Lookup</h2>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search by phone, email, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} isLoading={isSearching} className="w-full sm:w-auto">
              Search
            </Button>
          </div>

          {searchError && (
            <Alert variant="error" className="mb-4">{searchError}</Alert>
          )}

          {/* Search Results - Card layout on mobile, table on desktop */}
          {searchResults.length > 0 && (
            <>
              {/* Mobile: Card Layout */}
              <div className="md:hidden space-y-3">
                {searchResults.map((customer) => (
                  <div
                    key={customer.id}
                    className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{customer.name}</p>
                        <p className="text-sm text-gray-500">{customer.phone}</p>
                        <p className="text-sm text-gray-500 truncate max-w-[200px]">{customer.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{customer.points_balance.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">points</p>
                      </div>
                    </div>
                    <Button size="sm" className="w-full" onClick={() => handleSelectCustomer(customer)}>
                      Select Customer
                    </Button>
                  </div>
                ))}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden md:block border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                        Points
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {searchResults.map((customer) => (
                      <tr key={customer.id} className="hover:bg-gray-50">
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-base font-medium text-gray-900">
                          {customer.name}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-base text-gray-500">
                          {customer.phone}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-base text-gray-500">
                          {customer.email}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-base font-semibold text-green-600">
                          {customer.points_balance.toLocaleString()} pts
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <Button size="sm" onClick={() => handleSelectCustomer(customer)}>
                            Select
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* No Results */}
          {hasSearched && searchResults.length === 0 && !searchError && !isSearching && (
            <div className="text-center py-8 text-gray-500">
              No customers found matching "{searchQuery}"
            </div>
          )}
        </div>

        {/* Redemption Code Lookup Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Customer Has a Code</h2>
          <p className="text-gray-600 text-sm mb-4">
            Use this when a customer presents a redemption code they received in the app.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Enter redemption code (e.g., RD-ABC123)..."
                value={redemptionCode}
                onChange={(e) => setRedemptionCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleRedemptionLookup()}
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleRedemptionLookup} isLoading={isLookingUp} className="flex-1 sm:flex-none">
                Look Up
              </Button>
              {(redemptionResult || completionResult) && (
                <Button variant="outline" onClick={handleClearRedemption} className="flex-1 sm:flex-none">
                  Clear
                </Button>
              )}
            </div>
          </div>

          {lookupError && (
            <Alert variant="error" className="mb-4">{lookupError}</Alert>
          )}

          {/* Completion Success Message - PROMINENT DISCOUNT DISPLAY */}
          {completionResult && (
            <div className="mb-4 rounded-lg overflow-hidden border-4 border-green-500">
              <div className="bg-green-500 p-3">
                <p className="text-white font-semibold text-center">
                  Redemption completed for {completionResult.customer.name}
                </p>
              </div>
              <div className="bg-yellow-300 p-6 text-center">
                <p className="text-yellow-800 font-semibold text-lg mb-2">APPLY IN GINGR:</p>
                <p className="text-6xl font-black text-yellow-900">${completionResult.discount_to_apply}</p>
                <p className="text-yellow-800 text-sm mt-2">
                  {completionResult.redemption.reward_tier} points redeemed
                </p>
              </div>
            </div>
          )}

          {/* Redemption Details */}
          {redemptionResult && (
            <div className={`border rounded-lg p-4 ${
              redemptionResult.status === 'pending'
                ? 'border-yellow-400 bg-yellow-50'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Redemption Code</p>
                  <p className="text-2xl font-mono font-bold tracking-wider text-gray-900">
                    {redemptionResult.redemption_code}
                  </p>
                </div>
                <span className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${
                  redemptionResult.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : redemptionResult.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {redemptionResult.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-medium text-gray-900">{redemptionResult.customer.name}</p>
                  <p className="text-sm text-gray-500">{redemptionResult.customer.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Discount Value</p>
                  <p className="text-2xl font-bold text-green-600">${redemptionResult.discount_value}</p>
                  <p className="text-sm text-gray-500">{redemptionResult.reward_tier} points</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Customer Balance</p>
                  <p className="font-medium text-base">{redemptionResult.customer.points_balance.toLocaleString()} pts</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Date Requested</p>
                  <p className="font-medium text-base">{new Date(redemptionResult.created_at).toLocaleString()}</p>
                </div>
              </div>

              {redemptionResult.status === 'pending' && (
                <Button
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full"
                  size="lg"
                >
                  Complete Redemption
                </Button>
              )}

              {redemptionResult.status === 'completed' && redemptionResult.approved_at && (
                <div className="text-center text-gray-500 text-sm">
                  Completed on {new Date(redemptionResult.approved_at).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!redemptionResult && !completionResult && !lookupError && (
            <div className="text-center py-4 text-gray-500">
              Enter a redemption code above to look up its details.
            </div>
          )}
        </div>

        {/* Selected Customer & Points Entry */}
        {selectedCustomer && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Add Points</h2>
                <p className="text-gray-600">Add points for a purchase</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleClearSelection}>
                Clear Selection
              </Button>
            </div>

            {/* Customer Info Card */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">{selectedCustomer.name}</h3>
                  <p className="text-gray-600">{selectedCustomer.phone} | {selectedCustomer.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Current Balance</p>
                  <p className="text-2xl font-bold text-green-600">
                    {selectedCustomer.points_balance.toLocaleString()} pts
                  </p>
                </div>
              </div>
            </div>

            {/* Success Message */}
            {successResult && (
              <Alert variant="success" className="mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <strong>Points added successfully!</strong>
                    <p className="text-sm mt-1">
                      {successResult.customer.name} earned {successResult.transaction.points_earned} points.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">New Balance</p>
                    <p className="text-xl font-bold">{successResult.customer.new_balance.toLocaleString()} pts</p>
                  </div>
                </div>
              </Alert>
            )}

            {/* Error Message */}
            {submitError && (
              <Alert variant="error" className="mb-6">{submitError}</Alert>
            )}

            {/* Points Entry Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
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

            {/* Points Preview */}
            {previewPoints > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-600">Points to be earned</p>
                    {serviceType === 'grooming' && (
                      <p className="text-sm text-green-600 font-medium">1.5x bonus for grooming!</p>
                    )}
                  </div>
                  <p className="text-3xl font-bold text-green-600">
                    +{previewPoints.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleAddPoints}
              isLoading={isSubmitting}
              disabled={!dollarAmount || parsedAmount <= 0}
              className="w-full"
              size="lg"
            >
              Add {previewPoints > 0 ? `${previewPoints.toLocaleString()} Points` : 'Points'}
            </Button>

            {/* Divider */}
            <div className="border-t border-gray-200 my-6"></div>

            {/* Redeem Points Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Redemption (No Code Needed)</h3>
              <p className="text-gray-600 mb-4">
                Use this when a customer wants to redeem points at checkout but hasn't generated a code in the app.
              </p>

              {/* Direct Redemption Error */}
              {directRedemptionError && (
                <Alert variant="error" className="mb-4">{directRedemptionError}</Alert>
              )}

              {/* Direct Redemption Success - PROMINENT DISCOUNT DISPLAY */}
              {directRedemptionResult && (
                <div className="mb-4 rounded-lg overflow-hidden border-4 border-green-500">
                  <div className="bg-green-500 p-3 flex justify-between items-center">
                    <p className="text-white font-semibold">
                      Redemption completed for {directRedemptionResult.customer.name}
                    </p>
                    <Button size="sm" variant="outline" onClick={handleClearDirectRedemption} className="bg-white text-green-700 hover:bg-green-50">
                      Dismiss
                    </Button>
                  </div>
                  <div className="bg-yellow-300 p-6 text-center">
                    <p className="text-yellow-800 font-semibold text-lg mb-2">APPLY IN GINGR:</p>
                    <p className="text-6xl font-black text-yellow-900">${directRedemptionResult.discount_to_apply}</p>
                    <p className="text-yellow-800 text-sm mt-2">
                      {directRedemptionResult.redemption.reward_tier} points redeemed
                    </p>
                  </div>
                </div>
              )}

              {/* Reward Tiers Grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {REWARD_TIERS.map((tier) => {
                  const canAfford = selectedCustomer.points_balance >= tier.points;
                  const pointsNeeded = tier.points - selectedCustomer.points_balance;

                  return (
                    <button
                      key={tier.points}
                      onClick={() => canAfford && handleSelectRedemptionTier(tier)}
                      disabled={!canAfford}
                      className={`p-3 sm:p-4 rounded-lg border-2 text-center transition-all min-h-[100px] ${
                        canAfford
                          ? 'border-green-500 bg-green-50 hover:bg-green-100 cursor-pointer'
                          : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <div className="text-xl sm:text-2xl font-bold mb-1">
                        ${tier.discount}
                      </div>
                      <div className={`text-sm ${canAfford ? 'text-green-700' : 'text-gray-400'}`}>
                        {tier.points} pts
                      </div>
                      {!canAfford && (
                        <div className="text-xs text-red-500 mt-1">
                          Need {pointsNeeded}
                        </div>
                      )}
                      {canAfford && (
                        <div className="text-xs text-green-600 mt-1 font-medium">
                          Available
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!selectedCustomer && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            Search for a customer above to add points for their purchase.
          </div>
        )}

        {/* Sign Out Footer */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 text-red-600 hover:text-red-700 font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign Out
          </button>
        </div>
      </main>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Complete Redemption"
      >
        {redemptionResult && (
          <div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to complete this redemption?
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Customer</span>
                <span className="font-medium">{redemptionResult.customer.name}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Code</span>
                <span className="font-mono font-medium">{redemptionResult.redemption_code}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Points to Deduct</span>
                <span className="font-medium text-red-600">-{redemptionResult.reward_tier}</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-600 font-medium">Discount to Apply</span>
                <span className="text-xl font-bold text-green-600">${redemptionResult.discount_value}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCompleteRedemption}
                isLoading={isCompleting}
              >
                Complete Redemption
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Direct Redemption Confirmation Modal */}
      <Modal
        isOpen={showDirectRedemptionModal}
        onClose={() => setShowDirectRedemptionModal(false)}
        title="Process Redemption"
      >
        {selectedCustomer && selectedRedemptionTier && (
          <div>
            <p className="text-gray-600 mb-4">
              Are you sure you want to process this redemption for the customer?
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Customer</span>
                <span className="font-medium">{selectedCustomer.name}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Current Balance</span>
                <span className="font-medium">{selectedCustomer.points_balance.toLocaleString()} pts</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Points to Deduct</span>
                <span className="font-medium text-red-600">-{selectedRedemptionTier.points}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Balance After</span>
                <span className="font-medium">{(selectedCustomer.points_balance - selectedRedemptionTier.points).toLocaleString()} pts</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-600 font-medium">Discount to Apply</span>
                <span className="text-xl font-bold text-green-600">${selectedRedemptionTier.discount}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDirectRedemptionModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleProcessDirectRedemption}
                isLoading={isProcessingDirectRedemption}
              >
                Process Redemption
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Demo Reset Modal */}
      <Modal
        isOpen={showDemoResetModal}
        onClose={handleCloseDemoResetModal}
        title="Reset Demo Data"
      >
        <div>
          {!demoResetResult ? (
            <>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
                <p className="text-orange-800 font-medium mb-2">This will:</p>
                <ul className="text-orange-700 text-sm space-y-1">
                  <li>Reset all claimed Gingr-imported accounts to unclaimed</li>
                  <li>Clear customer passwords</li>
                  <li>Clear all verification codes</li>
                </ul>
              </div>
              <p className="text-gray-600 mb-4">
                Use this to reset the demo environment for a fresh walkthrough.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCloseDemoResetModal}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  onClick={handleDemoReset}
                  isLoading={isResettingDemo}
                >
                  Reset Demo
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-800 font-medium mb-2">Reset Complete!</p>
                <ul className="text-green-700 text-sm space-y-1">
                  <li>{demoResetResult.accounts_reset} account(s) reset to unclaimed</li>
                  <li>{demoResetResult.verification_codes_cleared} verification code(s) cleared</li>
                </ul>
              </div>
              <p className="text-gray-600 mb-4">
                Customers can now go through the claim flow fresh.
              </p>
              <Button
                className="w-full"
                onClick={handleCloseDemoResetModal}
              >
                Done
              </Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
