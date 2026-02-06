import { Router } from 'express';
import groomingRouter from '../../modules/grooming/router';

const router = Router();

router.use('/', groomingRouter);

export default router;
