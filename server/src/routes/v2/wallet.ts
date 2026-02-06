import { Router } from 'express';
import walletRouter from '../../modules/wallet/router';

const router = Router();

// Mount the wallet module's customer-facing routes
router.use('/', walletRouter);

export default router;
