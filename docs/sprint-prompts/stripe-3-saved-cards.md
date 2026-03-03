# HTHD — Stripe Phase 3: Saved Cards + Wallet Wiring

## Session Protocol
- **Project:** `production/happy-tail/`
- **Estimated scope:** 3-5 files modified across `server/` and `customer-app/`
- **Prerequisites:** stripe-2 committed — Stripe Elements in checkout, PaymentIntent flow working. Both apps build clean.
- **Build gates:** `npx tsc --noEmit` (both), `npm run build` (customer-app), full checkout flow works in Stripe test mode
- **One sprint per session.** Read CLAUDE.md, then start.

## Context

Customers can now pay with real cards via Stripe Elements (from stripe-2). This session completes the Stripe integration:

1. **Stripe Customer creation** — When a user first pays with a card, create a Stripe Customer and save the `stripeCustomerId` on their Wallet record
2. **Saved payment methods** — Let customers save cards for faster checkout
3. **Wallet top-up via Stripe** — Wire the "Add Funds" flow to use real Stripe charges
4. **End-to-end test** — Full checkout with Stripe's 4242 4242 4242 4242 test card

## Read First

- `server/src/modules/stripe/service.ts` — StripeService (from stripe-1)
- `server/src/modules/wallet/service.ts` — WalletService.loadFunds()
- `customer-app/src/pages/CheckoutPage.tsx` — Current checkout with Stripe Elements (from stripe-2)
- `server/prisma/schema.prisma` — Wallet model (note `stripeCustomerId`, `autoReloadEnabled` fields)
- `customer-app/src/lib/api.ts` — checkoutApi and wallet API methods

## Steps

### Step 1: Add Stripe Customer Creation to StripeService

In `server/src/modules/stripe/service.ts`, add:

1. `getOrCreateCustomer(customerId: string, email: string, name: string): Promise<Result<string, StripeError>>`
   - Check Wallet for existing `stripeCustomerId`
   - If exists, return it
   - If not, call `stripe.customers.create({ email, name, metadata: { hthd_customer_id: customerId } })`
   - Save `stripeCustomerId` to Wallet record
   - Return the Stripe customer ID

2. `savePaymentMethod(stripeCustomerId: string, paymentMethodId: string): Promise<Result<Stripe.PaymentMethod, StripeError>>`
   - Attach payment method to customer
   - Return the payment method

3. `listPaymentMethods(stripeCustomerId: string): Promise<Result<Stripe.PaymentMethod[], StripeError>>`
   - List saved cards for the customer
   - Return array of payment methods

### Step 2: Wire Wallet Top-Up to Stripe

Modify `server/src/modules/wallet/service.ts`:

In `loadFunds()`:
- If Stripe is configured and payment method is 'card':
  - Get or create Stripe Customer
  - Create PaymentIntent with `customer: stripeCustomerId`
  - On success: credit wallet balance (existing logic)
  - On failure: return error
- If Stripe not configured:
  - Use existing simulated flow

### Step 3: Create Saved Cards API Endpoints

Add to server (new file or extend checkout router):

- `GET /api/v2/payment-methods` — List saved cards for authenticated user
  - Returns `{ paymentMethods: Array<{ id, brand, last4, expMonth, expYear }> }`
- `DELETE /api/v2/payment-methods/:id` — Remove a saved card
- `POST /api/v2/checkout/create-payment-intent` — Update to accept optional `paymentMethodId` and `saveCard: boolean`

Add corresponding methods to `customer-app/src/lib/api.ts`.

### Step 4: Update CheckoutPage for Saved Cards

In `customer-app/src/pages/CheckoutPage.tsx`, in the Card tab:

1. On mount (when Stripe configured): fetch saved payment methods
2. If saved cards exist, show them as selectable options above the new card form:
   - Radio buttons: "Visa ending in 4242" with brand icon
   - "Use a different card" option to show Stripe Element
3. Add "Save this card for future purchases" checkbox when entering new card
4. When using a saved card: pass `paymentMethodId` to create-payment-intent

### Step 5: Update Wallet Add Funds UI

In `customer-app/src/pages/CheckoutPage.tsx` (Wallet tab, "Add Funds" section):

1. When Stripe is configured and user clicks "Add Funds":
   - Show Stripe Element for card input (or use saved card)
   - Create PaymentIntent for the fund amount
   - On success: wallet balance updates
2. When Stripe not configured:
   - Keep existing simulated "Add Funds" flow

### Step 6: End-to-End Test with Stripe Test Mode

Set environment variables:
```bash
# Server
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MODE=test

# Customer App
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

Test flow:
1. Start both apps
2. Log in as test customer
3. Navigate to checkout for a booking
4. Select Card tab → enter 4242 4242 4242 4242, any future date, any CVC
5. Check "Save card" checkbox
6. Complete checkout → should succeed
7. Go to another booking → Card tab shows saved card
8. Select saved card → complete checkout
9. Go to Wallet → Add Funds → use saved card → balance updates

## Build Gates (ALL must pass before commit)
```bash
cd server && npx tsc --noEmit
cd ../customer-app && npx tsc --noEmit && npm run build
```

Start both apps and test:
```bash
# Terminal 1:
cd server && npm run dev

# Terminal 2:
cd customer-app && npm run dev
```

## E2E Verification
- [ ] New card checkout works with Stripe test card (4242...)
- [ ] "Save card" checkbox saves the card to Stripe Customer
- [ ] Saved cards appear on next checkout visit
- [ ] Saved card can be used for checkout (no re-entering card details)
- [ ] Saved card can be deleted
- [ ] Wallet "Add Funds" works with Stripe when configured
- [ ] Wallet "Add Funds" falls back to simulation when Stripe not configured
- [ ] Full checkout flow: Wallet tab still works identically
- [ ] Full checkout flow: Points tab still works identically
- [ ] Split payment: wallet portion uses balance, card portion uses Stripe
- [ ] Stripe Customer is created on first card use, reused after

## Anti-Pattern Checklist
- [ ] No white screens if Stripe API calls fail
- [ ] Saved cards show masked numbers only (last 4 digits, brand)
- [ ] Full PCI compliance — raw card numbers never touch our server
- [ ] Simulation mode still works perfectly with no Stripe keys
- [ ] Error messages are customer-friendly ("Card declined" not "Stripe Error: charge_declined")
- [ ] No duplicate Stripe Customers created for the same HTHD customer

## Commit Checkpoint
```bash
git add server/src/modules/stripe/service.ts server/src/modules/wallet/service.ts server/src/modules/checkout/router.ts customer-app/src/pages/CheckoutPage.tsx customer-app/src/lib/api.ts
git commit -m "feat: complete Stripe integration with saved cards and wallet wiring

Stripe Customer created on first card use, persisted on Wallet record.
Saved payment methods listed and selectable at checkout. Wallet Add
Funds wired to Stripe when configured. Full backward compatibility
with simulation mode. Tested end-to-end with Stripe test cards.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

## Progress Updates
1. Update `CHANGELOG.md` — note full Stripe integration complete
2. Append to `ferroai/spine/memory/daily/2026-03-03.md`
3. Archive session series to `archive/sessions/2026-03-03_stripe-integration.md`

## Done!

HTHD now has full Stripe payment processing. Customers can pay with real cards, save cards for future use, and top up their wallet with Stripe charges. Simulation mode remains as fallback. Ready for Ted/Julian to configure their Stripe account and go live.
