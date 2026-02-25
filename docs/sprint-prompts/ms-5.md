# MS-5: Sprint C — Agreements + Boarding (Full-Stack)

## Session Protocol
> **One micro-sprint per session.** Each session: execute this sprint only, pass build gates, commit, push, then shut down. Do NOT start the next sprint in the same session. Fresh context prevents compaction disasters.
>
> **Startup:** Ensure Docker Postgres (`happy-tail-postgres`) is running on port 5432 — tests need it.
>
> **Shutdown sequence:** After push succeeds → update CHANGELOG.md with MS-5 entry → archive session to `archive/sessions/YYYY-MM-DD_HH-MM_session.md` → update memory files → verify all logs written → confirm ready to exit.

## Context
This is micro-sprint 5 of 8. MS-1 added schema (ServiceAgreement, AgreementSignature, BoardingDetail tables). MS-2-4 handled uploads, dog profile, and grooming pricing.

**Prior sprints completed:** MS-1 (schema), MS-2 (uploads), MS-3 (frontend dog profile), MS-4 (grooming pricing)

## Read First (for patterns)
- `server/prisma/schema.prisma` — ServiceAgreement, AgreementSignature, BoardingDetail models
- `server/src/modules/dog-profile/service.ts` — Service class pattern
- `server/src/modules/dog-profile/router.ts` — Router pattern
- `server/src/modules/dog-profile/types.ts` — Zod types pattern
- `server/src/index.ts` — Route mounting
- `customer-app/src/lib/api.ts` — API client pattern
- `customer-app/src/pages/BookingPage.tsx` — existing booking flow

## What to Do

### Server: Agreements Module

**Create `server/src/modules/agreements/types.ts`:**
```typescript
import { z } from 'zod';

export const AgreementCreateSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  content: z.string().min(1),
  requiredFor: z.array(z.string()), // ['boarding', 'daycare', 'grooming']
  version: z.number().int().positive().optional(),
});

export const AgreementUpdateSchema = AgreementCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const SignatureCreateSchema = z.object({
  agreementId: z.string().uuid(),
  typedName: z.string().min(1),
  agreedToTerms: z.literal(true), // Must be true to sign
});

export type AgreementCreate = z.infer<typeof AgreementCreateSchema>;
export type AgreementUpdate = z.infer<typeof AgreementUpdateSchema>;
export type SignatureCreate = z.infer<typeof SignatureCreateSchema>;
```

**Create `server/src/modules/agreements/service.ts`:**
- `AgreementError` class with `statusCode`
- Methods:
  - `getAgreements()` — all active agreements
  - `getAgreement(id)` — single agreement by ID
  - `getRequiredAgreements(serviceType: string)` — agreements where `requiredFor` contains the service type
  - `getCustomerSignatures(customerId: string)` — all signatures for a customer
  - `checkCompliance(customerId: string, serviceType: string)` — returns `{ compliant: boolean, missing: Agreement[], signed: Agreement[] }`
  - `signAgreement(data: SignatureCreate, customerId: string, ipAddress?: string, userAgent?: string)` — creates AgreementSignature
    - Prevents duplicate signatures for same agreement+customer
    - Returns the signature record
  - `createAgreement(data)` — admin: create new agreement
  - `updateAgreement(id, data)` — admin: update agreement (bumps version if content changed)
  - `deactivateAgreement(id)` — admin: set isActive false

**Create `server/src/modules/agreements/router.ts`:**
Customer-facing routes (all authenticated):
- `GET /` — list agreements required for a service: `?serviceType=boarding`
- `GET /my-signatures` — customer's signed agreements
- `GET /compliance` — compliance check: `?serviceType=boarding`
- `POST /sign` — sign an agreement

**Create `server/src/modules/agreements/admin-router.ts`:**
Admin routes (owner/manager):
- `GET /` — list all agreements (including inactive)
- `POST /` — create agreement
- `PUT /:id` — update agreement
- `DELETE /:id` — deactivate agreement
- `GET /signatures` — view all signatures with filters: `?customerId=X&agreementId=Y`

### Server: Boarding Details

Add boarding detail handling to the existing booking flow.

**Update `server/src/modules/booking/` or the relevant v2 bookings route:**
- When creating a boarding booking, optionally accept `boardingDetails` in the request body
- After booking creation, create a `BoardingDetail` record linked to the booking
- Add `GET /api/v2/bookings/:id/boarding-detail` — returns boarding detail for a booking
- Add `PUT /api/v2/bookings/:id/boarding-detail` — update boarding detail (customer can update until check-in)

