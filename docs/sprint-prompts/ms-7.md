# MS-7: E2E Tests for All Sprints

## Context
This is micro-sprint 7 of 8. MS-1 through MS-6 built all features. This sprint adds E2E test coverage.

**Prior sprints completed:** MS-1 (schema), MS-2 (uploads), MS-3 (frontend dog profile), MS-4 (grooming pricing), MS-5 (agreements + boarding), MS-6 (badges + analytics)

## Read First (for patterns)
- `e2e/fixtures/auth.fixture.ts` — test fixture pattern (customerPage, staffPage)
- `e2e/fixtures/test-accounts.ts` — test account credentials
- `e2e/tests/customer/booking.spec.ts` — existing test pattern (NEVER submit real bookings)
- `e2e/tests/customer/dashboard.spec.ts` — dashboard test pattern
- `e2e/tests/admin/dashboard.spec.ts` — admin test pattern
- `e2e/playwright.config.ts` or `e2e/package.json` — Playwright config

## Key Testing Rules
1. **Import pattern:** `import { test, expect } from '../../fixtures/auth.fixture';`
2. **Fixtures:** Use `customerPage` for customer tests, `staffPage` for admin tests
3. **Locators:** Prefer `locator('text="Label"')` for text-based locators
4. **Timeouts:** 15s for network waits, 10s for UI elements
5. **NEVER modify production data** — don't submit bookings, don't delete records, don't sign agreements that can't be rolled back
6. **Read-only tests** — verify pages render, elements exist, navigation works
7. **Describe blocks** — group related tests in `test.describe()`

## What to Do

### Customer Tests

**`e2e/tests/customer/grooming-booking.spec.ts`** (new file)
```typescript
test.describe('Grooming Booking Flow', () => {
  // Test: grooming pricing grid renders with sub-services
  // Test: pricing shows different prices for different dog sizes
  // Test: add-on selector renders available add-ons
  // Test: selecting add-ons updates quote summary
  // Test: quote summary shows base price + add-ons = total
  // Test: navigating back preserves selections
});
```

Tests to write:
- Grooming pricing grid loads and shows sub-services with prices
- Selecting a grooming sub-service shows size-based pricing
- Add-on selector renders with at least one add-on
- Selecting/deselecting add-ons updates the running total
- Quote summary component appears with correct breakdown
- Back navigation preserves grooming selections

**`e2e/tests/customer/agreements.spec.ts`** (new file)
```typescript
test.describe('Agreements', () => {
  // Test: agreements page renders
  // Test: agreement list shows signed and pending
  // Test: agreement content is viewable
  // Test: type-to-sign input exists and validates name
  // Test: eligibility checker shows compliance status
  // Test: boarding intake form renders with all fields
});
```

Tests to write:
- Agreements page loads at `/agreements`
- Shows list of available agreements
- Individual agreement content is viewable (scroll area)
- Type-to-sign component has text input and submit button
- Submit button is disabled when name is empty
- Eligibility checker shows vaccination and agreement status
- Boarding intake form shows all fields (feeding, schedule, emergency)

**`e2e/tests/customer/badges.spec.ts`** (new file)
```typescript
test.describe('Badges', () => {
  // Test: badge grid renders on dashboard or badges page
  // Test: next badge progress bar shows progress
  // Test: earned badges display with icons and dates
  // Test: locked badges shown differently from earned ones
});
```

Tests to write:
- Dashboard shows next badge progress component
- Badge grid renders earned badges
- Each badge shows display name and earned date
- Unearned/locked badges are visually distinct
- Progress bar shows numeric progress (X of Y)

**`e2e/tests/customer/boarding-booking.spec.ts`** (new file)
```typescript
test.describe('Boarding Booking Flow', () => {
  // Test: selecting boarding service shows date range picker
  // Test: boarding intake form appears during flow
  // Test: intake form has feeding schedule, food, emergency fields
  // Test: eligibility checker appears before confirmation
});
```

