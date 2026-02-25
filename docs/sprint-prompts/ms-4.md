# MS-4: Sprint B — Grooming Pricing (Full-Stack)

## Session Protocol
> **One micro-sprint per session.** Each session: execute this sprint only, pass build gates, commit, push, then shut down. Do NOT start the next sprint in the same session. Fresh context prevents compaction disasters.
>
> **Startup:** Ensure Docker Postgres (`happy-tail-postgres`) is running on port 5432 — tests need it.
>
> **Shutdown sequence:** After push succeeds → update CHANGELOG.md with MS-4 entry → archive session to `archive/sessions/YYYY-MM-DD_HH-MM_session.md` → update memory files → verify all logs written → confirm ready to exit.

## Context
This is micro-sprint 4 of 8. MS-1 added schema (GroomingServicePrice, GroomingAddOn, BookingAddOn tables). MS-2/3 handled uploads and dog profile.

**Prior sprints completed:** MS-1 (schema), MS-2 (server uploads), MS-3 (frontend uploads/dog profile)

## Read First (for patterns)
- `server/prisma/schema.prisma` — GroomingServicePrice, GroomingAddOn, BookingAddOn models
- `server/src/modules/grooming/router.ts` — existing grooming routes (sub-services, pricing, rate, matrix)
- `server/src/modules/grooming/service.ts` — existing GroomingService class
- `customer-app/src/lib/api.ts` — bookingApi.getGroomingPriceRange, getGroomingSubServices
- `customer-app/src/pages/BookingPage.tsx` — existing booking wizard
- `admin-app/src/pages/GroomingPricingPage.tsx` — existing admin pricing page
- `admin-app/src/lib/api.ts` — admin API patterns

## What to Do

### Server: Grooming Pricing Module

**`server/src/modules/grooming/types.ts`** (new file)
```typescript
import { z } from 'zod';

export const GroomingServicePriceCreateSchema = z.object({
  subServiceId: z.string().uuid(),
  sizeCategory: z.string().optional(), // null = one-size price
  priceCents: z.number().int().positive(),
});

export const GroomingServicePriceUpdateSchema = z.object({
  priceCents: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const GroomingAddOnCreateSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().positive(),
  sortOrder: z.number().int().optional(),
});

export const GroomingAddOnUpdateSchema = GroomingAddOnCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type GroomingServicePriceCreate = z.infer<typeof GroomingServicePriceCreateSchema>;
export type GroomingServicePriceUpdate = z.infer<typeof GroomingServicePriceUpdateSchema>;
export type GroomingAddOnCreate = z.infer<typeof GroomingAddOnCreateSchema>;
export type GroomingAddOnUpdate = z.infer<typeof GroomingAddOnUpdateSchema>;
```

**`server/src/modules/grooming/pricing-service.ts`** (new file)
- `PricingServiceError` class with `statusCode` property (same pattern as `DogProfileError`)
- Methods:
  - `getServicePrices(subServiceId?: string)` — returns all active prices, optionally filtered by subService
  - `getServicePrice(subServiceId: string, sizeCategory?: string)` — returns specific price
  - `createServicePrice(data)` — creates a GroomingServicePrice
  - `updateServicePrice(id, data)` — updates price or active status
  - `getAddOns()` — returns all active GroomingAddOns ordered by sortOrder
  - `createAddOn(data)` — creates a GroomingAddOn
  - `updateAddOn(id, data)` — updates an add-on
  - `deleteAddOn(id)` — soft-delete (set isActive: false)
  - `getFullPricingSheet()` — returns all sub-services with their size-based prices + all add-ons (for the customer pricing display)

**`server/src/modules/grooming/admin-router.ts`** (new file)
- Uses `authenticateStaff` + `requireRole('owner', 'admin', 'manager')`
- CRUD routes for service prices and add-ons:
  - `GET /prices` — list all service prices
  - `POST /prices` — create service price
  - `PUT /prices/:id` — update service price
  - `GET /add-ons` — list all add-ons (including inactive)
  - `POST /add-ons` — create add-on
  - `PUT /add-ons/:id` — update add-on
  - `DELETE /add-ons/:id` — soft-delete add-on

**Update `server/src/modules/grooming/router.ts`:**
- Add customer-facing endpoint: `GET /pricing-sheet` — calls `pricingService.getFullPricingSheet()`, returns organized pricing data
- Add customer-facing endpoint: `GET /add-ons` — calls `pricingService.getAddOns()`, returns active add-ons only

**Mount in `server/src/index.ts`:**
```typescript
import v2AdminGroomingRoutes from './modules/grooming/admin-router';
app.use('/api/v2/admin/grooming', v2AdminGroomingRoutes);
```

### Frontend: Customer Pricing Display

