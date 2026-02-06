import { Router, Request, Response } from 'express';

const router = Router();

// Placeholder — Sprint 5
router.all('*', (req: Request, res: Response) => {
  res.status(501).json({ message: 'Report cards API not yet implemented', version: 'v2' });
});

export default router;
