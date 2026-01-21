import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Select, Alert, Modal } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { adminCustomersApi, adminPointsApi, adminRedemptionsApi } from '../lib/api';
import type { CustomerSearchResult, AddPointsResponse, RedemptionLookupResponse, CompleteRedemptionResponse, CreateRedemptionResponse } from '../lib/api';

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

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-green-600">Happy Tail Happy Dog</h1>
            <p className="text-sm text-gray-600">Admin Portal</p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/gingr-sync')}>
              Gingr Sync
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/customers')}>
              View All Customers
            </Button>
            <span className="text-gray-700">
              {staff?.first_name} {staff?.last_name}
              <span className="ml-2 px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full capitalize">
                {staff?.role}
              </span>
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Customer Search Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Lookup</h2>

          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search by phone, email, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} isLoading={isSearching}>
              Search
            </Button>
          </div>

          {searchError && (
            <Alert variant="error" className="mb-4">{searchError}</Alert>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Points
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {searchResults.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {customer.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                        {customer.points_balance.toLocaleString()} pts
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Button size="sm" onClick={() => handleSelectCustomer(customer)}>
                          Select
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Enter redemption code (e.g., RD-ABC123)..."
                value={redemptionCode}
                onChange={(e) => setRedemptionCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleRedemptionLookup()}
              />
            </div>
            <Button onClick={handleRedemptionLookup} isLoading={isLookingUp}>
              Look Up
            </Button>
            {(redemptionResult || completionResult) && (
              <Button variant="outline" onClick={handleClearRedemption}>
                Clear
              </Button>
            )}
          </div>

          {lookupError && (
            <Alert variant="error" className="mb-4">{lookupError}</Alert>
          )}

          {/* Completion Success Message */}
          {completionResult && (
            <Alert variant="success" className="mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <strong>Redemption completed successfully!</strong>
                  <p className="text-sm mt-1">
                    {completionResult.customer.name} redeemed {completionResult.redemption.reward_tier} points.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">Discount to apply</p>
                  <p className="text-2xl font-bold">${completionResult.discount_to_apply}</p>
                </div>
              </div>
            </Alert>
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

              <div className="grid grid-cols-2 gap-4 mb-4">
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

              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-gray-600">Customer Balance</p>
                  <p className="font-medium">{redemptionResult.customer.points_balance.toLocaleString()} pts</p>
                </div>
                <div>
                  <p className="text-gray-600">Date Requested</p>
                  <p className="font-medium">{new Date(redemptionResult.created_at).toLocaleString()}</p>
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

              {/* Direct Redemption Success */}
              {directRedemptionResult && (
                <Alert variant="success" className="mb-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <strong>Redemption processed successfully!</strong>
                      <p className="text-sm mt-1">
                        {directRedemptionResult.customer.name} redeemed {directRedemptionResult.redemption.reward_tier} points.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">Discount to apply</p>
                      <p className="text-2xl font-bold">${directRedemptionResult.discount_to_apply}</p>
                    </div>
                  </div>
                  <div className="mt-3 text-right">
                    <Button size="sm" variant="outline" onClick={handleClearDirectRedemption}>
                      Dismiss
                    </Button>
                  </div>
                </Alert>
              )}

              {/* Reward Tiers Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {REWARD_TIERS.map((tier) => {
                  const canAfford = selectedCustomer.points_balance >= tier.points;
                  const pointsNeeded = tier.points - selectedCustomer.points_balance;

                  return (
                    <button
                      key={tier.points}
                      onClick={() => canAfford && handleSelectRedemptionTier(tier)}
                      disabled={!canAfford}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        canAfford
                          ? 'border-green-500 bg-green-50 hover:bg-green-100 cursor-pointer'
                          : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <div className="text-2xl font-bold text-center mb-1">
                        ${tier.discount}
                      </div>
                      <div className={`text-sm text-center ${canAfford ? 'text-green-700' : 'text-gray-400'}`}>
                        {tier.points} points
                      </div>
                      {!canAfford && (
                        <div className="text-xs text-center text-red-500 mt-1">
                          Need {pointsNeeded} more pts
                        </div>
                      )}
                      {canAfford && (
                        <div className="text-xs text-center text-green-600 mt-1 font-medium">
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
    </div>
  );
}
