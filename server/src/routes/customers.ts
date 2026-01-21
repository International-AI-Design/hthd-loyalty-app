import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateCustomer, AuthenticatedCustomerRequest } from '../middleware/auth';

const router = Router();

// GET /api/customers/me - Get current customer profile
router.get('/me', authenticateCustomer, async (req, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const customerId = customerReq.customer.id;

    // Fetch full customer profile
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        pointsBalance: true,
        referralCode: true,
      },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    res.status(200).json({
      id: customer.id,
      first_name: customer.firstName,
      last_name: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      points_balance: customer.pointsBalance,
      referral_code: customer.referralCode,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/customers/me/transactions - Get customer points transaction history
router.get('/me/transactions', authenticateCustomer, async (req, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const customerId = customerReq.customer.id;

    // Parse pagination params with defaults
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

    // Fetch transactions with pagination, ordered by most recent first
    const [transactions, total] = await Promise.all([
      prisma.pointsTransaction.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          createdAt: true,
        },
      }),
      prisma.pointsTransaction.count({
        where: { customerId },
      }),
    ]);

    res.status(200).json({
      transactions: transactions.map((tx) => ({
        id: tx.id,
        date: tx.createdAt.toISOString(),
        type: tx.type,
        points_amount: tx.amount,
        description: tx.description,
      })),
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + transactions.length < total,
      },
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/customers/me/referrals - Get customer referral stats
router.get('/me/referrals', authenticateCustomer, async (req, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const customerId = customerReq.customer.id;

    // Fetch referred customers and referral bonus transactions
    const [referredCustomers, referralTransactions] = await Promise.all([
      prisma.customer.findMany({
        where: { referredById: customerId },
        select: {
          id: true,
          firstName: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.pointsTransaction.findMany({
        where: {
          customerId,
          type: 'referral',
        },
        select: {
          amount: true,
        },
      }),
    ]);

    // Calculate total bonus points from referrals
    const totalBonusPoints = referralTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    res.status(200).json({
      referral_count: referredCustomers.length,
      total_bonus_points: totalBonusPoints,
      referred_customers: referredCustomers.map((c) => ({
        id: c.id,
        first_name: c.firstName,
        joined_at: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
