import { DashboardService } from '../dashboard/service';
import { prisma } from '../../lib/prisma';
import { logger } from '../../middleware/security';
import { AimAlertData } from './types';

const dashboardService = new DashboardService();

const STAFF_TO_DOG_WARNING_RATIO = 8;
const STAFF_TO_DOG_CRITICAL_RATIO = 12;
const CAPACITY_INFO_PERCENT = 80;
const CAPACITY_WARNING_PERCENT = 90;
const CAPACITY_CRITICAL_PERCENT = 95;

/**
 * Run all alert checks and create AimAlert records for new issues.
 * Designed to be called on dashboard load or periodically.
 */
export async function generateAlerts(date: string): Promise<void> {
  const alerts: AimAlertData[] = [];

  const [staffingAlerts, capacityAlerts, complianceAlerts] = await Promise.all([
    checkStaffingGaps(date),
    checkCapacity(date),
    checkCompliance(),
  ]);

  alerts.push(...staffingAlerts, ...capacityAlerts, ...complianceAlerts);

  for (const alert of alerts) {
    // Deduplicate: don't create the same alert type+title if one already exists unresolved today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await (prisma as any).aimAlert.findFirst({
      where: {
        type: alert.type,
        title: alert.title,
        resolvedAt: null,
        createdAt: { gte: today },
      },
    });

    if (!existing) {
      await (prisma as any).aimAlert.create({
        data: {
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          data: alert.data ?? undefined,
        },
      });
      logger.info('AIM alert created', { type: alert.type, title: alert.title });
    }
  }
}

/**
 * Check for staffing gaps: dog-to-staff ratio > threshold.
 */
export async function checkStaffingGaps(
  date: string
): Promise<AimAlertData[]> {
  const alerts: AimAlertData[] = [];

  try {
    const staffData = await dashboardService.getStaffOnDuty(date);
    const facility = await dashboardService.getFacilityStatus(date);

    if (staffData.count === 0 && facility.totalDogs > 0) {
      alerts.push({
        type: 'staffing_gap',
        severity: 'critical',
        title: 'No staff scheduled',
        description: `${facility.totalDogs} dogs expected but no staff scheduled for ${date}.`,
        data: { date, totalDogs: facility.totalDogs },
      });
    } else if (staffData.count > 0 && facility.totalDogs > 0) {
      const ratio = facility.totalDogs / staffData.count;
      if (ratio > STAFF_TO_DOG_CRITICAL_RATIO) {
        alerts.push({
          type: 'staffing_gap',
          severity: 'critical',
          title: 'Critical dog-to-staff ratio',
          description: `Ratio is 1:${Math.round(ratio)} (${facility.totalDogs} dogs, ${staffData.count} staff). Maximum safe ratio is 1:${STAFF_TO_DOG_CRITICAL_RATIO}.`,
          data: { date, totalDogs: facility.totalDogs, staffCount: staffData.count, ratio },
        });
      } else if (ratio > STAFF_TO_DOG_WARNING_RATIO) {
        alerts.push({
          type: 'staffing_gap',
          severity: 'warning',
          title: 'High dog-to-staff ratio',
          description: `Ratio is 1:${Math.round(ratio)} (${facility.totalDogs} dogs, ${staffData.count} staff). Target is 1:${STAFF_TO_DOG_WARNING_RATIO} or better.`,
          data: { date, totalDogs: facility.totalDogs, staffCount: staffData.count, ratio },
        });
      }
    }
  } catch (err) {
    logger.error('AIM alert check failed: staffing gaps', { error: err });
  }

  return alerts;
}

/**
 * Check for capacity warnings: facility at or near max.
 * Checks the given date plus the next 6 days (7-day forecast).
 */
export async function checkCapacity(date: string): Promise<AimAlertData[]> {
  const alerts: AimAlertData[] = [];

  try {
    // Check today + next 6 days
    const startDate = new Date(date + 'T00:00:00Z');
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];

      try {
        const facility = await dashboardService.getFacilityStatus(dateStr);

        if (facility.capacityPercent >= CAPACITY_CRITICAL_PERCENT) {
          alerts.push({
            type: 'capacity_warning',
            severity: 'critical',
            title: `At or near full capacity (${dateStr})`,
            description: `Facility is at ${facility.capacityPercent}% capacity (${facility.totalDogs}/${facility.maxCapacity} dogs) on ${dateStr}.`,
            data: { date: dateStr, ...facility },
          });
        } else if (facility.capacityPercent >= CAPACITY_WARNING_PERCENT) {
          alerts.push({
            type: 'capacity_warning',
            severity: 'warning',
            title: `High capacity forecast (${dateStr})`,
            description: `Facility is at ${facility.capacityPercent}% capacity (${facility.totalDogs}/${facility.maxCapacity} dogs) on ${dateStr}.`,
            data: { date: dateStr, ...facility },
          });
        } else if (facility.capacityPercent >= CAPACITY_INFO_PERCENT) {
          alerts.push({
            type: 'capacity_warning',
            severity: 'info',
            title: `Capacity trending up (${dateStr})`,
            description: `Facility is at ${facility.capacityPercent}% capacity (${facility.totalDogs}/${facility.maxCapacity} dogs) on ${dateStr}.`,
            data: { date: dateStr, ...facility },
          });
        }
      } catch {
        // Skip dates that fail (e.g., no capacity data)
      }
    }
  } catch (err) {
    logger.error('AIM alert check failed: capacity', { error: err });
  }

  return alerts;
}

/**
 * Check for compliance issues from DashboardService.
 */
export async function checkCompliance(): Promise<AimAlertData[]> {
  const alerts: AimAlertData[] = [];

  try {
    const compliance = await dashboardService.getComplianceFlags();

    if (compliance.totalAffected > 0) {
      alerts.push({
        type: 'compliance',
        severity:
          compliance.expiredVaccinations.length > 0 ? 'warning' : 'info',
        title: `${compliance.totalAffected} dogs with compliance issues`,
        description: `${compliance.expiredVaccinations.length} expired and ${compliance.missingVaccinations.length} missing vaccinations across upcoming bookings.`,
        data: {
          expiredCount: compliance.expiredVaccinations.length,
          missingCount: compliance.missingVaccinations.length,
          totalAffected: compliance.totalAffected,
        },
      });
    }
  } catch (err) {
    logger.error('AIM alert check failed: compliance', { error: err });
  }

  return alerts;
}

/**
 * Get unread alerts.
 */
export async function getUnreadAlerts() {
  return (prisma as any).aimAlert.findMany({
    where: { readAt: null, resolvedAt: null },
    orderBy: [
      { severity: 'asc' }, // critical first (alphabetical: c < i < w)
      { createdAt: 'desc' },
    ],
  });
}

/**
 * Get all alerts, optionally filtered.
 */
export async function getAlerts(unreadOnly: boolean = false) {
  const where: Record<string, unknown> = {};
  if (unreadOnly) {
    where.readAt = null;
    where.resolvedAt = null;
  }

  return (prisma as any).aimAlert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/**
 * Mark an alert as read.
 */
export async function markAlertRead(id: string) {
  return (prisma as any).aimAlert.update({
    where: { id },
    data: { readAt: new Date() },
  });
}

/**
 * Mark an alert as resolved.
 */
export async function resolveAlert(id: string) {
  return (prisma as any).aimAlert.update({
    where: { id },
    data: { resolvedAt: new Date() },
  });
}
