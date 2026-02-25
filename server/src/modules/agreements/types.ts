import { z } from 'zod';

export const AgreementCreateSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  content: z.string().min(1),
  requiredFor: z.array(z.string()),
  version: z.number().int().positive().optional(),
});

export const AgreementUpdateSchema = AgreementCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const SignatureCreateSchema = z.object({
  agreementId: z.string().uuid(),
  typedName: z.string().min(1),
  agreedToTerms: z.literal(true),
});

export const BoardingDetailSchema = z.object({
  feedingSchedule: z.string().optional(),
  foodType: z.string().optional(),
  foodBrand: z.string().optional(),
  feedingNotes: z.string().optional(),
  dropOffTime: z.string().optional(),
  pickUpTime: z.string().optional(),
  specialItems: z.string().optional(),
  emergencyContact: z.string().optional(),
});

export type AgreementCreate = z.infer<typeof AgreementCreateSchema>;
export type AgreementUpdate = z.infer<typeof AgreementUpdateSchema>;
export type SignatureCreate = z.infer<typeof SignatureCreateSchema>;
export type BoardingDetailUpdate = z.infer<typeof BoardingDetailSchema>;
