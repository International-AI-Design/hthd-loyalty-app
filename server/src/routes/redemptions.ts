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

    // Fetch customer to check points balance
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, firstName: true, lastName: true, pointsBalance: true },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // Validate customer has sufficient points
    if (customer.pointsBalance < reward_tier) {
      res.status(400).json({
        error: 'Insufficient points',
        message: `You need ${reward_tier} points but only have ${customer.pointsBalance}`,
        required_points: reward_tier,
        current_balance: customer.pointsBalance,
      });
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

    // Create redemption record with status 'pending'
    // Points are NOT deducted yet - they will be deducted when the redemption is completed
    const redemption = await prisma.redemption.create({
      data: {
        customerId,
        redemptionCode,
        rewardTier: reward_tier,
        discountValue,
        status: 'pending',
      },
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
    console.error('Redemption request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
