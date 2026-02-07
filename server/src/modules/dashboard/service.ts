import { prisma } from '../../lib/prisma';

// Max dogs per day across all services (business constraint from BookingService)
const MAX_CAPACITY = 40;

// Active booking statuses that represent dogs currently at or expected at the facility
const FACILITY_STATUSES = ['confirmed', 'checked_in'];

export class DashboardService {
  /**
   * Facility status: total dogs on-site/expected, broken down by service type.
   */
  async getFacilityStatus(date: string) {
    const dateObj = new Date(date + 'T00:00:00Z');

    // Find all bookings for this date that are confirmed or checked in
    // Include multi-day bookings that overlap this date
    const bookings = await (prisma as any).booking.findMany({
      where: {
        status: { in: FACILITY_STATUSES },
        OR: [
          // Single-day bookings on this date
          { startDate: null, date: dateObj },
          // Multi-day bookings overlapping this date
          { AND: [{ startDate: { not: null } }, { startDate: { lte: dateObj } }, { endDate: { gte: dateObj } }] },
        ],
      },
      include: {
        serviceType: { select: { name: true, displayName: true } },
        _count: { select: { dogs: true } },
      },
    });

    // Aggregate dog counts by service type
    const byService: Record<string, number> = {};
    let totalDogs = 0;

    for (const booking of bookings) {
      const serviceName = booking.serviceType.name;
      const dogCount = booking._count.dogs;
      byService[serviceName] = (byService[serviceName] ?? 0) + dogCount;
      totalDogs += dogCount;
    }

    return {
      totalDogs,
      maxCapacity: MAX_CAPACITY,
      capacityPercent: Math.round((totalDogs / MAX_CAPACITY) * 100),
      byService: {
        daycare: byService['daycare'] ?? 0,
        boarding: byService['boarding'] ?? 0,
        grooming: byService['grooming'] ?? 0,
      },
    };
  }

