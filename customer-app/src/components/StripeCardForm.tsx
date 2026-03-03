import { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { StripeCardElementChangeEvent } from '@stripe/stripe-js';

interface StripeCardFormProps {
  clientSecret: string;
  amountCents: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (msg: string) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  submitLabel: string;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#1B365D',
      fontFamily: '"Open Sans", system-ui, sans-serif',
      '::placeholder': { color: '#9CA3AF' },
    },
    invalid: {
      color: '#EF4444',
      iconColor: '#EF4444',
    },
  },
};

export function StripeCardForm({
  clientSecret,
  amountCents,
  onSuccess,
  onError,
  isProcessing,
  setIsProcessing,
  submitLabel,
}: StripeCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const handleCardChange = (event: StripeCardElementChangeEvent) => {
    setCardError(event.error?.message ?? null);
    setCardComplete(event.complete);
  };

  const handleSubmit = async () => {
    if (!stripe || !elements || !clientSecret) return;

    const card = elements.getElement(CardElement);
    if (!card) return;

    setIsProcessing(true);
    setCardError(null);

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card },
    });

    if (error) {
      setCardError(error.message ?? 'Payment failed. Please try again.');
      onError(error.message ?? 'Payment failed.');
      setIsProcessing(false);
    } else if (paymentIntent) {
      onSuccess(paymentIntent.id);
    }
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Card Details</label>
        <div className="px-4 py-3.5 border border-gray-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-brand-primary focus-within:border-brand-primary transition-all min-h-[44px]">
          <CardElement options={CARD_ELEMENT_OPTIONS} onChange={handleCardChange} />
        </div>
        {cardError && (
          <p className="text-sm text-red-500 mt-1.5">{cardError}</p>
        )}
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!stripe || !cardComplete || isProcessing}
        className={`w-full py-3.5 px-4 rounded-xl font-semibold text-white min-h-[44px] transition-opacity ${
          stripe && cardComplete && !isProcessing
            ? 'bg-brand-primary hover:opacity-90'
            : 'bg-gray-300 cursor-not-allowed'
        }`}
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : (
          submitLabel || `Pay ${formatPrice(amountCents)}`
        )}
      </button>
    </div>
  );
}
