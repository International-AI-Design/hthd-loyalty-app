import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { authenticateStaff, AuthenticatedStaffRequest } from '../../middleware/auth';

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

// Apply staff authentication to all routes
router.use(authenticateStaff);

// GET /api/admin/redemptions/lookup?code={code}
// Look up a redemption by code
router.get('/lookup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Redemption code is required' });
      return;
    }

    // Find the redemption by code
    const redemption = await prisma.redemption.findUnique({
      where: { redemptionCode: code.toUpperCase() },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            pointsBalance: true,
          },
        },
      },
    });

    if (!redemption) {
      res.status(404).json({ error: 'Redemption not found' });
      return;
    }

    res.status(200).json({
      id: redemption.id,
      redemption_code: redemption.redemptionCode,
      reward_tier: redemption.rewardTier,
      discount_value: Number(redemption.discountValue),
      status: redemption.status,
      created_at: redemption.createdAt.toISOString(),
      approved_at: redemption.approvedAt?.toISOString() || null,
      customer: {
        id: redemption.customer.id,
        name: `${redemption.customer.firstName} ${redemption.customer.lastName}`,
        phone: redemption.customer.phone,
        email: redemption.customer.email,
        points_balance: redemption.customer.pointsBalance,
      },
    });
  } catch (error) {
    console.error('Redemption lookup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validation schema for completing a redemption
const completeRedemptionSchema = z.object({
  redemption_code: z.string().min(1, 'Redemption code is required'),
});

// POST /api/admin/redemptions/complete
// Complete a pending redemption
router.post('/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;

    // Validate request body
    const validation = completeRedemptionSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.issues,
      });
      return;
    }

    const { redemption_code } = validation.data;

    // Use interactive transaction to prevent double-completion race condition
    const result = await prisma.$transaction(async (tx) => {
      // Find the redemption inside transaction for consistent read
      const redemption = await tx.redemption.findUnique({
        where: { redemptionCode: redemption_code },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              pointsBalance: true,
            },
          },
        },
      });

      if (!redemption) {
        throw { statusCode: 404, message: 'Redemption not found' };
      }

      // Validate redemption status is 'pending' (inside transaction)
      if (redemption.status !== 'pending') {
        throw {
          statusCode: 400,
          message: `Redemption is already ${redemption.status}`,
          details: { current_status: redemption.status },
        };
      }

      // Validate customer has sufficient points (safety check)
      if (redemption.customer.pointsBalance < redemption.rewardTier) {
        throw {
          statusCode: 400,
          message: `Customer needs ${redemption.rewardTier} points but only has ${redemption.customer.pointsBalance}`,
          details: {
            required_points: redemption.rewardTier,
            current_balance: redemption.customer.pointsBalance,
          },
        };
      }

      // Update redemption status to 'completed'
      const updatedRedemption = await tx.redemption.update({
        where: { id: redemption.id },
        data: {
          status: 'completed',
          approvedBy: staffReq.staff.id,
          approvedAt: new Date(),
        },
      });

      // Create points transaction for the redemption (negative amount)
      await tx.pointsTransaction.create({
        data: {
          customerId: redemption.customerId,
          type: 'redemption',
          amount: -redemption.rewardTier,
          description: `Redeemed ${redemption.rewardTier} points for $${Number(redemption.discountValue)} discount`,
        },
      });

      // Deduct points from customer balance (atomic decrement)
      const updatedCustomer = await tx.customer.update({
        where: { id: redemption.customerId },
        data: {
          pointsBalance: {
            decrement: redemption.rewardTier,
          },
        },
        select: { id: true, pointsBalance: true },
      });

      // Log to audit log
      await tx.auditLog.create({
        data: {
          staffUserId: staffReq.staff.id,
          action: 'complete_redemption',
          entityType: 'redemption',
          entityId: redemption.id,
          details: {
            redemption_code: redemption.redemptionCode,
            reward_tier: redemption.rewardTier,
            discount_value: Number(redemption.discountValue),
            customer_id: redemption.customerId,
            customer_name: `${redemption.customer.firstName} ${redemption.customer.lastName}`,
            previous_balance: redemption.customer.pointsBalance,
            new_balance: updatedCustomer.pointsBalance,
          },
        },
      });

      return {
        updatedRedemption,
        updatedCustomer,
        customer: redemption.customer,
        discountValue: redemption.discountValue,
      };
    });

    res.status(200).json({
      success: true,
      message: 'Redemption completed successfully',
      redemption: {
        id: result.updatedRedemption.id,
        redemption_code: result.updatedRedemption.redemptionCode,
        reward_tier: result.updatedRedemption.rewardTier,
        discount_value: Number(result.updatedRedemption.discountValue),
        status: result.updatedRedemption.status,
        approved_at: result.updatedRedemption.approvedAt?.toISOString(),
      },
      customer: {
        id: result.customer.id,
        name: `${result.customer.firstName} ${result.customer.lastName}`,
        previous_balance: result.customer.pointsBalance,
        new_balance: result.updatedCustomer.pointsBalance,
      },
      discount_to_apply: Number(result.discountValue),
    });
  } catch (error: any) {
    if (error?.statusCode) {
      res.status(error.statusCode).json({
        error: error.message,
        ...(error.details || {}),
      });
      return;
    }
    console.error('Complete redemption error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Validation schema for staff-initiated redemption
const createRedemptionSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  reward_tier: z.enum(['100', '250', '500'], {
    message: 'Reward tier must be 100, 250, or 500',
  }).transform((val) => parseInt(val, 10)),
});

