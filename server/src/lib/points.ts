// Points system constants and utilities

export const POINTS_CAP = 500;
export const WELCOME_BONUS_POINTS = 25;
export const REFERRAL_BONUS_POINTS = 100;

/**
 * Calculate how many points can actually be awarded given the cap.
 * Returns the capped amount (may be less than requested).
 */
export function capPoints(currentBalance: number, pointsToAdd: number): {
  pointsAwarded: number;
  pointsCapped: number; // how many were lost to the cap
  newBalance: number;
} {
  const uncappedBalance = currentBalance + pointsToAdd;
  const newBalance = Math.min(uncappedBalance, POINTS_CAP);
  const pointsAwarded = newBalance - currentBalance;
  const pointsCapped = pointsToAdd - pointsAwarded;

  return { pointsAwarded, pointsCapped, newBalance };
}
