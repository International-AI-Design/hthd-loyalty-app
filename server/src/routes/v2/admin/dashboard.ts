import { Router } from 'express';
import adminDashboardRouter from '../../../modules/dashboard/admin-router';

const router = Router();

// Mount the dashboard module's admin routes
router.use('/', adminDashboardRouter);

export default router;
