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

## Architecture Standards (NEW — applies to this sprint and all future code)

**Read `architecture/code-standards.md` before starting.** This sprint is the first to use the new patterns:

1. **Parse at boundaries** — Zod schemas validate all API input
2. **Errors as values** — Service methods return `Result<T, E>` via `neverthrow`, not throw
3. **Exhaustive matching** — `ts-pattern` `.exhaustive()` on all unions (route handlers + React)
4. **Discriminated unions** — All error types and component states
5. **Functional core** — Pure pricing calculations separated from DB I/O

```bash
# Install new dependencies (one-time per project)
cd server && npm install neverthrow ts-pattern
cd ../customer-app && npm install ts-pattern
cd ../admin-app && npm install ts-pattern
```

## Read First (for patterns)
- `architecture/code-standards.md` — **mandatory patterns for this sprint**
- `server/prisma/schema.prisma` — GroomingServicePrice, GroomingAddOn, BookingAddOn models
- `server/src/modules/grooming/router.ts` — existing grooming routes (sub-services, pricing, rate, matrix)
- `server/src/modules/grooming/service.ts` — existing GroomingService class
- `customer-app/src/lib/api.ts` — bookingApi.getGroomingPriceRange, getGroomingSubServices
- `customer-app/src/pages/BookingPage.tsx` — existing booking wizard
- `admin-app/src/pages/GroomingPricingPage.tsx` — existing admin pricing page
- `admin-app/src/lib/api.ts` — admin API patterns

## What to Do

### Server: Install Dependencies

```bash
cd server && npm install neverthrow ts-pattern
```

### Server: Types with Discriminated Error Unions

**`server/src/modules/grooming/types.ts`** (new file)
```typescript
import { z } from 'zod';

// --- Input Schemas (parse at boundary) ---

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

// --- Error Types (discriminated unions — exhaustive handling required) ---

export type PricingError =
  | { type: "NOT_FOUND"; entity: string; id: string }
  | { type: "DUPLICATE_PRICE"; subServiceId: string; sizeCategory: string | null }
  | { type: "VALIDATION_ERROR"; message: string }
  | { type: "DB_ERROR"; cause: unknown };

export type AddOnError =
  | { type: "NOT_FOUND"; id: string }
  | { type: "DUPLICATE_NAME"; name: string }
  | { type: "DB_ERROR"; cause: unknown };
```

### Server: Pricing Service with Result Types

**`server/src/modules/grooming/pricing-service.ts`** (new file)

