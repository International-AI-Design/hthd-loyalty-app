import { Button, Badge, Card } from '../../components/ui';
import type { CustomerDetail } from '../../lib/api';

const POINTS_CAP = 500;

interface CustomerHeaderProps {
  customer: CustomerDetail;
  onAddPoints: () => void;
  onRedeem: () => void;
}

export function CustomerHeader({ customer, onAddPoints, onRedeem }: CustomerHeaderProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <Card className="mb-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#1B365D]">{customer.name}</h2>
          <p className="text-gray-600">{customer.email}</p>
          <p className="text-gray-600">{customer.phone}</p>
          <p className="text-sm text-gray-500 mt-2">
            Member since {formatDate(customer.join_date)}
          </p>
          <p className="text-sm text-gray-500">
            Referral Code: <span className="font-mono font-medium">{customer.referral_code}</span>
          </p>
        </div>
        <div className="text-left sm:text-right bg-[#62A2C3]/10 sm:bg-transparent p-3 sm:p-0 rounded-xl">
          <p className="text-sm text-gray-600">Points Balance</p>
          <p className={`text-3xl sm:text-4xl font-bold ${customer.points_balance >= POINTS_CAP ? 'text-amber-600' : 'text-[#62A2C3]'}`}>
            {customer.points_balance.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">points</p>
          {customer.points_balance >= POINTS_CAP && (
            <Badge variant="overdue" className="mt-1">AT CAP ({POINTS_CAP})</Badge>
          )}
          {customer.points_balance >= 450 && customer.points_balance < POINTS_CAP && (
            <Badge variant="active" className="mt-1">Near cap ({POINTS_CAP - customer.points_balance} to max)</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <Button onClick={onAddPoints} className="w-full sm:w-auto">
          Add Points
        </Button>
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={onRedeem}
          disabled={customer.points_balance < 100}
        >
          Process Redemption
        </Button>
      </div>
    </Card>
  );
}
