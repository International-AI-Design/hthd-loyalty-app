# HTHD — Stripe Phase 1: Server Infrastructure

## Session Protocol
- **Project:** `production/happy-tail/`
- **Estimated scope:** 4-5 files modified/created in `server/`
- **Prerequisites:** ms-8 committed and deployed. All E2E tests passing. Server builds clean.
- **Build gates:** `npx tsc --noEmit` (from `server/`), server starts, webhook returns 200 for test signatures
- **One sprint per session.** Read CLAUDE.md, then start.

## Context

HTHD has a fully working simulated checkout system. Payments currently generate fake `sim_*` transaction IDs. The Prisma schema already has `stripePaymentIntentId` on Payment and `stripeCustomerId` on Wallet — the database is ready for real Stripe.

This session adds the server-side Stripe infrastructure: SDK installation, a StripeService with neverthrow Result types, a webhook handler with raw body parsing, and conditional real/simulated payment in CheckoutService.

**CRITICAL: This is a production app with real customers. Every change must be backward-compatible with the existing simulated flow. Stripe is additive, not a replacement — simulated mode stays as fallback.**

## Read First

- `server/src/modules/checkout/service.ts` — Current CheckoutService (simulated payments)
- `server/src/modules/checkout/types.ts` — Payment methods, Zod schemas, POINTS_VALUE_CENTS
- `server/src/modules/checkout/router.ts` — Customer checkout routes
- `server/src/modules/wallet/service.ts` — WalletService (loadFunds, deductFunds)
- `server/prisma/schema.prisma` — Payment and Wallet models (note stripePaymentIntentId, stripeCustomerId)
- `server/.env.example` — Current env vars
- `CHANGELOG.md` — Recent changes

## Steps

### Step 1: Install Stripe SDK

```bash
cd server && npm install stripe
```

### Step 2: Create StripeService

Create `server/src/modules/stripe/service.ts`:

1. `import Stripe from 'stripe'`
2. `import { Result, ok, err } from 'neverthrow'` (install neverthrow if not present: `npm install neverthrow`)
3. Define `StripeError` discriminated union:
   ```typescript
   type StripeError =
     | { type: 'card_declined'; message: string }
     | { type: 'invalid_request'; message: string }
     | { type: 'api_error'; message: string }
     | { type: 'not_configured'; message: string }
   ```
4. Create `StripeService` class:
   - Constructor takes `stripe: Stripe | null` (null when keys not configured)
   - `isConfigured(): boolean`
   - `createPaymentIntent(amountCents: number, metadata: Record<string, string>): Promise<Result<Stripe.PaymentIntent, StripeError>>`
   - `confirmPaymentIntent(paymentIntentId: string): Promise<Result<Stripe.PaymentIntent, StripeError>>`
   - `createCustomer(email: string, name: string): Promise<Result<Stripe.Customer, StripeError>>`
   - `constructWebhookEvent(body: string, signature: string): Result<Stripe.Event, StripeError>`
   - Every method returns `err({ type: 'not_configured', message: '...' })` if `stripe` is null

5. Create `server/src/modules/stripe/index.ts` that exports a singleton:
   ```typescript
   const stripe = process.env.STRIPE_SECRET_KEY
     ? new Stripe(process.env.STRIPE_SECRET_KEY)
     : null;
   export const stripeService = new StripeService(stripe);
   ```

### Step 3: Create Webhook Handler

Create `server/src/modules/stripe/webhook-router.ts`:

1. Express router with `POST /` endpoint
2. Uses `express.raw({ type: 'application/json' })` middleware for raw body
3. Verifies signature via `stripeService.constructWebhookEvent()`
4. Handles events:
   - `payment_intent.succeeded` → Update Payment record with stripePaymentIntentId, set status 'completed'
   - `payment_intent.payment_failed` → Update Payment status to 'failed'
5. Returns 200 for all valid events (even unhandled ones)
6. Returns 400 for signature verification failures
7. All within try/catch, never crashes

