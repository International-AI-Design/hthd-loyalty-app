import { z } from 'zod';

export const InsightQuerySchema = z.object({
  type: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export type InsightQuery = z.infer<typeof InsightQuerySchema>;

export type AnalyticsError =
  | { type: 'DB_ERROR'; cause: unknown }
  | { type: 'VALIDATION_ERROR'; message: string };

export interface RevenueSnapshot {
  today: number;
  thisWeek: number;
  thisMonth: number;
  todayChange: number;
  weekChange: number;
  monthChange: number;
}

export interface CustomerSegments {
  new: number;
  active: number;
  atRisk: number;
  churned: number;
}

export interface CapacityData {
  services: Array<{
    name: string;
    displayName: string;
    booked: number;
    capacity: number;
    utilizationPct: number;
  }>;
  weekStart: string;
  weekEnd: string;
}

export interface InsightRecord {
  id: string;
  type: string;
  title: string;
  summary: string;
  data: unknown;
  generatedAt: Date;
  expiresAt: Date;
}
