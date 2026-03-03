import { Router, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { authenticateCustomer } from '../../middleware/auth';
import { checkoutSchema, CheckoutInput } from './types';
import { checkoutService } from './service';
import { stripeService } from '../stripe';

const router = Router();

// Middleware: Require authentication for all checkout routes
router.use(authenticateCustomer as any);

/**
 * POST /create-payment-intent
 * Create a Stripe PaymentIntent for card payment
 */
const createPaymentIntentSchema = z.object({
  amountCents: z.number().int().min(50, 'Amount must be at least 50 cents'),
  bookingIds: z.array(z.string().uuid()).min(1),
});

router.post('/create-payment-intent', async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customer?.id;
    if (!customerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amountCents, bookingIds } = createPaymentIntentSchema.parse(req.body);

    const result = await stripeService.createPaymentIntent(amountCents, {
      bookingIds: bookingIds.join(','),
      customerId,
    });

    if (result.isErr()) {
      const status = result.error.type === 'not_configured' ? 503 : 400;
      return res.status(status).json({ error: result.error.message });
    }

    return res.status(200).json({ clientSecret: result.value.client_secret });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.issues });
    }
    console.error('Create PaymentIntent error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /
 * Process checkout for one or more bookings
 *
 * Request body:
 * {
 *   bookingIds: string[],           // Array of booking UUIDs
 *   paymentMethod: 'wallet' | 'card' | 'split' | 'cash' | 'points',
 *   walletAmountCents?: number,     // Required for 'split', ignored for others
 *   pointsToRedeem?: number,        // Required for 'points', optional for 'split'
 *   tipCents?: number,              // Tip amount (default 0)
 *   idempotencyKey?: string         // Optional UUID for idempotency
 * }
 *
 * Response:
 * {
 *   paymentId: string,
 *   transactionId: string,
 *   totalCents: number,
 *   walletAmountCents: number,
 *   cardAmountCents: number,
 *   tipCents: number,
 *   status: string,
 *   bookings: Array<{ id, status }>,
 *   createdAt: Date
 * }
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customer?.id;
    if (!customerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Validate request body against schema
    const input: CheckoutInput = checkoutSchema.parse(req.body);

    // Process checkout
    const result = await checkoutService.processCheckout(customerId, null, input);

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

    console.error('Checkout error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /:paymentId/receipt
 * Retrieve receipt for a completed payment
 */
router.get('/:paymentId/receipt', async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customer?.id;
    if (!customerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const paymentId = req.params.paymentId as string;

    const receipt = await checkoutService.getReceipt(paymentId, customerId);

    return res.status(200).json(receipt);
  } catch (error) {
    if (error instanceof Error && error.message === 'Payment not found') {
      return res.status(404).json({ error: 'Payment not found' });
    }

    console.error('Receipt error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
