import { prisma } from '../../lib/prisma';

export class GroomingService {
  /**
   * Get price for a specific size + condition rating combo
   */
  async getPrice(sizeCategory: string, conditionRating: number) {
    const tier = await (prisma as any).groomingPriceTier.findUnique({
      where: {
        sizeCategory_conditionRating: { sizeCategory, conditionRating },
      },
    });
    if (!tier) {
      throw new GroomingError('Price tier not found', 404);
    }
    return tier;
  }

  /**
   * Get min/max price range for a size category
   */
  async getPriceRange(sizeCategory: string) {
    const tiers = await (prisma as any).groomingPriceTier.findMany({
      where: { sizeCategory, isActive: true },
      select: { priceCents: true },
    });
    if (!tiers.length) {
      throw new GroomingError('No pricing found for this size', 404);
    }
    const prices = tiers.map((t: any) => t.priceCents);
    return {
      sizeCategory,
      minPriceCents: Math.min(...prices),
      maxPriceCents: Math.max(...prices),
    };
  }

  /**
   * Groomer rates a dog's coat condition — calculates and stores price
   */
  async rateCondition(bookingDogId: string, conditionRating: number, staffId: string) {
    if (conditionRating < 1 || conditionRating > 5) {
      throw new GroomingError('Condition rating must be between 1 and 5', 400);
    }

    // Get the booking dog with its dog's size
    const bookingDog = await (prisma as any).bookingDog.findUnique({
      where: { id: bookingDogId },
      include: {
        dog: true,
        booking: { include: { serviceType: true } },
      },
    });
    if (!bookingDog) {
      throw new GroomingError('Booking dog not found', 404);
    }
    if (bookingDog.booking.serviceType.name !== 'grooming') {
      throw new GroomingError('Can only rate grooming bookings', 400);
    }
    if (!bookingDog.dog.sizeCategory) {
      throw new GroomingError('Dog size category must be set before rating', 400);
    }

    // Look up price from matrix
    const tier = await (prisma as any).groomingPriceTier.findUnique({
      where: {
        sizeCategory_conditionRating: {
          sizeCategory: bookingDog.dog.sizeCategory,
          conditionRating,
        },
      },
    });
    if (!tier) {
      throw new GroomingError('Price tier not found for this size/condition combo', 404);
    }

    // Update the booking dog with rating and quoted price
    const updated = await (prisma as any).bookingDog.update({
      where: { id: bookingDogId },
      data: {
        conditionRating,
        quotedPriceCents: tier.priceCents,
      },
      include: {
        dog: true,
        booking: true,
      },
    });

    // Also update the booking's total if this is the only dog
    const allBookingDogs = await (prisma as any).bookingDog.findMany({
      where: { bookingId: bookingDog.booking.id },
    });

    // Recalculate total from all rated dogs
    let newTotal = 0;
    let allRated = true;
    for (const bd of allBookingDogs) {
      if (bd.id === bookingDogId) {
        newTotal += tier.priceCents;
      } else if (bd.quotedPriceCents) {
        newTotal += bd.quotedPriceCents;
      } else {
        allRated = false;
        newTotal += bookingDog.booking.totalCents / allBookingDogs.length; // estimate
      }
    }

    if (allRated) {
      await (prisma as any).booking.update({
        where: { id: bookingDog.booking.id },
        data: { totalCents: newTotal },
      });
    }

    return {
      bookingDog: updated,
      priceTier: tier,
    };
  }

  /**
   * Get the full 4×5 price matrix for admin display
   */
  async getPriceMatrix() {
    return (prisma as any).groomingPriceTier.findMany({
      orderBy: [
        { sizeCategory: 'asc' },
        { conditionRating: 'asc' },
      ],
    });
  }

  /**
   * Owner updates a price tier
   */
  async updatePriceTier(id: string, data: { priceCents?: number; estimatedMinutes?: number }) {
    const tier = await (prisma as any).groomingPriceTier.findUnique({ where: { id } });
    if (!tier) {
      throw new GroomingError('Price tier not found', 404);
    }
    return (prisma as any).groomingPriceTier.update({
      where: { id },
      data,
    });
  }
}

export class GroomingError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'GroomingError';
  }
}