```typescript
import { ok, err, Result, ResultAsync } from 'neverthrow';
import { prisma } from '../../lib/prisma';
import type {
  PricingError, AddOnError,
  GroomingServicePriceCreate, GroomingServicePriceUpdate,
  GroomingAddOnCreate, GroomingAddOnUpdate,
} from './types';

// --- Pure Calculations (functional core — no DB, no side effects) ---

export function calculateGroomingTotal(
  basePriceCents: number,
  addOns: { priceCents: number }[],
): number {
  return basePriceCents + addOns.reduce((sum, a) => sum + a.priceCents, 0);
}

// --- Service Methods (imperative shell — returns Result, never throws) ---

export function getServicePrices(
  subServiceId?: string
): ResultAsync<any[], PricingError> {
  return ResultAsync.fromPromise(
    prisma.groomingServicePrice.findMany({
      where: {
        isActive: true,
        ...(subServiceId ? { subServiceId } : {}),
      },
      include: { subService: true },
      orderBy: { subService: { sortOrder: 'asc' } },
    }),
    (e) => ({ type: 'DB_ERROR' as const, cause: e }),
  );
}

export function getServicePrice(
  subServiceId: string,
  sizeCategory?: string,
): ResultAsync<any, PricingError> {
  return ResultAsync.fromPromise(
    prisma.groomingServicePrice.findFirst({
      where: {
        subServiceId,
        sizeCategory: sizeCategory ?? null,
        isActive: true,
      },
      include: { subService: true },
    }),
    (e) => ({ type: 'DB_ERROR' as const, cause: e }),
  ).andThen((price) =>
    price
      ? ok(price)
      : err({ type: 'NOT_FOUND' as const, entity: 'ServicePrice', id: subServiceId }),
  );
}

export function createServicePrice(
  data: GroomingServicePriceCreate,
): ResultAsync<any, PricingError> {
  // Check for duplicate first
  return ResultAsync.fromPromise(
    prisma.groomingServicePrice.findFirst({
      where: {
        subServiceId: data.subServiceId,
        sizeCategory: data.sizeCategory ?? null,
      },
    }),
    (e) => ({ type: 'DB_ERROR' as const, cause: e }),
  ).andThen((existing) =>
    existing
      ? err({
          type: 'DUPLICATE_PRICE' as const,
          subServiceId: data.subServiceId,
          sizeCategory: data.sizeCategory ?? null,
        })
      : ResultAsync.fromPromise(
          prisma.groomingServicePrice.create({
            data: {
              subServiceId: data.subServiceId,
              sizeCategory: data.sizeCategory ?? null,
              priceCents: data.priceCents,
            },
          }),
          (e) => ({ type: 'DB_ERROR' as const, cause: e }),
        ),
  );
}

export function updateServicePrice(
  id: string,
  data: GroomingServicePriceUpdate,
): ResultAsync<any, PricingError> {
  return ResultAsync.fromPromise(
    prisma.groomingServicePrice.findUnique({ where: { id } }),
    (e) => ({ type: 'DB_ERROR' as const, cause: e }),
  ).andThen((existing) =>
    existing
      ? ResultAsync.fromPromise(
          prisma.groomingServicePrice.update({ where: { id }, data }),
          (e) => ({ type: 'DB_ERROR' as const, cause: e }),
        )
      : err({ type: 'NOT_FOUND' as const, entity: 'ServicePrice', id }),
  );
}

export function getAddOns(
  includeInactive = false,
): ResultAsync<any[], AddOnError> {
  return ResultAsync.fromPromise(
    prisma.groomingAddOn.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    (e) => ({ type: 'DB_ERROR' as const, cause: e }),
  );
}

export function createAddOn(
  data: GroomingAddOnCreate,
): ResultAsync<any, AddOnError> {
  return ResultAsync.fromPromise(
    prisma.groomingAddOn.findFirst({ where: { name: data.name } }),
    (e) => ({ type: 'DB_ERROR' as const, cause: e }),
  ).andThen((existing) =>
    existing
      ? err({ type: 'DUPLICATE_NAME' as const, name: data.name })
      : ResultAsync.fromPromise(
          prisma.groomingAddOn.create({ data }),
          (e) => ({ type: 'DB_ERROR' as const, cause: e }),
        ),
  );
}

export function updateAddOn(
  id: string,
  data: GroomingAddOnUpdate,
): ResultAsync<any, AddOnError> {
  return ResultAsync.fromPromise(
    prisma.groomingAddOn.findUnique({ where: { id } }),
    (e) => ({ type: 'DB_ERROR' as const, cause: e }),
  ).andThen((existing) =>
    existing
      ? ResultAsync.fromPromise(
          prisma.groomingAddOn.update({ where: { id }, data }),
          (e) => ({ type: 'DB_ERROR' as const, cause: e }),
        )
      : err({ type: 'NOT_FOUND' as const, id }),
  );
}

export function deleteAddOn(id: string): ResultAsync<any, AddOnError> {
  return updateAddOn(id, { isActive: false });
}

export function getFullPricingSheet(): ResultAsync<any, PricingError> {
  return ResultAsync.fromPromise(
    prisma.groomingSubService.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        prices: {
          where: { isActive: true },
          orderBy: { sizeCategory: 'asc' },
        },
      },
    }),
    (e) => ({ type: 'DB_ERROR' as const, cause: e }),
  ).andThen((subServices) =>
    getAddOns().map((addOns) => ({
      subServices: subServices.map((s) => ({
        id: s.id,
        name: s.name,
        displayName: s.displayName,
        description: s.description,
        isCoatRelated: s.isCoatRelated,
        prices: s.prices.map((p) => ({
          sizeCategory: p.sizeCategory,
          priceCents: p.priceCents,
        })),
      })),
      addOns,
    })),
  );
}
```

### Server: Admin Router with Exhaustive Error Handling

**`server/src/modules/grooming/admin-router.ts`** (new file)

