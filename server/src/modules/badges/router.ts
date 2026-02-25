import { Router } from 'express';
import { match } from 'ts-pattern';
import { authenticateCustomer, AuthenticatedCustomerRequest } from '../../middleware/auth';
import * as badgeService from './service';

const router = Router();

router.use(authenticateCustomer);

// GET /api/v2/badges — get customer's badges
router.get('/', async (req, res): Promise<void> => {
  const { id: customerId } = (req as AuthenticatedCustomerRequest).customer;

  const result = await badgeService.getCustomerBadges(customerId);

  result.match(
    (badges) => {
      res.json({ badges });
    },
    (error) =>
      match(error)
        .with({ type: 'NOT_FOUND' }, (e) => {
          res.status(404).json({ error: `${e.entity} not found` });
        })
        .with({ type: 'DB_ERROR' }, () => {
          res.status(500).json({ error: 'Internal error' });
        })
        .exhaustive(),
  );
});

// GET /api/v2/badges/next — get next badge progress
router.get('/next', async (req, res): Promise<void> => {
  const { id: customerId } = (req as AuthenticatedCustomerRequest).customer;

  const result = await badgeService.getNextBadge(customerId);

  result.match(
    (next) => {
      if (next) {
        res.json(next);
      } else {
        res.json({ badge: null, message: 'All badges earned!' });
      }
    },
    (error) =>
      match(error)
        .with({ type: 'NOT_FOUND' }, (e) => {
          res.status(404).json({ error: `${e.entity} not found` });
        })
        .with({ type: 'DB_ERROR' }, () => {
          res.status(500).json({ error: 'Internal error' });
        })
        .exhaustive(),
  );
});

// POST /api/v2/badges/evaluate — trigger badge evaluation
router.post('/evaluate', async (req, res): Promise<void> => {
  const { id: customerId } = (req as AuthenticatedCustomerRequest).customer;

  const result = await badgeService.evaluateBadges(customerId);

  result.match(
    (evaluation) => {
      res.json(evaluation);
    },
    (error) =>
      match(error)
        .with({ type: 'NOT_FOUND' }, (e) => {
          res.status(404).json({ error: `${e.entity} not found` });
        })
        .with({ type: 'DB_ERROR' }, () => {
          res.status(500).json({ error: 'Internal error' });
        })
        .exhaustive(),
  );
});

// PUT /api/v2/badges/:id/notified — mark badge notification as seen
router.put('/:id/notified', async (req, res): Promise<void> => {
  const badgeId = req.params.id as string;

  const result = await badgeService.markNotified(badgeId);

  result.match(
    () => {
      res.json({ success: true });
    },
    (error) =>
      match(error)
        .with({ type: 'NOT_FOUND' }, (e) => {
          res.status(404).json({ error: `${e.entity} not found` });
        })
        .with({ type: 'DB_ERROR' }, () => {
          res.status(500).json({ error: 'Internal error' });
        })
        .exhaustive(),
  );
});

export default router;
