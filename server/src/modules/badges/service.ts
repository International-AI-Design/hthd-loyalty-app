import { okAsync, errAsync, ResultAsync } from 'neverthrow';
import { prisma } from '../../lib/prisma';
import {
  BADGE_DEFINITIONS,
  BADGE_THRESHOLDS,
  BadgeName,
  BadgeError,
  BadgeWithDisplay,
  NextBadgeProgress,
  EvaluationResult,
} from './types';

function enrichBadge(raw: {
  id: string;
  badge: string;
  earnedAt: Date;
  notified: boolean;
}): BadgeWithDisplay {
  const def = BADGE_DEFINITIONS[raw.badge as BadgeName];
  return {
    id: raw.id,
    badge: raw.badge,
    displayName: def?.displayName ?? raw.badge,
    description: def?.description ?? '',
    icon: def?.icon ?? '🏅',
    earnedAt: raw.earnedAt,
    notified: raw.notified,
  };
}

interface CustomerStats {
  bookings: number;
  grooming: number;
  boarding: number;
  referrals: number;
  points: number;
  compliance: number; // 1 if all vax current, 0 otherwise
}

function gatherStats(customerId: string): ResultAsync<CustomerStats, BadgeError> {
  return ResultAsync.fromPromise(
    (async () => {
      const completedStatuses = ['confirmed', 'checked_in', 'checked_out'];

      const [bookingCount, groomingCount, boardingCount, customerWithRefs, pointsAgg, dogs] =
        await Promise.all([
          (prisma as any).booking.count({
            where: { customerId, status: { in: completedStatuses } },
          }),
          (prisma as any).booking.count({
            where: {
              customerId,
              status: { in: completedStatuses },
              serviceType: { name: 'grooming' },
            },
          }),
          (prisma as any).booking.count({
            where: {
              customerId,
              status: { in: completedStatuses },
              serviceType: { name: 'boarding' },
            },
          }),
          prisma.customer.findUnique({
            where: { id: customerId },
            select: { referrals: { select: { id: true } } },
          }),
          prisma.pointsTransaction.aggregate({
            where: { customerId, amount: { gt: 0 } },
            _sum: { amount: true },
          }),
          prisma.dog.findMany({
            where: { customerId },
            include: { vaccinations: true },
          }),
        ]);

      const refCount = customerWithRefs?.referrals?.length ?? 0;
      const totalPoints = pointsAgg._sum.amount ?? 0;

      const now = new Date();
      const allVaxCurrent =
        dogs.length > 0 &&
        dogs.every((dog: any) => {
          const vax = (dog as any).vaccinations ?? [];
          if (vax.length === 0) return false;
          return vax.every(
            (v: any) => !v.expiresAt || new Date(v.expiresAt) > now,
          );
        });

      return {
        bookings: bookingCount as number,
        grooming: groomingCount as number,
        boarding: boardingCount as number,
        referrals: refCount,
        points: totalPoints,
        compliance: allVaxCurrent ? 1 : 0,
      };
    })(),
    (e): BadgeError => ({ type: 'DB_ERROR', cause: e }),
  );
}

export function getCustomerBadges(
  customerId: string,
): ResultAsync<BadgeWithDisplay[], BadgeError> {
  return ResultAsync.fromPromise(
    (prisma as any).customerBadge.findMany({
      where: { customerId },
      orderBy: { earnedAt: 'asc' },
    }) as Promise<any[]>,
    (e): BadgeError => ({ type: 'DB_ERROR', cause: e }),
  ).map((badges) => badges.map(enrichBadge));
}

export function evaluateBadges(
  customerId: string,
): ResultAsync<EvaluationResult, BadgeError> {
  return ResultAsync.fromPromise(
    (prisma as any).customerBadge.findMany({ where: { customerId } }) as Promise<any[]>,
    (e): BadgeError => ({ type: 'DB_ERROR', cause: e }),
  ).andThen((existing) => {
    const earnedSet = new Set(existing.map((b: any) => b.badge as string));

    return gatherStats(customerId).andThen((stats) => {
      return ResultAsync.fromPromise(
        (async () => {
          const newBadges: string[] = [];

          const entries = Object.entries(BADGE_THRESHOLDS) as [
            BadgeName,
            { stat: string; target: number },
          ][];

          for (const [badge, { stat, target }] of entries) {
            const value = stats[stat as keyof CustomerStats];
            if (value >= target && !earnedSet.has(badge)) {
              await (prisma as any).customerBadge.create({
                data: { customerId, badge },
              });
              newBadges.push(badge);
            }
          }

          const allBadges = await (prisma as any).customerBadge.findMany({
            where: { customerId },
            orderBy: { earnedAt: 'asc' },
          });

          return {
            newBadges,
            allBadges: (allBadges as any[]).map(enrichBadge),
          };
        })(),
        (e): BadgeError => ({ type: 'DB_ERROR', cause: e }),
      );
    });
  });
}

export function awardBadge(
  customerId: string,
  badge: string,
): ResultAsync<BadgeWithDisplay, BadgeError> {
  return ResultAsync.fromPromise(
    (prisma as any).customerBadge.upsert({
      where: { customerId_badge: { customerId, badge } },
      update: {},
      create: { customerId, badge },
    }) as Promise<any>,
    (e): BadgeError => ({ type: 'DB_ERROR', cause: e }),
  ).map((raw) => enrichBadge(raw));
}

export function getNextBadge(
  customerId: string,
): ResultAsync<NextBadgeProgress | null, BadgeError> {
  return ResultAsync.fromPromise(
    (prisma as any).customerBadge.findMany({ where: { customerId } }) as Promise<any[]>,
    (e): BadgeError => ({ type: 'DB_ERROR', cause: e }),
  ).andThen((existing) => {
    const earnedSet = new Set(existing.map((b: any) => b.badge as string));

    return gatherStats(customerId).map((stats) => {
      // Find closest unearned badge by progress percentage
      let best: NextBadgeProgress | null = null;
      let bestPct = -1;

      const entries = Object.entries(BADGE_THRESHOLDS) as [
        BadgeName,
        { stat: string; target: number },
      ][];

      for (const [badge, { stat, target }] of entries) {
        if (earnedSet.has(badge)) continue;
        const value = stats[stat as keyof CustomerStats];
        const pct = Math.min(Math.round((value / target) * 100), 99);
        if (pct > bestPct) {
          bestPct = pct;
          const def = BADGE_DEFINITIONS[badge];
          best = {
            badge,
            displayName: def.displayName,
            description: def.description,
            icon: def.icon,
            progress: value,
            target,
            progressPct: pct,
          };
        }
      }

      return best;
    });
  });
}

export function markNotified(
  badgeId: string,
): ResultAsync<void, BadgeError> {
  return ResultAsync.fromPromise(
    (prisma as any).customerBadge.update({
      where: { id: badgeId },
      data: { notified: true },
    }) as Promise<any>,
    (e): BadgeError => ({ type: 'DB_ERROR', cause: e }),
  ).map(() => undefined);
}
