import { Router, Request, Response } from 'express';
import { authenticateCustomer, AuthenticatedCustomerRequest } from '../../middleware/auth';
import { ReportCardService, ReportCardError } from './service';
import { ReportCardListParamsSchema } from './types';

const router = Router();
const reportCardService = new ReportCardService();

// All customer report card routes require authentication
router.use(authenticateCustomer);

// GET / — list all report cards for the customer's dogs
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const validation = ReportCardListParamsSchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const result = await reportCardService.getReportCards(customerReq.customer.id, validation.data);
    res.json(result);
  } catch (error) {
    if (error instanceof ReportCardError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('List report cards error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id — get a single report card
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const reportCard = await reportCardService.getReportCard(
      req.params.id as string,
      customerReq.customer.id
    );
    res.json({ reportCard });
  } catch (error) {
    if (error instanceof ReportCardError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Get report card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /dog/:dogId — report cards for a specific dog
router.get('/dog/:dogId', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const validation = ReportCardListParamsSchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const result = await reportCardService.getReportCardsByDog(
      req.params.dogId as string,
      customerReq.customer.id,
      validation.data
    );
    res.json(result);
  } catch (error) {
    if (error instanceof ReportCardError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Get report cards by dog error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
