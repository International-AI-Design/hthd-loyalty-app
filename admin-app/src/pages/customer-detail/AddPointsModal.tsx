import { useState } from 'react';
import { Button, Input, Select, Alert, Modal } from '../../components/ui';
import { adminPointsApi } from '../../lib/api';
import type { CustomerDetail } from '../../lib/api';

const POINTS_CAP = 500;

const SERVICE_TYPES = [
  { value: 'daycare', label: 'Daycare' },
  { value: 'boarding', label: 'Boarding' },
  { value: 'grooming', label: 'Grooming (1.5x points)' },
];

interface AddPointsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerDetail;
  onSuccess: (newBalance: number) => void;
  onTransactionsChanged: () => void;
}

export function AddPointsModal({ isOpen, onClose, customer, onSuccess, onTransactionsChanged }: AddPointsModalProps) {
  const [dollarAmount, setDollarAmount] = useState('');
  const [serviceType, setServiceType] = useState<'daycare' | 'boarding' | 'grooming'>('daycare');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<{ pointsEarned: number; newBalance: number } | null>(null);

  const calculatePoints = (amount: number, service: string): number => {
    return Math.floor(amount * (service === 'grooming' ? 1.5 : 1));
  };

  const parsedAmount = parseFloat(dollarAmount) || 0;
  const previewPoints = parsedAmount > 0 ? calculatePoints(parsedAmount, serviceType) : 0;

  const handleSubmit = async () => {
    const amount = parseFloat(dollarAmount);
    if (isNaN(amount) || amount <= 0) { setError('Please enter a valid dollar amount'); return; }
    setIsSubmitting(true);
    setError(null);
    const result = await adminPointsApi.add({ customer_id: customer.id, dollar_amount: amount, service_type: serviceType });
    setIsSubmitting(false);
    if (result.error) { setError(result.error); }
    else if (result.data) {
      setSuccessMsg({ pointsEarned: result.data.transaction.points_earned, newBalance: result.data.customer.new_balance });
      onSuccess(result.data.customer.new_balance);
      onTransactionsChanged();
      setDollarAmount('');
      setServiceType('daycare');
    }
  };

  const handleClose = () => {
    setDollarAmount('');
    setServiceType('daycare');
    setError(null);
    setSuccessMsg(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Points">
      <div>
        <div className="mb-4">
          <p className="text-gray-600">Adding points for <span className="font-semibold">{customer.name}</span></p>
          <p className="text-sm text-gray-500">Current balance: {customer.points_balance.toLocaleString()} pts</p>
          {customer.points_balance >= POINTS_CAP && (
            <div className="mt-2 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <p className="text-sm font-medium">Customer is at the {POINTS_CAP}-point cap.</p>
            </div>
          )}
        </div>
        {successMsg && (
          <Alert variant="success" className="mb-4">
            <strong>Points added!</strong>
            <p className="text-sm mt-1">{successMsg.pointsEarned} points earned. New balance: {successMsg.newBalance.toLocaleString()} pts</p>
          </Alert>
        )}
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        <div className="space-y-4 mb-4">
          <Input label="Dollar Amount" type="number" min="0" step="0.01" placeholder="0.00" value={dollarAmount} onChange={(e) => setDollarAmount(e.target.value)} />
          <Select label="Service Type" options={SERVICE_TYPES} value={serviceType} onChange={(e) => setServiceType(e.target.value as 'daycare' | 'boarding' | 'grooming')} />
        </div>
        {previewPoints > 0 && (
          <div className="bg-[#F8F6F3] border border-gray-200 rounded-xl p-4 mb-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-600">Points to be earned</p>
                {serviceType === 'grooming' && <p className="text-sm text-[#62A2C3] font-medium">1.5x bonus!</p>}
              </div>
              <p className="text-2xl font-bold text-[#62A2C3]">+{previewPoints.toLocaleString()}</p>
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={handleClose}>{successMsg ? 'Close' : 'Cancel'}</Button>
          {!successMsg && (
            <Button className="flex-1" onClick={handleSubmit} isLoading={isSubmitting} disabled={!dollarAmount || parsedAmount <= 0}>
              Add {previewPoints > 0 ? `${previewPoints.toLocaleString()} Points` : 'Points'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
