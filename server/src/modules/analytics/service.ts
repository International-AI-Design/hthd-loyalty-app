import { okAsync, ResultAsync } from 'neverthrow';
import { prisma } from '../../lib/prisma';
import {
  AnalyticsError,
  RevenueSnapshot,
  CustomerSegments,
  CapacityData,
  InsightRecord,
} from './types';

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day;
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

async function sumRevenue(start: Date, end: Date): Promise<number> {
  const result = await prisma.payment.aggregate({
    where: {
      status: 'completed',
      createdAt: { gte: start, lt: end },
    },
    _sum: { totalCents: true },
  });
  return result._sum.totalCents ?? 0;
}

export function getRevenueSnapshot(): ResultAsync<RevenueSnapshot, AnalyticsError> {
  return ResultAsync.fromPromise(
    (async () => {
      const now = new Date();
      const todayStart = startOfDay(now);
      const todayEnd = addDays(todayStart, 1);
      const yesterdayStart = addDays(todayStart, -1);

      const weekStart = startOfWeek(now);
      const weekEnd = addDays(weekStart, 7);
      const prevWeekStart = addDays(weekStart, -7);

      const monthStart = startOfMonth(now);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      const [today, yesterday, thisWeek, lastWeek, thisMonth, lastMonth] =
        await Promise.all([
          sumRevenue(todayStart, todayEnd),
          sumRevenue(yesterdayStart, todayStart),
          sumRevenue(weekStart, weekEnd),
          sumRevenue(prevWeekStart, weekStart),
          sumRevenue(monthStart, monthEnd),
          sumRevenue(prevMonthStart, monthStart),
        ]);

      const pctChange = (current: number, previous: number): number => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
      };

      return {
        today: today / 100,
        thisWeek: thisWeek / 100,
        thisMonth: thisMonth / 100,
        todayChange: pctChange(today, yesterday),
        weekChange: pctChange(thisWeek, lastWeek),
        monthChange: pctChange(thisMonth, lastMonth),
      };
    })(),
    (e): AnalyticsError => ({ type: 'DB_ERROR', cause: e }),
  );
}

export function getCustomerSegments(): ResultAsync<CustomerSegments, AnalyticsError> {
  return ResultAsync.fromPromise(
    (async () => {
      const now = new Date();
      const thirtyDaysAgo = addDays(now, -30);
      const sixtyDaysAgo = addDays(now, -60);
      const ninetyDaysAgo = addDays(now, -90);

      // Get all active customers with their latest booking date
      const customers = await prisma.customer.findMany({
        where: { accountStatus: 'active' },
        select: {
          id: true,
          createdAt: true,
          bookings: {
            select: { date: true },
            orderBy: { date: 'desc' },
            take: 1,
          },
        },
      });

      let newCount = 0;
      let activeCount = 0;
      let atRiskCount = 0;
      let churnedCount = 0;

      for (const c of customers) {
        const lastBooking = c.bookings[0]?.date;

        if (c.createdAt >= thirtyDaysAgo && !lastBooking) {
          // New customer — signed up in last 30 days, no bookings yet
          newCount++;
        } else if (lastBooking && new Date(lastBooking) >= sixtyDaysAgo) {
          activeCount++;
        } else if (lastBooking && new Date(lastBooking) >= ninetyDaysAgo) {
          atRiskCount++;
        } else if (lastBooking) {
          churnedCount++;
        } else if (c.createdAt < thirtyDaysAgo) {
          // Old signup, never booked
          churnedCount++;
        } else {
          newCount++;
        }
      }

      return { new: newCount, active: activeCount, atRisk: atRiskCount, churned: churnedCount };
    })(),
    (e): AnalyticsError => ({ type: 'DB_ERROR', cause: e }),
  );
}

export function getCapacity(): ResultAsync<CapacityData, AnalyticsError> {
  return ResultAsync.fromPromise(
    (async () => {
      const now = new Date();
      const weekStartDate = startOfWeek(now);
      const weekEndDate = addDays(weekStartDate, 7);

      const serviceTypes = await (prisma as any).serviceType.findMany({
        where: { isActive: true },
        select: { id: true, name: true, displayName: true },
      });

      const services = await Promise.all(
        (serviceTypes as any[]).map(async (st: any) => {
          const booked = await (prisma as any).booking.count({
            where: {
              serviceTypeId: st.id,
              date: { gte: weekStartDate, lt: weekEndDate },
              status: { notIn: ['cancelled', 'no_show'] },
            },
          });

          const capacityRules = await (prisma as any).capacityRule.findMany({
            where: { serviceTypeId: st.id },
            select: { maxCapacity: true },
          });

          // Total weekly capacity = sum of per-day maxCapacity * 7 (simplified)
          const avgCapacity =
            capacityRules.length > 0
              ? Math.round(
                  (capacityRules as any[]).reduce(
                    (sum: number, r: any) => sum + (r.maxCapacity as number),
                    0,
                  ) / capacityRules.length,
                ) * 7
              : 0;

          return {
            name: st.name as string,
            displayName: st.displayName as string,
            booked: booked as number,
            capacity: avgCapacity,
            utilizationPct:
              avgCapacity > 0
                ? Math.round(((booked as number) / avgCapacity) * 100)
                : 0,
          };
        }),
      );

      return {
        services,
        weekStart: weekStartDate.toISOString().split('T')[0],
        weekEnd: weekEndDate.toISOString().split('T')[0],
      };
    })(),
    (e): AnalyticsError => ({ type: 'DB_ERROR', cause: e }),
  );
}