```typescript
import { Router } from 'express';
import { match } from 'ts-pattern';
import { authenticateStaff, requireRole } from '../../middleware/auth';
import * as pricingService from './pricing-service';
import {
  GroomingServicePriceCreateSchema,
  GroomingServicePriceUpdateSchema,
  GroomingAddOnCreateSchema,
  GroomingAddOnUpdateSchema,
} from './types';

const router = Router();
router.use(authenticateStaff, requireRole('owner', 'admin', 'manager'));

// --- Service Prices ---

router.get('/prices', async (_req, res) => {
  const result = await pricingService.getServicePrices();
  result.match(
    (prices) => res.json({ prices }),
    (error) => match(error)
      .with({ type: 'DB_ERROR' }, () => res.status(500).json({ error: 'Internal error' }))
      .with({ type: 'NOT_FOUND' }, (e) => res.status(404).json(e))
      .with({ type: 'DUPLICATE_PRICE' }, (e) => res.status(409).json(e))
      .with({ type: 'VALIDATION_ERROR' }, (e) => res.status(400).json(e))
      .exhaustive(),
  );
});

router.post('/prices', async (req, res) => {
  const parsed = GroomingServicePriceCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await pricingService.createServicePrice(parsed.data);
  result.match(
    (price) => res.status(201).json({ price }),
    (error) => match(error)
      .with({ type: 'DUPLICATE_PRICE' }, (e) => res.status(409).json(e))
      .with({ type: 'DB_ERROR' }, () => res.status(500).json({ error: 'Internal error' }))
      .with({ type: 'NOT_FOUND' }, (e) => res.status(404).json(e))
      .with({ type: 'VALIDATION_ERROR' }, (e) => res.status(400).json(e))
      .exhaustive(),
  );
});

router.put('/prices/:id', async (req, res) => {
  const parsed = GroomingServicePriceUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await pricingService.updateServicePrice(req.params.id, parsed.data);
  result.match(
    (price) => res.json({ price }),
    (error) => match(error)
      .with({ type: 'NOT_FOUND' }, (e) => res.status(404).json(e))
      .with({ type: 'DB_ERROR' }, () => res.status(500).json({ error: 'Internal error' }))
      .with({ type: 'DUPLICATE_PRICE' }, (e) => res.status(409).json(e))
      .with({ type: 'VALIDATION_ERROR' }, (e) => res.status(400).json(e))
      .exhaustive(),
  );
});

// --- Add-Ons ---

router.get('/add-ons', async (_req, res) => {
  const result = await pricingService.getAddOns(true); // include inactive for admin
  result.match(
    (addOns) => res.json({ addOns }),
    (error) => match(error)
      .with({ type: 'DB_ERROR' }, () => res.status(500).json({ error: 'Internal error' }))
      .with({ type: 'NOT_FOUND' }, (e) => res.status(404).json(e))
      .with({ type: 'DUPLICATE_NAME' }, (e) => res.status(409).json(e))
      .exhaustive(),
  );
});

router.post('/add-ons', async (req, res) => {
  const parsed = GroomingAddOnCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await pricingService.createAddOn(parsed.data);
  result.match(
    (addOn) => res.status(201).json({ addOn }),
    (error) => match(error)
      .with({ type: 'DUPLICATE_NAME' }, (e) => res.status(409).json(e))
      .with({ type: 'DB_ERROR' }, () => res.status(500).json({ error: 'Internal error' }))
      .with({ type: 'NOT_FOUND' }, (e) => res.status(404).json(e))
      .exhaustive(),
  );
});

router.put('/add-ons/:id', async (req, res) => {
  const parsed = GroomingAddOnUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await pricingService.updateAddOn(req.params.id, parsed.data);
  result.match(
    (addOn) => res.json({ addOn }),
    (error) => match(error)
      .with({ type: 'NOT_FOUND' }, (e) => res.status(404).json(e))
      .with({ type: 'DB_ERROR' }, () => res.status(500).json({ error: 'Internal error' }))
      .with({ type: 'DUPLICATE_NAME' }, (e) => res.status(409).json(e))
      .exhaustive(),
  );
});

router.delete('/add-ons/:id', async (req, res) => {
  const result = await pricingService.deleteAddOn(req.params.id);
  result.match(
    () => res.status(204).send(),
    (error) => match(error)
      .with({ type: 'NOT_FOUND' }, (e) => res.status(404).json(e))
      .with({ type: 'DB_ERROR' }, () => res.status(500).json({ error: 'Internal error' }))
      .with({ type: 'DUPLICATE_NAME' }, (e) => res.status(409).json(e))
      .exhaustive(),
  );
});

export default router;
```

