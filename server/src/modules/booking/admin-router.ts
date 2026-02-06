import { Router, Request, Response } from 'express';
import { authenticateStaff, AuthenticatedStaffRequest } from '../../middleware/auth';
import { BookingService, BookingError } from './service';
import { checkOutSchema } from './types';

const router = Router();
const bookingService = new BookingService();

// All admin booking routes require staff authentication
router.use(authenticateStaff);

// GET /schedule — get all bookings for a date
router.get('/schedule', async (req: Request, res: Response): Promise<void> => {
  try {
    const dateParam = req.query.date as string;
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      res.status(400).json({ error: 'Date is required in YYYY-MM-DD format' });
      return;
    }

    const serviceTypeId = req.query.serviceTypeId as string | undefined;
    const schedule = await bookingService.getSchedule(
      new Date(dateParam + 'T00:00:00Z'),
      serviceTypeId
    );

    res.json({ schedule });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/confirm — confirm a pending booking
router.post('/:id/confirm', async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingId = req.params.id as string;
    const booking = await bookingService.confirmBooking(bookingId);
    res.json({ booking });
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Confirm booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/check-in — check in a dog
router.post('/:id/check-in', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const bookingId = req.params.id as string;
    const booking = await bookingService.checkIn(bookingId, staffReq.staff.id);
    res.json({ booking });
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/check-out — check out a dog
router.post('/:id/check-out', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const validation = checkOutSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const bookingId = req.params.id as string;
    const booking = await bookingService.checkOut(
      bookingId,
      staffReq.staff.id,
      validation.data.notes
    );
    res.json({ booking });
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Check-out error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/no-show — mark as no-show
router.post('/:id/no-show', async (req: Request, res: Response): Promise<void> => {
  try {
    const bookingId = req.params.id as string;
    const booking = await bookingService.markNoShow(bookingId);
    res.json({ booking });
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('No-show error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
