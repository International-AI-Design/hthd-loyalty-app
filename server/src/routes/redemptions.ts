import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticateCustomer, AuthenticatedCustomerRequest } from '../middleware/auth';

const router = Router();

// Reward tier configuration: points required -> discount value
const REWARD_TIERS: Record<number, number> = {
  100: 10,  // 100 points = $10 discount
  250: 25,  // 250 points = $25 discount
  500: 50,  // 500 points = $50 discount
};

// Generate unique redemption code (RD-XXXXXX format)
function generateRedemptionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoiding confusing characters
  let code = 'RD-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Domain error for redemption operations (thrown inside transactions)
class RedemptionError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'RedemptionError';
  }
}

// Validation schema for redemption request
const redemptionRequestSchema = z.object({
  reward_tier: z.enum(['100', '250', '500'], {
    message: 'Reward tier must be 100, 250, or 500',
  }).transform((val) => parseInt(val, 10)),
});

// GET /api/redemptions - Get customer's redemptions
router.get('/', authenticateCustomer, async (req, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const customerId = customerReq.customer.id;

    // Fetch all redemptions for this customer
    const redemptions = await prisma.redemption.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

    // Separate into pending and completed
    const pending = redemptions.filter(r => r.status === 'pending');
    const completed = redemptions.filter(r => r.status === 'completed');

    res.json({
      pending: pending.map(r => ({
        id: r.id,
        redemption_code: r.redemptionCode,
        reward_tier: r.rewardTier,
        discount_value: Number(r.discountValue),
        status: r.status,
        created_at: r.createdAt.toISOString(),
      })),
      completed: completed.map(r => ({
        id: r.id,
        redemption_code: r.redemptionCode,
        reward_tier: r.rewardTier,
        discount_value: Number(r.discountValue),
        status: r.status,
        created_at: r.createdAt.toISOString(),
        approved_at: r.approvedAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error('Get redemptions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/redemptions/request - Request a points redemption
router.post('/request', authenticateCustomer, async (req, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const customerId = customerReq.customer.id;

    // Validate request body
    const validation = redemptionRequestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.issues,
      });
      return;
    }

    const { reward_tier } = validation.data;

    // Get discount value for this tier
    const discountValue = REWARD_TIERS[reward_tier];
    if (!discountValue) {
      res.status(400).json({ error: 'Invalid reward tier' });
      return;
    }

    // Generate unique redemption code with retry logic
    let redemptionCode = generateRedemptionCode();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const existing = await prisma.redemption.findUnique({
        where: { redemptionCode },
      });
      if (!existing) break;
      redemptionCode = generateRedemptionCode();
      attempts++;
    }

    // Use interactive transaction to prevent race condition:
    // Two concurrent requests could both pass the balance check without this
    const redemption = await prisma.$transaction(async (tx) => {
      // Re-fetch customer inside transaction for consistent read
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { id: true, firstName: true, lastName: true, pointsBalance: true },
      });

      if (!customer) {
        throw new RedemptionError('Customer not found', 404);
      }

      // Check total pending redemptions to prevent over-commitment
      const pendingRedemptions = await tx.redemption.findMany({
        where: { customerId, status: 'pending' },
        select: { rewardTier: true },
      });
      const pendingPoints = pendingRedemptions.reduce((sum, r) => sum + r.rewardTier, 0);
      const availablePoints = customer.pointsBalance - pendingPoints;

      if (availablePoints < reward_tier) {
        throw new RedemptionError(
          `You need ${reward_tier} points but only have ${availablePoints} available (${pendingPoints} reserved in pending redemptions)`,
          400,
          { required_points: reward_tier, current_balance: customer.pointsBalance, pending_points: pendingPoints }
        );
      }

      // Create redemption record with status 'pending'
      return tx.redemption.create({
        data: {
          customerId,
          redemptionCode,
          rewardTier: reward_tier,
          discountValue,
          status: 'pending',
        },
      });
    });

    res.status(201).json({
      success: true,
      message: 'Redemption request created successfully',
      redemption: {
        id: redemption.id,
        redemption_code: redemption.redemptionCode,
        reward_tier: redemption.rewardTier,
        discount_value: Number(redemption.discountValue),
        status: redemption.status,
        created_at: redemption.createdAt.toISOString(),
      },
      instructions: 'Show this code at checkout to redeem your discount',
    });
  } catch (error) {
    if (error instanceof RedemptionError) {
      res.status(error.statusCode).json({
        error: error.message,
        ...(error.details || {}),
      });
      return;
    }
    console.error('Redemption request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
