import { prisma } from '../../lib/prisma';
import { WalletService } from '../wallet/service';
import { CheckoutInput, CheckoutResult, ReceiptData, POINTS_VALUE_CENTS } from './types';
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
    const { bookingIds, paymentMethod, walletAmountCents, pointsToRedeem, tipCents, idempotencyKey } = input;

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
          pointsRedeemed: 0,
          pointsAmountCents: 0,
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

    // Determine wallet vs card vs points split
    let walletDeductCents = 0;
    let cardChargeCents = 0;
    let pointsDeductAmount = 0;
    let pointsDeductCents = 0;

    if (paymentMethod === 'wallet') {
      walletDeductCents = totalCents;
      cardChargeCents = 0;
    } else if (paymentMethod === 'card' || paymentMethod === 'cash') {
      walletDeductCents = 0;
      cardChargeCents = totalCents;
    } else if (paymentMethod === 'split') {
      // Split can combine wallet + card, or points + card
      walletDeductCents = Math.min(walletAmountCents || 0, totalCents);
      // If points are also included in a split
      if (pointsToRedeem && pointsToRedeem > 0) {
        pointsDeductAmount = pointsToRedeem;
        pointsDeductCents = pointsDeductAmount * POINTS_VALUE_CENTS;
        // Points cover part of total after wallet
        const remaining = totalCents - walletDeductCents;
        pointsDeductCents = Math.min(pointsDeductCents, remaining);
        // Recalculate actual points needed (round up to cover the cents)
        pointsDeductAmount = Math.ceil(pointsDeductCents / POINTS_VALUE_CENTS);
        pointsDeductCents = pointsDeductAmount * POINTS_VALUE_CENTS;
        // Cap at remaining
        if (pointsDeductCents > remaining) {
          pointsDeductCents = remaining;
          pointsDeductAmount = Math.ceil(pointsDeductCents / POINTS_VALUE_CENTS);
        }
      }
      cardChargeCents = totalCents - walletDeductCents - pointsDeductCents;
      if (cardChargeCents < 0) cardChargeCents = 0;
    } else if (paymentMethod === 'points') {
      // Full points payment
      pointsDeductAmount = pointsToRedeem || 0;
      pointsDeductCents = pointsDeductAmount * POINTS_VALUE_CENTS;
      if (pointsDeductCents < totalCents) {
        throw new CheckoutError(
          `Insufficient points. You need ${Math.ceil(totalCents / POINTS_VALUE_CENTS)} points ($${(totalCents / 100).toFixed(2)}), but only selected ${pointsDeductAmount} points ($${(pointsDeductCents / 100).toFixed(2)}).`
        );
      }
      // Cap to exact amount needed (no overpaying with points)
      pointsDeductCents = totalCents;
      pointsDeductAmount = Math.ceil(totalCents / POINTS_VALUE_CENTS);
      cardChargeCents = 0;
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

    // Validate points balance if using points
    if (pointsDeductAmount > 0) {
      const customer = await (prisma as any).customer.findUnique({
        where: { id: customerId },
        select: { pointsBalance: true },
      });
      if (!customer || customer.pointsBalance < pointsDeductAmount) {
        throw new CheckoutError(
          `Insufficient points. Available: ${customer?.pointsBalance ?? 0}, Required: ${pointsDeductAmount}`
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

      // Deduct wallet if applicable (atomic decrement to prevent race conditions)
      if (walletDeductCents > 0) {
        const wallet = await tx.wallet.findUnique({ where: { customerId } });
        if (!wallet || wallet.balanceCents < walletDeductCents) {
          throw new CheckoutError('Insufficient wallet balance');
        }
        const updatedWallet = await tx.wallet.update({
          where: { customerId },
          data: { balanceCents: { decrement: walletDeductCents } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'payment',
            amountCents: -walletDeductCents,
            balanceAfterCents: updatedWallet.balanceCents,
            description: `Checkout payment for ${bookingIds.length} booking(s)`,
            bookingId: bookingIds.length === 1 ? bookingIds[0] : null,
          },
        });
      }

      // Deduct points if applicable (atomic decrement to prevent race conditions)
      if (pointsDeductAmount > 0) {
        const cust = await tx.customer.findUnique({ where: { id: customerId } });
        if (!cust || cust.pointsBalance < pointsDeductAmount) {
          throw new CheckoutError('Insufficient points balance');
        }
        await tx.customer.update({
          where: { id: customerId },
          data: { pointsBalance: { decrement: pointsDeductAmount } },
        });
        await tx.pointsTransaction.create({
          data: {
            customerId,
            type: 'redemption',
            amount: -pointsDeductAmount,
            description: `Checkout payment — ${pointsDeductAmount} points redeemed ($${(pointsDeductCents / 100).toFixed(2)})`,
            dollarAmount: pointsDeductCents / 100,
          },
        });
      }

      // Award loyalty points for card/cash payments (wallet payments earn via WalletService)
      if (cardChargeCents > 0 && walletDeductCents === 0) {
        // Card/cash-only: 1 point per dollar, 1.5x for grooming
        const hasGrooming = bookings.some((b: any) => b.serviceType?.name === 'grooming');
        const multiplier = hasGrooming ? 1.5 : 1;
        const pointsEarned = Math.floor((cardChargeCents / 100) * multiplier);

        if (pointsEarned > 0) {
          await tx.customer.update({
            where: { id: customerId },
            data: { pointsBalance: { increment: pointsEarned } },
          });
          await tx.pointsTransaction.create({
            data: {
              customerId,
              type: 'purchase',
              amount: pointsEarned,
              description: `Points earned on ${paymentMethod} payment`,
              serviceType: hasGrooming ? 'grooming' : bookings[0]?.serviceType?.name || 'daycare',
              dollarAmount: cardChargeCents / 100,
            },
          });
        }
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
              pointsRedeemed: pointsDeductAmount,
              pointsAmountCents: pointsDeductCents,
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
        pointsRedeemed: pointsDeductAmount,
        pointsAmountCents: pointsDeductCents,
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