  /**
   * Arrivals (confirmed bookings) and departures (checked-in bookings) for a date.
   */
  async getArrivalsAndDepartures(date: string) {
    const dateObj = new Date(date + 'T00:00:00Z');

    // Arrivals: confirmed bookings starting on this date
    const arrivals = await (prisma as any).booking.findMany({
      where: {
        status: 'confirmed',
        OR: [
          { startDate: null, date: dateObj },
          { startDate: dateObj },
        ],
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
        dogs: { include: { dog: { select: { id: true, name: true } } } },
        serviceType: { select: { name: true, displayName: true } },
      },
      orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
    });

    // Departures: checked-in bookings that end on this date (or single-day bookings on this date)
    const departures = await (prisma as any).booking.findMany({
      where: {
        status: 'checked_in',
        OR: [
          // Single-day bookings on this date
          { startDate: null, date: dateObj },
          // Multi-day bookings ending today
          { endDate: dateObj },
        ],
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true } },
        dogs: { include: { dog: { select: { id: true, name: true } } } },
        serviceType: { select: { name: true, displayName: true } },
      },
      orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
    });

    const formatBooking = (b: any) => ({
      bookingId: b.id,
      customer: { firstName: b.customer.firstName, lastName: b.customer.lastName },
      dogs: b.dogs.map((bd: any) => ({ id: bd.dog.id, name: bd.dog.name })),
      service: b.serviceType.displayName,
      startTime: b.startTime,
      status: b.status,
    });

    return {
      arrivals: arrivals.map(formatBooking),
      departures: departures.map(formatBooking),
      arrivalCount: arrivals.length,
      departureCount: departures.length,
    };
  }

  /**
   * Staff on duty for a given date with role breakdown and staff-to-dog ratio.
   */
  async getStaffOnDuty(date: string) {
    const dateObj = new Date(date + 'T00:00:00Z');

    const schedules = await (prisma as any).staffSchedule.findMany({
      where: { date: dateObj },
      include: {
        staffUser: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const byRole: Record<string, number> = {
      general: 0,
      groomer: 0,
      manager: 0,
      kennel_tech: 0,
    };

    const staff = schedules.map((s: any) => {
      const scheduleRole = s.role as string;
      if (scheduleRole in byRole) {
        byRole[scheduleRole]++;
      }
      return {
        id: s.staffUser.id,
        name: `${s.staffUser.firstName} ${s.staffUser.lastName}`,
        role: scheduleRole,
        startTime: s.startTime,
        endTime: s.endTime,
      };
    });

    // Get dog count for ratio calculation
    const facilityStatus = await this.getFacilityStatus(date);
    const totalDogs = facilityStatus.totalDogs;
    const staffCount = staff.length;

    return {
      staff,
      count: staffCount,
      byRole,
      staffToDogsRatio: staffCount > 0 ? `1:${Math.round(totalDogs / staffCount)}` : 'N/A',
    };
  }

  /**
   * Compliance flags: dogs with upcoming bookings (next 7 days) that have
   * expired or missing required vaccinations.
   */
  async getComplianceFlags() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysOut = new Date(today);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

    // Get all vaccination requirements
    const requirements = await (prisma as any).vaccinationRequirement.findMany({
      where: { isRequired: true },
    });

    // Get upcoming bookings with dog info and their vaccinations
    const upcomingBookings = await (prisma as any).booking.findMany({
      where: {
        status: { in: ['pending', 'confirmed'] },
        OR: [
          { startDate: null, date: { gte: today, lte: sevenDaysOut } },
          { AND: [{ startDate: { not: null } }, { startDate: { lte: sevenDaysOut } }, { endDate: { gte: today } }] },
        ],
      },
      include: {
        dogs: {
          include: {
            dog: {
              select: {
                id: true,
                name: true,
                vaccinations: {
                  select: { id: true, name: true, expiresAt: true, dateGiven: true },
                },
              },
            },
          },
        },
        serviceType: { select: { id: true, name: true } },
      },
    });

    const expiredVaccinations: any[] = [];
    const missingVaccinations: any[] = [];
    const affectedDogIds = new Set<string>();

    for (const booking of upcomingBookings) {
      for (const bookingDog of booking.dogs) {
        const dog = bookingDog.dog;

        for (const req of requirements) {
          // Check if requirement applies to this service type
          if (req.serviceTypeId && req.serviceTypeId !== booking.serviceTypeId) {
            continue;
          }

          // Find the most recent vaccination matching this requirement
          const vaccination = dog.vaccinations.find(
            (v: any) => v.name === req.vaccinationName
          );

          if (!vaccination) {
            // Missing vaccination entirely
            missingVaccinations.push({
              dog: { id: dog.id, name: dog.name },
              requirement: { name: req.vaccinationName, description: req.description },
              booking: { id: booking.id, date: booking.date },
            });
            affectedDogIds.add(dog.id);
          } else if (vaccination.expiresAt && new Date(vaccination.expiresAt) < today) {
            // Expired vaccination
            expiredVaccinations.push({
              dog: { id: dog.id, name: dog.name },
              vaccination: { name: vaccination.name, expiresAt: vaccination.expiresAt },
              booking: { id: booking.id, date: booking.date },
            });
            affectedDogIds.add(dog.id);
          }
        }
      }
    }

    return {
      expiredVaccinations,
      missingVaccinations,
      totalAffected: affectedDogIds.size,
    };
  }

  /**
   * Full dashboard summary combining all data for a given date.
   */
  async getDashboardSummary(date: string) {
    const [facility, arrivalsAndDepartures, staff, compliance] = await Promise.all([
      this.getFacilityStatus(date),
      this.getArrivalsAndDepartures(date),
      this.getStaffOnDuty(date),
      this.getComplianceFlags(),
    ]);

    return {
      date,
      facility,
      arrivalsAndDepartures,
      staff,
      compliance,
    };
  }

  /**
   * Weekly overview: daily dog counts and capacity for 7 days starting from a date.
   */
  async getWeeklyOverview(startDate: string) {
    const days: any[] = [];
    const start = new Date(startDate + 'T00:00:00Z');

    for (let i = 0; i < 7; i++) {
      const current = new Date(start);
      current.setDate(current.getDate() + i);
      const dateStr = current.toISOString().split('T')[0];

      const facilityStatus = await this.getFacilityStatus(dateStr);
      days.push({
        date: dateStr,
        totalDogs: facilityStatus.totalDogs,
        maxCapacity: facilityStatus.maxCapacity,
        capacityPercent: facilityStatus.capacityPercent,
        byService: facilityStatus.byService,
      });
    }

    return { startDate, days };
  }
}
