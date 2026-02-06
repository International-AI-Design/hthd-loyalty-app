import { Router, Request, Response } from 'express';

const router = Router();

// Placeholder — Sprint 2
router.all('/{*path}', (req: Request, res: Response) => {
  res.status(501).json({ message: 'Memberships API not yet implemented', version: 'v2' });
});

export default router;
