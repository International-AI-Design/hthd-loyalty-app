import { z } from 'zod';

export const ReportCardCreateSchema = z.object({
  bookingId: z.string().uuid(),
  dogId: z.string().uuid(),
  notes: z.string().min(1),
  photoUrls: z.array(z.string()).default([]),
  rating: z.number().int().min(1).max(5).optional(),
  activities: z.string().optional(),
  meals: z.string().optional(),
  socialBehavior: z.string().optional(),
  mood: z.enum(['happy', 'calm', 'anxious', 'playful', 'tired']).optional(),
});

export const ReportCardUpdateSchema = z.object({
  notes: z.string().min(1).optional(),
  photoUrls: z.array(z.string()).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  activities: z.string().optional(),
  meals: z.string().optional(),
  socialBehavior: z.string().optional(),
  mood: z.enum(['happy', 'calm', 'anxious', 'playful', 'tired']).optional(),
});

export const ReportCardListParamsSchema = z.object({
  dogId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ReportCardCreate = z.infer<typeof ReportCardCreateSchema>;
export type ReportCardUpdate = z.infer<typeof ReportCardUpdateSchema>;
export type ReportCardListParams = z.infer<typeof ReportCardListParamsSchema>;