// POST /api/admin/redemptions/create
// Process a redemption directly for a customer at checkout (staff-initiated)
router.post('/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;

    // Validate request body
    const validation = createRedemptionSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.issues,
      });
      return;
    }

    const { customer_id, reward_tier } = validation.data;

    // Get discount value for this tier
    const discountValue = REWARD_TIERS[reward_tier];
    if (!discountValue) {
      res.status(400).json({ error: 'Invalid reward tier' });
      return;
    }

    // Fetch customer to check points balance
    const customer = await prisma.customer.findUnique({
      where: { id: customer_id },
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
        message: `Customer needs ${reward_tier} points but only has ${customer.pointsBalance}`,
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

    // Create redemption as 'completed' immediately and deduct points in a transaction
    const [redemption, transaction, updatedCustomer] = await prisma.$transaction([
      // Create redemption record with status 'completed' immediately
      prisma.redemption.create({
        data: {
          customerId: customer_id,
          redemptionCode,
          rewardTier: reward_tier,
          discountValue,
          status: 'completed',
          approvedBy: staffReq.staff.id,
          approvedAt: new Date(),
        },
      }),
      // Create points transaction for the redemption (negative amount)
      prisma.pointsTransaction.create({
        data: {
          customerId: customer_id,
          type: 'redemption',
          amount: -reward_tier,
          description: `Redeemed ${reward_tier} points for $${discountValue} discount`,
        },
      }),
      // Deduct points from customer balance
      prisma.customer.update({
        where: { id: customer_id },
        data: {
          pointsBalance: {
            decrement: reward_tier,
          },
        },
        select: { id: true, pointsBalance: true },
      }),
      // Log to audit log
      prisma.auditLog.create({
        data: {
          staffUserId: staffReq.staff.id,
          action: 'create_redemption',
          entityType: 'redemption',
          entityId: '', // Will be updated after we get the redemption ID
          details: {
            customer_id: customer_id,
            customer_name: `${customer.firstName} ${customer.lastName}`,
            reward_tier: reward_tier,
            discount_value: discountValue,
            redemption_code: redemptionCode,
            previous_balance: customer.pointsBalance,
            new_balance: customer.pointsBalance - reward_tier,
          },
        },
      }),
    ]);

    res.status(201).json({
      success: true,
      message: 'Redemption processed successfully',
      redemption: {
        id: redemption.id,
        redemption_code: redemption.redemptionCode,
        reward_tier: redemption.rewardTier,
        discount_value: Number(redemption.discountValue),
        status: redemption.status,
        approved_at: redemption.approvedAt?.toISOString(),
      },
      customer: {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        previous_balance: customer.pointsBalance,
        new_balance: updatedCustomer.pointsBalance,
      },
      discount_to_apply: discountValue,
    });
  } catch (error) {
    console.error('Create redemption error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
