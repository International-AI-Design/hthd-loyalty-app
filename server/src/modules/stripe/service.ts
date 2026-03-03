import Stripe from 'stripe';
import { Result, ok, err } from 'neverthrow';
import { logger } from '../../middleware/security';

// --- StripeError discriminated union ---

export type StripeError =
  | { type: 'card_declined'; message: string }
  | { type: 'invalid_request'; message: string }
  | { type: 'api_error'; message: string }
  | { type: 'not_configured'; message: string };

function mapStripeError(e: unknown): StripeError {
  if (e instanceof Stripe.errors.StripeCardError) {
    return { type: 'card_declined', message: e.message };
  }
  if (e instanceof Stripe.errors.StripeInvalidRequestError) {
    return { type: 'invalid_request', message: e.message };
  }
  if (e instanceof Error) {
    return { type: 'api_error', message: e.message };
  }
  return { type: 'api_error', message: 'Unknown Stripe error' };
}

// --- StripeService ---

export class StripeService {
  constructor(private stripe: Stripe | null) {}

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  async createPaymentIntent(
    amountCents: number,
    metadata: Record<string, string>
  ): Promise<Result<Stripe.PaymentIntent, StripeError>> {
    if (!this.stripe) {
      return err({ type: 'not_configured', message: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable.' });
    }
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountCents,
        currency: 'usd',
        metadata,
        automatic_payment_methods: { enabled: true },
      });
      return ok(paymentIntent);
    } catch (e) {
      const mapped = mapStripeError(e);
      logger.error('Stripe createPaymentIntent failed', { error: mapped });
      return err(mapped);
    }
  }

  async confirmPaymentIntent(
    paymentIntentId: string
  ): Promise<Result<Stripe.PaymentIntent, StripeError>> {
    if (!this.stripe) {
      return err({ type: 'not_configured', message: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable.' });
    }
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);
      return ok(paymentIntent);
    } catch (e) {
      const mapped = mapStripeError(e);
      logger.error('Stripe confirmPaymentIntent failed', { error: mapped });
      return err(mapped);
    }
  }

  async createCustomer(
    email: string,
    name: string
  ): Promise<Result<Stripe.Customer, StripeError>> {
    if (!this.stripe) {
      return err({ type: 'not_configured', message: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable.' });
    }
    try {
      const customer = await this.stripe.customers.create({ email, name });
      return ok(customer);
    } catch (e) {
      const mapped = mapStripeError(e);
      logger.error('Stripe createCustomer failed', { error: mapped });
      return err(mapped);
    }
  }

  constructWebhookEvent(
    body: string,
    signature: string
  ): Result<Stripe.Event, StripeError> {
    if (!this.stripe) {
      return err({ type: 'not_configured', message: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable.' });
    }
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return err({ type: 'not_configured', message: 'STRIPE_WEBHOOK_SECRET is not set.' });
    }
    try {
      const event = this.stripe.webhooks.constructEvent(body, signature, webhookSecret);
      return ok(event);
    } catch (e) {
      const mapped = mapStripeError(e);
      logger.error('Stripe webhook signature verification failed', { error: mapped });
      return err(mapped);
    }
  }
}
