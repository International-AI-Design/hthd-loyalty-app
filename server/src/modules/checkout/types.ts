import { z } from 'zod';

// --- Payment Methods ---

export const PAYMENT_METHODS = ['wallet', 'card', 'split', 'cash'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// --- Zod Schemas ---

export const checkoutSchema = z.object({
  bookingIds: z
    .array(z.string().uuid('Invalid booking ID'))
    .min(1, 'At least one booking is required'),
  paymentMethod: z.enum(PAYMENT_METHODS, {
    message: 'paymentMethod must be one of: wallet, card, split, cash',
  }),
  walletAmountCents: z
    .number()
    .int('Amount must be a whole number of cents')
    .min(0, 'Wallet amount cannot be negative')
    .optional()
    .default(0),
  tipCents: z
    .number()
    .int('Tip must be a whole number of cents')
    .min(0, 'Tip cannot be negative')
    .optional()
    .default(0),
  idempotencyKey: z.string().uuid('Invalid idempotency key').optional(),
}).refine(
  (data) => {
    // wallet method requires no walletAmountCents override (uses full amount)
    // split method requires walletAmountCents > 0
    if (data.paymentMethod === 'split' && (!data.walletAmountCents || data.walletAmountCents <= 0)) {
      return false;
    }
    return true;
  },
  { message: 'Split payment requires walletAmountCents > 0', path: ['walletAmountCents'] }
);

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// --- Checkout Result ---

export interface CheckoutResult {
  paymentId: string;
  transactionId: string;
  totalCents: number;
  walletAmountCents: number;
  cardAmountCents: number;
  tipCents: number;
  status: string;
  bookings: Array<{
    id: string;
    status: string;
  }>;
  createdAt: Date;
}

// --- Receipt ---

export interface ReceiptData {
  paymentId: string;
  transactionId: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  bookings: Array<{
    id: string;
    serviceType: string;
    date: string;
    startDate: string | null;
    endDate: string | null;
    dogs: string[];
    totalCents: number;
  }>;
  totalCents: number;
  walletAmountCents: number;
  cardAmountCents: number;
  tipCents: number;
  paymentMethod: string;
  status: string;
  createdAt: Date;
}
