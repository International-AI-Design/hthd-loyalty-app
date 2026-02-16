import { prisma } from '../../lib/prisma';
import { capPoints } from '../../lib/points';
import { AutoReloadConfig } from './types';

// Type aliases — Prisma types won't exist until migration + prisma generate
// Using `any` for now; will be properly typed once schema is migrated
type Wallet = any;
type WalletTransaction = any;

const DAILY_LOAD_LIMIT_CENTS = 100_000; // $1,000 per day

export class WalletService {
  /**
   * Get existing wallet or create a new one with $0 balance.
   */
  async getOrCreateWallet(customerId: string): Promise<Wallet> {
    const existing = await (prisma as any).wallet.findUnique({
      where: { customerId },
    });
    if (existing) return existing;

    return (prisma as any).wallet.create({
      data: {
        customerId,
        balanceCents: 0,
        tier: 'basic',
      },
    });
  }

  /**
   * Load funds into a customer's wallet.
   * Enforces min/max per transaction and a daily load limit.
   * Uses interactive transaction to prevent race conditions.
   */
  async loadFunds(
    customerId: string,
    amountCents: number
  ): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
    if (amountCents < 500 || amountCents > 50_000) {
      throw new WalletError('Load amount must be between $5.00 and $500.00', 400);
    }

    const wallet = await this.getOrCreateWallet(customerId);

