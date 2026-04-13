import { z } from 'zod';

export const DogProfileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  breed: z.string().nullish(),
  birthDate: z.string().nullish(),
  weight: z.number().positive().nullish(),
  temperament: z.enum(['calm', 'energetic', 'anxious', 'friendly', 'reactive']).nullish(),
  careInstructions: z.string().nullish(),
  isNeutered: z.boolean().nullish(),
  photoUrl: z.string().url().nullish(),
  socialNotes: z.string().nullish(),
  sizeCategory: z.enum(['small', 'medium', 'large', 'xl']).nullish(),
  allergies: z.string().nullish(),
  specialNeeds: z.string().nullish(),
  emergencyVetName: z.string().nullish(),
  emergencyVetPhone: z.string().nullish(),
  lastGroomDate: z.string().nullish(),
  // Sprint 5a: Dog Model Enrichment
  vetName: z.string().nullish(),
  vetPhone: z.string().nullish(),
  vetAddress: z.string().nullish(),
  vetEmail: z.string().email().nullish(),
  microchipNumber: z.string().nullish(),
  color: z.string().nullish(),
  feedingMethod: z.enum(['free_feed', 'scheduled', 'measured']).nullish(),
  foodType: z.enum(['dry', 'wet', 'raw', 'mixed']).nullish(),
  feedingNotes: z.string().nullish(),
  alteredStatus: z.enum(['intact', 'spayed', 'neutered']).nullish(),
  alteredDate: z.string().nullish(),
  emergencyAgent: z.string().nullish(),
  emergencyAgentRelationship: z.string().nullish(),
  emergencyAgentPhone: z.string().nullish(),
  emergencyVetCostLimit: z.number().int().min(0).nullish(),
  goodWith: z.string().nullish(),
});

export const VaccinationCreateSchema = z.object({
  name: z.string().min(1),
  dateGiven: z.string(),
  expiresAt: z.string().optional(),
  vetName: z.string().optional(),
  documentUrl: z.string().optional(),
  notes: z.string().optional(),
  cloudinaryPublicId: z.string().optional(),
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