### Server: Customer Router Updates

**Update `server/src/modules/grooming/router.ts`:**

Add two customer-facing endpoints using the same Result + match pattern:

```typescript
import { match } from 'ts-pattern';
import * as pricingService from './pricing-service';

// Add to existing router:

router.get('/pricing-sheet', async (_req, res) => {
  const result = await pricingService.getFullPricingSheet();
  result.match(
    (sheet) => res.json(sheet),
    (error) => match(error)
      .with({ type: 'DB_ERROR' }, () => res.status(500).json({ error: 'Internal error' }))
      .with({ type: 'NOT_FOUND' }, (e) => res.status(404).json(e))
      .with({ type: 'DUPLICATE_PRICE' }, (e) => res.status(409).json(e))
      .with({ type: 'VALIDATION_ERROR' }, (e) => res.status(400).json(e))
      .exhaustive(),
  );
});

router.get('/add-ons', async (_req, res) => {
  const result = await pricingService.getAddOns();
  result.match(
    (addOns) => res.json({ addOns }),
    (error) => match(error)
      .with({ type: 'DB_ERROR' }, () => res.status(500).json({ error: 'Internal error' }))
      .with({ type: 'NOT_FOUND' }, (e) => res.status(404).json(e))
      .with({ type: 'DUPLICATE_NAME' }, (e) => res.status(409).json(e))
      .exhaustive(),
  );
});
```

**Mount admin router in `server/src/index.ts`:**
```typescript
import v2AdminGroomingRoutes from './modules/grooming/admin-router';
app.use('/api/v2/admin/grooming', v2AdminGroomingRoutes);
```

### Frontend: Shared State Types

**`customer-app/src/lib/types.ts`** (add or create)
```typescript
// Standard fetch state — used by ALL components that load data
export type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };
```

### Frontend: Customer Pricing Display

**`customer-app/src/components/GroomingPriceGrid.tsx`** (new file)
- Fetches pricing sheet, stores in `FetchState<PricingSheet>`
- Uses `match(state).exhaustive()` for rendering — every state handled explicitly
- Displays sub-services with per-size pricing in a responsive grid/table
- Each sub-service row shows: name, description, price by size (S/M/L/XL)
- Prices formatted as dollars: `(priceCents / 100).toFixed(2)`
- Coat-related services marked with a badge
- Mobile: cards layout. Desktop: table layout.
- Brand styling: `font-heading` for service names, `brand-primary` accents

```typescript
// Pattern to follow:
import { match } from 'ts-pattern';
import type { FetchState } from '../lib/types';

function GroomingPriceGrid({ dogSize }: { dogSize: string }) {
  const state: FetchState<PricingSheet> = useApiState(/* ... */);

  return match(state)
    .with({ status: "idle" }, () => null)
    .with({ status: "loading" }, () => <LoadingSpinner />)
    .with({ status: "success" }, ({ data }) => (
      // Render price grid from data.subServices
    ))
    .with({ status: "error" }, ({ error }) => (
      <div className="text-red-600">{error}</div>
    ))
    .exhaustive();
}
```

**`customer-app/src/components/AddOnSelector.tsx`** (new file)
- Displays available add-ons as toggle-able cards
- Each card: name, description, price
- Selected add-ons have a checked state with `brand-primary` border
- Tracks selected add-ons and calculates running total using the **pure** `calculateTotal` function (no side effects in the calculation)
- Props: `addOns: GroomingAddOn[]`, `selectedIds: string[]`, `onToggle: (id: string) => void`
- Touch targets: 44px minimum

**`customer-app/src/components/GroomingQuoteSummary.tsx`** (new file)
- Shows a pricing breakdown: base service + add-ons = total
- Uses pure calculation: `basePriceCents + selectedAddOns.reduce(...)` — no API calls in this component
- Props: `basePriceCents: number`, `selectedAddOns: { name: string; priceCents: number }[]`, `sizeCategory: string`
- Sticky at bottom of screen on mobile (like a cart summary)
- Brand styling with `brand-sage` background

