import { Router, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { authenticateCustomer } from '../../middleware/auth';
import { checkoutSchema, CheckoutInput } from './types';
import { checkoutService } from './service';
import { stripeService } from '../stripe';
import { prisma } from '../../lib/prisma';

const router = Router();

// Middleware: Require authentication for all checkout routes
router.use(authenticateCustomer as any);

/**
 * POST /create-payment-intent
 * Create a Stripe PaymentIntent for card payment.
 * Optionally accepts paymentMethodId (saved card) and saveCard flag.
 */
const createPaymentIntentSchema = z.object({
  amountCents: z.number().int().min(50, 'Amount must be at least 50 cents'),
  bookingIds: z.array(z.string().uuid()).min(1),
  paymentMethodId: z.string().optional(),
  saveCard: z.boolean().optional(),
});

router.post('/create-payment-intent', async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customer?.id;
    if (!customerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { amountCents, bookingIds, paymentMethodId, saveCard } = createPaymentIntentSchema.parse(req.body);

    // Get or create Stripe Customer so we can attach payment methods
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { email: true, firstName: true, lastName: true },
    });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customerResult = await stripeService.getOrCreateCustomer(
      customerId,
      customer.email,
      `${customer.firstName} ${customer.lastName}`
    );
    if (customerResult.isErr()) {
      const status = customerResult.error.type === 'not_configured' ? 503 : 400;
      return res.status(status).json({ error: customerResult.error.message });
    }

    const stripeCustomerId = customerResult.value;

    // Build PaymentIntent create params
    const intentParams: Record<string, unknown> = {
      amount: amountCents,
      currency: 'usd',
      customer: stripeCustomerId,
      metadata: {
        bookingIds: bookingIds.join(','),
        customerId,
      },
      automatic_payment_methods: { enabled: true },
    };

    // If using a saved payment method, attach it
    if (paymentMethodId) {
      intentParams.payment_method = paymentMethodId;
    }

    // If saveCard requested, set setup_future_usage to save the card after payment
    if (saveCard) {
      intentParams.setup_future_usage = 'on_session';
    }

    const result = await stripeService.createPaymentIntentWithParams(intentParams);
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
 * GET /payment-methods
 * List saved cards for the authenticated customer.
 */
router.get('/payment-methods', async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customer?.id;
    if (!customerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const wallet = await (prisma as any).wallet.findUnique({
      where: { customerId },
      select: { stripeCustomerId: true },
    });

    if (!wallet?.stripeCustomerId) {
      return res.status(200).json({ paymentMethods: [] });
    }

    const result = await stripeService.listPaymentMethods(wallet.stripeCustomerId);
    if (result.isErr()) {
      return res.status(400).json({ error: result.error.message });
    }

    const paymentMethods = result.value.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? 'unknown',
      last4: pm.card?.last4 ?? '****',
      expMonth: pm.card?.exp_month ?? 0,
      expYear: pm.card?.exp_year ?? 0,
    }));

    return res.status(200).json({ paymentMethods });
  } catch (error) {
    console.error('List payment methods error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /payment-methods/:id
 * Remove a saved card.
 */
router.delete('/payment-methods/:id', async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customer?.id;
    if (!customerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const paymentMethodId = req.params.id as string;

    const result = await stripeService.detachPaymentMethod(paymentMethodId);
    if (result.isErr()) {
      return res.status(400).json({ error: result.error.message });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete payment method error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /
 * Process checkout for one or more bookings
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customer?.id;
    if (!customerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input: CheckoutInput = checkoutSchema.parse(req.body);
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
