import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { capPoints } from '../../lib/points';
import { authenticateStaff, AuthenticatedStaffRequest } from '../../middleware/auth';

const router = Router();

// Apply staff authentication to all routes
router.use(authenticateStaff);

// Validation schema for adding points
const addPointsSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  dollar_amount: z.number().positive('Dollar amount must be positive').max(10000, 'Dollar amount cannot exceed $10,000'),
  service_type: z.enum(['daycare', 'boarding', 'grooming'], {
    message: 'Service type must be daycare, boarding, or grooming',
  }),
});

// POST /api/admin/points/add
// Add points to a customer's account for a purchase
router.post('/add', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;

    // Validate request body
    const validation = addPointsSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation error',
        details: validation.error.issues,
      });
      return;
    }

    const { customer_id, dollar_amount, service_type } = validation.data;

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customer_id },
      select: { id: true, firstName: true, lastName: true, pointsBalance: true },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // Calculate points: 1 point per dollar, 1.5x for grooming
    const multiplier = service_type === 'grooming' ? 1.5 : 1;
    const rawPoints = Math.floor(dollar_amount * multiplier);

    // Apply 500-point cap
    const { pointsAwarded, pointsCapped, newBalance } = capPoints(customer.pointsBalance, rawPoints);

    if (pointsAwarded <= 0) {
      res.status(200).json({
        success: true,
        message: 'Customer is already at the 500 point maximum',
        customer: {
          id: customer.id,
          name: `${customer.firstName} ${customer.lastName}`,
          previous_balance: customer.pointsBalance,
          new_balance: customer.pointsBalance,
          points_capped: rawPoints,
        },
      });
      return;
    }

    // Create transaction and update balance in a transaction
    const [transaction, updatedCustomer] = await prisma.$transaction([
      // Create points transaction record
      prisma.pointsTransaction.create({
        data: {
          customerId: customer_id,
          type: 'purchase',
          amount: pointsAwarded,
          description: `${service_type.charAt(0).toUpperCase() + service_type.slice(1)} purchase - $${dollar_amount.toFixed(2)}${pointsCapped > 0 ? ` (${pointsCapped} pts capped at max)` : ''}`,
          serviceType: service_type,
          dollarAmount: dollar_amount,
        },
      }),
      // Update customer points balance
      prisma.customer.update({
        where: { id: customer_id },
        data: {
          pointsBalance: newBalance,
        },
        select: { id: true, pointsBalance: true },
      }),
      // Log to audit log
      prisma.auditLog.create({
        data: {
          staffUserId: staffReq.staff.id,
          action: 'add_points',
          entityType: 'customer',
          entityId: customer_id,
          details: {
            dollar_amount,
            service_type,
            points_calculated: rawPoints,
            points_awarded: pointsAwarded,
            points_capped: pointsCapped,
            multiplier,
            previous_balance: customer.pointsBalance,
            new_balance: newBalance,
          },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        points_earned: pointsAwarded,
        points_capped: pointsCapped,
        dollar_amount,
        service_type,
        description: transaction.description,
        created_at: transaction.createdAt,
      },
      customer: {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        previous_balance: customer.pointsBalance,
        new_balance: updatedCustomer.pointsBalance,
      },
    });
  } catch (error) {
    console.error('Add points error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
