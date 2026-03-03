import Stripe from 'stripe';
import { StripeService } from './service';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const stripeService = new StripeService(stripe);
export { StripeService, StripeError } from './service';
