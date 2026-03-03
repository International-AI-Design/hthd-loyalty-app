import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { stripeService } from './index';
import { prisma } from '../../lib/prisma';
import { logger } from '../../middleware/security';

const router = Router();

/**
 * POST /api/v2/webhooks/stripe
 * Stripe webhook handler — receives events with raw body for signature verification.
 * Raw body parsing is applied at the mount point in index.ts.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature || typeof signature !== 'string') {
      logger.warn('Stripe webhook: missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    // req.body is a Buffer from express.raw()
    const rawBody = typeof req.body === 'string' ? req.body : req.body.toString();

    const eventResult = stripeService.constructWebhookEvent(rawBody, signature);

    if (eventResult.isErr()) {
      logger.warn('Stripe webhook: signature verification failed', { error: eventResult.error });
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    const event = eventResult.value;
    logger.info('Stripe webhook received', { type: event.type, id: event.id });

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      default:
        logger.info('Stripe webhook: unhandled event type', { type: event.type });
    }

    // Always return 200 for valid events
    return res.status(200).json({ received: true });
  } catch (e) {
    logger.error('Stripe webhook: unexpected error', { error: e instanceof Error ? e.message : 'unknown' });
    return res.status(500).json({ error: 'Webhook handler error' });
  }
});

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    const payment = await (prisma as any).payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!payment) {
      logger.warn('Stripe webhook: no Payment found for PaymentIntent', { id: paymentIntent.id });
      return;
    }

    if (payment.status === 'completed') {
      logger.info('Stripe webhook: Payment already completed', { id: payment.id });
      return;
    }

    await (prisma as any).payment.update({
      where: { id: payment.id },
      data: { status: 'completed' },
    });

    logger.info('Stripe webhook: Payment marked completed', { paymentId: payment.id, stripeId: paymentIntent.id });
  } catch (e) {
    logger.error('Stripe webhook: error handling payment_intent.succeeded', {
      stripeId: paymentIntent.id,
      error: e instanceof Error ? e.message : 'unknown',
    });
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    const payment = await (prisma as any).payment.findUnique({
      where: { stripePaymentIntentId: paymentIntent.id },
    });

    if (!payment) {
      logger.warn('Stripe webhook: no Payment found for failed PaymentIntent', { id: paymentIntent.id });
      return;
    }

    await (prisma as any).payment.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    });

    logger.info('Stripe webhook: Payment marked failed', { paymentId: payment.id, stripeId: paymentIntent.id });
  } catch (e) {
    logger.error('Stripe webhook: error handling payment_intent.payment_failed', {
      stripeId: paymentIntent.id,
      error: e instanceof Error ? e.message : 'unknown',
    });
  }
}

export default router;
