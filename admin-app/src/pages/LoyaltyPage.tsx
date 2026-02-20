import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Select, Alert, Modal, PageHeader, Card, Spinner, EmptyState } from '../components/ui';
import { adminCustomersApi, adminPointsApi, adminRedemptionsApi, adminDemoApi } from '../lib/api';
import type { CustomerSearchResult, AddPointsResponse, RedemptionLookupResponse, CompleteRedemptionResponse, CreateRedemptionResponse, DemoResetResponse } from '../lib/api';

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

export function LoyaltyPage() {
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

  // Direct redemption state
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
  const [demoResetError, setDemoResetError] = useState<string | null>(null);

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
      setSelectedCustomer({
        ...selectedCustomer,
        points_balance: result.data.customer.new_balance,
      });
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

  const handleQuickPhoneChange = useCallback(async (phone: string) => {
    setQuickPhone(phone);
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
    setDemoResetError(null);
    const result = await adminDemoApi.reset();
    setIsResettingDemo(false);
    if (result.error) {
      setDemoResetError(result.error);
    } else if (result.data) {
      setDemoResetResult(result.data);
    }
  };

  const handleCloseDemoResetModal = () => {
    setShowDemoResetModal(false);
    setDemoResetResult(null);
    setDemoResetError(null);
  };

  return (
    <>
      <PageHeader
        title="Loyalty Points"
        subtitle="Add points, process redemptions, and manage loyalty"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDemoResetModal(true)}
            className="text-[#E8837B] border-[#E8837B]/30 hover:bg-[#E8837B]/5"
          >
            Reset Demo
          </Button>
        }
      />

      {/* Quick Phone Lookup */}
      {!selectedCustomer && (
        <Card className="mb-6 !bg-gradient-to-r !from-[#62A2C3] !to-[#4F8BA8] !border-0">
          <h2 className="text-xl font-semibold text-white mb-2">Quick Lookup</h2>
          <p className="text-white/70 text-sm mb-4">Enter last 4+ digits of phone for instant lookup</p>
          <div className="relative">
            <input
              type="text"
              placeholder="Last 4 digits of phone..."
              value={quickPhone}
              onChange={(e) => handleQuickPhoneChange(e.target.value)}
              className="w-full px-3 py-3 border rounded-lg shadow-sm min-h-[44px] text-lg border-white/30 bg-white/20 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/50"
            />
            {isQuickSearching && (
              <div className="absolute right-3 top-3.5">
                <Spinner size="sm" className="!border-white/30 !border-t-white" />
              </div>
            )}
            {quickResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-10 max-h-80 overflow-y-auto">
                {quickResults.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => handleQuickSelect(customer)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#62A2C3]/5 border-b border-gray-50 last:border-0 transition-colors"
                  >
                    <div className="text-left">
                      <p className="font-medium text-[#1B365D]">{customer.name}</p>
                      <p className="text-sm text-gray-500">{customer.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#62A2C3]">{customer.points_balance.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">points</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {quickPhone.replace(/\D/g, '').length >= 4 && quickResults.length === 0 && !isQuickSearching && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-4 text-center text-gray-500 z-10">
                No customers found
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Customer Search */}
      <Card title="Customer Lookup" className="mb-6">
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

        {searchError && <Alert variant="error" className="mb-4">{searchError}</Alert>}

        {searchResults.length > 0 && (
          <>
            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {searchResults.map((customer) => (
                <div key={customer.id} className="border border-gray-100 rounded-xl p-4 hover:bg-[#62A2C3]/5 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-[#1B365D]">{customer.name}</p>
                      <p className="text-sm text-gray-500">{customer.phone}</p>
                      <p className="text-sm text-gray-500 truncate max-w-[200px]">{customer.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#62A2C3]">{customer.points_balance.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">points</p>
                    </div>
                  </div>
                  <Button size="sm" className="w-full" onClick={() => handleSelectCustomer(customer)}>
                    Select Customer
                  </Button>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto -mx-5 sm:-mx-6">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Name</th>
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Phone</th>
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Email</th>
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Points</th>
                    <th className="text-left text-xs font-semibold text-[#1B365D] uppercase tracking-wide px-5 sm:px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((customer, idx) => (
                    <tr key={customer.id} className={`border-b border-gray-50 hover:bg-[#62A2C3]/5 ${idx % 2 === 1 ? 'bg-[#F8F6F3]/50' : ''}`}>
                      <td className="px-5 sm:px-6 py-3.5 text-sm font-medium text-[#1B365D]">{customer.name}</td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-gray-500">{customer.phone}</td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm text-gray-500">{customer.email}</td>
                      <td className="px-5 sm:px-6 py-3.5 text-sm font-semibold text-[#62A2C3]">{customer.points_balance.toLocaleString()} pts</td>
                      <td className="px-5 sm:px-6 py-3.5">
                        <Button size="sm" onClick={() => handleSelectCustomer(customer)}>Select</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {hasSearched && searchResults.length === 0 && !searchError && !isSearching && (
          <EmptyState title={`No customers found matching "${searchQuery}"`} />
        )}
      </Card>

      {/* Redemption Code Lookup */}
      <Card title="Customer Has a Code" subtitle="Use this when a customer presents a redemption code they received in the app." className="mb-6">
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

        {lookupError && <Alert variant="error" className="mb-4">{lookupError}</Alert>}

        {/* Completion Success - Prominent Discount */}
        {completionResult && (
          <div className="mb-4 rounded-xl overflow-hidden border-4 border-[#7FB685]">
            <div className="bg-[#7FB685] p-3">
              <p className="text-white font-semibold text-center">
                Redemption completed for {completionResult.customer.name}
              </p>
            </div>
            <div className="bg-[#F5C65D] p-6 text-center">
              <p className="text-[#1B365D] font-semibold text-lg mb-2">APPLY IN GINGR:</p>
              <p className="text-6xl font-black text-[#1B365D]">${completionResult.discount_to_apply}</p>
              <p className="text-[#1B365D]/70 text-sm mt-2">
                {completionResult.redemption.reward_tier} points redeemed
              </p>
            </div>
          </div>
        )}

        {/* Redemption Details */}
        {redemptionResult && (
          <div className={`border rounded-xl p-4 ${
            redemptionResult.status === 'pending'
              ? 'border-[#F5C65D] bg-[#F5C65D]/10'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Redemption Code</p>
                <p className="text-2xl font-mono font-bold tracking-wider text-[#1B365D]">
                  {redemptionResult.redemption_code}
                </p>
              </div>
              <span className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${
                redemptionResult.status === 'pending'
                  ? 'bg-[#F5C65D]/20 text-[#B8941F]'
                  : redemptionResult.status === 'completed'
                  ? 'bg-[#7FB685]/15 text-[#5A9A62]'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {redemptionResult.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-medium text-[#1B365D]">{redemptionResult.customer.name}</p>
                <p className="text-sm text-gray-500">{redemptionResult.customer.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Discount Value</p>
                <p className="text-2xl font-bold text-[#62A2C3]">${redemptionResult.discount_value}</p>
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
              <Button onClick={() => setShowConfirmModal(true)} className="w-full" size="lg">
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

        {!redemptionResult && !completionResult && !lookupError && (
          <div className="text-center py-4 text-gray-500">
            Enter a redemption code above to look up its details.
          </div>
        )}
      </Card>

      {/* Selected Customer & Points Entry */}
      {selectedCustomer && (
        <Card className="mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="font-heading text-lg font-semibold text-[#1B365D]">Add Points</h2>
              <p className="text-sm text-gray-500 mt-0.5">Add points for a purchase</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleClearSelection}>
              Clear Selection
            </Button>
          </div>

          {/* Customer Info */}
          <div className="bg-[#62A2C3]/10 border border-[#62A2C3]/20 rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg text-[#1B365D]">{selectedCustomer.name}</h3>
                <p className="text-gray-600">{selectedCustomer.phone} | {selectedCustomer.email}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Current Balance</p>
                <p className="text-2xl font-bold text-[#62A2C3]">
                  {selectedCustomer.points_balance.toLocaleString()} pts
                </p>
              </div>
            </div>
          </div>

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

          {submitError && <Alert variant="error" className="mb-6">{submitError}</Alert>}

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

          {previewPoints > 0 && (
            <div className="bg-[#F8F6F3] border border-gray-200 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-gray-600">Points to be earned</p>
                  {serviceType === 'grooming' && (
                    <p className="text-sm text-[#62A2C3] font-medium">1.5x bonus for grooming!</p>
                  )}
                </div>
                <p className="text-3xl font-bold text-[#62A2C3]">
                  +{previewPoints.toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <Button
            onClick={handleAddPoints}
            isLoading={isSubmitting}
            disabled={!dollarAmount || parsedAmount <= 0}
            className="w-full"
            size="lg"
          >
            Add {previewPoints > 0 ? `${previewPoints.toLocaleString()} Points` : 'Points'}
          </Button>

          <div className="border-t border-gray-200 my-6" />

          {/* Redeem Points */}
          <div>
            <h3 className="font-heading text-lg font-semibold text-[#1B365D] mb-2">Quick Redemption (No Code Needed)</h3>
            <p className="text-gray-600 mb-4">
              Use this when a customer wants to redeem points at checkout but hasn't generated a code in the app.
            </p>

            {directRedemptionError && <Alert variant="error" className="mb-4">{directRedemptionError}</Alert>}

            {/* Direct Redemption Success - Prominent Discount */}
            {directRedemptionResult && (
              <div className="mb-4 rounded-xl overflow-hidden border-4 border-[#7FB685]">
                <div className="bg-[#7FB685] p-3 flex justify-between items-center">
                  <p className="text-white font-semibold">
                    Redemption completed for {directRedemptionResult.customer.name}
                  </p>
                  <Button size="sm" variant="outline" onClick={handleClearDirectRedemption} className="bg-white text-[#5A9A62] hover:bg-[#7FB685]/10">
                    Dismiss
                  </Button>
                </div>
                <div className="bg-[#F5C65D] p-6 text-center">
                  <p className="text-[#1B365D] font-semibold text-lg mb-2">APPLY IN GINGR:</p>
                  <p className="text-6xl font-black text-[#1B365D]">${directRedemptionResult.discount_to_apply}</p>
                  <p className="text-[#1B365D]/70 text-sm mt-2">
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
                    className={`p-3 sm:p-4 rounded-xl border-2 text-center transition-all min-h-[100px] ${
                      canAfford
                        ? 'border-[#62A2C3] bg-[#62A2C3]/5 hover:bg-[#62A2C3]/10 cursor-pointer'
                        : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <div className="text-xl sm:text-2xl font-bold mb-1">${tier.discount}</div>
                    <div className={`text-sm ${canAfford ? 'text-[#4F8BA8]' : 'text-gray-400'}`}>
                      {tier.points} pts
                    </div>
                    {!canAfford && (
                      <div className="text-xs text-[#E8837B] mt-1">Need {pointsNeeded}</div>
                    )}
                    {canAfford && (
                      <div className="text-xs text-[#62A2C3] mt-1 font-medium">Available</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!selectedCustomer && (
        <Card>
          <EmptyState
            title="No customer selected"
            description="Search for a customer above to add points for their purchase."
          />
        </Card>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Complete Redemption"
      >
        {redemptionResult && (
          <div>
            <p className="text-gray-600 mb-4">Are you sure you want to complete this redemption?</p>
            <div className="bg-[#F8F6F3] rounded-xl p-4 mb-4">
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
                <span className="font-medium text-[#E8837B]">-{redemptionResult.reward_tier}</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-600 font-medium">Discount to Apply</span>
                <span className="text-xl font-bold text-[#62A2C3]">${redemptionResult.discount_value}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleCompleteRedemption} isLoading={isCompleting}>Complete Redemption</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Direct Redemption Modal */}
      <Modal
        isOpen={showDirectRedemptionModal}
        onClose={() => setShowDirectRedemptionModal(false)}
        title="Process Redemption"
      >
        {selectedCustomer && selectedRedemptionTier && (
          <div>
            <p className="text-gray-600 mb-4">Are you sure you want to process this redemption?</p>
            <div className="bg-[#F8F6F3] rounded-xl p-4 mb-4">
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
                <span className="font-medium text-[#E8837B]">-{selectedRedemptionTier.points}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Balance After</span>
                <span className="font-medium">{(selectedCustomer.points_balance - selectedRedemptionTier.points).toLocaleString()} pts</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-600 font-medium">Discount to Apply</span>
                <span className="text-xl font-bold text-[#62A2C3]">${selectedRedemptionTier.discount}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDirectRedemptionModal(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleProcessDirectRedemption} isLoading={isProcessingDirectRedemption}>Process Redemption</Button>
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
              <div className="bg-[#E8837B]/10 border border-[#E8837B]/20 rounded-xl p-4 mb-4">
                <p className="text-[#E8837B] font-medium mb-2">This will:</p>
                <ul className="text-[#E8837B]/80 text-sm space-y-1">
                  <li>Reset all claimed Gingr-imported accounts to unclaimed</li>
                  <li>Clear customer passwords</li>
                  <li>Clear all verification codes</li>
                </ul>
              </div>
              <p className="text-gray-600 mb-4">
                Use this to reset the demo environment for a fresh walkthrough.
              </p>
              {demoResetError && <Alert variant="error" className="mb-4">{demoResetError}</Alert>}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleCloseDemoResetModal}>Cancel</Button>
                <Button
                  className="flex-1 !bg-[#E8837B] hover:!bg-[#d6716a]"
                  onClick={handleDemoReset}
                  isLoading={isResettingDemo}
                >
                  Reset Demo
                </Button>
              </div>
            </>
          ) : (
            <>
              <Alert variant="success" className="mb-4">
                <p className="font-medium mb-2">Reset Complete!</p>
                <ul className="text-sm space-y-1">
                  <li>{demoResetResult.accounts_reset} account(s) reset to unclaimed</li>
                  <li>{demoResetResult.verification_codes_cleared} verification code(s) cleared</li>
                </ul>
              </Alert>
              <p className="text-gray-600 mb-4">
                Customers can now go through the claim flow fresh.
              </p>
              <Button className="w-full" onClick={handleCloseDemoResetModal}>Done</Button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
