import { z } from 'zod';

export const BADGE_DEFINITIONS = {
  first_visit: { displayName: 'First Visit', description: 'Completed first visit', icon: '🐾' },
  loyal_5: { displayName: 'Regular', description: '5 visits completed', icon: '⭐' },
  loyal_10: { displayName: 'VIP Pup', description: '10 visits completed', icon: '🌟' },
  loyal_25: { displayName: 'Best Friend', description: '25 visits completed', icon: '💎' },
  grooming_first: { displayName: 'Fresh & Clean', description: 'First grooming appointment', icon: '✨' },
  boarding_first: { displayName: 'Sleepover Star', description: 'First boarding stay', icon: '🏠' },
  referral_first: { displayName: 'Social Butterfly', description: 'First successful referral', icon: '🦋' },
  referral_5: { displayName: 'Pack Leader', description: '5 successful referrals', icon: '👑' },
  points_500: { displayName: 'Points Pro', description: 'Earned 500 points', icon: '🎯' },
  perfect_compliance: { displayName: 'Health Hero', description: 'All vaccinations up to date', icon: '💚' },
} as const;

export type BadgeName = keyof typeof BADGE_DEFINITIONS;

export const BadgeAwardSchema = z.object({
  customerId: z.string().uuid(),
  badge: z.string(),
});

export type BadgeError =
  | { type: 'NOT_FOUND'; entity: string; id: string }
  | { type: 'DB_ERROR'; cause: unknown };

export interface BadgeWithDisplay {
  id: string;
  badge: string;
  displayName: string;
  description: string;
  icon: string;
  earnedAt: Date;
  notified: boolean;
}

export interface NextBadgeProgress {
  badge: string;
  displayName: string;
  description: string;
  icon: string;
  progress: number;
  target: number;
  progressPct: number;
}

export interface EvaluationResult {
  newBadges: string[];
  allBadges: BadgeWithDisplay[];
}

// Badge thresholds for evaluation
export const BADGE_THRESHOLDS: Record<BadgeName, { stat: string; target: number }> = {
  first_visit: { stat: 'bookings', target: 1 },
  loyal_5: { stat: 'bookings', target: 5 },
  loyal_10: { stat: 'bookings', target: 10 },
  loyal_25: { stat: 'bookings', target: 25 },
  grooming_first: { stat: 'grooming', target: 1 },
  boarding_first: { stat: 'boarding', target: 1 },
  referral_first: { stat: 'referrals', target: 1 },
  referral_5: { stat: 'referrals', target: 5 },
  points_500: { stat: 'points', target: 500 },
  perfect_compliance: { stat: 'compliance', target: 1 },
};
