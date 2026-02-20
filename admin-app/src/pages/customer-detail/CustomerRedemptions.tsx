import { Card, EmptyState } from '../../components/ui';
import type { CustomerRedemption } from '../../lib/api';

interface CustomerRedemptionsProps {
  pendingRedemptions: CustomerRedemption[];
  completedRedemptions: CustomerRedemption[];
}

export function CustomerRedemptions({ pendingRedemptions, completedRedemptions }: CustomerRedemptionsProps) {
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
    <Card title="Redemptions">
      {/* Pending */}
      {pendingRedemptions.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Pending</h4>
          <div className="space-y-2">
            {pendingRedemptions.map((r) => (
              <div key={r.id} className="p-3 rounded-xl border-2 border-[#F5C65D] bg-[#F5C65D]/10">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-mono font-bold text-lg">{r.redemption_code}</p>
                    <p className="text-sm text-gray-500">{formatDateTime(r.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-[#62A2C3]">${r.discount_value}</p>
                    <p className="text-xs text-gray-500">{r.reward_tier} pts</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completedRedemptions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Completed</h4>
          <div className="space-y-2">
            {completedRedemptions.map((r) => (
              <div key={r.id} className="p-3 rounded-xl border border-gray-100 bg-[#F8F6F3]/50">
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
        <EmptyState title="No redemptions yet" />
      )}
    </Card>
  );
}