### Step 4: Mount Webhook Route

In `server/src/index.ts`:

1. Import webhook router
2. Mount BEFORE the JSON body parser middleware:
   ```typescript
   app.use('/api/v2/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookRouter);
   ```
   This ensures the webhook gets the raw body for signature verification.

### Step 5: Update CheckoutService for Conditional Stripe

Modify `server/src/modules/checkout/service.ts`:

1. Import `stripeService`
2. In `processCheckout()`, when payment method is 'card' or 'split' (card portion):
   - If `stripeService.isConfigured()`:
     - Create PaymentIntent with amount and metadata (customerId, bookingIds)
     - On success: use `paymentIntent.id` as the transaction ID
     - On error: return checkout error with Stripe error message
   - If NOT configured (no API key):
     - Fall back to current simulated `sim_*` ID generation (existing behavior)
3. Add `STRIPE_MODE` env var check: `'live' | 'test' | 'simulation'` (default: 'simulation')

### Step 6: Update .env.example

Add to `server/.env.example`:
```bash
# Stripe (optional — falls back to simulated payments if not set)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MODE=simulation  # 'live', 'test', or 'simulation'
```

## Build Gates (ALL must pass before commit)
```bash
cd server
npx tsc --noEmit
npm run build
npm start  # Verify server starts without Stripe keys (simulation mode)

# Test webhook (requires stripe CLI or curl):
curl -X POST http://localhost:3001/api/v2/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"payment_intent.succeeded","data":{"object":{"id":"pi_test"}}}'
# Should return 400 (no signature) — but NOT crash
```

## E2E Verification
- [ ] Server starts cleanly without any Stripe env vars (simulation mode)
- [ ] Server starts cleanly with STRIPE_SECRET_KEY set to a test key
- [ ] Existing checkout flow still works in simulation mode (no regression)
- [ ] Webhook endpoint exists at `/api/v2/webhooks/stripe`
- [ ] Webhook returns 400 for requests without valid signature (not 500)
- [ ] stripeService.isConfigured() returns false when no key is set
- [ ] stripeService.isConfigured() returns true when key is set
- [ ] StripeService methods return err({ type: 'not_configured' }) when unconfigured

## Anti-Pattern Checklist
- [ ] No white screens — server-only changes, no frontend touched
- [ ] Stripe secret key is NEVER logged or returned in API responses
- [ ] Webhook handler never crashes — all errors caught and return proper HTTP status
- [ ] Simulation mode is the DEFAULT — Stripe is opt-in
- [ ] neverthrow Result types used for all Stripe operations — no thrown errors
- [ ] No silent catch blocks — errors are logged via existing logger

## Commit Checkpoint
```bash
git add server/src/modules/stripe/ server/src/modules/checkout/service.ts server/src/index.ts server/.env.example server/package.json server/package-lock.json
git commit -m "feat(server): add Stripe infrastructure with neverthrow Results

StripeService wraps all Stripe SDK calls with Result<T, StripeError>.
Webhook handler at /api/v2/webhooks/stripe verifies signatures and
updates Payment records. CheckoutService conditionally uses real Stripe
or falls back to simulation mode. Backward-compatible — simulation is
the default when STRIPE_SECRET_KEY is not set.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

## Progress Updates
1. Update `CHANGELOG.md` with Stripe infrastructure addition
2. Append to `ferroai/spine/memory/daily/2026-03-03.md`

## Handoff → Next Sub-Session

Paste into a fresh Claude Code instance:

```
Read and execute docs/sprint-prompts/stripe-2-checkout.md

Context from stripe-1: StripeService is installed at
server/src/modules/stripe/service.ts with neverthrow Result types.
Webhook handler mounted at /api/v2/webhooks/stripe. CheckoutService
conditionally creates PaymentIntents when STRIPE_SECRET_KEY is set,
falls back to simulation otherwise. STRIPE_MODE env var controls
behavior ('simulation' default). Server builds and starts clean.
```
