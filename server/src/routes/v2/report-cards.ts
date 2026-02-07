import { Router } from 'express';
import reportCardRouter from '../../modules/report-card/router';

const router = Router();

// Mount the report-card module's customer-facing routes
router.use('/', reportCardRouter);

export default router;
