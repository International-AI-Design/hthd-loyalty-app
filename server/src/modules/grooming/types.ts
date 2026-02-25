import { z } from 'zod';

// --- Input Schemas (parse at boundary) ---

export const GroomingServicePriceCreateSchema = z.object({
  subServiceId: z.string().uuid(),
  sizeCategory: z.string().optional(),
  priceCents: z.number().int().positive(),
});

export const GroomingServicePriceUpdateSchema = z.object({
  priceCents: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const GroomingAddOnCreateSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().positive(),
  sortOrder: z.number().int().optional(),
});

export const GroomingAddOnUpdateSchema = GroomingAddOnCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type GroomingServicePriceCreate = z.infer<typeof GroomingServicePriceCreateSchema>;
export type GroomingServicePriceUpdate = z.infer<typeof GroomingServicePriceUpdateSchema>;
export type GroomingAddOnCreate = z.infer<typeof GroomingAddOnCreateSchema>;
export type GroomingAddOnUpdate = z.infer<typeof GroomingAddOnUpdateSchema>;

// --- Error Types (discriminated unions — exhaustive handling required) ---

export type PricingError =
  | { type: 'NOT_FOUND'; entity: string; id: string }
  | { type: 'DUPLICATE_PRICE'; subServiceId: string; sizeCategory: string | null }
  | { type: 'VALIDATION_ERROR'; message: string }
  | { type: 'DB_ERROR'; cause: unknown };

export type AddOnError =
  | { type: 'NOT_FOUND'; id: string }
  | { type: 'DUPLICATE_NAME'; name: string }
  | { type: 'DB_ERROR'; cause: unknown };
