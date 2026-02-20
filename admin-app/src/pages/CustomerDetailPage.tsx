import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Alert, PageHeader, Card, Spinner } from '../components/ui';
import { adminCustomersListApi } from '../lib/api';
import type { CustomerDetail, CustomerTransaction, CustomerRedemption } from '../lib/api';
import { CustomerHeader } from './customer-detail/CustomerHeader';
import { CustomerDogs } from './customer-detail/CustomerDogs';
import { CustomerBookings } from './customer-detail/CustomerBookings';
import { CustomerTransactions } from './customer-detail/CustomerTransactions';
import { CustomerRedemptions } from './customer-detail/CustomerRedemptions';
import { AddPointsModal } from './customer-detail/AddPointsModal';
import { RedeemModal } from './customer-detail/RedeemModal';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [pendingRedemptions, setPendingRedemptions] = useState<CustomerRedemption[]>([]);
  const [completedRedemptions, setCompletedRedemptions] = useState<CustomerRedemption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactionOffset, setTransactionOffset] = useState(0);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false);
  const transactionLimit = 10;

  const [showAddPointsModal, setShowAddPointsModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    const result = await adminCustomersListApi.get(id);
    if (result.error) setError(result.error);
    else if (result.data) setCustomer(result.data);
  }, [id]);

  const fetchTransactions = useCallback(async (offset = 0) => {
    if (!id) return;
    const result = await adminCustomersListApi.getTransactions(id, { limit: transactionLimit, offset });
    if (result.data) {
      if (offset === 0) setTransactions(result.data.transactions);
      else setTransactions((prev) => [...prev, ...result.data!.transactions]);
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

  useEffect(() => { loadAllData(); }, [loadAllData]);

  const handleBalanceUpdate = (newBalance: number) => {
    if (customer) setCustomer({ ...customer, points_balance: newBalance });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Spinner size="lg" />
        <p className="mt-3 text-sm text-gray-500">Loading customer details...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <>
        <PageHeader title="Customer" backTo="/customers" />
        <Alert variant="error">{error || 'Customer not found'}</Alert>
      </>
    );
  }

  return (
    <>
      <PageHeader title={customer.name} backTo="/customers" />

      <CustomerHeader
        customer={customer}
        onAddPoints={() => setShowAddPointsModal(true)}
        onRedeem={() => setShowRedeemModal(true)}
      />

      {/* Referral Information */}
      {(customer.referred_by || customer.referrals.length > 0) && (
        <Card title="Referral Information" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Referred By</h4>
              {customer.referred_by ? (
                <div className="flex items-center gap-3 p-3 bg-[#F8F6F3] rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-[#62A2C3]/15 flex items-center justify-center">
                    <span className="text-[#4F8BA8] font-medium text-sm">
                      {customer.referred_by.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <button
                    onClick={() => navigate(`/customers/${customer.referred_by!.id}`)}
                    className="text-[#62A2C3] hover:text-[#4F8BA8] font-medium hover:underline"
                  >
                    {customer.referred_by.name}
                  </button>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No referrer</p>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Referred Customers ({customer.referrals.length})
              </h4>
              {customer.referrals.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {customer.referrals.map((referral) => (
                    <div key={referral.id} className="flex items-center justify-between p-3 bg-[#F8F6F3] rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#62A2C3]/15 flex items-center justify-center">
                          <span className="text-[#4F8BA8] font-medium text-xs">
                            {referral.name.split(' ').map((n) => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <button
                          onClick={() => navigate(`/customers/${referral.id}`)}
                          className="text-[#62A2C3] hover:text-[#4F8BA8] font-medium text-sm hover:underline"
                        >
                          {referral.name}
                        </button>
                      </div>
                      <span className="text-xs text-gray-500">
                        Joined {new Date(referral.join_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No referrals yet</p>
              )}
            </div>
          </div>
        </Card>
      )}

      <CustomerDogs dogs={customer.dogs || []} />

      <CustomerBookings
        upcomingBookings={customer.upcoming_bookings || []}
        recentBookings={customer.recent_bookings || []}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CustomerTransactions
          transactions={transactions}
          transactionTotal={transactionTotal}
          hasMoreTransactions={hasMoreTransactions}
          onLoadMore={() => fetchTransactions(transactionOffset)}
        />
        <CustomerRedemptions
          pendingRedemptions={pendingRedemptions}
          completedRedemptions={completedRedemptions}
        />
      </div>

      <AddPointsModal
        isOpen={showAddPointsModal}
        onClose={() => setShowAddPointsModal(false)}
        customer={customer}
        onSuccess={handleBalanceUpdate}
        onTransactionsChanged={() => fetchTransactions(0)}
      />

      <RedeemModal
        isOpen={showRedeemModal}
        onClose={() => setShowRedeemModal(false)}
        customer={customer}
        onSuccess={handleBalanceUpdate}
        onDataChanged={() => { fetchTransactions(0); fetchRedemptions(); }}
      />
    </>
  );
}