Tests to write:
- Selecting boarding from service list navigates to date selection
- Boarding flow shows multi-day date range picker (start + end date)
- Boarding intake form renders with all expected fields
- Emergency contact field is present
- Drop-off and pick-up time selectors render

### Admin Tests

**`e2e/tests/admin/grooming-pricing.spec.ts`** (new file)
```typescript
test.describe('Grooming Pricing Management', () => {
  // Test: pricing page renders with service price matrix
  // Test: add-ons section renders
  // Test: price cells are editable (click to edit)
  // Test: add-on toggle active/inactive exists
});
```

Tests to write:
- Admin grooming pricing page loads
- Shows service price matrix with sub-services and sizes
- Price cells can be clicked (input appears)
- Add-ons section lists existing add-ons
- Each add-on has edit and toggle actions
- Create add-on form exists

**`e2e/tests/admin/analytics.spec.ts`** (new file)
```typescript
test.describe('Admin Analytics', () => {
  // Test: dashboard shows revenue snapshot
  // Test: customer segments cards render
  // Test: insights panel renders
  // Test: refresh insights button exists
});
```

Tests to write:
- Admin dashboard shows revenue section (today, week, month)
- Customer segment cards render (New, Active, At-Risk, Churned)
- Insights panel shows at least the section heading
- Refresh/generate insights button is clickable
- Analytics page (if created) loads at its route

### Cross-Module Tests

**`e2e/tests/shared/cross-module-polish.spec.ts`** (update existing or new file)
```typescript
test.describe('Cross-Module Integration', () => {
  // Test: dog profile shows new fields (allergies, emergency vet)
  // Test: dog profile shows photo upload area
  // Test: vaccination section shows upload document option
  // Test: customer navigation includes agreements link
  // Test: admin navigation includes analytics/pricing links
});
```

Tests to write:
- Dog profile page shows extended fields section (allergies, special needs)
- Photo upload area is visible on dog profile
- Vaccination cards have document upload option
- Customer nav includes links to agreements
- Admin nav includes links to grooming pricing and analytics
- All pages handle empty states gracefully (no white screens)
- Loading states appear while data fetches

## Test Structure
Each test file should follow this structure:
```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Feature Name', () => {
  test('descriptive test name', async ({ customerPage }) => {
    await customerPage.goto('/route');
    await customerPage.waitForLoadState('networkidle');

    // Assert element visibility with timeout
    await expect(
      customerPage.locator('text="Expected Text"')
    ).toBeVisible({ timeout: 15_000 });

    // More assertions...
  });
});
```

## Build Gate
```bash
cd e2e && npx playwright test --reporter=list 2>&1 | tail -30
```

- [ ] All new test files parse (no syntax errors)
- [ ] Existing tests still pass (83 baseline tests)
- [ ] New tests pass (targeting ~35-40 new tests)
- [ ] No tests modify production data
- [ ] All tests use auth fixtures correctly

If some tests fail due to features not being seeded in test data, that's acceptable — mark them with `test.skip` and add a `// TODO: needs seed data` comment. The important thing is that the test code is correct and will pass once data exists.

## Git Commit
```bash
git add e2e/tests/
git commit -m "test(e2e): add E2E tests for sprints A-D features

Grooming booking: pricing grid, add-ons, quote summary.
Agreements: signing flow, eligibility, boarding intake.
Badges: grid, progress bar, unlock display.
Admin: pricing management, analytics dashboard.
Cross-module: navigation, empty states, photo upload.

~40 new test cases. MS-7 of 8 micro-sprint rebuild."
```

## CHANGELOG Entry
```
### MS-7: E2E Tests
- Added E2E tests for grooming booking flow with pricing
- Added E2E tests for agreement signing and compliance
- Added E2E tests for badge display and progress
- Added E2E tests for boarding intake form
- Added E2E tests for admin pricing management and analytics
- ~40 new test cases covering sprints A-D features
```

## Next Session
Proceed to MS-8 (Integration verification + deploy).
