import { z } from 'zod';

// --- Booking Status ---

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// --- Availability ---

export interface AvailabilityQuery {
  serviceTypeId: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
}

export interface AvailabilityResult {
  date: string;
  available: boolean;
  spotsRemaining: number;
  totalCapacity: number;
}

// --- Create Booking ---

export interface CreateBookingInput {
  customerId: string;
  serviceTypeId: string;
  dogIds: string[];
  date: string; // ISO date string
  startTime?: string; // HH:MM for grooming
  notes?: string;
}

// --- Zod Schemas ---

export const createBookingSchema = z.object({
  serviceTypeId: z.string().uuid('Invalid service type ID'),
  dogIds: z
    .array(z.string().uuid('Invalid dog ID'))
    .min(1, 'At least one dog is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Start time must be HH:MM format')
    .optional(),
  notes: z.string().max(1000).optional(),
});

export const availabilityQuerySchema = z.object({
  serviceTypeId: z.string().uuid('Invalid service type ID'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD format'),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const checkOutSchema = z.object({
  notes: z.string().max(1000).optional(),
});
