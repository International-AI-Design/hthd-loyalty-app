import { Router } from 'express';
import adminReportCardRouter from '../../../modules/report-card/admin-router';

const router = Router();

// Mount the report-card module's admin routes
router.use('/', adminReportCardRouter);

export default router;
