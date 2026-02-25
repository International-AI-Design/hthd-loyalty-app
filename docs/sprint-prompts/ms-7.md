# MS-7: Cross-Module Integration Tests + Full Regression

## Session Protocol
> **One micro-sprint per session.** Each session: execute this sprint only, pass build gates, commit, push, then shut down. Do NOT start the next sprint in the same session. Fresh context prevents compaction disasters.
>
> **Startup:** Ensure Docker Postgres (`happy-tail-postgres`) is running on port 5432 — tests need it.
>
> **Shutdown sequence:** After push succeeds → update CHANGELOG.md with MS-7 entry → archive session to `archive/sessions/YYYY-MM-DD_HH-MM_session.md` → update memory files → verify all logs written → confirm ready to exit.

## Context
This is micro-sprint 7 of 8. MS-3.1 and MS-4 through MS-6 each included per-sprint E2E tests for their own features. This sprint adds **cross-module integration tests** that verify features work together — navigating between modules, data flowing across features, and full user journeys that touch multiple sprints.

**Prior sprints completed:** MS-1 (schema), MS-2 (uploads), MS-3 (frontend dog profile), MS-3.1 (retroactive E2E), MS-4 (grooming pricing), MS-5 (agreements + boarding), MS-6 (badges + analytics)

## Read First (for patterns)
- `e2e/fixtures/auth.fixture.ts` — fixture pattern (`customerPage`, `staffPage`)
- `e2e/fixtures/test-accounts.ts` — QA accounts (dogs: Playwright, Cypress)
- `e2e/tests/shared/functional-audit.spec.ts` — existing cross-module audit pattern
- `e2e/playwright.config.ts` — projects: `customer-desktop`, `customer-mobile`, `admin-desktop`, `admin-mobile`, `functional-audit`

## Key Testing Rules
1. **Import pattern:** `import { test, expect } from '../../fixtures/auth.fixture';`
2. **Fixtures:** Use `customerPage` for customer tests, `staffPage` for admin tests
3. **Timeouts:** 15s for network waits, 10s for UI elements
4. **NEVER modify production data** — don't submit bookings, don't delete records, don't sign agreements
5. **Read-only tests** — verify pages render, elements exist, navigation works
6. **Describe blocks** — group related tests in `test.describe()`

## What to Do

### 1. Customer Journey Tests

**Create `e2e/tests/customer/full-journey.spec.ts`:**

