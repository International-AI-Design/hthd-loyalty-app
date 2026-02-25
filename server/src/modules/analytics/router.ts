import { Router } from 'express';
import { match } from 'ts-pattern';
import { authenticateStaff, requireRoles } from '../../middleware/auth';
import { InsightQuerySchema } from './types';
import * as analyticsService from './service';

const router = Router();

router.use(authenticateStaff);
router.use(requireRoles('owner', 'admin', 'manager'));

// GET /api/v2/admin/analytics/insights
router.get('/insights', async (req, res): Promise<void> => {
  const parsed = InsightQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const result = await analyticsService.getActiveInsights(parsed.data.type, parsed.data.limit);

  result.match(
    (insights) => {
      res.json({ insights });
    },
    (error) =>
      match(error)
        .with({ type: 'DB_ERROR' }, () => {
          res.status(500).json({ error: 'Internal error' });
        })
        .with({ type: 'VALIDATION_ERROR' }, (e) => {
          res.status(400).json({ error: e.message });
        })
        .exhaustive(),
  );
});

// POST /api/v2/admin/analytics/insights/generate
router.post('/insights/generate', async (_req, res): Promise<void> => {
  const result = await analyticsService.generateInsights();

  result.match(
    (generated) => {
      res.json({ generated });
    },
    (error) =>
      match(error)
        .with({ type: 'DB_ERROR' }, () => {
          res.status(500).json({ error: 'Internal error' });
        })
        .with({ type: 'VALIDATION_ERROR' }, (e) => {
          res.status(400).json({ error: e.message });
        })
        .exhaustive(),
  );
});

// GET /api/v2/admin/analytics/revenue
router.get('/revenue', async (_req, res): Promise<void> => {
  const result = await analyticsService.getRevenueSnapshot();

  result.match(
    (snapshot) => {
      res.json(snapshot);
    },
    (error) =>
      match(error)
        .with({ type: 'DB_ERROR' }, () => {
          res.status(500).json({ error: 'Internal error' });
        })
        .with({ type: 'VALIDATION_ERROR' }, (e) => {
          res.status(400).json({ error: e.message });
        })
        .exhaustive(),
  );
});

// GET /api/v2/admin/analytics/segments
router.get('/segments', async (_req, res): Promise<void> => {
  const result = await analyticsService.getCustomerSegments();

  result.match(
    (segments) => {
      res.json(segments);
    },
    (error) =>
      match(error)
        .with({ type: 'DB_ERROR' }, () => {
          res.status(500).json({ error: 'Internal error' });
        })
        .with({ type: 'VALIDATION_ERROR' }, (e) => {
          res.status(400).json({ error: e.message });
        })
        .exhaustive(),
  );
});

// GET /api/v2/admin/analytics/capacity
router.get('/capacity', async (_req, res): Promise<void> => {
  const result = await analyticsService.getCapacity();

  result.match(
    (capacity) => {
      res.json(capacity);
    },
    (error) =>
      match(error)
        .with({ type: 'DB_ERROR' }, () => {
          res.status(500).json({ error: 'Internal error' });
        })
        .with({ type: 'VALIDATION_ERROR' }, (e) => {
          res.status(400).json({ error: e.message });
        })
        .exhaustive(),
  );
});

export default router;