export function getActiveInsights(
  type?: string,
  limit?: number,
): ResultAsync<InsightRecord[], AnalyticsError> {
  return ResultAsync.fromPromise(
    (prisma as any).aimInsight.findMany({
      where: {
        expiresAt: { gt: new Date() },
        ...(type ? { type } : {}),
      },
      orderBy: { generatedAt: 'desc' },
      take: limit ?? 20,
    }),
    (e): AnalyticsError => ({ type: 'DB_ERROR', cause: e }),
  );
}

export function generateInsights(): ResultAsync<number, AnalyticsError> {
  return ResultAsync.fromPromise(
    (async () => {
      const now = new Date();
      const expiresAt = addDays(now, 1); // insights expire in 24h

      const insights: Array<{ type: string; title: string; summary: string; data: any }> = [];

      // Revenue insight
      const todayStart = startOfDay(now);
      const yesterdayStart = addDays(todayStart, -1);
      const [todayRev, yesterdayRev] = await Promise.all([
        sumRevenue(todayStart, addDays(todayStart, 1)),
        sumRevenue(yesterdayStart, todayStart),
      ]);

      if (todayRev > 0 || yesterdayRev > 0) {
        const change = yesterdayRev > 0
          ? Math.round(((todayRev - yesterdayRev) / yesterdayRev) * 100)
          : 100;
        insights.push({
          type: 'revenue',
          title: 'Daily Revenue',
          summary: `Today's revenue is $${(todayRev / 100).toFixed(2)} (${change >= 0 ? '+' : ''}${change}% vs yesterday).`,
          data: { todayCents: todayRev, yesterdayCents: yesterdayRev, changePct: change },
        });
      }

      // Booking volume insight
      const weekStart = startOfWeek(now);
      const prevWeekStart = addDays(weekStart, -7);
      const [thisWeekBookings, lastWeekBookings] = await Promise.all([
        (prisma as any).booking.count({
          where: { date: { gte: weekStart, lt: addDays(weekStart, 7) }, status: { notIn: ['cancelled'] } },
        }),
        (prisma as any).booking.count({
          where: { date: { gte: prevWeekStart, lt: weekStart }, status: { notIn: ['cancelled'] } },
        }),
      ]);

      insights.push({
        type: 'bookings',
        title: 'Weekly Bookings',
        summary: `${thisWeekBookings} bookings this week vs ${lastWeekBookings} last week.`,
        data: { thisWeek: thisWeekBookings, lastWeek: lastWeekBookings },
      });

      // Compliance insight
      const dogs = await prisma.dog.findMany({
        where: { customer: { accountStatus: 'active' } },
        include: { vaccinations: true },
      });

      const totalDogs = dogs.length;
      const compliantDogs = dogs.filter((dog) => {
        const vax = (dog as any).vaccinations ?? [];
        if (vax.length === 0) return false;
        return vax.every((v: any) => !v.expiresAt || new Date(v.expiresAt) > now);
      }).length;

      if (totalDogs > 0) {
        const compliancePct = Math.round((compliantDogs / totalDogs) * 100);
        insights.push({
          type: 'compliance',
          title: 'Vaccination Compliance',
          summary: `${compliancePct}% of active dogs (${compliantDogs}/${totalDogs}) have up-to-date vaccinations.`,
          data: { compliant: compliantDogs, total: totalDogs, pct: compliancePct },
        });
      }

      // Popular services insight
      const serviceBreakdown = await (prisma as any).booking.groupBy({
        by: ['serviceTypeId'],
        where: { date: { gte: weekStart }, status: { notIn: ['cancelled'] } },
        _count: { id: true },
      });

      if ((serviceBreakdown as any[]).length > 0) {
        const serviceTypes = await (prisma as any).serviceType.findMany({
          select: { id: true, displayName: true },
        });
        const nameMap = new Map((serviceTypes as any[]).map((s: any) => [s.id, s.displayName]));
        const breakdown = (serviceBreakdown as any[])
          .map((s: any) => ({
            service: nameMap.get(s.serviceTypeId) ?? 'Unknown',
            count: s._count.id as number,
          }))
          .sort((a, b) => b.count - a.count);

        insights.push({
          type: 'services',
          title: 'Popular Services This Week',
          summary: breakdown.map((b) => `${b.service}: ${b.count}`).join(', '),
          data: { breakdown },
        });
      }

      // Write insights to DB
      for (const insight of insights) {
        await (prisma as any).aimInsight.create({
          data: {
            type: insight.type,
            title: insight.title,
            summary: insight.summary,
            data: insight.data,
            generatedAt: now,
            expiresAt,
          },
        });
      }

      return insights.length;
    })(),
    (e): AnalyticsError => ({ type: 'DB_ERROR', cause: e }),
  );
}
