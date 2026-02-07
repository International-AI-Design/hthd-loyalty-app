import { prisma } from '../../lib/prisma';
import { ScheduleCreate, ScheduleUpdate } from './types';

// Active booking statuses that count toward dog capacity
const ACTIVE_STATUSES = ['pending', 'confirmed', 'checked_in'];

export class StaffScheduleService {
  /**
   * Get all staff schedules for a specific date.
   * Includes staff firstName/lastName for display.
   */
  async getSchedulesByDate(date: string) {
    const dateObj = new Date(date + 'T00:00:00Z');

    return (prisma as any).staffSchedule.findMany({
      where: { date: dateObj },
      include: {
        staffUser: {
          select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
        },
      },
      orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Get all staff schedules within a date range.
   */
  async getSchedulesByDateRange(startDate: string, endDate: string) {
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    return (prisma as any).staffSchedule.findMany({
      where: {
        date: { gte: start, lte: end },
      },
      include: {
        staffUser: {
          select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });
  }

  /**
   * Get a specific staff member's schedule over a date range.
   */
  async getStaffSchedule(staffUserId: string, startDate: string, endDate: string) {
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    return (prisma as any).staffSchedule.findMany({
      where: {
        staffUserId,
        date: { gte: start, lte: end },
      },
      include: {
        staffUser: {
          select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Create a single schedule entry.
   * Prisma handles the unique constraint on (staffUserId, date).
   */
  async createSchedule(data: ScheduleCreate) {
    const dateObj = new Date(data.date + 'T00:00:00Z');

    return (prisma as any).staffSchedule.create({
      data: {
        staffUserId: data.staffUserId,
        date: dateObj,
        startTime: data.startTime,
        endTime: data.endTime,
        role: data.role,
        notes: data.notes ?? null,
      },
      include: {
        staffUser: {
          select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
        },
      },
    });
  }

  /**
   * Bulk create schedule entries.
   * Uses upsert to handle conflicts on (staffUserId, date) gracefully.
   */
  async bulkCreateSchedules(schedules: ScheduleCreate[]) {
    const results = await Promise.all(
      schedules.map((schedule) => {
        const dateObj = new Date(schedule.date + 'T00:00:00Z');
        return (prisma as any).staffSchedule.upsert({
          where: {
            staffUserId_date: {
              staffUserId: schedule.staffUserId,
              date: dateObj,
            },
          },
          create: {
            staffUserId: schedule.staffUserId,
            date: dateObj,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            role: schedule.role,
            notes: schedule.notes ?? null,
          },
          update: {
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            role: schedule.role,
            notes: schedule.notes ?? null,
          },
          include: {
            staffUser: {
              select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
            },
          },
        });
      })
    );

    return results;
  }

  /**
   * Update an existing schedule entry by ID.
   */
  async updateSchedule(id: string, data: ScheduleUpdate) {
    const existing = await (prisma as any).staffSchedule.findUnique({ where: { id } });
    if (!existing) {
      throw new ScheduleError('Schedule entry not found', 404);
    }

    return (prisma as any).staffSchedule.update({
      where: { id },
      data: {
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: {
        staffUser: {
          select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
        },
      },
    });
  }

  /**
   * Delete a schedule entry by ID.
   */
  async deleteSchedule(id: string) {
    const existing = await (prisma as any).staffSchedule.findUnique({ where: { id } });
    if (!existing) {
      throw new ScheduleError('Schedule entry not found', 404);
    }

    return (prisma as any).staffSchedule.delete({ where: { id } });
  }

  /**
   * Get a 7-day grid view starting from startDate.
   * Each day has an array of { staff, role, startTime, endTime }.
   */
  async getWeekView(startDate: string) {
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const schedules = await (prisma as any).staffSchedule.findMany({
      where: {
        date: { gte: start, lte: end },
      },
      include: {
        staffUser: {
          select: { id: true, firstName: true, lastName: true, role: true, isActive: true },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    // Build a map of date -> schedule entries
    const weekGrid: Record<string, any[]> = {};
    const current = new Date(start);
    for (let i = 0; i < 7; i++) {
      const dateKey = current.toISOString().split('T')[0];
      weekGrid[dateKey] = [];
      current.setDate(current.getDate() + 1);
    }

    for (const schedule of schedules) {
      const dateKey = schedule.date.toISOString().split('T')[0];
      if (weekGrid[dateKey]) {
        weekGrid[dateKey].push({
          id: schedule.id,
          staff: {
            id: schedule.staffUser.id,
            firstName: schedule.staffUser.firstName,
            lastName: schedule.staffUser.lastName,
          },
          role: schedule.role,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          notes: schedule.notes,
        });
      }
    }

    return weekGrid;
  }

  /**
   * Get staff coverage ratio for a date.
   * Returns count of staff on duty vs dogs booked.
   */
  async getStaffCoverage(date: string) {
    const dateObj = new Date(date + 'T00:00:00Z');

    // Count staff scheduled for this date
    const staffCount = await (prisma as any).staffSchedule.count({
      where: { date: dateObj },
    });

    // Count dogs booked for this date (across all active bookings)
    const bookings = await (prisma as any).booking.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        OR: [
          // Single-day bookings on this date
          { startDate: null, date: dateObj },
          // Multi-day bookings covering this date
          { AND: [{ startDate: { not: null } }, { startDate: { lte: dateObj } }, { endDate: { gte: dateObj } }] },
        ],
      },
      include: { _count: { select: { dogs: true } } },
    });

    const dogsBooked = bookings.reduce((sum: number, b: any) => sum + b._count.dogs, 0);

    const ratio = staffCount > 0 ? dogsBooked / staffCount : dogsBooked > 0 ? Infinity : 0;

    return {
      date,
      staffCount,
      dogsBooked,
      ratio: Math.round(ratio * 10) / 10,
    };
  }

  /**
   * Get active staff members who are NOT scheduled for a given date.
   */
  async getAvailableStaff(date: string) {
    const dateObj = new Date(date + 'T00:00:00Z');

    // Get IDs of staff already scheduled
    const scheduledStaff = await (prisma as any).staffSchedule.findMany({
      where: { date: dateObj },
      select: { staffUserId: true },
    });
    const scheduledIds = scheduledStaff.map((s: any) => s.staffUserId);

    // Get active staff NOT in scheduled list
    const available = await prisma.staffUser.findMany({
      where: {
        isActive: true,
        ...(scheduledIds.length > 0 && { id: { notIn: scheduledIds } }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
      orderBy: { firstName: 'asc' },
    });

    return available;
  }
}

/**
 * Custom error class for schedule operations with HTTP status codes.
 */
export class ScheduleError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ScheduleError';
  }
}
