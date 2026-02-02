import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';
import { authenticateStaff } from '../../middleware/auth';
import { logger } from '../../middleware/security';

const router = Router();

// Apply staff authentication to all routes
router.use(authenticateStaff);

// POST /api/admin/demo/reset
// Reset all claimed Gingr-imported accounts back to unclaimed state
// Used for demo purposes
router.post('/reset', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Demo reset initiated');

    // Count how many accounts will be reset
    const claimedCount = await prisma.customer.count({
      where: {
        accountStatus: 'active',
        source: 'gingr_import',
      },
    });

    // Reset all claimed Gingr-imported accounts
    const resetResult = await prisma.customer.updateMany({
      where: {
        accountStatus: 'active',
        source: 'gingr_import',
      },
      data: {
        accountStatus: 'unclaimed',
        passwordHash: null,
        claimedAt: null,
      },
    });

    // Clear all verification codes
    const codesDeleted = await prisma.verificationCode.deleteMany({});

    logger.info(`Demo reset complete: ${resetResult.count} accounts reset, ${codesDeleted.count} codes cleared`);

    res.status(200).json({
      success: true,
      message: 'Demo reset complete',
      accounts_reset: resetResult.count,
      verification_codes_cleared: codesDeleted.count,
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
