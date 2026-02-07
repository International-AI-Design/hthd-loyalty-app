import { Router, Request, Response } from 'express';
import { authenticateStaff, AuthenticatedStaffRequest } from '../../middleware/auth';
import { ReportCardService, ReportCardError } from './service';
import { ReportCardCreateSchema, ReportCardUpdateSchema } from './types';

const router = Router();
const reportCardService = new ReportCardService();

// All admin report card routes require staff authentication
router.use(authenticateStaff);

// POST / — create a report card
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const validation = ReportCardCreateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const reportCard = await reportCardService.createReportCard(
      staffReq.staff.id,
      validation.data
    );
    res.status(201).json({ reportCard });
  } catch (error) {
    if (error instanceof ReportCardError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Create report card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id — update a report card
router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const validation = ReportCardUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const reportCard = await reportCardService.updateReportCard(
      req.params.id as string,
      staffReq.staff.id,
      validation.data
    );
    res.json({ reportCard });
  } catch (error) {
    if (error instanceof ReportCardError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Update report card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id — delete a report card
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    await reportCardService.deleteReportCard(req.params.id as string);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof ReportCardError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Delete report card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/send — send a report card to the customer
router.post('/:id/send', async (req: Request, res: Response): Promise<void> => {
  try {
    const { channel } = req.body;
    if (!channel) {
      res.status(400).json({ error: 'channel is required (sms, email, or app)' });
      return;
    }

    const reportCard = await reportCardService.sendReportCard(
      req.params.id as string,
      channel
    );
    res.json({ reportCard });
  } catch (error) {
    if (error instanceof ReportCardError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Send report card error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /unsent — get unsent report cards
router.get('/unsent', async (req: Request, res: Response): Promise<void> => {
  try {
    const date = req.query.date as string | undefined;
    const reportCards = await reportCardService.getUnsentReportCards(date);
    res.json({ reportCards, total: reportCards.length });
  } catch (error) {
    console.error('Get unsent report cards error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /booking/:bookingId — report cards for a specific booking
router.get('/booking/:bookingId', async (req: Request, res: Response): Promise<void> => {
  try {
    const reportCards = await reportCardService.getReportCardsByBooking(
      req.params.bookingId as string
    );
    res.json({ reportCards, total: reportCards.length });
  } catch (error) {
    console.error('Get report cards by booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
