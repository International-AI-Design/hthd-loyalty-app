import { useState, useEffect, useCallback } from 'react';
import { badgeApi } from '../lib/api';
import type { CustomerBadge } from '../lib/api';

// All possible badges for the "locked" display
const ALL_BADGES = [
  { badge: 'first_visit', displayName: 'First Visit', description: 'Completed first visit', icon: '🐾' },
  { badge: 'loyal_5', displayName: 'Regular', description: '5 visits completed', icon: '⭐' },
  { badge: 'loyal_10', displayName: 'VIP Pup', description: '10 visits completed', icon: '🌟' },
  { badge: 'loyal_25', displayName: 'Best Friend', description: '25 visits completed', icon: '💎' },
  { badge: 'grooming_first', displayName: 'Fresh & Clean', description: 'First grooming appointment', icon: '✨' },
  { badge: 'boarding_first', displayName: 'Sleepover Star', description: 'First boarding stay', icon: '🏠' },
  { badge: 'referral_first', displayName: 'Social Butterfly', description: 'First successful referral', icon: '🦋' },
  { badge: 'referral_5', displayName: 'Pack Leader', description: '5 successful referrals', icon: '👑' },
  { badge: 'points_500', displayName: 'Points Pro', description: 'Earned 500 points', icon: '🎯' },
  { badge: 'perfect_compliance', displayName: 'Health Hero', description: 'All vaccinations up to date', icon: '💚' },
] as const;

export function BadgeGrid() {
  const [earned, setEarned] = useState<CustomerBadge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBadges = useCallback(async () => {
    setIsLoading(true);
    const result = await badgeApi.getBadges();
    setIsLoading(false);
    if (result.data) {
      setEarned(result.data.badges || []);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-brand-sand/40 rounded-2xl h-28" />
        ))}
      </div>
    );
  }

  const earnedSet = new Set(earned.map((b) => b.badge));

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {ALL_BADGES.map((badge) => {
        const isEarned = earnedSet.has(badge.badge);
        const earnedData = earned.find((b) => b.badge === badge.badge);

        return (
          <div
            key={badge.badge}
            className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
              isEarned
                ? 'bg-white border-brand-primary/20 shadow-md'
                : 'bg-gray-50 border-gray-200 opacity-50'
            }`}
          >
            <span className={`text-3xl mb-1.5 ${isEarned ? '' : 'grayscale'}`}>
              {badge.icon}
            </span>
            <p className={`text-xs font-semibold leading-tight ${
              isEarned ? 'text-brand-forest' : 'text-gray-400'
            }`}>
              {badge.displayName}
            </p>
            {isEarned && earnedData && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {new Date(earnedData.earnedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            )}
            {!isEarned && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