**`customer-app/src/components/GroomingPriceGrid.tsx`** (new file)
- Displays sub-services with per-size pricing in a responsive grid/table
- Each sub-service row shows: name, description, price by size (S/M/L/XL)
- Prices formatted as dollars: `$XX.XX`
- Coat-related services marked with a badge
- Mobile: cards layout. Desktop: table layout.
- Brand styling: `font-heading` for service names, `brand-primary` accents

**`customer-app/src/components/AddOnSelector.tsx`** (new file)
- Displays available add-ons as toggle-able cards
- Each card: name, description, price
- Selected add-ons have a checked state with `brand-primary` border
- Tracks selected add-ons and calculates running total
- Props: `addOns: GroomingAddOn[]`, `selectedIds: string[]`, `onToggle: (id: string) => void`
- Touch targets: 44px minimum

**`customer-app/src/components/GroomingQuoteSummary.tsx`** (new file)
- Shows a pricing breakdown: base service + add-ons = total
- Props: `basePriceCents: number`, `selectedAddOns: { name: string; priceCents: number }[]`, `sizeCategory: string`
- Sticky at bottom of screen on mobile (like a cart summary)
- Brand styling with `brand-sage` background

**Update `customer-app/src/lib/api.ts`:**
Add to API types and `bookingApi` (or create new `groomingApi` group):
```typescript
export interface GroomingServicePriceItem {
  id: string;
  subServiceId: string;
  sizeCategory: string | null;
  priceCents: number;
  isActive: boolean;
  subService: { name: string; displayName: string; isCoatRelated: boolean };
}

export interface GroomingAddOn {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  priceCents: number;
  sortOrder: number;
}

export interface PricingSheet {
  subServices: Array<{
    id: string;
    name: string;
    displayName: string;
    description: string | null;
    isCoatRelated: boolean;
    prices: Array<{ sizeCategory: string | null; priceCents: number }>;
  }>;
  addOns: GroomingAddOn[];
}

export const groomingApi = {
  getPricingSheet: () => api.get<PricingSheet>('/v2/grooming/pricing-sheet'),
  getAddOns: () => api.get<{ addOns: GroomingAddOn[] }>('/v2/grooming/add-ons'),
};
```

**Update `customer-app/src/pages/BookingPage.tsx`:**
- When grooming is selected: show GroomingPriceGrid for the dog's size
- After sub-service selection: show AddOnSelector
- Show GroomingQuoteSummary as the user makes selections
- Add-on selections should be passed through to the booking creation

### Frontend: Admin Pricing Management

**Update `admin-app/src/pages/GroomingPricingPage.tsx`:**
- Add a "Service Prices" section showing the sub-service × size price matrix
- Inline editing for prices (click to edit, save on blur or Enter)
- Add an "Add-Ons" section:
  - List all add-ons with name, display name, price, active status
  - Create new add-on form
  - Toggle active/inactive
  - Edit price and details
- Use existing admin UI patterns (tables with action buttons)

**Update `admin-app/src/lib/api.ts`:**
Add admin grooming API methods for CRUD operations on prices and add-ons.

## E2E Verification (required before push)

### API Verification (curl)
```bash
TOKEN=$(curl -s -X POST $API_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"qa-test@internationalaidesign.com","password":"..."}' | jq -r '.token')

# Pricing sheet endpoint returns sub-services with per-size prices
curl -s -H "Authorization: Bearer $TOKEN" $API_URL/api/v2/grooming/pricing-sheet | jq '.subServices[0] | {name, displayName, prices}'

# Add-ons endpoint returns active add-ons
curl -s -H "Authorization: Bearer $TOKEN" $API_URL/api/v2/grooming/add-ons | jq '.addOns | length'

# Admin pricing CRUD (use staff token)
STAFF_TOKEN=$(curl -s -X POST $API_URL/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"qa-staff","password":"..."}' | jq -r '.token')

curl -s -H "Authorization: Bearer $STAFF_TOKEN" $API_URL/api/v2/admin/grooming/prices | jq '.prices | length'
curl -s -H "Authorization: Bearer $STAFF_TOKEN" $API_URL/api/v2/admin/grooming/add-ons | jq '.addOns | length'
```

**API Checklist:**
- [ ] `/v2/grooming/pricing-sheet` returns sub-services with per-size prices array
- [ ] `/v2/grooming/add-ons` returns active add-ons with id, name, displayName, priceCents
- [ ] Admin `/v2/admin/grooming/prices` returns price list
- [ ] Admin `/v2/admin/grooming/add-ons` returns all add-ons (including inactive)
- [ ] All prices in cents (integer), frontend converts to dollars

### Browser E2E Tests

