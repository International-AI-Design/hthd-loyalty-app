import { Router, Request, Response } from 'express';
import { authenticateCustomer, AuthenticatedCustomerRequest } from '../../middleware/auth';
import { DogProfileService, DogProfileError } from './service';
import {
  DogProfileUpdateSchema,
  VaccinationCreateSchema,
  VaccinationUpdateSchema,
  MedicationCreateSchema,
  MedicationUpdateSchema,
} from './types';

const router = Router();
const dogProfileService = new DogProfileService();

// All customer dog profile routes require authentication
router.use(authenticateCustomer);

// GET / — list all dogs for the authenticated customer
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const dogs = await dogProfileService.getDogsByCustomer(customerReq.customer.id);
    res.json({ dogs });
  } catch (error) {
    console.error('List dogs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:dogId — get full dog profile
router.get('/:dogId', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const dogId = req.params.dogId as string;
    const dog = await dogProfileService.getDogProfile(dogId, customerReq.customer.id);
    res.json({ dog });
  } catch (error) {
    if (error instanceof DogProfileError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Get dog profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:dogId — update dog profile
router.put('/:dogId', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const dogId = req.params.dogId as string;
    const validation = DogProfileUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const dog = await dogProfileService.updateDogProfile(
      dogId,
      customerReq.customer.id,
      validation.data
    );
    res.json({ dog });
  } catch (error) {
    if (error instanceof DogProfileError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update dog profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:dogId/vaccinations — add vaccination record
router.post('/:dogId/vaccinations', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const dogId = req.params.dogId as string;
    const validation = VaccinationCreateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const vaccination = await dogProfileService.addVaccination(
      dogId,
      customerReq.customer.id,
      validation.data
    );
    res.status(201).json({ vaccination });
  } catch (error) {
    if (error instanceof DogProfileError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Add vaccination error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:dogId/vaccinations/:vaccinationId — update vaccination record
router.put('/:dogId/vaccinations/:vaccinationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const dogId = req.params.dogId as string;
    const vaccinationId = req.params.vaccinationId as string;
    const validation = VaccinationUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const vaccination = await dogProfileService.updateVaccination(
      vaccinationId,
      dogId,
      customerReq.customer.id,
      validation.data
    );
    res.json({ vaccination });
  } catch (error) {
    if (error instanceof DogProfileError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update vaccination error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:dogId/vaccinations/:vaccinationId — delete vaccination record
router.delete('/:dogId/vaccinations/:vaccinationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const dogId = req.params.dogId as string;
    const vaccinationId = req.params.vaccinationId as string;
    const result = await dogProfileService.deleteVaccination(
      vaccinationId,
      dogId,
      customerReq.customer.id
    );
    res.json(result);
  } catch (error) {
    if (error instanceof DogProfileError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Delete vaccination error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:dogId/medications — add medication
router.post('/:dogId/medications', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const dogId = req.params.dogId as string;
    const validation = MedicationCreateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const medication = await dogProfileService.addMedication(
      dogId,
      customerReq.customer.id,
      validation.data
    );
    res.status(201).json({ medication });
  } catch (error) {
    if (error instanceof DogProfileError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Add medication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:dogId/medications/:medicationId — update medication
router.put('/:dogId/medications/:medicationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const dogId = req.params.dogId as string;
    const medicationId = req.params.medicationId as string;
    const validation = MedicationUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const medication = await dogProfileService.updateMedication(
      medicationId,
      dogId,
      customerReq.customer.id,
      validation.data
    );
    res.json({ medication });
  } catch (error) {
    if (error instanceof DogProfileError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update medication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:dogId/medications/:medicationId — delete medication
router.delete('/:dogId/medications/:medicationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const dogId = req.params.dogId as string;
    const medicationId = req.params.medicationId as string;
    const result = await dogProfileService.deleteMedication(
      medicationId,
      dogId,
      customerReq.customer.id
    );
    res.json(result);
  } catch (error) {
    if (error instanceof DogProfileError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Delete medication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:dogId/compliance — vaccination compliance check
router.get('/:dogId/compliance', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const dogId = req.params.dogId as string;
    // Verify ownership before checking compliance
    await dogProfileService.getDogProfile(dogId, customerReq.customer.id);
    const compliance = await dogProfileService.getVaccinationCompliance(dogId);
    res.json(compliance);
  } catch (error) {
    if (error instanceof DogProfileError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Get compliance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
