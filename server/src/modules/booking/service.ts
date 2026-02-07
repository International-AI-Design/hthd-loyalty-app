import { prisma } from '../../lib/prisma';
import { AvailabilityResult, CreateBookingInput, CreateMultiDayBookingInput, BookingStatus } from './types';

interface GroomingSlotAvailability {
  startTime: string;
  endTime: string;
  available: boolean;
  spotsRemaining: number;
}

interface CapacityRuleRow {
  id: string;
  serviceTypeId: string;
  dayOfWeek: number | null;
  maxCapacity: number;
  startTime: string | null;
  endTime: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Active statuses that count toward capacity
const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'checked_in'];

// Max dogs per day across all services (business constraint)
const MAX_DOGS_PER_DAY = 40;

// Business hours
const BUSINESS_HOURS = {
  weekday: { open: '07:00', close: '19:00' }, // 7 AM - 7 PM
  weekend: { open: '07:00', close: '18:30' }, // 7 AM - 6:30 PM
};

export class BookingService {
  /**
   * Check availability for a service type over a date range.
   * Considers capacity rules, overrides (closures), and existing bookings.
   * Also enforces the 40 dogs/day global limit.
   */
  async checkAvailability(
    serviceTypeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AvailabilityResult[]> {
    // Load capacity rules for this service type
    const capacityRules: CapacityRuleRow[] = await (prisma as any).capacityRule.findMany({
      where: { serviceTypeId },
    });

    // Load overrides in the date range
    const overrides = await (prisma as any).capacityOverride.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        OR: [
          { serviceTypeId },
          { serviceTypeId: null }, // global overrides
        ],
      },
    });

    // Count existing active bookings per date for THIS service type
    const existingBookings = await (prisma as any).booking.groupBy({
      by: ['date'],
      where: {
        serviceTypeId,
        date: { gte: startDate, lte: endDate },
        status: { in: ACTIVE_STATUSES },
      },
      _count: { id: true },
    });

    // Count ALL active bookings per date (for global 40 dogs/day limit)
    // We count BookingDog records (each dog = 1 slot) across all multi-day ranges
    const allBookingsInRange = await (prisma as any).booking.findMany({
      where: {
        status: { in: ACTIVE_STATUSES },
        OR: [
          // Single-day bookings in range
          { startDate: null, date: { gte: startDate, lte: endDate } },
          // Multi-day bookings overlapping range
          { AND: [{ startDate: { not: null } }, { startDate: { lte: endDate } }, { endDate: { gte: startDate } }] },
        ],
      },
      include: { _count: { select: { dogs: true } } },
    });

    // Build a map of total dogs per date across ALL services
    const globalDogCountByDate = new Map<string, number>();
    for (const b of allBookingsInRange) {
      const dogCount = b._count.dogs;
      if (b.startDate && b.endDate) {
        // Multi-day: count dogs for each day in the range
        const cur = new Date(b.startDate);
        const end = new Date(b.endDate);
        while (cur <= end) {
          const dk = cur.toISOString().split('T')[0];
          globalDogCountByDate.set(dk, (globalDogCountByDate.get(dk) ?? 0) + dogCount);
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        // Single-day
        const dk = b.date.toISOString().split('T')[0];
        globalDogCountByDate.set(dk, (globalDogCountByDate.get(dk) ?? 0) + dogCount);
      }
    }

    const bookingCountByDate = new Map<string, number>();
    for (const b of existingBookings) {
      const dateKey = b.date.toISOString().split('T')[0];
      bookingCountByDate.set(dateKey, b._count.id);
    }

    const overrideByDate = new Map<string, typeof overrides[number]>();
    for (const o of overrides) {
      const dateKey = o.date.toISOString().split('T')[0];
      overrideByDate.set(dateKey, o);
    }

    const results: AvailabilityResult[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateKey = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay(); // 0=Sun, 6=Sat

      // Check for override (closure or expanded capacity)
      const override = overrideByDate.get(dateKey);
      if (override && override.maxCapacity === null) {
        // Closed
        results.push({ date: dateKey, available: false, spotsRemaining: 0, totalCapacity: 0 });
        current.setDate(current.getDate() + 1);
        continue;
      }

      // Determine capacity: override > day-specific rule > default rule
      let totalCapacity = 0;
      if (override && override.maxCapacity !== null) {
        totalCapacity = override.maxCapacity;
      } else {
        // Find day-specific rule first, then fallback to null (all days)
        const dayRule = capacityRules.find((r) => r.dayOfWeek === dayOfWeek);
        const defaultRule = capacityRules.find((r) => r.dayOfWeek === null);
        const rule = dayRule || defaultRule;
        totalCapacity = rule?.maxCapacity ?? 0;
      }

      const booked = bookingCountByDate.get(dateKey) ?? 0;
      const spotsRemaining = Math.max(0, totalCapacity - booked);

      // Also check global 40 dogs/day limit
      const globalDogs = globalDogCountByDate.get(dateKey) ?? 0;
      const globalSpotsLeft = Math.max(0, MAX_DOGS_PER_DAY - globalDogs);
      const effectiveSpots = Math.min(spotsRemaining, globalSpotsLeft);

      results.push({
        date: dateKey,
        available: effectiveSpots > 0,
        spotsRemaining: effectiveSpots,
        totalCapacity,
      });

      current.setDate(current.getDate() + 1);
    }

    return results;
  }

  /**
   * Create a new booking (single-day, backward compatible).
   * Validates service type, dog ownership, availability, and duplicates.
   */
  async createBooking(input: CreateBookingInput) {
    const { customerId, serviceTypeId, dogIds, date, startTime, notes } = input;

    // Validate service type exists and is active
    const serviceType = await (prisma as any).serviceType.findUnique({
      where: { id: serviceTypeId },
    });
    if (!serviceType) {
      throw new BookingError('Service type not found', 404);
    }
    if (!serviceType.isActive) {
      throw new BookingError('Service type is not currently available', 400);
    }

    // Validate all dogs belong to the customer
    const dogs = await prisma.dog.findMany({
      where: { id: { in: dogIds }, customerId },
    });
    if (dogs.length !== dogIds.length) {
      throw new BookingError('One or more dogs not found or do not belong to you', 400);
    }

    // Check availability
    const bookingDate = new Date(date + 'T00:00:00Z');
    const availability = await this.checkAvailability(serviceTypeId, bookingDate, bookingDate);
    if (!availability.length || !availability[0].available) {
      throw new BookingError('No availability for the selected date', 409);
    }

    // Check for duplicate bookings (same dog, same day, same service)
    const duplicates = await (prisma as any).booking.findMany({
      where: {
        serviceTypeId,
        date: bookingDate,
        status: { in: ACTIVE_STATUSES },
        dogs: {
          some: { dogId: { in: dogIds } },
        },
      },
      include: { dogs: true },
    });
    if (duplicates.length > 0) {
      throw new BookingError('One or more dogs already have a booking for this service on this date', 409);
    }

    // Calculate price
    const totalCents = await this.calculatePrice(serviceType, dogIds.length, bookingDate);

    // Create booking + booking dogs in a transaction
    const booking = await (prisma as any).booking.create({
      data: {
        customerId,
        serviceTypeId,
        date: bookingDate,
        startTime: startTime ?? null,
        status: 'pending',
        totalCents,
        notes: notes ?? null,
        dogs: {
          create: dogIds.map((dogId) => ({ dogId })),
        },
      },
      include: {
        serviceType: true,
        dogs: { include: { dog: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return booking;
  }

  /**
   * Create a multi-day booking (e.g. boarding over several days).
   * Validates availability for EVERY day in the range and enforces 40 dogs/day.
   */
  async createMultiDayBooking(input: CreateMultiDayBookingInput) {
    const { customerId, serviceTypeId, dogIds, startDate, endDate, notes } = input;

    // Validate service type exists and is active
    const serviceType = await (prisma as any).serviceType.findUnique({
      where: { id: serviceTypeId },
    });
    if (!serviceType) {
      throw new BookingError('Service type not found', 404);
    }
    if (!serviceType.isActive) {
      throw new BookingError('Service type is not currently available', 400);
    }

    // Validate all dogs belong to the customer
    const dogs = await prisma.dog.findMany({
      where: { id: { in: dogIds }, customerId },
    });
    if (dogs.length !== dogIds.length) {
      throw new BookingError('One or more dogs not found or do not belong to you', 400);
    }

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    // Validate date range is reasonable (max 30 days)
    const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      throw new BookingError('Booking cannot exceed 30 days', 400);
    }
    if (daysDiff < 0) {
      throw new BookingError('End date must be on or after start date', 400);
    }

    // Check availability for every day in the range
    const availability = await this.checkAvailability(serviceTypeId, start, end);
    const unavailableDates = availability.filter((a) => !a.available);
    if (unavailableDates.length > 0) {
      const dates = unavailableDates.map((a) => a.date).join(', ');
      throw new BookingError(`No availability on: ${dates}`, 409);
    }

    // Check for duplicate bookings across the date range
    const duplicates = await (prisma as any).booking.findMany({
      where: {
        serviceTypeId,
        status: { in: ACTIVE_STATUSES },
        dogs: {
          some: { dogId: { in: dogIds } },
        },
        OR: [
          // Single-day bookings in our range
          { startDate: null, date: { gte: start, lte: end } },
          // Multi-day bookings overlapping our range
          { AND: [{ startDate: { not: null } }, { startDate: { lte: end } }, { endDate: { gte: start } }] },
        ],
      },
      include: { dogs: true },
    });
    if (duplicates.length > 0) {
      throw new BookingError('One or more dogs already have an overlapping booking for this service', 409);
    }

    // Calculate price: per-day price * number of days
    const numDays = daysDiff + 1; // inclusive
    const dailyPrice = await this.calculatePrice(serviceType, dogIds.length, start);
    const totalCents = dailyPrice * numDays;

    // Create the booking with startDate/endDate; set date = startDate for backward compat
    const booking = await (prisma as any).booking.create({
      data: {
        customerId,
        serviceTypeId,
        date: start,       // backward compat: date = startDate
        startDate: start,
        endDate: end,
        status: 'pending',
        totalCents,
        notes: notes ?? null,
        dogs: {
          create: dogIds.map((dogId) => ({ dogId })),
        },
      },
      include: {
        serviceType: true,
        dogs: { include: { dog: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return booking;
  }

  /**
   * Confirm a pending booking.
   */
  async confirmBooking(bookingId: string) {
    const booking = await (prisma as any).booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new BookingError('Booking not found', 404);
    }
    if (booking.status !== 'pending') {
      throw new BookingError(`Cannot confirm booking with status '${booking.status}'`, 400);
    }

    return (prisma as any).booking.update({
      where: { id: bookingId },
      data: { status: 'confirmed' },
      include: {
        serviceType: true,
        dogs: { include: { dog: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Cancel a booking. Customer can only cancel their own bookings.
   */
  async cancelBooking(bookingId: string, customerId: string, reason?: string) {
    const booking = await (prisma as any).booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new BookingError('Booking not found', 404);
    }
    if (booking.customerId !== customerId) {
      throw new BookingError('Booking not found', 404); // Don't leak existence
    }
    if (booking.status === 'checked_out') {
      throw new BookingError('Cannot cancel a completed booking', 400);
    }
    if (booking.status === 'cancelled') {
      throw new BookingError('Booking is already cancelled', 400);
    }

    return (prisma as any).booking.update({
      where: { id: bookingId },
      data: {
        status: 'cancelled',
        cancelReason: reason ?? null,
      },
      include: {
        serviceType: true,
        dogs: { include: { dog: true } },
      },
    });
  }

  /**
   * Check in a booking. Staff only.
   */
  async checkIn(bookingId: string, staffId: string) {
    const booking = await (prisma as any).booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new BookingError('Booking not found', 404);
    }
    if (booking.status !== 'confirmed') {
      throw new BookingError(`Cannot check in booking with status '${booking.status}'`, 400);
    }

    return (prisma as any).booking.update({
      where: { id: bookingId },
      data: {
        status: 'checked_in',
        checkedInAt: new Date(),
        checkedInBy: staffId,
      },
      include: {
        serviceType: true,
        dogs: { include: { dog: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Check out a booking. Staff only.
   */
  async checkOut(bookingId: string, staffId: string, notes?: string) {
    const booking = await (prisma as any).booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new BookingError('Booking not found', 404);
    }
    if (booking.status !== 'checked_in') {
      throw new BookingError(`Cannot check out booking with status '${booking.status}'`, 400);
    }

    return (prisma as any).booking.update({
      where: { id: bookingId },
      data: {
        status: 'checked_out',
        checkedOutAt: new Date(),
        checkedOutBy: staffId,
        notes: notes ?? booking.notes,
      },
      include: {
        serviceType: true,
        dogs: { include: { dog: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Mark a booking as no-show. Staff only.
   */
  async markNoShow(bookingId: string) {
    const booking = await (prisma as any).booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      throw new BookingError('Booking not found', 404);
    }
    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      throw new BookingError(`Cannot mark as no-show with status '${booking.status}'`, 400);
    }

    return (prisma as any).booking.update({
      where: { id: bookingId },
      data: { status: 'no_show' },
      include: {
        serviceType: true,
        dogs: { include: { dog: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  /**
   * Get a customer's bookings with pagination and optional status filter.
   */
  async getCustomerBookings(
    customerId: string,
    options?: { status?: BookingStatus; limit?: number; offset?: number }
  ): Promise<{ bookings: any[]; total: number }> {
    const where: Record<string, any> ={ customerId };
    if (options?.status) {
      where.status = options.status;
    }

    const [bookings, total] = await Promise.all([
      (prisma as any).booking.findMany({
        where,
        include: {
          serviceType: true,
          dogs: { include: { dog: true } },
          payments: true,
        },
        orderBy: { date: 'desc' },
        take: options?.limit ?? 20,
        skip: options?.offset ?? 0,
      }),
      (prisma as any).booking.count({ where }),
    ]);

    return { bookings, total };
  }

  /**
   * Admin schedule view: all bookings for a given date, optionally filtered by service.
   */
  async getSchedule(date: Date, serviceTypeId?: string) {
    const where: Record<string, any> ={ date };
    if (serviceTypeId) {
      where.serviceTypeId = serviceTypeId;
    }

    return (prisma as any).booking.findMany({
      where,
      include: {
        serviceType: true,
        dogs: { include: { dog: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
      orderBy: [{ startTime: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Admin schedule view: bookings across a date range, optionally filtered by service and status.
   * Includes multi-day bookings that overlap the range.
   */
  async getScheduleRange(startDate: Date, endDate: Date, serviceTypeId?: string, status?: string) {
    const where: Record<string, any> = {
      OR: [
        // Single-day bookings in range
        { startDate: null, date: { gte: startDate, lte: endDate } },
        // Multi-day bookings overlapping range
        { AND: [{ startDate: { not: null } }, { startDate: { lte: endDate } }, { endDate: { gte: startDate } }] },
      ],
    };
    if (serviceTypeId) {
      where.serviceTypeId = serviceTypeId;
    }
    if (status) {
      where.status = status;
    }

    return (prisma as any).booking.findMany({
      where,
      include: {
        serviceType: true,
        dogs: { include: { dog: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Get all active service types.
   */
  async getServiceTypes() {
    return (prisma as any).serviceType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Get grooming slot availability for a specific date.
   * Queries CapacityRules with startTime (grooming slots) and counts bookings per slot.
   */
  async getGroomingSlots(date: Date): Promise<GroomingSlotAvailability[]> {
    // Find the grooming service type
    const grooming = await (prisma as any).serviceType.findUnique({
      where: { name: 'grooming' },
    });
    if (!grooming) {
      throw new BookingError('Grooming service type not found', 404);
    }

    // Get all grooming time slots (capacity rules with startTime)
    const slots = await (prisma as any).capacityRule.findMany({
      where: {
        serviceTypeId: grooming.id,
        startTime: { not: null },
      },
      orderBy: { startTime: 'asc' },
    });

    // Count existing active bookings per slot for this date
    const existingBookings = await (prisma as any).booking.findMany({
      where: {
        serviceTypeId: grooming.id,
        date,
        status: { in: ['pending', 'confirmed', 'checked_in'] },
        startTime: { not: null },
      },
      select: { startTime: true },
    });

    const bookingCountBySlot = new Map<string, number>();
    for (const b of existingBookings) {
      const count = bookingCountBySlot.get(b.startTime) ?? 0;
      bookingCountBySlot.set(b.startTime, count + 1);
    }

    return slots.map((slot: any) => {
      const booked = bookingCountBySlot.get(slot.startTime) ?? 0;
      const remaining = Math.max(0, slot.maxCapacity - booked);
      return {
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: remaining > 0,
        spotsRemaining: remaining,
      };
    });
  }

  /**
   * Calculate total price for a booking.
   * Starts with base price * number of dogs, then applies active pricing rules.
   */
  async calculatePrice(
    serviceType: { id: string; basePriceCents: number },
    dogCount: number,
    date: Date
  ): Promise<number> {
    let totalCents = serviceType.basePriceCents * dogCount;

    // Load active pricing rules for this service type
    const rules = await (prisma as any).pricingRule.findMany({
      where: { serviceTypeId: serviceType.id, isActive: true },
      orderBy: { priority: 'desc' },
    });

    for (const rule of rules) {
      // Day-of-week filter
      if (rule.dayOfWeek !== null && rule.dayOfWeek !== date.getDay()) {
        continue;
      }

      // Multi-dog threshold
      if (rule.minDogs !== null && dogCount < rule.minDogs) {
        continue;
      }

      // Skip membership rules (handled separately when wallet/payment module is built)
      if (rule.membershipPlanId !== null) {
        continue;
      }

      if (rule.type === 'percentage_discount' && rule.percentage) {
        const discount = Math.round(totalCents * Number(rule.percentage) / 100);
        totalCents -= discount;
      } else if (rule.type === 'fixed_discount' && rule.valueCents) {
        totalCents -= rule.valueCents;
      } else if (rule.type === 'surcharge' && rule.valueCents) {
        totalCents += rule.valueCents;
      }
    }

    return Math.max(0, totalCents);
  }
}

/**
 * Custom error class for booking operations with HTTP status codes.
 */
export class BookingError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'BookingError';
  }
}
