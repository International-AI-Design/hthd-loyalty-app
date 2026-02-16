import { Router, Request, Response } from 'express';
import { authenticateStaff, AuthenticatedStaffRequest, requireRoles } from '../../middleware/auth';
import { checkoutSchema } from './types';
import { checkoutService } from './service';
import { WalletService } from '../wallet/service';
import { ZodError } from 'zod';

const router = Router();
const walletService = new WalletService();

// All admin checkout routes require staff auth + owner/manager/admin role
router.use(authenticateStaff as any);
router.use(requireRoles('owner', 'manager', 'admin') as any);

/**
 * GET /wallet-balance/:customerId
 * Staff looks up a customer's wallet balance
 */
router.get('/wallet-balance/:customerId', async (req: Request, res: Response) => {
  try {
    const customerId = req.params.customerId as string;
    const { balanceCents, tier } = await walletService.getBalance(customerId);
    return res.status(200).json({ balanceCents, tier });
  } catch (error) {
    console.error('Admin wallet balance error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /process
 * Staff processes checkout on behalf of a customer.
 * Request body includes customerId + standard checkout fields.
 */
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { customerId, ...checkoutData } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    // Validate checkout fields with the same schema as customer checkout
    const input = checkoutSchema.parse(checkoutData);

    // Staff ID from authenticated JWT for audit logging
    const staffId = (req as AuthenticatedStaffRequest).staff.id;

    const result = await checkoutService.processCheckout(customerId, staffId, input);

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.issues,
      });
    }

    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Admin checkout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /receipt/:paymentId
 * Staff retrieves receipt for any payment (no ownership restriction)
 */
router.get('/receipt/:paymentId', async (req: Request, res: Response) => {
  try {
    const paymentId = req.params.paymentId as string;
    const receipt = await checkoutService.getReceiptAdmin(paymentId);
    return res.status(200).json(receipt);
  } catch (error) {
    if (error instanceof Error && error.message === 'Payment not found') {
      return res.status(404).json({ error: 'Payment not found' });
    }

    console.error('Admin receipt error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
