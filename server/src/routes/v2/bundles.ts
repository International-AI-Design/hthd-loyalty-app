import { Router } from 'express';
import bundlesRouter from '../../modules/bundles/router';

const router = Router();

router.use('/', bundlesRouter);

export default router;
