import { Router, Request, Response } from 'express';
import { authenticateCustomer, AuthenticatedCustomerRequest } from '../../middleware/auth';
import { BookingService, BookingError } from './service';
import {
  createBookingSchema,
  availabilityQuerySchema,
  cancelBookingSchema,
  BookingStatus,
  BOOKING_STATUSES,
} from './types';

const router = Router();
const bookingService = new BookingService();

// All customer booking routes require authentication
router.use(authenticateCustomer);

// GET /availability — check availability for a service type over a date range
router.get('/availability', async (req: Request, res: Response): Promise<void> => {
  try {
    const validation = availabilityQuerySchema.safeParse(req.query);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const { serviceTypeId, startDate, endDate } = validation.data;
    const results = await bookingService.checkAvailability(
      serviceTypeId,
      new Date(startDate + 'T00:00:00Z'),
      new Date(endDate + 'T00:00:00Z')
    );

    res.json({ availability: results });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / — create a booking
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const validation = createBookingSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const booking = await bookingService.createBooking({
      customerId: customerReq.customer.id,
      ...validation.data,
    });

    res.status(201).json({ booking });
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET / — list my bookings
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    // Validate status if provided
    if (status && !BOOKING_STATUSES.includes(status as BookingStatus)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${BOOKING_STATUSES.join(', ')}` });
      return;
    }

    const result = await bookingService.getCustomerBookings(customerReq.customer.id, {
      status: status as BookingStatus | undefined,
      limit,
      offset,
    });

    res.json(result);
  } catch (error) {
    console.error('List bookings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id — get booking detail (verify ownership)
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const { bookings } = await bookingService.getCustomerBookings(customerReq.customer.id);

    const bookingId = req.params.id as string;
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking) {
      res.status(404).json({ error: 'Booking not found' });
      return;
    }

    res.json({ booking });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/cancel — cancel my booking
router.post('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const validation = cancelBookingSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const bookingId = req.params.id as string;
    const booking = await bookingService.cancelBooking(
      bookingId,
      customerReq.customer.id,
      validation.data.reason
    );

    res.json({ booking });
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