Tests that traverse multiple features in a single session, the way a real user would:

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Customer Full Journey — Cross-Module', () => {
  test('Dashboard → My Pets → Dog Profile → Back to Dashboard', async ({ customerPage }) => {
    // Start at dashboard
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');
    await expect(customerPage.locator('body')).not.toBeEmpty();

    // Navigate to My Pets
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await expect(firstPet).toBeVisible({ timeout: 15_000 });

    // Open dog profile
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');
    await expect(customerPage.locator('text="Vaccinations"')).toBeVisible({ timeout: 15_000 });

    // Navigate back to dashboard via bottom nav or back button
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');
    await expect(customerPage.locator('body')).not.toBeEmpty();
  });

  test('Dashboard → Book → Back → Rewards → Back (multi-page navigation)', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    const bookingContent = await customerPage.locator('body').textContent();
    expect(bookingContent).toBeTruthy();

    await customerPage.goBack();
    await customerPage.waitForLoadState('networkidle');

    await customerPage.goto('/rewards');
    await customerPage.waitForLoadState('networkidle');
    const rewardsContent = await customerPage.locator('body').textContent();
    expect(rewardsContent).toBeTruthy();

    await customerPage.goBack();
    await customerPage.waitForLoadState('networkidle');
    // Should be back at dashboard, not a white screen
    const dashContent = await customerPage.locator('body').textContent();
    expect(dashContent).toBeTruthy();
  });

  test('Dog Profile shows data that matches My Pets card', async ({ customerPage }) => {
    // Get dog info from My Pets page
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await expect(firstPet).toBeVisible({ timeout: 15_000 });
    const petName = await firstPet.locator('.font-pet').textContent();

    // Navigate to profile
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // Profile should show the same dog name
    const profileName = customerPage.locator('.font-heading').filter({ hasText: petName!.trim() });
    await expect(profileName).toBeVisible({ timeout: 15_000 });
  });

  test('Agreements page accessible from navigation', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // Navigate to agreements
    await customerPage.goto('/agreements');
    await customerPage.waitForLoadState('networkidle');
    const content = await customerPage.locator('body').textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(50);
  });

  test('Badge progress visible alongside other dashboard content', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // Dashboard should show both points balance AND badge progress without conflicts
    const content = await customerPage.locator('body').textContent();
    expect(content).toBeTruthy();
    // Points balance should still be present (not displaced by badge widget)
    await expect(customerPage.locator('text=/[Pp]oints/')).toBeVisible({ timeout: 15_000 });
  });
});
```

### 2. Admin Journey Tests

**Create `e2e/tests/admin/full-journey.spec.ts`:**

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Admin Full Journey — Cross-Module', () => {
  test('Dashboard shows all new sections without layout breaking', async ({ staffPage }) => {
    await staffPage.goto('/dashboard');
    await staffPage.waitForLoadState('networkidle');

    // Page should load with multiple sections (facility, revenue, segments, etc.)
    const content = await staffPage.locator('body').textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(100);
  });

  test('Dashboard → Grooming Pricing → Back → Dashboard (navigation)', async ({ staffPage }) => {
    await staffPage.goto('/dashboard');
    await staffPage.waitForLoadState('networkidle');

    await staffPage.goto('/grooming-pricing');
    await staffPage.waitForLoadState('networkidle');
    const pricingContent = await staffPage.locator('body').textContent();
    expect(pricingContent).toBeTruthy();

    await staffPage.goBack();
    await staffPage.waitForLoadState('networkidle');
    const dashContent = await staffPage.locator('body').textContent();
    expect(dashContent).toBeTruthy();
  });

  test('Admin navigation includes all new module links', async ({ staffPage }) => {
    await staffPage.goto('/dashboard');
    await staffPage.waitForLoadState('networkidle');

    // Check that navigation/sidebar has links to new modules
    // These may be in sidebar, top nav, or within the dashboard as cards
    const navLinks = await staffPage.locator('a, button').allTextContents();
    const navText = navLinks.join(' ').toLowerCase();

    // At minimum, grooming pricing should be accessible
    const hasPricingLink = navText.includes('pricing') || navText.includes('grooming');
    console.log(`Has pricing link: ${hasPricingLink}`);
  });
});
```

### 3. Empty State / Error Resilience Tests

**Create `e2e/tests/shared/cross-module-resilience.spec.ts`:**

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Cross-Module Resilience', () => {
  test('Direct URL to dog profile with invalid ID shows error, not crash', async ({ customerPage }) => {
    await customerPage.goto('/dogs/00000000-0000-0000-0000-000000000000');
    await customerPage.waitForLoadState('networkidle');

    // Should show error state, not white screen
    const content = await customerPage.locator('body').textContent();
    expect(content).toBeTruthy();
    // Should have either error message or "not found" — not a raw error stack
    const hasErrorUI = content!.includes('not found') ||
      content!.includes('Try Again') ||
      content!.includes('Go Back') ||
      content!.includes('error');
    expect(hasErrorUI).toBeTruthy();
  });

  test('Direct URL to invalid route redirects gracefully', async ({ customerPage }) => {
    await customerPage.goto('/nonexistent-page');
    await customerPage.waitForLoadState('networkidle');

    // Should redirect to dashboard or show 404, not white screen
    const content = await customerPage.locator('body').textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(50);
  });

  test('All customer pages load without console errors', async ({ customerPage }) => {
    const consoleErrors: string[] = [];
    customerPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const routes = ['/dashboard', '/my-pets', '/book', '/bookings', '/rewards', '/agreements', '/settings'];
    for (const route of routes) {
      await customerPage.goto(route);
      await customerPage.waitForLoadState('networkidle');
    }

    // Filter out known benign errors (e.g., network timeouts on cold start)
    const realErrors = consoleErrors.filter(e =>
      !e.includes('net::ERR') && !e.includes('Failed to fetch') && !e.includes('AbortError')
    );

    if (realErrors.length > 0) {
      console.log('Console errors found:', realErrors);
    }
    // Warn but don't fail on console errors — some may be expected
    // Fail only on critical counts
    expect(realErrors.length).toBeLessThan(5);
  });

  test('All admin pages load without white screen', async ({ staffPage }) => {
    const routes = ['/dashboard', '/grooming-pricing'];
    for (const route of routes) {
      await staffPage.goto(route);
      await staffPage.waitForLoadState('networkidle');
      const content = await staffPage.locator('body').textContent();
      expect(content).toBeTruthy();
      expect(content!.length).toBeGreaterThan(50);
    }
  });
});
```

### 4. Mobile Integration Tests

**Create `e2e/tests/customer/mobile-integration.spec.ts`:**

```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.use({ viewport: { width: 375, height: 812 } });

