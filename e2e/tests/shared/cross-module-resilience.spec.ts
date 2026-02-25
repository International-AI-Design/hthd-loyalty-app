/**
 * Cross-Module Resilience Tests (MS-7)
 *
 * Verifies that the app handles edge cases gracefully:
 * invalid routes, bad IDs, console errors, and white screens.
 *
 * Uses shared-auth pattern: login once per app, share page across serial tests.
 */
import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsCustomer, loginAsStaff } from '../../fixtures/auth.fixture';

let customerContext: BrowserContext;
let customerPage: Page;
let adminContext: BrowserContext;
let staffPage: Page;

base.describe('Cross-Module Resilience', () => {
  base.beforeAll(async ({ browser }) => {
    customerContext = await browser.newContext({
      baseURL: process.env.CUSTOMER_APP_URL || 'https://hthd.internationalaidesign.com',
    });
    customerPage = await customerContext.newPage();
    await loginAsCustomer(customerPage);

    adminContext = await browser.newContext({
      baseURL: process.env.ADMIN_APP_URL || 'https://hthd-admin.internationalaidesign.com',
    });
    staffPage = await adminContext.newPage();
    await loginAsStaff(staffPage);
  });

  base.afterAll(async () => {
    await customerContext?.close();
    await adminContext?.close();
  });

  base.describe.configure({ mode: 'serial' });

  base('Direct URL to dog profile with invalid ID shows error, not crash', async () => {
    await customerPage.goto('/dogs/00000000-0000-0000-0000-000000000000');
    await customerPage.waitForLoadState('networkidle');
    await customerPage.waitForTimeout(2_000);

    // Should show error state or redirect, not white screen
    const content = await customerPage.locator('body').textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(20);
  });

  base('Direct URL to invalid route redirects gracefully', async () => {
    await customerPage.goto('/nonexistent-page-xyz');
    await customerPage.waitForLoadState('networkidle');
    await customerPage.waitForTimeout(2_000);

    // Customer app catch-all redirects to /dashboard
    await expect(customerPage).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Dashboard should render, not a white screen
    const content = await customerPage.locator('body').textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(50);
  });

  base('All customer pages load without critical console errors', async () => {
    const consoleErrors: string[] = [];
    customerPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const routes = ['/dashboard', '/my-pets', '/book', '/bookings', '/rewards', '/agreements', '/settings'];
    for (const route of routes) {
      await customerPage.goto(route);
      await customerPage.waitForLoadState('networkidle');
      await customerPage.waitForTimeout(1_000);
    }

    // Filter out known benign errors (network timeouts, abort signals, etc.)
    const realErrors = consoleErrors.filter(e =>
      !e.includes('net::ERR') &&
      !e.includes('Failed to fetch') &&
      !e.includes('AbortError') &&
      !e.includes('ResizeObserver') &&
      !e.includes('favicon')
    );

    if (realErrors.length > 0) {
      console.log('Console errors found:', realErrors);
    }
    // Warn but don't hard-fail on a few errors — fail on excessive count
    expect(realErrors.length).toBeLessThan(5);
  });

  base('All admin pages load without white screen', async () => {
    const routes = ['/dashboard', '/grooming-pricing', '/customers', '/loyalty'];
    for (const route of routes) {
      await staffPage.goto(route);
      await staffPage.waitForLoadState('networkidle');
      await staffPage.waitForTimeout(2_000);
      const content = await staffPage.locator('body').textContent();
      expect(content).toBeTruthy();
      expect(content!.length).toBeGreaterThan(50);
    }
  });
});
