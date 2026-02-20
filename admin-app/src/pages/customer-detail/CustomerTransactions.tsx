import { Button, Card, EmptyState } from '../../components/ui';
import type { CustomerTransaction } from '../../lib/api';

interface CustomerTransactionsProps {
  transactions: CustomerTransaction[];
  transactionTotal: number;
  hasMoreTransactions: boolean;
  onLoadMore: () => void;
}

export function CustomerTransactions({
  transactions,
  transactionTotal,
  hasMoreTransactions,
  onLoadMore,
}: CustomerTransactionsProps) {
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Card
      title="Points Transactions"
      headerRight={<span className="text-sm text-gray-500">{transactionTotal} total</span>}
    >
      {transactions.length === 0 ? (
        <EmptyState title="No transactions yet" />
      ) : (
        <div className="space-y-3">
          {transactions.map((txn) => (
            <div
              key={txn.id}
              className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-3 border-b border-gray-50 last:border-0 gap-2"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#1B365D] text-base">{txn.description}</p>
                <p className="text-sm text-gray-500">{formatDateTime(txn.date)}</p>
                {txn.service_type && (
                  <span className="text-xs text-gray-400 capitalize">{txn.service_type}</span>
                )}
              </div>
              <div className="text-left sm:text-right flex sm:flex-col items-center sm:items-end gap-2 sm:gap-0">
                <p className={`font-semibold text-lg ${txn.points_amount >= 0 ? 'text-[#62A2C3]' : 'text-[#E8837B]'}`}>
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
          <Button variant="outline" size="sm" onClick={onLoadMore}>
            Load More
          </Button>
        </div>
      )}
    </Card>
  );
}