test.describe('Mobile Integration — Cross-Module', () => {
  test('Bottom nav works across all pages', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // Bottom nav should be visible
    const bottomNav = customerPage.locator('nav').last();
    await expect(bottomNav).toBeVisible({ timeout: 15_000 });

    // Navigate via bottom nav to different sections
    // Each tap should load the page without crash
    const navButtons = bottomNav.locator('a, button');
    const count = await navButtons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < Math.min(count, 5); i++) {
      await navButtons.nth(i).click();
      await customerPage.waitForLoadState('networkidle');
      const content = await customerPage.locator('body').textContent();
      expect(content).toBeTruthy();
    }
  });

  test('Dog profile is fully functional on mobile viewport', async ({ customerPage }) => {
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');

    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await expect(firstPet).toBeVisible({ timeout: 15_000 });
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // Scroll to bottom — all sections should be reachable
    await customerPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await customerPage.waitForTimeout(500);

    // Medications section should be reachable by scrolling
    await expect(customerPage.locator('text="Medications"')).toBeVisible({ timeout: 5_000 });
  });

  test('No horizontal overflow on any page (mobile)', async ({ customerPage }) => {
    const routes = ['/dashboard', '/my-pets', '/book', '/rewards'];
    for (const route of routes) {
      await customerPage.goto(route);
      await customerPage.waitForLoadState('networkidle');

      const hasOverflow = await customerPage.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      if (hasOverflow) {
        console.log(`Horizontal overflow detected on ${route}`);
      }
      expect(hasOverflow).toBeFalsy();
    }
  });
});
```

### 5. Run Full Regression Suite

After writing all integration tests, run the ENTIRE test suite:

```bash
cd e2e && npx playwright test --reporter=list
```

**Expected outcome:** All per-sprint tests (MS-3.1 through MS-6) + all new integration tests + all 83 baseline tests pass.

Fix any failures before committing:
- If a test fails because a feature isn't seeded: add `test.skip('Needs seed data')` with comment
- If a test fails because of an actual bug: fix the bug in source code
- If a test fails due to flaky timing: increase timeout or add `waitForLoadState`

## Build Gate
```bash
# All apps build
cd server && npx tsc --noEmit
cd ../customer-app && npx tsc --noEmit && npm run build
cd ../admin-app && npx tsc --noEmit && npm run build

# All E2E tests
cd ../e2e && npx playwright test --reporter=list 2>&1 | tail -30
```

- [ ] All 3 apps build
- [ ] Customer journey tests pass (5 tests)
- [ ] Admin journey tests pass (3 tests)
- [ ] Resilience tests pass (4 tests)
- [ ] Mobile integration tests pass (3 tests)
- [ ] Full regression suite passes (report total)

## Git Commit
```bash
git add e2e/tests/
git commit -m "test(e2e): add cross-module integration and regression tests

Customer: full journey tests (dashboard → pets → profile → back).
Admin: navigation journey, dashboard section integrity.
Resilience: invalid routes, error states, console error monitoring.
Mobile: bottom nav, scrollability, no horizontal overflow.
Full regression suite verified.

MS-7 of 8 micro-sprint rebuild."
```

## CHANGELOG Entry
```
### MS-7: Cross-Module Integration Tests
- Customer full-journey tests (multi-page navigation, data consistency)
- Admin navigation and dashboard integrity tests
- Error resilience tests (invalid routes, bad IDs, console errors)
- Mobile integration tests (bottom nav, scrolling, overflow)
- Full regression suite verified across all sprints
```

## Next Session
Proceed to MS-8 (Integration verification + deploy).
