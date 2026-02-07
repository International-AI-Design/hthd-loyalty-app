import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { authenticateStaff } from '../../middleware/auth';

const router = Router();

// Apply staff authentication to all routes
router.use(authenticateStaff);

// GET /api/admin/customers
// List all customers with pagination, sorting, and filtering
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Pagination params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    // Sort params
    const sortBy = (req.query.sort_by as string) || 'created_at';
    const sortOrder = ((req.query.sort_order as string) || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    // Filter/search param
    const search = (req.query.search as string)?.trim() || '';

    // Build where clause
    const where: Prisma.CustomerWhereInput = search
      ? {
          OR: [
            { phone: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    // Build orderBy based on sortBy parameter
    type CustomerOrderByKey = 'firstName' | 'lastName' | 'phone' | 'email' | 'pointsBalance' | 'createdAt';
    const sortFieldMap: Record<string, CustomerOrderByKey> = {
      name: 'lastName', // Sort by lastName as proxy for name
      first_name: 'firstName',
      last_name: 'lastName',
      phone: 'phone',
      email: 'email',
      points_balance: 'pointsBalance',
      created_at: 'createdAt',
      join_date: 'createdAt',
    };

    const orderByField: CustomerOrderByKey = sortFieldMap[sortBy] || 'createdAt';
    const orderBy: Prisma.CustomerOrderByWithRelationInput = { [orderByField]: sortOrder };

    // Query customers and count in parallel
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          pointsBalance: true,
          createdAt: true,
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.customer.count({ where }),
    ]);

    // Transform to snake_case for API response
    const results = customers.map((customer) => ({
      id: customer.id,
      first_name: customer.firstName,
      last_name: customer.lastName,
      name: `${customer.firstName} ${customer.lastName}`,
      phone: customer.phone,
      email: customer.email,
      points_balance: customer.pointsBalance,
      join_date: customer.createdAt.toISOString(),
    }));

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      customers: results,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_more: page < totalPages,
      },
    });
  } catch (error) {
    console.error('Customer list error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/customers/search?q={query}
// Search customers by phone, email, or name (partial match)
// NOTE: This route must come BEFORE /:id to avoid being matched as an ID
router.get('/search', async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string | undefined;

    if (!query || query.trim().length === 0) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const searchTerm = query.trim();

    // Search by phone, email, or name (case-insensitive partial match)
    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { phone: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { firstName: { contains: searchTerm, mode: 'insensitive' } },
          { lastName: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        pointsBalance: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 50, // Limit results
    });

    // Transform to snake_case for API response
    const results = customers.map((customer) => ({
      id: customer.id,
      first_name: customer.firstName,
      last_name: customer.lastName,
      name: `${customer.firstName} ${customer.lastName}`,
      phone: customer.phone,
      email: customer.email,
      points_balance: customer.pointsBalance,
    }));

    res.status(200).json({
      customers: results,
      count: results.length,
    });
  } catch (error) {
    console.error('Customer search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/customers/:id
// Get a single customer by ID with referral information, pets, and bookings
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        pointsBalance: true,
        referralCode: true,
        accountStatus: true,
        source: true,
        createdAt: true,
        referredBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        referrals: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        dogs: {
          select: {
            id: true,
            name: true,
            breed: true,
            sizeCategory: true,
            weight: true,
            birthDate: true,
            notes: true,
            temperament: true,
            careInstructions: true,
            isNeutered: true,
            photoUrl: true,
          },
          orderBy: { name: 'asc' },
        },
        bookings: {
          select: {
            id: true,
            date: true,
            startDate: true,
            endDate: true,
            startTime: true,
            endTime: true,
            status: true,
            totalCents: true,
            notes: true,
            createdAt: true,
            serviceType: {
              select: {
                name: true,
                displayName: true,
              },
            },
            dogs: {
              select: {
                dog: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // Separate upcoming vs past bookings
    const upcomingBookings = customer.bookings
      .filter((b) => {
        const bookingDate = new Date(b.date);
        return bookingDate >= today && b.status !== 'cancelled' && b.status !== 'checked_out';
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const recentBookings = customer.bookings
      .filter((b) => {
        const bookingDate = new Date(b.date);
        return bookingDate < today || b.status === 'checked_out' || b.status === 'cancelled';
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const formatBooking = (b: typeof customer.bookings[number]) => ({
      id: b.id,
      date: b.date.toISOString().split('T')[0],
      start_date: b.startDate ? b.startDate.toISOString().split('T')[0] : null,
      end_date: b.endDate ? b.endDate.toISOString().split('T')[0] : null,
      start_time: b.startTime,
      end_time: b.endTime,
      status: b.status,
      total_cents: b.totalCents,
      notes: b.notes,
      service_name: b.serviceType.name,
      service_display_name: b.serviceType.displayName,
      dogs: b.dogs.map((bd) => ({
        id: bd.dog.id,
        name: bd.dog.name,
      })),
      created_at: b.createdAt.toISOString(),
    });

    res.status(200).json({
      id: customer.id,
      first_name: customer.firstName,
      last_name: customer.lastName,
      name: `${customer.firstName} ${customer.lastName}`,
      phone: customer.phone,
      email: customer.email,
      points_balance: customer.pointsBalance,
      referral_code: customer.referralCode,
      account_status: customer.accountStatus,
      source: customer.source,
      join_date: customer.createdAt.toISOString(),
      referred_by: customer.referredBy
        ? {
            id: customer.referredBy.id,
            name: `${customer.referredBy.firstName} ${customer.referredBy.lastName}`,
          }
        : null,
      referrals: customer.referrals.map((r) => ({
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        join_date: r.createdAt.toISOString(),
      })),
      dogs: customer.dogs.map((d) => ({
        id: d.id,
        name: d.name,
        breed: d.breed,
        size_category: d.sizeCategory,
        weight: d.weight ? Number(d.weight) : null,
        birth_date: d.birthDate ? d.birthDate.toISOString().split('T')[0] : null,
        notes: d.notes,
        temperament: d.temperament,
        care_instructions: d.careInstructions,
        is_neutered: d.isNeutered,
        photo_url: d.photoUrl,
      })),
      upcoming_bookings: upcomingBookings.map(formatBooking),
      recent_bookings: recentBookings.map(formatBooking),
    });
  } catch (error) {
    console.error('Customer detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/customers/:id/transactions
// Get a customer's transaction history
router.get('/:id/transactions', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Pagination params
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // Query transactions and count in parallel
    const [transactions, total] = await Promise.all([
      prisma.pointsTransaction.findMany({
        where: { customerId: id },
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          dollarAmount: true,
          serviceType: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.pointsTransaction.count({ where: { customerId: id } }),
    ]);

    // Transform to snake_case for API response
    const results = transactions.map((txn) => ({
      id: txn.id,
      type: txn.type,
      points_amount: txn.amount,
      description: txn.description,
      dollar_amount: txn.dollarAmount ? Number(txn.dollarAmount) : null,
      service_type: txn.serviceType,
      date: txn.createdAt.toISOString(),
    }));

    res.status(200).json({
      transactions: results,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Customer transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/customers/:id/redemptions
// Get a customer's redemption history
router.get('/:id/redemptions', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // Reward tier configuration
    const REWARD_TIERS: Record<number, number> = {
      100: 10,
      250: 25,
      500: 50,
    };

    // Query all redemptions for this customer
    const redemptions = await prisma.redemption.findMany({
      where: { customerId: id },
      select: {
        id: true,
        redemptionCode: true,
        rewardTier: true,
        status: true,
        createdAt: true,
        approvedAt: true,
        approvedBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to snake_case for API response
    const results = redemptions.map((r) => ({
      id: r.id,
      redemption_code: r.redemptionCode,
      reward_tier: r.rewardTier,
      discount_value: REWARD_TIERS[r.rewardTier] || 0,
      status: r.status,
      created_at: r.createdAt.toISOString(),
      approved_at: r.approvedAt ? r.approvedAt.toISOString() : null,
    }));

    // Separate pending and completed redemptions
    const pending = results.filter((r) => r.status === 'pending');
    const completed = results.filter((r) => r.status === 'completed');

    res.status(200).json({
      pending,
      completed,
    });
  } catch (error) {
    console.error('Customer redemptions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