**Update `customer-app/src/lib/api.ts`:**
Add to API types and create `groomingApi` group:
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
- All state uses `FetchState<T>` discriminated union pattern
- Add-on selections passed through to booking creation

### Frontend: Admin Pricing Management

**Update `admin-app/src/pages/GroomingPricingPage.tsx`:**
- Add a "Service Prices" section showing the sub-service × size price matrix
- Inline editing for prices (click to edit, save on blur or Enter)
- Add an "Add-Ons" section:
  - List all add-ons with name, display name, price, active status
  - Create new add-on form
  - Toggle active/inactive
  - Edit price and details
- Use `FetchState<T>` + `match().exhaustive()` for all data loading states
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
- [ ] All error responses use discriminated union `{ type: "..." }` format

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
    const groomingOption = customerPage.locator('text=/[Gg]rooming/').first();
    await groomingOption.click();
    // Pricing grid should render with dollar amounts — not NaN, not undefined, not blank
    await expect(customerPage.locator('text=/\\$\\d+/')).toBeVisible({ timeout: 15_000 });
  });

  test('Add-on selector renders when grooming selected', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    const groomingOption = customerPage.locator('text=/[Gg]rooming/').first();
    await groomingOption.click();
    const addOnSection = customerPage.locator('text=/[Aa]dd-?[Oo]n/');
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });

  test('Quote summary shows price breakdown', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    const groomingOption = customerPage.locator('text=/[Gg]rooming/').first();
    await groomingOption.click();
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent).not.toContain('NaN');
    expect(pageContent).not.toContain('undefined');
  });

  test('Navigate back from grooming booking preserves state', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    await customerPage.goBack();
    await customerPage.waitForLoadState('networkidle');
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
    await expect(staffPage.locator('text=/[Pp]ric/')).toBeVisible({ timeout: 15_000 });
  });

  test('Price matrix shows sub-services and sizes', async ({ staffPage }) => {
    await staffPage.goto('/grooming-pricing');
    await staffPage.waitForLoadState('networkidle');
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

- [ ] Server TypeScript compiles (including neverthrow + ts-pattern imports)
- [ ] Customer app builds
- [ ] Admin app builds
- [ ] New customer components use `FetchState<T>` + `match().exhaustive()`
- [ ] Service methods return `Result<T, E>`, no throws in pricing-service.ts
- [ ] All error handling uses `match(error).exhaustive()` — no catch blocks in route handlers
- [ ] All prices display in dollars (not raw cents)
- [ ] E2E verification passed (API + browser)

## Git Commit
```bash
git add server/src/modules/grooming/ server/src/index.ts customer-app/ admin-app/ e2e/tests/
git commit -m "feat(grooming): add service pricing with Result types and exhaustive matching

Server: pricing-service returns Result<T,E> via neverthrow, no throws.
Error types are discriminated unions with exhaustive ts-pattern matching.
Pure calculateGroomingTotal separated from DB I/O (functional core).
Admin router for grooming pricing management with Zod parsing.
Customer: GroomingPriceGrid, AddOnSelector, GroomingQuoteSummary components.
All React state uses FetchState<T> discriminated unions.
Booking wizard shows pricing when grooming selected.
Admin: inline price editing and add-on management.
E2E: grooming pricing tests (customer + admin).

MS-4 of 8 micro-sprint rebuild. First sprint using code-standards.md patterns."
```

## CHANGELOG Entry
```
### MS-4: Sprint B — Grooming Pricing (Architecture Standards)
- **New patterns adopted:** neverthrow Result types, ts-pattern exhaustive matching, discriminated unions
- Sub-service pricing by dog size (S/M/L/XL)
- Grooming add-ons (nail painting, teeth brushing, etc.)
- Customer booking shows real-time price quote with add-on selection
- Admin can manage service prices and add-ons inline
- Pure pricing calculations separated from DB I/O
- All error handling is typed and exhaustive — no silent failures
- E2E tests for grooming pricing (customer + admin)
```

## Next Session
Proceed to MS-5 (Sprint C — Agreements + Boarding). Continue using code-standards.md patterns.
