import { Router } from 'express';
import adminBookingRouter from '../../../modules/booking/admin-router';

const router = Router();

// Mount the booking module's admin routes
router.use('/', adminBookingRouter);

export default router;
