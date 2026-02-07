import { Router, Request, Response } from 'express';
import { authenticateStaff, AuthenticatedStaffRequest } from '../../middleware/auth';
import { DogProfileService, DogProfileError } from './service';
import { BehaviorNoteCreateSchema } from './types';

const router = Router();
const dogProfileService = new DogProfileService();

// All admin dog profile routes require staff authentication
router.use(authenticateStaff);

// GET /compliance/report — compliance report for all dogs
// NOTE: This route must be defined before /:dogId to avoid matching "compliance" as a dogId
router.get('/compliance/report', async (req: Request, res: Response): Promise<void> => {
  try {
    const report = await dogProfileService.getComplianceReport();
    res.json(report);
  } catch (error) {
    console.error('Get compliance report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:dogId — get any dog's full profile (no ownership check)
router.get('/:dogId', async (req: Request, res: Response): Promise<void> => {
  try {
    const dogId = req.params.dogId as string;
    const dog = await dogProfileService.getDogProfileAdmin(dogId);
    res.json({ dog });
  } catch (error) {
    if (error instanceof DogProfileError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Admin get dog profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:dogId/behavior-notes — add behavior note (staff only)
router.post('/:dogId/behavior-notes', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const dogId = req.params.dogId as string;
    const validation = BehaviorNoteCreateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const note = await dogProfileService.addBehaviorNote(
      dogId,
      staffReq.staff.id,
      validation.data
    );
    res.status(201).json({ note });
  } catch (error) {
    if (error instanceof DogProfileError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Add behavior note error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:dogId/vaccinations/:vaccinationId/verify — verify a vaccination record
router.put('/:dogId/vaccinations/:vaccinationId/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const vaccinationId = req.params.vaccinationId as string;
    const vaccination = await dogProfileService.verifyVaccination(
      vaccinationId,
      staffReq.staff.id
    );
    res.json({ vaccination });
  } catch (error) {
    if (error instanceof DogProfileError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Verify vaccination error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
