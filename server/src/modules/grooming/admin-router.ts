import { Router, Request, Response } from 'express';
import { match } from 'ts-pattern';
import { authenticateStaff } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import * as pricingService from './pricing-service';
import {
  GroomingServicePriceCreateSchema,
  GroomingServicePriceUpdateSchema,
  GroomingAddOnCreateSchema,
  GroomingAddOnUpdateSchema,
} from './types';

const router = Router();
router.use(authenticateStaff, requireRole('owner', 'admin', 'manager'));

// --- Service Prices ---

router.get('/prices', async (_req: Request, res: Response): Promise<void> => {
  const result = await pricingService.getServicePrices();
  result.match(
    (prices) => { res.json({ prices }); },
    (error) => match(error)
      .with({ type: 'DB_ERROR' }, () => { res.status(500).json({ error: 'Internal error' }); })
      .with({ type: 'NOT_FOUND' }, (e) => { res.status(404).json(e); })
      .with({ type: 'DUPLICATE_PRICE' }, (e) => { res.status(409).json(e); })
      .with({ type: 'VALIDATION_ERROR' }, (e) => { res.status(400).json(e); })
      .exhaustive(),
  );
});

router.post('/prices', async (req: Request, res: Response): Promise<void> => {
  const parsed = GroomingServicePriceCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const result = await pricingService.createServicePrice(parsed.data);
  result.match(
    (price) => { res.status(201).json({ price }); },
    (error) => match(error)
      .with({ type: 'DUPLICATE_PRICE' }, (e) => { res.status(409).json(e); })
      .with({ type: 'DB_ERROR' }, () => { res.status(500).json({ error: 'Internal error' }); })
      .with({ type: 'NOT_FOUND' }, (e) => { res.status(404).json(e); })
      .with({ type: 'VALIDATION_ERROR' }, (e) => { res.status(400).json(e); })
      .exhaustive(),
  );
});

router.put('/prices/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = GroomingServicePriceUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const result = await pricingService.updateServicePrice(req.params.id as string, parsed.data);
  result.match(
    (price) => { res.json({ price }); },
    (error) => match(error)
      .with({ type: 'NOT_FOUND' }, (e) => { res.status(404).json(e); })
      .with({ type: 'DB_ERROR' }, () => { res.status(500).json({ error: 'Internal error' }); })
      .with({ type: 'DUPLICATE_PRICE' }, (e) => { res.status(409).json(e); })
      .with({ type: 'VALIDATION_ERROR' }, (e) => { res.status(400).json(e); })
      .exhaustive(),
  );
});

// --- Add-Ons ---

router.get('/add-ons', async (_req: Request, res: Response): Promise<void> => {
  const result = await pricingService.getAddOns(true);
  result.match(
    (addOns) => { res.json({ addOns }); },
    (error) => match(error)
      .with({ type: 'DB_ERROR' }, () => { res.status(500).json({ error: 'Internal error' }); })
      .with({ type: 'NOT_FOUND' }, (e) => { res.status(404).json(e); })
      .with({ type: 'DUPLICATE_NAME' }, (e) => { res.status(409).json(e); })
      .exhaustive(),
  );
});

router.post('/add-ons', async (req: Request, res: Response): Promise<void> => {
  const parsed = GroomingAddOnCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const result = await pricingService.createAddOn(parsed.data);
  result.match(
    (addOn) => { res.status(201).json({ addOn }); },
    (error) => match(error)
      .with({ type: 'DUPLICATE_NAME' }, (e) => { res.status(409).json(e); })
      .with({ type: 'DB_ERROR' }, () => { res.status(500).json({ error: 'Internal error' }); })
      .with({ type: 'NOT_FOUND' }, (e) => { res.status(404).json(e); })
      .exhaustive(),
  );
});

router.put('/add-ons/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = GroomingAddOnUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const result = await pricingService.updateAddOn(req.params.id as string, parsed.data);
  result.match(
    (addOn) => { res.json({ addOn }); },
    (error) => match(error)
      .with({ type: 'NOT_FOUND' }, (e) => { res.status(404).json(e); })
      .with({ type: 'DB_ERROR' }, () => { res.status(500).json({ error: 'Internal error' }); })
      .with({ type: 'DUPLICATE_NAME' }, (e) => { res.status(409).json(e); })
      .exhaustive(),
  );
});

router.delete('/add-ons/:id', async (req: Request, res: Response): Promise<void> => {
  const result = await pricingService.deleteAddOn(req.params.id as string);
  result.match(
    () => { res.status(204).send(); },
    (error) => match(error)
      .with({ type: 'NOT_FOUND' }, (e) => { res.status(404).json(e); })
      .with({ type: 'DB_ERROR' }, () => { res.status(500).json({ error: 'Internal error' }); })
      .with({ type: 'DUPLICATE_NAME' }, (e) => { res.status(409).json(e); })
      .exhaustive(),
  );
});

export default router;