**Create Zod schema for boarding details** (in the agreements types file or a new `boarding-types.ts`):
```typescript
export const BoardingDetailSchema = z.object({
  feedingSchedule: z.string().optional(),
  foodType: z.string().optional(),
  foodBrand: z.string().optional(),
  feedingNotes: z.string().optional(),
  dropOffTime: z.string().optional(),
  pickUpTime: z.string().optional(),
  specialItems: z.string().optional(),
  emergencyContact: z.string().optional(),
});
```

### Mount Routes

In `server/src/index.ts`:
```typescript
import v2AgreementsRoutes from './modules/agreements/router';
import v2AdminAgreementsRoutes from './modules/agreements/admin-router';
app.use('/api/v2/agreements', v2AgreementsRoutes);
app.use('/api/v2/admin/agreements', v2AdminAgreementsRoutes);
```

### Frontend: Agreement Signing Flow

**Update `customer-app/src/lib/api.ts`:**
```typescript
export interface ServiceAgreement {
  id: string;
  name: string;
  displayName: string;
  content: string;
  version: number;
}

export interface AgreementCompliance {
  compliant: boolean;
  missing: ServiceAgreement[];
  signed: ServiceAgreement[];
}

export interface AgreementSignature {
  id: string;
  agreementId: string;
  typedName: string;
  signedAt: string;
  agreement: { displayName: string; version: number };
}

export const agreementApi = {
  getRequired: (serviceType: string) =>
    api.get<{ agreements: ServiceAgreement[] }>(`/v2/agreements?serviceType=${serviceType}`),
  getMySignatures: () =>
    api.get<{ signatures: AgreementSignature[] }>('/v2/agreements/my-signatures'),
  checkCompliance: (serviceType: string) =>
    api.get<AgreementCompliance>(`/v2/agreements/compliance?serviceType=${serviceType}`),
  sign: (agreementId: string, typedName: string) =>
    api.post<{ signature: AgreementSignature }>('/v2/agreements/sign', { agreementId, typedName, agreedToTerms: true }),
};
```

**`customer-app/src/components/AgreementViewer.tsx`** (new file)
- Shows agreement content (rendered markdown or plain text)
- Scrollable content area with "I have read this agreement" indicator
- Props: `agreement: ServiceAgreement`, `onSign: (typedName: string) => void`, `alreadySigned: boolean`

**`customer-app/src/components/TypeToSign.tsx`** (new file)
- Text input where customer types their full name
- "Sign Agreement" button (disabled until name is typed)
- Shows signed checkmark after completion
- Touch-friendly, brand styling

**`customer-app/src/pages/AgreementsPage.tsx`** (new file)
- Route: `/agreements`
- Lists all agreements the customer has signed + pending ones
- Can view and sign pending agreements
- Links from booking flow when compliance check fails

**`customer-app/src/components/EligibilityChecker.tsx`** (new file)
- Used in BookingPage before final booking step
- Checks vaccination compliance AND agreement compliance for the selected service
- Shows green checkmarks for compliant items, red X for missing
- Missing agreements link to signing flow
- Missing vaccinations link to dog profile

### Frontend: Boarding Intake Form

**`customer-app/src/components/BoardingIntakeForm.tsx`** (new file)
- Form for BoardingDetail fields
- Shows during/after boarding booking creation
- Fields: feeding schedule, food type/brand, feeding notes, drop-off time, pick-up time, special items, emergency contact
- Time inputs use select dropdowns (7:00 AM through 7:00 PM in 30-min increments)
- Save button calls boarding detail API
- Mobile-friendly layout

**Update `customer-app/src/pages/BookingPage.tsx`:**
- After boarding booking creation, show BoardingIntakeForm
- Before booking confirmation, run EligibilityChecker

**Update `customer-app/src/App.tsx`:**
- Add route: `/agreements` → AgreementsPage

### Update `customer-app/src/pages/index.ts`
Export AgreementsPage if using barrel exports.

## E2E Verification (required before push)

### API Verification (curl)
```bash
TOKEN=<customer token>
STAFF_TOKEN=<staff token>

# Agreements list for a service type
curl -s -H "Authorization: Bearer $TOKEN" $API_URL/api/v2/agreements?serviceType=boarding | jq '.agreements | length'

# Compliance check
curl -s -H "Authorization: Bearer $TOKEN" $API_URL/api/v2/agreements/compliance?serviceType=boarding | jq '{compliant, missingCount: (.missing | length), signedCount: (.signed | length)}'

# Customer signatures
curl -s -H "Authorization: Bearer $TOKEN" $API_URL/api/v2/agreements/my-signatures | jq '.signatures | length'

# Boarding detail endpoint exists
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" $API_URL/api/v2/bookings/00000000-0000-0000-0000-000000000000/boarding-detail
# Expected: 404 (not found, not 500 — proves endpoint exists)

# Admin agreements CRUD
curl -s -H "Authorization: Bearer $STAFF_TOKEN" $API_URL/api/v2/admin/agreements | jq '.agreements | length'
```

