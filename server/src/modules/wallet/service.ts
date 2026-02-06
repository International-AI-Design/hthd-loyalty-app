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
   */
  async loadFunds(
    customerId: string,
    amountCents: number
  ): Promise<{ wallet: Wallet; transaction: WalletTransaction }> {
    if (amountCents < 500 || amountCents > 50_000) {
      throw new WalletError('Load amount must be between $5.00 and $500.00', 400);
    }

    // Check daily load limit
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const wallet = await this.getOrCreateWallet(customerId);

    const todayLoads = await (prisma as any).walletTransaction.aggregate({
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

    const newBalance = wallet.balanceCents + amountCents;

    const [updatedWallet, transaction] = await prisma.$transaction([
      (prisma as any).wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: newBalance },
      }),
      (prisma as any).walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'load',
          amountCents,
          balanceAfterCents: newBalance,
          description: `Loaded $${(amountCents / 100).toFixed(2)}`,
        },
      }),
    ]);

    return { wallet: updatedWallet, transaction };
  }

  /**
   * Deduct funds from wallet for a payment. Awards 2x loyalty points.
   */
  async deductFunds(
    customerId: string,
    input: { amountCents: number; bookingId?: string; description: string }
  ): Promise<{ wallet: Wallet; transaction: WalletTransaction; pointsAwarded: number }> {
    const wallet = await this.getOrCreateWallet(customerId);

    if (wallet.balanceCents < input.amountCents) {
      throw new WalletError('Insufficient wallet balance', 400);
    }

    const newBalance = wallet.balanceCents - input.amountCents;

    // Calculate 2x base points for wallet payments
    let basePoints = Math.floor(input.amountCents / 100) * 2;

    // Check for grooming multiplier if bookingId provided
    if (input.bookingId) {
      const booking = await (prisma as any).booking.findUnique({
        where: { id: input.bookingId },
        include: { serviceType: { select: { name: true } } },
      });
      if (booking?.serviceType.name === 'grooming') {
        basePoints = Math.floor(basePoints * 1.5);
      }
    }

    // Get current points balance and apply cap
    const customer = await prisma.customer.findUnique({
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

    const [updatedWallet, transaction] = await prisma.$transaction([
      (prisma as any).wallet.update({
        where: { id: wallet.id },
        data: { balanceCents: newBalance },
      }),
      (prisma as any).walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'payment',
          amountCents: -input.amountCents,
          balanceAfterCents: newBalance,
          description: input.description,
          bookingId: input.bookingId,
        },
      }),
      // Award loyalty points (only if any can be awarded under the cap)
      ...(pointsAwarded > 0
        ? [
            prisma.pointsTransaction.create({
              data: {
                customerId,
                type: 'purchase',
                amount: pointsAwarded,
                description: `Wallet payment - 2x points ($${(input.amountCents / 100).toFixed(2)})`,
              },
            }),
            prisma.customer.update({
              where: { id: customerId },
              data: { pointsBalance: newPointsBalance },
            }),
          ]
        : []),
    ]);

    return { wallet: updatedWallet, transaction, pointsAwarded };
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
