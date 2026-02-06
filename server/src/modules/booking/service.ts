import { prisma } from '../../lib/prisma';
import { AvailabilityResult, CreateBookingInput, BookingStatus } from './types';

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

export class BookingService {
  /**
   * Check availability for a service type over a date range.
   * Considers capacity rules, overrides (closures), and existing bookings.
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

    // Count existing active bookings per date
    const existingBookings = await (prisma as any).booking.groupBy({
      by: ['date'],
      where: {
        serviceTypeId,
        date: { gte: startDate, lte: endDate },
        status: { in: ACTIVE_STATUSES },
      },
      _count: { id: true },
    });

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

      results.push({
        date: dateKey,
        available: spotsRemaining > 0,
        spotsRemaining,
        totalCapacity,
      });

      current.setDate(current.getDate() + 1);
    }

    return results;
  }

  /**
   * Create a new booking.
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
  private async calculatePrice(
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
