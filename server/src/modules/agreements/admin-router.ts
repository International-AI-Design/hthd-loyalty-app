import { Router, Request, Response } from 'express';
import { authenticateStaff } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { AgreementService, AgreementError } from './service';
import { AgreementCreateSchema, AgreementUpdateSchema } from './types';

const router = Router();
const agreementService = new AgreementService();

router.use(authenticateStaff, requireRole('owner', 'admin', 'manager'));

// GET / — list all agreements (including inactive)
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const agreements = await agreementService.getAllAgreements();
    res.json({ agreements });
  } catch (error) {
    console.error('Admin list agreements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / — create agreement
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = AgreementCreateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const agreement = await agreementService.createAgreement(validation.data);
    res.status(201).json({ agreement });
  } catch (error) {
    if (error instanceof AgreementError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Create agreement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id — update agreement
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const validation = AgreementUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const agreement = await agreementService.updateAgreement(id, validation.data);
    res.json({ agreement });
  } catch (error) {
    if (error instanceof AgreementError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update agreement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id — deactivate agreement
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await agreementService.deactivateAgreement(id);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof AgreementError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Deactivate agreement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /signatures — view all signatures with filters
router.get('/signatures', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.query.customerId as string | undefined;
    const agreementId = req.query.agreementId as string | undefined;
    const signatures = await agreementService.getSignaturesFiltered({ customerId, agreementId });
    res.json({ signatures });
  } catch (error) {
    console.error('Admin list signatures error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
