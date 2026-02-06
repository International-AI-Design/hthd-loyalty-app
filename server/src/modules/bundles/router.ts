import { Router, Request, Response } from 'express';
import { authenticateCustomer, authenticateStaff } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { BundleService, BundleError } from './service';

const router = Router();
const bundleService = new BundleService();

// GET / — list active bundles (customer-facing)
router.get('/', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const bundles = await bundleService.getActiveBundles();
    res.json({ bundles });
  } catch (error) {
    console.error('List bundles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /suggestions — suggest bundles for a service type
router.get('/suggestions', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const serviceTypeId = req.query.serviceTypeId as string;
    if (!serviceTypeId) {
      res.status(400).json({ error: 'serviceTypeId query parameter is required' });
      return;
    }
    const bundles = await bundleService.getBundleSuggestions(serviceTypeId);
    res.json({ bundles });
  } catch (error) {
    console.error('Bundle suggestions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /calculate — calculate bundle price
router.get('/calculate', authenticateCustomer, async (req: Request, res: Response): Promise<void> => {
  try {
    const bundleId = req.query.bundleId as string;
    const dogIdsParam = req.query.dogIds as string;

    if (!bundleId || !dogIdsParam) {
      res.status(400).json({ error: 'bundleId and dogIds query parameters are required' });
      return;
    }

    const dogIds = dogIdsParam.split(',');
    const result = await bundleService.calculateBundlePrice(bundleId, dogIds);
    res.json(result);
  } catch (error) {
    if (error instanceof BundleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Calculate bundle price error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / — create bundle (owner only)
router.post('/', authenticateStaff, requireRole('owner', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, discountType, discountValue, serviceTypeIds, sortOrder } = req.body;
    if (!name || !discountType || discountValue === undefined || !serviceTypeIds) {
      res.status(400).json({ error: 'name, discountType, discountValue, and serviceTypeIds are required' });
      return;
    }
    const bundle = await bundleService.createBundle({
      name, description, discountType, discountValue, serviceTypeIds, sortOrder,
    });
    res.status(201).json({ bundle });
  } catch (error) {
    if (error instanceof BundleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Create bundle error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id — update bundle (owner only)
router.put('/:id', authenticateStaff, requireRole('owner', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bundle = await bundleService.updateBundle(id, req.body);
    res.json({ bundle });
  } catch (error) {
    if (error instanceof BundleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update bundle error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id — deactivate bundle (owner only, soft delete)
router.delete('/:id', authenticateStaff, requireRole('owner', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bundle = await bundleService.toggleBundle(id);
    res.json({ bundle });
  } catch (error) {
    if (error instanceof BundleError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Toggle bundle error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