    // Use interactive transaction for atomic balance update
    const result = await prisma.$transaction(async (tx) => {
      // Check daily load limit inside transaction
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayLoads = await (tx as any).walletTransaction.aggregate({
        where: {
          walletId: wallet.id,
          type: 'load',
          createdAt: { gte: startOfDay },
        },
        _sum: { amountCents: true },
      });

      const loadedToday = todayLoads._sum.amountCents ?? 0;
      if (loadedToday + amountCents > DAILY_LOAD_LIMIT_CENTS) {
        throw new WalletError(
          `Daily load limit is $${(DAILY_LOAD_LIMIT_CENTS / 100).toFixed(2)}. You have loaded $${(loadedToday / 100).toFixed(2)} today.`,
          400
        );
      }

      // Atomic increment instead of read-then-set
      const updatedWallet = await (tx as any).wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: { increment: amountCents } },
      });

      const transaction = await (tx as any).walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'load',
          amountCents,
          balanceAfterCents: updatedWallet.balanceCents,
          description: `Loaded $${(amountCents / 100).toFixed(2)}`,
        },
      });

      return { wallet: updatedWallet, transaction };
    });

    return result;
  }

  /**
   * Deduct funds from wallet for a payment. Awards 2x loyalty points.
   * Uses interactive transaction to prevent race conditions.
   */
  async deductFunds(
    customerId: string,
    input: { amountCents: number; bookingId?: string; description: string }
  ): Promise<{ wallet: Wallet; transaction: WalletTransaction; pointsAwarded: number }> {
    // Calculate base points outside transaction (read-only lookup)
    let basePoints = Math.floor(input.amountCents / 100) * 2;

    if (input.bookingId) {
      const booking = await (prisma as any).booking.findUnique({
        where: { id: input.bookingId },
        include: { serviceType: { select: { name: true } } },
      });
      if (booking?.serviceType.name === 'grooming') {
        basePoints = Math.floor(basePoints * 1.5);
      }
    }

    // Interactive transaction for atomic balance checks and updates
    const result = await prisma.$transaction(async (tx) => {
      // Re-read wallet inside transaction for consistent balance
      const wallet = await (tx as any).wallet.findUnique({
        where: { customerId },
      });

      if (!wallet) {
        throw new WalletError('Wallet not found', 404);
      }

      if (wallet.balanceCents < input.amountCents) {
        throw new WalletError('Insufficient wallet balance', 400);
      }

      // Atomic decrement
      const updatedWallet = await (tx as any).wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: { decrement: input.amountCents } },
      });

      const transaction = await (tx as any).walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'payment',
          amountCents: -input.amountCents,
          balanceAfterCents: updatedWallet.balanceCents,
          description: input.description,
          bookingId: input.bookingId,
        },
      });

      // Award loyalty points (read customer inside transaction too)
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { pointsBalance: true },
      });
      if (!customer) {
        throw new WalletError('Customer not found', 404);
      }

      const { pointsAwarded, newBalance: newPointsBalance } = capPoints(
        customer.pointsBalance,
        basePoints
      );

      if (pointsAwarded > 0) {
        await tx.pointsTransaction.create({
          data: {
            customerId,
            type: 'purchase',
            amount: pointsAwarded,
            description: `Wallet payment - 2x points ($${(input.amountCents / 100).toFixed(2)})`,
          },
        });
        await tx.customer.update({
          where: { id: customerId },
          data: { pointsBalance: newPointsBalance },
        });
      }

      return { wallet: updatedWallet, transaction, pointsAwarded };
    });

    return result;
  }

  /**
   * Refund funds back to a customer's wallet.
   */
  async refund(
    customerId: string,
    amountCents: number,
    reason: string
  ): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
    const wallet = await this.getOrCreateWallet(customerId);
    const newBalance = wallet.balanceCents + amountCents;

    const [updatedWallet, transaction] = await prisma.$transaction([
      (prisma as any).wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: newBalance },
      }),
      (prisma as any).walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'refund',
          amountCents,
          balanceAfterCents: newBalance,
          description: `Refund: ${reason}`,
        },
      }),
    ]);

    return { wallet: updatedWallet, transaction };
  }

  /**
   * Quick balance lookup.
   */
  async getBalance(customerId: string): Promise<{ balanceCents: number; tier: string }> {
    const wallet = await this.getOrCreateWallet(customerId);
    return { balanceCents: wallet.balanceCents, tier: wallet.tier };
  }

  /**
   * Paginated transaction history, newest first.
   */
  async getTransactionHistory(
    customerId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ transactions: WalletTransaction[]; total: number }> {
    const wallet = await this.getOrCreateWallet(customerId);
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const [transactions, total] = await prisma.$transaction([
      (prisma as any).walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      (prisma as any).walletTransaction.count({
        where: { walletId: wallet.id },
      }),
    ]);

    return { transactions, total };
  }

  /**
   * Configure auto-reload settings on the wallet.
   */
  async setAutoReload(customerId: string, config: AutoReloadConfig): Promise<Wallet> {
    const wallet = await this.getOrCreateWallet(customerId);

    if (config.enabled) {
      if (config.reload_amount_cents !== undefined && config.reload_amount_cents > 20_000) {
        throw new WalletError('Max auto-reload amount is $200.00', 400);
      }
      if (config.threshold_cents !== undefined && config.threshold_cents < 500) {
        throw new WalletError('Min auto-reload threshold is $5.00', 400);
      }
    }

    return (prisma as any).wallet.update({
      where: { id: wallet.id },
      data: {
        autoReloadEnabled: config.enabled,
        autoReloadThresholdCents: config.enabled ? config.threshold_cents : null,
        autoReloadAmountCents: config.enabled ? config.reload_amount_cents : null,
      },
    });
  }

  /**
   * Check whether an auto-reload should be triggered for this customer.
   * Used by the payment module to know when to charge Stripe.
   */
  async checkAutoReloadTrigger(
    customerId: string
  ): Promise<{ shouldReload: boolean; amountCents: number }> {
    const wallet = await this.getOrCreateWallet(customerId);

    if (
      wallet.autoReloadEnabled &&
      wallet.autoReloadThresholdCents !== null &&
      wallet.autoReloadAmountCents !== null &&
      wallet.balanceCents < wallet.autoReloadThresholdCents
    ) {
      return { shouldReload: true, amountCents: wallet.autoReloadAmountCents };
    }

    return { shouldReload: false, amountCents: 0 };
  }
}

/**
 * Domain error with HTTP status code for clean error handling in routes.
 */
export class WalletError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'WalletError';
  }
}
