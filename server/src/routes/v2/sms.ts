import { Router, Request, Response } from 'express';

const router = Router();

// SMS inbound webhook — Placeholder for Sprint 3
router.post('/webhook', (req: Request, res: Response) => {
  res.status(501).json({ message: 'SMS webhook not yet implemented', version: 'v2' });
});

export default router;
