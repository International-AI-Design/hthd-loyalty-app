import { z } from 'zod';

// --- Type aliases ---

export type WalletTier = 'basic' | 'gold' | 'vip';
export type TransactionType = 'load' | 'payment' | 'refund' | 'adjustment';

// --- Zod schemas ---

export const loadFundsSchema = z.object({
  amount_cents: z
    .number()
    .int('Amount must be a whole number of cents')
    .min(500, 'Minimum load is $5.00 (500 cents)')
    .max(50000, 'Maximum load is $500.00 (50000 cents)'),
});

export const deductFundsSchema = z.object({
  amount_cents: z
    .number()
    .int('Amount must be a whole number of cents')
    .positive('Amount must be positive'),
  booking_id: z.string().uuid('Invalid booking ID').optional(),
  description: z.string().min(1, 'Description is required'),
});

export const autoReloadSchema = z.object({
  enabled: z.boolean(),
  threshold_cents: z
    .number()
    .int()
    .min(500, 'Minimum threshold is $5.00 (500 cents)')
    .optional(),
  reload_amount_cents: z
    .number()
    .int()
    .min(500, 'Minimum reload is $5.00 (500 cents)')
    .max(20000, 'Maximum reload is $200.00 (20000 cents)')
    .optional(),
}).refine(
  (data) => {
    if (data.enabled) {
      return data.threshold_cents !== undefined && data.reload_amount_cents !== undefined;
    }
    return true;
  },
  { message: 'threshold_cents and reload_amount_cents are required when enabling auto-reload' }
);

// --- Derived input types ---

export type LoadFundsInput = z.infer<typeof loadFundsSchema>;
export type DeductFundsInput = z.infer<typeof deductFundsSchema>;
export type AutoReloadConfig = z.infer<typeof autoReloadSchema>;
