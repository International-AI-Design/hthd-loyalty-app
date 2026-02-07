import { Router, Request, Response } from 'express';
import { authenticateCustomer, AuthenticatedCustomerRequest } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { BookingService, BookingError } from './service';
import {
  createBookingSchema,
  createMultiDayBookingSchema,
  availabilityQuerySchema,
  cancelBookingSchema,
  BookingStatus,
  BOOKING_STATUSES,
} from './types';

const router = Router();
const bookingService = new BookingService();

// All customer booking routes require authentication
router.use(authenticateCustomer);

// GET /service-types — list active service types
router.get('/service-types', async (req: Request, res: Response): Promise<void> => {
  try {
    const serviceTypes = await bookingService.getServiceTypes();
    res.json({ serviceTypes });
  } catch (error) {
    console.error('Get service types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /grooming-slots — get grooming slot availability for a date
router.get('/grooming-slots', async (req: Request, res: Response): Promise<void> => {
  try {
    const dateParam = req.query.date as string;
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      res.status(400).json({ error: 'date query parameter is required in YYYY-MM-DD format' });
      return;
    }
    const slots = await bookingService.getGroomingSlots(new Date(dateParam + 'T00:00:00Z'));
    res.json({ slots });
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Get grooming slots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /dogs/:id/size — customer sets their dog's size category
router.put('/dogs/:id/size', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const dogId = req.params.id;
    const { sizeCategory } = req.body;

    const validSizes = ['small', 'medium', 'large', 'xl'];
    if (!sizeCategory || !validSizes.includes(sizeCategory)) {
      res.status(400).json({ error: 'sizeCategory must be one of: small, medium, large, xl' });
      return;
    }

    // Verify dog belongs to customer
    const dog = await prisma.dog.findFirst({
      where: { id: dogId, customerId: customerReq.customer.id },
    });
    if (!dog) {
      res.status(404).json({ error: 'Dog not found' });
      return;
    }

    const updated = await prisma.dog.update({
      where: { id: dogId },
      data: { sizeCategory },
    });

    res.json({
      id: updated.id,
      name: updated.name,
      sizeCategory: updated.sizeCategory,
    });
  } catch (error) {
    console.error('Update dog size error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:bookingId/dogs/:dogId/photo — upload a dog photo for grooming estimate
router.post('/:bookingId/dogs/:dogId/photo', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const { bookingId, dogId } = req.params;
    const { photo } = req.body;

    if (!photo || typeof photo !== 'string') {
      res.status(400).json({ error: 'photo (base64 string) is required' });
      return;
    }

    // Validate size (rough check: base64 is ~4/3 the size of binary)
    const estimatedBytes = (photo.length * 3) / 4;
    if (estimatedBytes > 2 * 1024 * 1024) {
      res.status(400).json({ error: 'Photo must be less than 2MB' });
      return;
    }

    // Verify booking belongs to customer and is in valid state
    const booking = await (prisma as any).booking.findFirst({
      where: {
        id: bookingId,
        customerId: customerReq.customer.id,
        status: { in: ['pending', 'confirmed'] },
      },
    });
    if (!booking) {
      res.status(404).json({ error: 'Booking not found or not in a valid state for photo upload' });
      return;
    }

    // Find the booking dog record
    const bookingDog = await (prisma as any).bookingDog.findUnique({
      where: { bookingId_dogId: { bookingId, dogId } },
    });
    if (!bookingDog) {
      res.status(404).json({ error: 'Dog not found in this booking' });
      return;
    }

    // Store the photo
    await (prisma as any).bookingDog.update({
      where: { id: bookingDog.id },
      data: { conditionPhoto: photo },
    });

    res.json({ success: true, message: 'Photo uploaded successfully' });
  } catch (error) {
    console.error('Upload dog photo error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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


// POST /multi-day — create a multi-day booking (startDate/endDate)
router.post('/multi-day', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const validation = createMultiDayBookingSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const booking = await bookingService.createMultiDayBooking({
      customerId: customerReq.customer.id,
      ...validation.data,
    });

    res.status(201).json({ booking });
  } catch (error) {
    if (error instanceof BookingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Create multi-day booking error:', error);
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
