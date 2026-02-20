import { useState } from 'react';
import { Button, Alert, Modal } from '../../components/ui';
import { adminRedemptionsApi } from '../../lib/api';
import type { CustomerDetail } from '../../lib/api';

const REWARD_TIERS = [
  { points: 100, discount: 10 },
  { points: 250, discount: 25 },
  { points: 500, discount: 50 },
];

interface RedeemModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerDetail;
  onSuccess: (newBalance: number) => void;
  onDataChanged: () => void;
}

export function RedeemModal({ isOpen, onClose, customer, onSuccess, onDataChanged }: RedeemModalProps) {
  const [selectedTier, setSelectedTier] = useState<{ points: number; discount: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{ newBalance: number; discount: number } | null>(null);

  const handleSelectTier = (tier: { points: number; discount: number }) => {
    setSelectedTier(tier);
    setError(null);
    setSuccessResult(null);
  };

  const handleProcess = async () => {
    if (!selectedTier) return;
    setIsProcessing(true);
    setError(null);
    const result = await adminRedemptionsApi.create({
      customer_id: customer.id,
      reward_tier: String(selectedTier.points) as '100' | '250' | '500',
    });
    setIsProcessing(false);
    if (result.error) { setError(result.error); }
    else if (result.data) {
      setSuccessResult({ newBalance: result.data.customer.new_balance, discount: result.data.discount_to_apply });
      onSuccess(result.data.customer.new_balance);
      onDataChanged();
    }
  };

  const handleClose = () => {
    setSelectedTier(null);
    setError(null);
    setSuccessResult(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Process Redemption">
      <div>
        <div className="mb-4">
          <p className="text-gray-600">Processing redemption for <span className="font-semibold">{customer.name}</span></p>
          <p className="text-sm text-gray-500">Current balance: {customer.points_balance.toLocaleString()} pts</p>
        </div>
        {successResult && (
          <Alert variant="success" className="mb-4">
            <div className="flex justify-between items-center">
              <div>
                <strong>Redemption processed!</strong>
                <p className="text-sm mt-1">New balance: {successResult.newBalance.toLocaleString()} pts</p>
              </div>
              <div className="text-right">
                <p className="text-sm">Discount to apply</p>
                <p className="text-2xl font-bold">${successResult.discount}</p>
              </div>
            </div>
          </Alert>
        )}
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        {!selectedTier && !successResult && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3">Select a reward tier:</p>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {REWARD_TIERS.map((tier) => {
                const canAfford = customer.points_balance >= tier.points;
                const pointsNeeded = tier.points - customer.points_balance;
                return (
                  <button
                    key={tier.points}
                    onClick={() => canAfford && handleSelectTier(tier)}
                    disabled={!canAfford}
                    className={`p-3 sm:p-4 rounded-xl border-2 text-center transition-all min-h-[80px] ${
                      canAfford
                        ? 'border-[#62A2C3] bg-[#62A2C3]/5 hover:bg-[#62A2C3]/10 cursor-pointer'
                        : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <div className="text-lg sm:text-xl font-bold">${tier.discount}</div>
                    <div className={`text-sm ${canAfford ? 'text-[#4F8BA8]' : 'text-gray-400'}`}>{tier.points} pts</div>
                    {!canAfford && <div className="text-xs text-[#E8837B] mt-1">Need {pointsNeeded}</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {selectedTier && !successResult && (
          <div className="mb-4">
            <div className="bg-[#F8F6F3] rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Points to Deduct</span>
                <span className="font-medium text-[#E8837B]">-{selectedTier.points}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Balance After</span>
                <span className="font-medium">{(customer.points_balance - selectedTier.points).toLocaleString()} pts</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-600 font-medium">Discount to Apply</span>
                <span className="text-xl font-bold text-[#62A2C3]">${selectedTier.discount}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedTier(null)}>Back</Button>
              <Button className="flex-1" onClick={handleProcess} isLoading={isProcessing}>Confirm Redemption</Button>
            </div>
          </div>
        )}
        {(successResult || (!selectedTier && !successResult)) && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleClose}>{successResult ? 'Close' : 'Cancel'}</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
