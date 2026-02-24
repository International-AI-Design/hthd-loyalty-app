/**
 * Navigation E2E Tests
 *
 * Validates that every protected route:
 * 1. Loads correctly when authenticated (no redirect to login)
 * 2. Back navigation does NOT land on /login
 * 3. Unauthenticated access redirects to /login
 *
 * Uses a data-driven approach for comprehensive coverage.
 */
import { test, expect } from '../../fixtures/auth.fixture';
import { test as base } from '@playwright/test';

const protectedPages = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/messages', name: 'Messages' },
  { path: '/book', name: 'Booking' },
  { path: '/bookings', name: 'Bookings List' },
  { path: '/my-pets', name: 'My Pets' },
  { path: '/rewards', name: 'Rewards' },
  { path: '/settings', name: 'Settings' },
  { path: '/activity', name: 'Activity Feed' },
  { path: '/report-cards', name: 'Report Cards' },
];

// --- Authenticated navigation tests ---
test.describe('Protected pages load when authenticated', () => {
  for (const page of protectedPages) {
    test(`${page.name} (${page.path}) loads without redirect to login`, async ({ customerPage }) => {
      await customerPage.goto(page.path);
      await customerPage.waitForLoadState('networkidle');

      // Should NOT redirect to /login
      await expect(customerPage).not.toHaveURL(/\/login/, { timeout: 10_000 });

      // Page should have meaningful content (not blank)
      const body = customerPage.locator('body');
      await expect(body).not.toBeEmpty();

      // Verify the page is not just a loading spinner stuck forever
      // Wait for at least some text content beyond just "Loading"
      await customerPage.waitForTimeout(2_000);
      const textContent = await customerPage.locator('body').textContent();
      expect(textContent).toBeTruthy();
      expect(textContent!.length).toBeGreaterThan(20);
    });
  }
});

// --- Back button navigation tests ---
test.describe('Back navigation does NOT land on /login', () => {
  // Use a different source page than the target to ensure history entry is created
  for (const page of protectedPages) {
    // Skip dashboard as target since the auth fixture already lands there
    if (page.path === '/dashboard') continue;

    test(`${page.name}: browser back from ${page.path} avoids /login`, async ({ customerPage }) => {
      // Auth fixture already logged in and is on /dashboard
      // Navigate to the target page (creates a real history entry: /dashboard → target)
      await customerPage.goto(page.path);
      await customerPage.waitForLoadState('networkidle');

      // Use browser back — should go to /dashboard, NOT /login
      await customerPage.goBack();
      await customerPage.waitForLoadState('networkidle');
      await customerPage.waitForTimeout(1_000);

      // Verify we did NOT end up on /login
      const url = customerPage.url();
      expect(url).not.toMatch(/\/login/);
    });
  }
});

// --- Unauthenticated access tests ---
// These use a raw browser context (no login) to verify redirect behavior
test.describe('Unauthenticated access redirects to /login', () => {
  for (const page of protectedPages) {
    base(`${page.name} (${page.path}) redirects to /login without auth`, async ({ browser }) => {
      const context = await browser.newContext({
        baseURL: process.env.CUSTOMER_APP_URL || 'https://hthd.internationalaidesign.com',
      });
      const rawPage = await context.newPage();

      await rawPage.goto(page.path);
      await rawPage.waitForLoadState('networkidle');

      // Should redirect to /login within a reasonable timeout
      await base.expect(rawPage).toHaveURL(/\/login/, { timeout: 15_000 });

      await context.close();
    });
  }
});
