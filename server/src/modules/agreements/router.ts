import { Router, Request, Response } from 'express';
import { authenticateCustomer, AuthenticatedCustomerRequest } from '../../middleware/auth';
import { AgreementService, AgreementError } from './service';
import { SignatureCreateSchema, BoardingDetailSchema } from './types';

const router = Router();
const agreementService = new AgreementService();

router.use(authenticateCustomer);

// GET / — list agreements required for a service type
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const serviceType = req.query.serviceType as string | undefined;
    if (serviceType) {
      const agreements = await agreementService.getRequiredAgreements(serviceType);
      res.json({ agreements });
    } else {
      const agreements = await agreementService.getAgreements();
      res.json({ agreements });
    }
  } catch (error) {
    console.error('List agreements error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /my-signatures — customer's signed agreements
router.get('/my-signatures', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const signatures = await agreementService.getCustomerSignatures(customerReq.customer.id);
    res.json({ signatures });
  } catch (error) {
    console.error('Get signatures error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /compliance — compliance check for a service type
router.get('/compliance', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const serviceType = req.query.serviceType as string;
    if (!serviceType) {
      res.status(400).json({ error: 'serviceType query parameter is required' });
      return;
    }
    const result = await agreementService.checkCompliance(customerReq.customer.id, serviceType);
    res.json(result);
  } catch (error) {
    console.error('Check compliance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /sign — sign an agreement
router.post('/sign', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const validation = SignatureCreateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const ipAddress = req.ip ?? req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const signature = await agreementService.signAgreement(
      validation.data,
      customerReq.customer.id,
      ipAddress,
      userAgent
    );
    res.status(201).json({ signature });
  } catch (error) {
    if (error instanceof AgreementError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Sign agreement error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Boarding Detail routes (customer-facing) ---

// GET /boarding-detail/:bookingId — get boarding detail for a booking
router.get('/boarding-detail/:bookingId', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const bookingId = req.params.bookingId as string;
    const detail = await agreementService.getBoardingDetail(bookingId, customerReq.customer.id);
    res.json({ boardingDetail: detail });
  } catch (error) {
    if (error instanceof AgreementError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Get boarding detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /boarding-detail/:bookingId — create or update boarding detail
router.put('/boarding-detail/:bookingId', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const bookingId = req.params.bookingId as string;
    const validation = BoardingDetailSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const detail = await agreementService.upsertBoardingDetail(
      bookingId,
      customerReq.customer.id,
      validation.data
    );
    res.json({ boardingDetail: detail });
  } catch (error) {
    if (error instanceof AgreementError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update boarding detail error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
