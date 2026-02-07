import { z } from 'zod';

export const DashboardParamsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const DateRangeParamsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type DashboardParams = z.infer<typeof DashboardParamsSchema>;
export type DateRangeParams = z.infer<typeof DateRangeParamsSchema>;