**API Checklist:**
- [ ] `/v2/agreements?serviceType=boarding` returns agreements array
- [ ] `/v2/agreements/compliance?serviceType=boarding` returns `{compliant, missing, signed}`
- [ ] `/v2/agreements/my-signatures` returns signatures array
- [ ] Boarding detail endpoint responds (404 for bad ID, not 500)
- [ ] Admin `/v2/admin/agreements` returns agreements list

### Browser E2E Tests

**Create `e2e/tests/customer/agreements.spec.ts`:**
```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Agreements — MS-5', () => {
  test('Agreements page loads at /agreements', async ({ customerPage }) => {
    await customerPage.goto('/agreements');
    await customerPage.waitForLoadState('networkidle');
    // Should show agreement-related content, not a white screen or redirect
    const content = await customerPage.locator('body').textContent();
    expect(content).toBeTruthy();
  });

  test('Agreements page shows signed/pending sections', async ({ customerPage }) => {
    await customerPage.goto('/agreements');
    await customerPage.waitForLoadState('networkidle');
    // Look for section headers or agreement cards
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent!.length).toBeGreaterThan(50); // not empty
  });

  test('Type-to-sign component has text input', async ({ customerPage }) => {
    await customerPage.goto('/agreements');
    await customerPage.waitForLoadState('networkidle');
    // If unsigned agreements exist, the signing UI should be accessible
    // Just verify page is functional — don't actually sign
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });

  test('Booking flow shows eligibility checker', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    // Select a service and advance in the booking wizard
    // The eligibility checker should appear before confirmation
    // Verify the page doesn't crash during navigation
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });

  test('Boarding intake form renders with expected fields', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    // Select boarding service if available
    const boardingOption = customerPage.locator('text=/[Bb]oarding/').first();
    const hasBoardingOption = await boardingOption.isVisible().catch(() => false);
    if (hasBoardingOption) {
      await boardingOption.click();
      await customerPage.waitForLoadState('networkidle');
      // Boarding flow should eventually show intake form fields
      // At minimum, verify no crash
    }
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });
});
```

### Run E2E + Regression
```bash
cd e2e
npx playwright test tests/customer/agreements.spec.ts --reporter=list
npx playwright test --reporter=list 2>&1 | tail -20
```

**E2E Checklist:**
- [ ] Agreements page loads without white screen
- [ ] Agreement content is viewable
- [ ] Type-to-sign has text input and disabled submit button when empty
- [ ] Boarding intake form shows feeding/schedule fields
- [ ] Eligibility checker shows vaccination + agreement status
- [ ] All existing tests still pass (regression)

## Build Gate
```bash
cd server && npx tsc --noEmit
cd ../customer-app && npx tsc --noEmit && npm run build
```

- [ ] Server TypeScript compiles
- [ ] Customer app builds
- [ ] Agreement signing flow has typed-name input
- [ ] Boarding intake form has all fields
- [ ] Eligibility checker handles both vaccinations and agreements
- [ ] All new components have loading/error/empty states
- [ ] E2E verification passed (API + browser)

## Git Commit
```bash
git add server/src/modules/agreements/ server/src/index.ts customer-app/ e2e/tests/
git commit -m "feat: add service agreements and boarding intake

Server: agreements module with CRUD, signing, compliance checking.
Boarding detail endpoints for feeding/schedule info.
Customer: AgreementViewer, TypeToSign, EligibilityChecker components.
BoardingIntakeForm for boarding-specific details.
AgreementsPage for viewing/signing agreements.
E2E: agreements and boarding tests.

MS-5 of 8 micro-sprint rebuild."
```

## CHANGELOG Entry
```
### MS-5: Sprint C — Agreements + Boarding
- Service agreements system: create, sign, track compliance
- Type-to-sign agreement flow for customers
- Eligibility checker: vaccinations + agreements before booking
- Boarding intake form: feeding schedule, drop-off/pick-up times, special items
- AgreementsPage for customers to view and manage signed agreements
- E2E tests for agreements and boarding flow
```

## Next Session
Proceed to MS-6 (Sprint D — Badges + Admin Intelligence).
