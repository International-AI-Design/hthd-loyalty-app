# Stripe Phase 3: Saved Cards + Wallet Wiring

**Date:** 2026-03-03 16:04 MST
**Duration:** ~30 min
**Sprint:** stripe-3-saved-cards.md

## What Was Done

### Step 1: StripeService Expansion
- Added `getOrCreateCustomer()` — checks Wallet for existing `stripeCustomerId`, creates Stripe Customer if needed, upserts on Wallet
- Added `savePaymentMethod()` — attaches payment method to Stripe Customer
- Added `listPaymentMethods()` — lists saved cards for a customer
- Added `detachPaymentMethod()` — removes a saved card
- Added `createPaymentIntentWithParams()` — creates intent with full params (customer, payment_method, setup_future_usage)

### Step 2: Wallet loadFunds Stripe Wiring
- Added optional `stripePaymentIntentId` param to `WalletService.loadFunds()`
- Stored on WalletTransaction for audit trail

### Step 3: Saved Cards API Endpoints
- `GET /api/v2/checkout/payment-methods` — returns `{ paymentMethods: [{ id, brand, last4, expMonth, expYear }] }`
- `DELETE /api/v2/checkout/payment-methods/:id` — detaches from Stripe Customer
- Updated `POST /api/v2/checkout/create-payment-intent` — now accepts `paymentMethodId`, `saveCard`; creates Stripe Customer for all card payments; sets `setup_future_usage: 'on_session'` when saveCard is true

### Step 4: CheckoutPage Saved Cards UI
- Fetches saved cards on mount when Stripe configured
- Saved cards shown as radio buttons with brand, last4, expiry
- "Use a different card" option shows Stripe Elements
- Delete button (trash icon) on each saved card
- "Save this card for future purchases" checkbox on new card form
- Saved card checkout: creates intent with paymentMethodId, confirms via stripe.confirmCardPayment

### Step 5: Wallet Add Funds Stripe Wiring
- When Stripe configured, Add Funds shows Stripe Elements instead of simulated form
- Separate PaymentIntent created for wallet loads
- Falls back to simulated form when Stripe not configured

### Step 6: Build Gates
- `npx tsc --noEmit` — server: PASS, customer-app: PASS
- `npm run build` (customer-app): PASS

## Files Modified
- `server/src/modules/stripe/service.ts` — 5 new methods
- `server/src/modules/wallet/service.ts` — stripePaymentIntentId param
- `server/src/modules/checkout/router.ts` — enhanced create-payment-intent, new payment-methods endpoints
- `customer-app/src/lib/api.ts` — SavedPaymentMethod type, new API methods
- `customer-app/src/pages/CheckoutPage.tsx` — saved cards UI, wallet Stripe wiring
- `customer-app/src/components/StripeCardForm.tsx` — saveCard prop

## No Migration Needed
`stripeCustomerId` on Wallet and `stripePaymentIntentId` on WalletTransaction already exist in the schema from earlier migrations.

## Status
Stripe integration is now COMPLETE (all 3 phases). Ready for Ted/Julian to configure their Stripe account keys and go live.
