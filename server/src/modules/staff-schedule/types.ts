import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const ScheduleCreateSchema = z.object({
  staffUserId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  role: z.enum(['general', 'groomer', 'manager', 'kennel_tech']).default('general'),
  notes: z.string().optional(),
});

export const ScheduleUpdateSchema = z.object({
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  role: z.enum(['general', 'groomer', 'manager', 'kennel_tech']).optional(),
  notes: z.string().optional(),
});

export const ScheduleBulkCreateSchema = z.object({
  schedules: z.array(ScheduleCreateSchema).min(1).max(50),
});

export const WeekViewParamsSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ScheduleCreate = z.infer<typeof ScheduleCreateSchema>;
export type ScheduleUpdate = z.infer<typeof ScheduleUpdateSchema>;
export type ScheduleBulkCreate = z.infer<typeof ScheduleBulkCreateSchema>;
export type WeekViewParams = z.infer<typeof WeekViewParamsSchema>;
