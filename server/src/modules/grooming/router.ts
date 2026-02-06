import { Router, Request, Response } from 'express';
import { authenticateCustomer, AuthenticatedCustomerRequest, authenticateStaff, AuthenticatedStaffRequest } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { GroomingService, GroomingError } from './service';

const router = Router();
const groomingService = new GroomingService();

// GET /pricing/:sizeCategory — customer-facing price range
router.get('/pricing/:sizeCategory', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const { sizeCategory } = req.params;
    const validSizes = ['small', 'medium', 'large', 'xl'];
    if (!validSizes.includes(sizeCategory)) {
      res.status(400).json({ error: 'Invalid size category. Must be: small, medium, large, xl' });
      return;
    }
    const range = await groomingService.getPriceRange(sizeCategory);
    res.json(range);
  } catch (error) {
    if (error instanceof GroomingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Get grooming price range error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /rate/:bookingDogId — groomer rates coat condition (staff+)
router.post('/rate/:bookingDogId', authenticateStaff, async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const { bookingDogId } = req.params;
    const { conditionRating } = req.body;

    if (!conditionRating || typeof conditionRating !== 'number') {
      res.status(400).json({ error: 'conditionRating is required and must be a number (1-5)' });
      return;
    }

    const result = await groomingService.rateCondition(bookingDogId, conditionRating, staffReq.staff.id);
    res.json(result);
  } catch (error) {
    if (error instanceof GroomingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Rate grooming condition error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /matrix — full price matrix (manager+)
router.get('/matrix', authenticateStaff, requireRole('owner', 'admin', 'manager'), async (req: Request, res: Response): Promise<void> => {
  try {
    const matrix = await groomingService.getPriceMatrix();
    res.json({ matrix });
  } catch (error) {
    console.error('Get grooming matrix error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /matrix/:id — update a price tier (owner only)
router.put('/matrix/:id', authenticateStaff, requireRole('owner', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { priceCents, estimatedMinutes } = req.body;

    if (priceCents !== undefined && (typeof priceCents !== 'number' || priceCents < 0)) {
      res.status(400).json({ error: 'priceCents must be a non-negative number' });
      return;
    }
    if (estimatedMinutes !== undefined && (typeof estimatedMinutes !== 'number' || estimatedMinutes < 0)) {
      res.status(400).json({ error: 'estimatedMinutes must be a non-negative number' });
      return;
    }

    const tier = await groomingService.updatePriceTier(id, { priceCents, estimatedMinutes });
    res.json({ tier });
  } catch (error) {
    if (error instanceof GroomingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update grooming price error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