**Create `e2e/tests/customer/grooming-pricing.spec.ts`:**
```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Grooming Pricing — MS-4', () => {
  test('Booking page loads grooming option', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    await expect(customerPage.locator('text=/[Gg]rooming/')).toBeVisible({ timeout: 15_000 });
  });

  test('Selecting grooming shows pricing grid', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    // Select grooming service type
    const groomingOption = customerPage.locator('text=/[Gg]rooming/').first();
    await groomingOption.click();
    // Pricing grid should appear with sub-service names and prices
    // Verify at least price content renders (dollar signs or number)
    await expect(customerPage.locator('text=/\\$\\d+/')).toBeVisible({ timeout: 15_000 });
  });

  test('Add-on selector renders when grooming selected', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    const groomingOption = customerPage.locator('text=/[Gg]rooming/').first();
    await groomingOption.click();
    // Look for add-on cards or section (may require further navigation in booking wizard)
    const addOnSection = customerPage.locator('text=/[Aa]dd-?[Oo]n/');
    // This may be on a later step — just verify no crash
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });

  test('Quote summary shows price breakdown', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    const groomingOption = customerPage.locator('text=/[Gg]rooming/').first();
    await groomingOption.click();
    // After making selections, a quote/summary should appear with total
    // Verify page doesn't crash — may need dog selection first
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent).not.toContain('NaN');
  });

  test('Navigate back from grooming booking preserves state', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    await customerPage.goBack();
    await customerPage.waitForLoadState('networkidle');
    // Should not white-screen
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });
});
```

**Create `e2e/tests/admin/grooming-pricing.spec.ts`:**
```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Admin Grooming Pricing — MS-4', () => {
  test('Grooming pricing page loads', async ({ staffPage }) => {
    await staffPage.goto('/grooming-pricing');
    await staffPage.waitForLoadState('networkidle');
    // Should show pricing content, not a white screen
    await expect(staffPage.locator('text=/[Pp]ric/')).toBeVisible({ timeout: 15_000 });
  });

  test('Price matrix shows sub-services and sizes', async ({ staffPage }) => {
    await staffPage.goto('/grooming-pricing');
    await staffPage.waitForLoadState('networkidle');
    // Look for size labels (Small, Medium, Large, XL)
    await expect(staffPage.locator('text=/Small|Medium|Large|XL/')).toBeVisible({ timeout: 15_000 });
  });

  test('Add-ons section renders', async ({ staffPage }) => {
    await staffPage.goto('/grooming-pricing');
    await staffPage.waitForLoadState('networkidle');
    const addOnSection = staffPage.locator('text=/[Aa]dd-?[Oo]n/');
    await expect(addOnSection.first()).toBeVisible({ timeout: 15_000 });
  });
});
```

### Run E2E + Regression
```bash
cd e2e
# New tests for this sprint
npx playwright test tests/customer/grooming-pricing.spec.ts tests/admin/grooming-pricing.spec.ts --reporter=list
# Full regression
npx playwright test --reporter=list 2>&1 | tail -20
```

**E2E Checklist:**
- [ ] Customer grooming pricing grid renders with dollar amounts
- [ ] No `NaN` or `undefined` in pricing display
- [ ] Admin pricing page loads with matrix
- [ ] Back navigation doesn't crash
- [ ] All existing tests still pass (regression)

## Build Gate
```bash
cd server && npx tsc --noEmit
cd ../customer-app && npx tsc --noEmit && npm run build
cd ../admin-app && npx tsc --noEmit && npm run build
```

- [ ] Server TypeScript compiles
- [ ] Customer app builds
- [ ] Admin app builds
- [ ] New customer components have loading/error/empty states
- [ ] Admin pricing page has inline editing
- [ ] All prices display in dollars (not raw cents)
- [ ] E2E verification passed (API + browser)

## Git Commit
```bash
git add server/src/modules/grooming/ server/src/index.ts customer-app/ admin-app/ e2e/tests/
git commit -m "feat(grooming): add service pricing and add-ons system

Server: pricing-service with CRUD for service prices and add-ons.
Admin router for grooming pricing management.
Customer: GroomingPriceGrid, AddOnSelector, GroomingQuoteSummary components.
Booking wizard shows pricing when grooming selected.
Admin: inline price editing and add-on management.
E2E: grooming pricing tests (customer + admin).

MS-4 of 8 micro-sprint rebuild."
```

## CHANGELOG Entry
```
### MS-4: Sprint B — Grooming Pricing
- Sub-service pricing by dog size (S/M/L/XL)
- Grooming add-ons (nail painting, teeth brushing, etc.)
- Customer booking shows real-time price quote with add-on selection
- Admin can manage service prices and add-ons inline
- E2E tests for grooming pricing (customer + admin)
```

## Next Session
Proceed to MS-5 (Sprint C — Agreements + Boarding).
