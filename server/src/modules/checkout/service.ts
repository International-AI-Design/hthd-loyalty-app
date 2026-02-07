import { prisma } from '../../lib/prisma';
import { WalletService } from '../wallet/service';
import { CheckoutInput, CheckoutResult, ReceiptData } from './types';
import { randomUUID } from 'crypto';

const walletService = new WalletService();

const CHECKOUT_ELIGIBLE_STATUSES = ['pending', 'confirmed'];

export class CheckoutService {
  /**
   * Process checkout for one or more bookings.
   * Simulated payment — always succeeds, generates UUID transaction IDs.
   * Atomic: create Payment + deduct wallet + update booking status.
   */
  async processCheckout(
    customerId: string,
    staffId: string | null,
    input: CheckoutInput
  ): Promise<CheckoutResult> {
    const { bookingIds, paymentMethod, walletAmountCents, tipCents, idempotencyKey } = input;

    // Idempotency check
    if (idempotencyKey) {
      const existing = await (prisma as any).payment.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          paymentId: existing.id,
          transactionId: existing.stripePaymentIntentId || existing.id,
          totalCents: existing.totalCents,
          walletAmountCents: existing.walletAmountCents,
          cardAmountCents: existing.cardAmountCents,
          tipCents: existing.tipCents,
          status: existing.status,
          bookings: [],
          createdAt: existing.createdAt,
        };
      }
    }

    // Load and validate all bookings
    const bookings = await (prisma as any).booking.findMany({
      where: {
        id: { in: bookingIds },
        customerId,
        status: { in: CHECKOUT_ELIGIBLE_STATUSES },
      },
      include: {
        serviceType: true,
        dogs: { include: { dog: true } },
      },
    });

    if (bookings.length !== bookingIds.length) {
      const found = new Set(bookings.map((b: any) => b.id));
      const missing = bookingIds.filter((id) => !found.has(id));
      throw new CheckoutError(`Bookings not found or not eligible: ${missing.join(', ')}`);
    }

    // Calculate total
    const subtotalCents = bookings.reduce((sum: number, b: any) => sum + b.totalCents, 0);
    const totalCents = subtotalCents + (tipCents || 0);

    // Determine wallet vs card split
    let walletDeductCents = 0;
    let cardChargeCents = 0;

    if (paymentMethod === 'wallet') {
      walletDeductCents = totalCents;
      cardChargeCents = 0;
    } else if (paymentMethod === 'card' || paymentMethod === 'cash') {
      walletDeductCents = 0;
      cardChargeCents = totalCents;
    } else if (paymentMethod === 'split') {
      walletDeductCents = Math.min(walletAmountCents || 0, totalCents);
      cardChargeCents = totalCents - walletDeductCents;
    }

    // Validate wallet balance if using wallet
    if (walletDeductCents > 0) {
      const { balanceCents } = await walletService.getBalance(customerId);
      if (balanceCents < walletDeductCents) {
        throw new CheckoutError(
          `Insufficient wallet balance. Available: $${(balanceCents / 100).toFixed(2)}, Required: $${(walletDeductCents / 100).toFixed(2)}`
        );
      }
    }

    // Simulated transaction ID (replace with Stripe later)
    const transactionId = `sim_${randomUUID()}`;

    // Atomic transaction: payment + wallet deduction + booking status updates
    const result = await prisma.$transaction(async (tx: any) => {
      // Create payment record
      const payment = await tx.payment.create({
        data: {
          customerId,
          bookingId: bookingIds.length === 1 ? bookingIds[0] : null,
          totalCents,
          walletAmountCents: walletDeductCents,
          cardAmountCents: cardChargeCents,
          tipCents: tipCents || 0,
          status: 'completed',
          stripePaymentIntentId: transactionId,
          idempotencyKey: idempotencyKey || null,
        },
      });

      // Deduct wallet if applicable
      if (walletDeductCents > 0) {
        const wallet = await tx.wallet.findUnique({ where: { customerId } });
        if (!wallet || wallet.balanceCents < walletDeductCents) {
          throw new CheckoutError('Insufficient wallet balance');
        }
        await tx.wallet.update({
          where: { customerId },
          data: { balanceCents: wallet.balanceCents - walletDeductCents },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'payment',
            amountCents: -walletDeductCents,
            balanceAfterCents: wallet.balanceCents - walletDeductCents,
            description: `Checkout payment for ${bookingIds.length} booking(s)`,
            bookingId: bookingIds.length === 1 ? bookingIds[0] : null,
          },
        });
      }

      // Update all bookings to confirmed
      const updatedBookings = [];
      for (const bookingId of bookingIds) {
        const updated = await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'confirmed' },
        });
        updatedBookings.push({ id: updated.id, status: updated.status });
      }

      // Audit log if staff-initiated
      if (staffId) {
        await tx.auditLog.create({
          data: {
            staffUserId: staffId,
            action: 'checkout',
            entityType: 'payment',
            entityId: payment.id,
            details: {
              bookingIds,
              paymentMethod,
              totalCents,
              walletAmountCents: walletDeductCents,
              cardAmountCents: cardChargeCents,
            },
          },
        });
      }

      return {
        paymentId: payment.id,
        transactionId,
        totalCents,
        walletAmountCents: walletDeductCents,
        cardAmountCents: cardChargeCents,
        tipCents: tipCents || 0,
        status: 'completed',
        bookings: updatedBookings,
        createdAt: payment.createdAt,
      } satisfies CheckoutResult;
    });

    return result;
  }

  /**
   * Get receipt data for a completed payment.
   */
  async getReceipt(paymentId: string, customerId: string): Promise<ReceiptData> {
    return this._getReceipt(paymentId, customerId);
  }

  /**
   * Get receipt data for a completed payment (admin — no ownership check).
   */
  async getReceiptAdmin(paymentId: string): Promise<ReceiptData> {
    return this._getReceipt(paymentId, null);
  }

  /**
   * Internal receipt builder. When customerId is provided, enforces ownership.
   */
  private async _getReceipt(paymentId: string, customerId: string | null): Promise<ReceiptData> {
    const payment = await (prisma as any).payment.findUnique({
      where: { id: paymentId },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
        booking: {
          include: {
            serviceType: true,
            dogs: { include: { dog: true } },
          },
        },
      },
    });

    if (!payment) {
      throw new CheckoutError('Payment not found');
    }

    if (customerId && payment.customerId !== customerId) {
      throw new CheckoutError('Payment not found');
    }

    // Build booking details for receipt
    const bookings = [];
    if (payment.booking) {
      const b = payment.booking;
      bookings.push({
        id: b.id,
        serviceType: b.serviceType.name,
        date: b.date.toISOString().split('T')[0],
        startDate: b.startDate ? b.startDate.toISOString().split('T')[0] : null,
        endDate: b.endDate ? b.endDate.toISOString().split('T')[0] : null,
        dogs: b.dogs.map((bd: any) => bd.dog.name),
        totalCents: b.totalCents,
      });
    }

    return {
      paymentId: payment.id,
      transactionId: payment.stripePaymentIntentId || payment.id,
      customer: payment.customer,
      bookings,
      totalCents: payment.totalCents,
      walletAmountCents: payment.walletAmountCents,
      cardAmountCents: payment.cardAmountCents,
      tipCents: payment.tipCents,
      paymentMethod: payment.walletAmountCents > 0 && payment.cardAmountCents > 0
        ? 'split'
        : payment.walletAmountCents > 0
          ? 'wallet'
          : 'card',
      status: payment.status,
      createdAt: payment.createdAt,
    };
  }
}

class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutError';
  }
}

export const checkoutService = new CheckoutService();
