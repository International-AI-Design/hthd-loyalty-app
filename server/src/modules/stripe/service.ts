import Stripe from 'stripe';
import { Result, ok, err } from 'neverthrow';
import { logger } from '../../middleware/security';
import { prisma } from '../../lib/prisma';

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

  /**
   * Create a PaymentIntent with full params (supports customer, payment_method, setup_future_usage).
   */
  async createPaymentIntentWithParams(
    params: Record<string, unknown>
  ): Promise<Result<Stripe.PaymentIntent, StripeError>> {
    if (!this.stripe) {
      return err({ type: 'not_configured', message: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable.' });
    }
    try {
      const paymentIntent = await this.stripe.paymentIntents.create(
        params as unknown as Stripe.PaymentIntentCreateParams
      );
      return ok(paymentIntent);
    } catch (e) {
      const mapped = mapStripeError(e);
      logger.error('Stripe createPaymentIntentWithParams failed', { error: mapped });
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

  /**
   * Get or create a Stripe Customer for an HTHD customer.
   * Checks Wallet for existing stripeCustomerId; creates one in Stripe if not found.
   */
  async getOrCreateCustomer(
    customerId: string,
    email: string,
    name: string
  ): Promise<Result<string, StripeError>> {
    if (!this.stripe) {
      return err({ type: 'not_configured', message: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable.' });
    }

    try {
      // Check for existing Stripe Customer on the wallet
      const wallet = await (prisma as any).wallet.findUnique({
        where: { customerId },
        select: { stripeCustomerId: true },
      });

      if (wallet?.stripeCustomerId) {
        return ok(wallet.stripeCustomerId);
      }

      // Create Stripe Customer
      const stripeCustomer = await this.stripe.customers.create({
        email,
        name,
        metadata: { hthd_customer_id: customerId },
      });

      // Ensure wallet exists, then save the Stripe Customer ID
      await (prisma as any).wallet.upsert({
        where: { customerId },
        update: { stripeCustomerId: stripeCustomer.id },
        create: {
          customerId,
          balanceCents: 0,
          tier: 'basic',
          stripeCustomerId: stripeCustomer.id,
        },
      });

      return ok(stripeCustomer.id);
    } catch (e) {
      const mapped = mapStripeError(e);
      logger.error('Stripe getOrCreateCustomer failed', { error: mapped });
      return err(mapped);
    }
  }

  /**
   * Attach a payment method to a Stripe Customer (saving the card).
   */
  async savePaymentMethod(
    stripeCustomerId: string,
    paymentMethodId: string
  ): Promise<Result<Stripe.PaymentMethod, StripeError>> {
    if (!this.stripe) {
      return err({ type: 'not_configured', message: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable.' });
    }
    try {
      const pm = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });
      return ok(pm);
    } catch (e) {
      const mapped = mapStripeError(e);
      logger.error('Stripe savePaymentMethod failed', { error: mapped });
      return err(mapped);
    }
  }

  /**
   * List saved card payment methods for a Stripe Customer.
   */
  async listPaymentMethods(
    stripeCustomerId: string
  ): Promise<Result<Stripe.PaymentMethod[], StripeError>> {
    if (!this.stripe) {
      return err({ type: 'not_configured', message: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable.' });
    }
    try {
      const methods = await this.stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card',
      });
      return ok(methods.data);
    } catch (e) {
      const mapped = mapStripeError(e);
      logger.error('Stripe listPaymentMethods failed', { error: mapped });
      return err(mapped);
    }
  }

  /**
   * Detach a payment method from a customer (remove saved card).
   */
  async detachPaymentMethod(
    paymentMethodId: string
  ): Promise<Result<Stripe.PaymentMethod, StripeError>> {
    if (!this.stripe) {
      return err({ type: 'not_configured', message: 'Stripe is not configured. Set STRIPE_SECRET_KEY to enable.' });
    }
    try {
      const pm = await this.stripe.paymentMethods.detach(paymentMethodId);
      return ok(pm);
    } catch (e) {
      const mapped = mapStripeError(e);
      logger.error('Stripe detachPaymentMethod failed', { error: mapped });
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
