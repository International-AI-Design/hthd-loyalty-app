import { z } from 'zod';

export const DogProfileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  breed: z.string().optional(),
  birthDate: z.string().optional(),
  weight: z.number().positive().optional(),
  temperament: z.enum(['calm', 'energetic', 'anxious', 'friendly', 'reactive']).optional(),
  careInstructions: z.string().optional(),
  isNeutered: z.boolean().optional(),
  photoUrl: z.string().url().optional(),
  socialNotes: z.string().optional(),
  sizeCategory: z.enum(['small', 'medium', 'large', 'xl']).optional(),
});

export const VaccinationCreateSchema = z.object({
  name: z.string().min(1),
  dateGiven: z.string(),
  expiresAt: z.string().optional(),
  vetName: z.string().optional(),
  documentUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const VaccinationUpdateSchema = VaccinationCreateSchema.partial();

export const MedicationCreateSchema = z.object({
  name: z.string().min(1),
  dosage: z.string().optional(),
  frequency: z.enum(['daily', 'twice_daily', 'weekly', 'as_needed']).optional(),
  instructions: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const MedicationUpdateSchema = MedicationCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const BehaviorNoteCreateSchema = z.object({
  category: z.enum(['social', 'anxiety', 'aggression', 'feeding', 'play', 'general']),
  note: z.string().min(1),
  severity: z.number().int().min(1).max(5).optional(),
});

export type DogProfileUpdate = z.infer<typeof DogProfileUpdateSchema>;
export type VaccinationCreate = z.infer<typeof VaccinationCreateSchema>;
export type VaccinationUpdate = z.infer<typeof VaccinationUpdateSchema>;
export type MedicationCreate = z.infer<typeof MedicationCreateSchema>;
export type MedicationUpdate = z.infer<typeof MedicationUpdateSchema>;
export type BehaviorNoteCreate = z.infer<typeof BehaviorNoteCreateSchema>;
