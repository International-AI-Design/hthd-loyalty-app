# HTHD — Stripe Phase 2: Customer Checkout Frontend

## Session Protocol
- **Project:** `production/happy-tail/`
- **Estimated scope:** 3-4 files modified in `customer-app/`, 1 in `server/`
- **Prerequisites:** stripe-1 committed — StripeService, webhook handler, conditional CheckoutService all in place. Server builds clean.
- **Build gates:** `npx tsc --noEmit` (server + customer-app), `npm run build` (customer-app), checkout page shows Stripe Element
- **One sprint per session.** Read CLAUDE.md, then start.

## Context

The server can now create real Stripe PaymentIntents (from stripe-1). The customer checkout page at `customer-app/src/pages/CheckoutPage.tsx` currently shows a simulated card form with a hardcoded 4242 test card. This session replaces that with Stripe Elements — the official Stripe UI components that handle PCI compliance, card validation, and 3D Secure.

**CRITICAL: The checkout page has multiple payment tabs (Wallet, Card, Points, Split). We are ONLY replacing the Card tab's form. Wallet and Points flows are unchanged.**

## Read First

- `customer-app/src/pages/CheckoutPage.tsx` — Current checkout UI with tabs
- `customer-app/src/lib/api.ts` — checkoutApi methods (lines 934-946)
- `server/src/modules/checkout/router.ts` — POST /api/v2/checkout endpoint
- `server/src/modules/checkout/types.ts` — checkoutSchema, PAYMENT_METHODS
- `server/src/modules/stripe/service.ts` — StripeService from stripe-1

## Steps

### Step 1: Install Stripe React SDK

```bash
cd customer-app && npm install @stripe/react-stripe-js @stripe/stripe-js
```

### Step 2: Create Stripe Provider Setup

Create `customer-app/src/lib/stripe.ts`:

1. Import `loadStripe` from `@stripe/stripe-js`
2. Export `stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')`
3. Export a boolean `isStripeConfigured = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY`

### Step 3: Create PaymentIntent Endpoint

Add to `server/src/modules/checkout/router.ts` (or create a new route file):

New endpoint `POST /api/v2/checkout/create-payment-intent`:
- Accepts `{ amountCents: number, bookingIds: string[] }` (Zod-validated)
- Calls `stripeService.createPaymentIntent(amountCents, { bookingIds: bookingIds.join(',') })`
- Returns `{ clientSecret: paymentIntent.client_secret }` on success
- Returns error if Stripe not configured or call fails

Add to `customer-app/src/lib/api.ts`:
```typescript
createPaymentIntent: (amountCents: number, bookingIds: string[]) =>
  api.post<{ clientSecret: string }>('/v2/checkout/create-payment-intent', { amountCents, bookingIds }),
```

### Step 4: Create StripeCardForm Component

Create `customer-app/src/components/StripeCardForm.tsx`:

1. Import `PaymentElement` (or `CardElement`) from `@stripe/react-stripe-js`
2. Import `useStripe`, `useElements` from `@stripe/react-stripe-js`
3. Props: `{ amountCents: number, onSuccess: (paymentIntentId: string) => void, onError: (msg: string) => void, isProcessing: boolean }`
4. Renders `<CardElement>` with custom styling to match HTHD brand colors
5. On form submit:
   - Call `stripe.confirmCardPayment(clientSecret, { payment_method: { card: elements.getElement(CardElement) } })`
   - On success: call `onSuccess(paymentIntent.id)`
   - On error: call `onError(error.message)`
6. Style the CardElement options to match the existing form aesthetic (dark inputs, rounded corners)

### Step 5: Update CheckoutPage Card Tab

Modify `customer-app/src/pages/CheckoutPage.tsx`:

1. Import `Elements` provider from `@stripe/react-stripe-js`
2. Import `stripePromise`, `isStripeConfigured` from `../lib/stripe`
3. In the Card tab content:
   - If `isStripeConfigured`:
     - Create PaymentIntent on tab selection (call API, get clientSecret)
     - Wrap card form in `<Elements stripe={stripePromise} options={{ clientSecret }}>`
     - Replace simulated card inputs with `<StripeCardForm>`
     - On success: proceed to existing checkout flow with the real paymentIntentId
   - If NOT configured:
     - Keep existing simulated card form (backward compatible)

4. In the Split tab:
   - Same logic for the card portion of split payments
   - Wallet portion remains unchanged

### Step 6: Update Customer App .env.example

Add to `customer-app/.env.example` (create if needed):
```bash
VITE_API_URL=http://localhost:3001/api
# Stripe (optional — falls back to simulated card form if not set)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Build Gates (ALL must pass before commit)
```bash
cd server && npx tsc --noEmit
cd ../customer-app && npx tsc --noEmit && npm run build
```

Manual test:
1. Start server: `cd server && npm run dev`
2. Start customer app: `cd customer-app && npm run dev`
3. Navigate to checkout for any booking
4. Without VITE_STRIPE_PUBLISHABLE_KEY: see old simulated form (no regression)
5. With VITE_STRIPE_PUBLISHABLE_KEY set to pk_test_...: see Stripe CardElement

## E2E Verification
- [ ] Checkout page loads without errors (with or without Stripe key)
- [ ] Card tab shows Stripe CardElement when key is configured
- [ ] Card tab shows simulated form when key is NOT configured (backward compat)
- [ ] Wallet tab is completely unchanged
- [ ] Points tab is completely unchanged
- [ ] Split tab shows Stripe Element for card portion
- [ ] CardElement matches the existing visual style (dark theme, rounded)
- [ ] Card validation errors display inline (wrong number, expired card)
- [ ] Loading/processing state shown during payment

## Anti-Pattern Checklist
- [ ] Stripe publishable key (pk_*) is in frontend env — this is safe (it's public by design)
- [ ] Secret key (sk_*) is NEVER in frontend code
- [ ] No white screens if Stripe JS fails to load
- [ ] Simulated fallback works perfectly when Stripe is not configured
- [ ] No layout shift between Stripe and simulated card forms
- [ ] Error messages from Stripe are user-friendly (not raw error codes)

## Commit Checkpoint
```bash
git add customer-app/src/components/StripeCardForm.tsx customer-app/src/lib/stripe.ts customer-app/src/pages/CheckoutPage.tsx customer-app/src/lib/api.ts server/src/modules/checkout/router.ts customer-app/package.json customer-app/package-lock.json
git commit -m "feat(customer): integrate Stripe Elements in checkout card form

Replaces simulated card inputs with Stripe CardElement when
VITE_STRIPE_PUBLISHABLE_KEY is set. Falls back to simulated form when
unconfigured. PaymentIntent created server-side, confirmed client-side.
Wallet and Points tabs unchanged.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

## Progress Updates
1. Update `CHANGELOG.md`
2. Append to `ferroai/spine/memory/daily/2026-03-03.md`

## Handoff → Next Sub-Session

Paste into a fresh Claude Code instance:

```
Read and execute docs/sprint-prompts/stripe-3-saved-cards.md

Context from stripe-2: Stripe Elements integrated in CheckoutPage card
tab. StripeCardForm component renders CardElement. PaymentIntent created
via POST /api/v2/checkout/create-payment-intent. Stripe provider setup
in customer-app/src/lib/stripe.ts. Falls back to simulated form when
VITE_STRIPE_PUBLISHABLE_KEY is not set. Server and customer-app both
build clean.
```
