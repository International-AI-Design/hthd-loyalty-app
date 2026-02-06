import { Router } from 'express';
import bookingRouter from '../../modules/booking/router';

const router = Router();

// Mount the booking module's customer-facing routes
router.use('/', bookingRouter);

export default router;
