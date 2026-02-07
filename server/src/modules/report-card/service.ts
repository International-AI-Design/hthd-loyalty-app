import { prisma } from '../../lib/prisma';
import { ReportCardCreate, ReportCardUpdate, ReportCardListParams } from './types';

export class ReportCardService {
  /**
   * List report cards for a customer's dogs.
   * Includes dog name and booking date for display.
   */
  async getReportCards(
    customerId: string,
    params?: Partial<ReportCardListParams>
  ): Promise<{ reportCards: any[]; total: number }> {
    const limit = params?.limit ?? 20;
    const offset = params?.offset ?? 0;

    const where: Record<string, any> = {
      dog: { customerId },
    };

    if (params?.dogId) {
      where.dogId = params.dogId;
    }

    const [reportCards, total] = await Promise.all([
      (prisma as any).reportCard.findMany({
        where,
        include: {
          dog: { select: { id: true, name: true } },
          booking: { select: { id: true, date: true, serviceType: { select: { displayName: true } } } },
          staffUser: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      (prisma as any).reportCard.count({ where }),
    ]);

    return { reportCards, total };
  }

  /**
   * Get a single report card. Verifies the customer owns the dog.
   */
  async getReportCard(id: string, customerId: string) {
    const reportCard = await (prisma as any).reportCard.findUnique({
      where: { id },
      include: {
        dog: { select: { id: true, name: true, customerId: true } },
        booking: { select: { id: true, date: true, serviceType: { select: { displayName: true } } } },
        staffUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!reportCard) {
      throw new ReportCardError('Report card not found', 404);
    }

    if (reportCard.dog.customerId !== customerId) {
      throw new ReportCardError('Report card not found', 404); // Don't leak existence
    }

    return reportCard;
  }

  /**
   * Get report cards filtered by dog. Verifies customer owns the dog.
   */
  async getReportCardsByDog(
    dogId: string,
    customerId: string,
    params?: Partial<ReportCardListParams>
  ): Promise<{ reportCards: any[]; total: number }> {
    // Verify dog belongs to customer
    const dog = await prisma.dog.findFirst({
      where: { id: dogId, customerId },
    });
    if (!dog) {
      throw new ReportCardError('Dog not found', 404);
    }

    return this.getReportCards(customerId, { ...params, dogId });
  }

  /**
   * Create a report card (admin/staff).
   */
  async createReportCard(staffUserId: string, data: ReportCardCreate) {
    // Verify booking exists
    const booking = await (prisma as any).booking.findUnique({
      where: { id: data.bookingId },
      include: { dogs: true },
    });
    if (!booking) {
      throw new ReportCardError('Booking not found', 404);
    }

    // Verify dog is part of the booking
    const bookingDog = booking.dogs.find((bd: any) => bd.dogId === data.dogId);
    if (!bookingDog) {
      throw new ReportCardError('Dog is not part of this booking', 400);
    }

    const reportCard = await (prisma as any).reportCard.create({
      data: {
        bookingId: data.bookingId,
        dogId: data.dogId,
        staffUserId,
        notes: data.notes,
        photoUrls: data.photoUrls,
        rating: data.rating ?? null,
        activities: data.activities ?? null,
        meals: data.meals ?? null,
        socialBehavior: data.socialBehavior ?? null,
        mood: data.mood ?? null,
      },
      include: {
        dog: { select: { id: true, name: true } },
        booking: { select: { id: true, date: true, serviceType: { select: { displayName: true } } } },
        staffUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return reportCard;
  }

  /**
   * Update a report card (admin/staff).
   */
  async updateReportCard(id: string, staffUserId: string, data: ReportCardUpdate) {
    const existing = await (prisma as any).reportCard.findUnique({ where: { id } });
    if (!existing) {
      throw new ReportCardError('Report card not found', 404);
    }

    const reportCard = await (prisma as any).reportCard.update({
      where: { id },
      data: {
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.photoUrls !== undefined && { photoUrls: data.photoUrls }),
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.activities !== undefined && { activities: data.activities }),
        ...(data.meals !== undefined && { meals: data.meals }),
        ...(data.socialBehavior !== undefined && { socialBehavior: data.socialBehavior }),
        ...(data.mood !== undefined && { mood: data.mood }),
      },
      include: {
        dog: { select: { id: true, name: true } },
        booking: { select: { id: true, date: true, serviceType: { select: { displayName: true } } } },
        staffUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return reportCard;
  }

  /**
   * Delete a report card (admin/staff).
   */
  async deleteReportCard(id: string) {
    const existing = await (prisma as any).reportCard.findUnique({ where: { id } });
    if (!existing) {
      throw new ReportCardError('Report card not found', 404);
    }

    await (prisma as any).reportCard.delete({ where: { id } });
  }

  /**
   * Mark a report card as sent to the customer.
   */
  async sendReportCard(id: string, channel: string) {
    const existing = await (prisma as any).reportCard.findUnique({ where: { id } });
    if (!existing) {
      throw new ReportCardError('Report card not found', 404);
    }

    const validChannels = ['sms', 'email', 'app'];
    if (!validChannels.includes(channel)) {
      throw new ReportCardError(`Invalid channel. Must be one of: ${validChannels.join(', ')}`, 400);
    }

    const reportCard = await (prisma as any).reportCard.update({
      where: { id },
      data: {
        sentAt: new Date(),
        sentVia: channel,
      },
      include: {
        dog: { select: { id: true, name: true } },
        booking: { select: { id: true, date: true, serviceType: { select: { displayName: true } } } },
        staffUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return reportCard;
  }

  /**
   * Get report cards that haven't been sent yet, optionally filtered by date.
   */
  async getUnsentReportCards(date?: string): Promise<any[]> {
    const where: Record<string, any> = {
      sentAt: null,
    };

    if (date) {
      const dateObj = new Date(date + 'T00:00:00Z');
      const nextDay = new Date(dateObj);
      nextDay.setDate(nextDay.getDate() + 1);
      where.createdAt = { gte: dateObj, lt: nextDay };
    }

    return (prisma as any).reportCard.findMany({
      where,
      include: {
        dog: { select: { id: true, name: true, customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } } } },
        booking: { select: { id: true, date: true, serviceType: { select: { displayName: true } } } },
        staffUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all report cards for a specific booking.
   */
  async getReportCardsByBooking(bookingId: string): Promise<any[]> {
    return (prisma as any).reportCard.findMany({
      where: { bookingId },
      include: {
        dog: { select: { id: true, name: true } },
        staffUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

/**
 * Custom error class for report card operations with HTTP status codes.
 */
export class ReportCardError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'ReportCardError';
  }
}
