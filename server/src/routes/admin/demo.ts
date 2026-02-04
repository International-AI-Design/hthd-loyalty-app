import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticateStaff } from '../../middleware/auth';
import { logger } from '../../middleware/security';

const router = Router();

// Apply staff authentication to all routes
router.use(authenticateStaff);

// POST /api/admin/demo/reset
// Full demo reset - clears all customer data for fresh demo
// Used for demo purposes
router.post('/reset', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Demo reset initiated');

    // Delete all redemptions first (foreign key constraint)
    const redemptionsDeleted = await prisma.redemption.deleteMany({});

    // Delete all points transactions
    const transactionsDeleted = await prisma.pointsTransaction.deleteMany({});

    // Delete all gingr visits
    const visitsDeleted = await prisma.gingrVisit.deleteMany({});

    // Delete all dogs
    const dogsDeleted = await prisma.dog.deleteMany({});

    // Delete all verification codes
    const codesDeleted = await prisma.verificationCode.deleteMany({});

    // Delete all web-registered customers (keep gingr imports but reset them)
    const webCustomersDeleted = await prisma.customer.deleteMany({
      where: {
        source: { not: 'gingr_import' },
      },
    });

    // Reset all Gingr-imported accounts to unclaimed
    const gingrReset = await prisma.customer.updateMany({
      where: {
        source: 'gingr_import',
      },
      data: {
        accountStatus: 'unclaimed',
        passwordHash: null,
        claimedAt: null,
        pointsBalance: 0,
      },
    });

    logger.info(`Demo reset complete: ${webCustomersDeleted.count} web customers deleted, ${gingrReset.count} gingr accounts reset`);

    res.status(200).json({
      success: true,
      message: 'Demo reset complete',
      accounts_reset: gingrReset.count,
      web_customers_deleted: webCustomersDeleted.count,
      verification_codes_cleared: codesDeleted.count,
      transactions_cleared: transactionsDeleted.count,
      redemptions_cleared: redemptionsDeleted.count,
    });
  } catch (error) {
    logger.error('Demo reset error:', error);
    res.status(500).json({ error: 'Failed to reset demo data' });
  }
});

// GET /api/admin/demo/status
// Check current demo status (how many claimed vs unclaimed)
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const [claimed, unclaimed, total] = await Promise.all([
      prisma.customer.count({
        where: { accountStatus: 'active', source: 'gingr_import' },
      }),
      prisma.customer.count({
        where: { accountStatus: 'unclaimed', source: 'gingr_import' },
      }),
      prisma.customer.count({
        where: { source: 'gingr_import' },
      }),
    ]);

    res.status(200).json({
      gingr_imported: {
        total,
        claimed,
        unclaimed,
      },
    });
  } catch (error) {
    logger.error('Demo status error:', error);
    res.status(500).json({ error: 'Failed to get demo status' });
  }
});

export default router;
