import { Router, Request, Response } from 'express';

const router = Router();

// Placeholder — Sprint 4
router.all('*', (req: Request, res: Response) => {
  res.status(501).json({ message: 'Intakes API not yet implemented', version: 'v2' });
});

export default router;
