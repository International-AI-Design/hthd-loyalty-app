import { Router, Request, Response } from 'express';

const router = Router();

// Stripe webhook — Placeholder for Sprint 2
router.post('/stripe', (req: Request, res: Response) => {
  res.status(501).json({ message: 'Stripe webhook not yet implemented', version: 'v2' });
});

// Twilio webhook — Placeholder for Sprint 3
router.post('/twilio', (req: Request, res: Response) => {
  res.status(501).json({ message: 'Twilio webhook not yet implemented', version: 'v2' });
});

export default router;
