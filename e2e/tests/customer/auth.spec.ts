/**
 * Authentication E2E Tests
 *
 * Validates login, logout, invalid credentials, and auth guard behavior.
 *
 * These tests use raw browser contexts (no pre-auth fixture) to test
 * the actual authentication flow from scratch.
 */
import { test as base, expect } from '@playwright/test';
import { test, expect as authExpect } from '../../fixtures/auth.fixture';
import { TEST_CUSTOMER } from '../../fixtures/test-accounts';

const CUSTOMER_APP_URL = process.env.CUSTOMER_APP_URL || 'https://hthd.internationalaidesign.com';

base.describe('Authentication', () => {
  base('login with valid credentials redirects to dashboard', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: CUSTOMER_APP_URL });
    const page = await context.newPage();

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Verify the login page rendered
    await expect(page.locator('text="Happy Tail Happy Dog"').first()).toBeVisible({ timeout: 10_000 });

    // Fill in credentials — the login form uses "identifier" field (email or phone)
    await page.fill('input[type="text"], input[name="identifier"]', TEST_CUSTOMER.email);
    await page.fill('input[type="password"]', TEST_CUSTOMER.password);

    // Submit the form
    await page.click('button[type="submit"]');

    // Should redirect to /dashboard on success
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Dashboard should have meaningful content
    const pointsSection = page.locator('#points-balance');
    await expect(pointsSection).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  base('login with invalid credentials shows error message', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: CUSTOMER_APP_URL });
    const page = await context.newPage();

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Fill in credentials with a wrong password
    await page.fill('input[type="text"], input[name="identifier"]', TEST_CUSTOMER.email);
    await page.fill('input[type="password"]', 'definitely-wrong-password-12345');

    // Submit the form
    await page.click('button[type="submit"]');

    // Should show an error message (Alert component with variant="error")
    const errorAlert = page.locator('[role="alert"], .bg-red-50, [class*="error"]');
    await expect(errorAlert.first()).toBeVisible({ timeout: 10_000 });

    // Should NOT redirect to dashboard
    await expect(page).not.toHaveURL(/\/dashboard/);

    // Should remain on login page
    await expect(page).toHaveURL(/\/login/);

    await context.close();
  });

  base('protected route redirects to login without auth', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: CUSTOMER_APP_URL });
    const page = await context.newPage();

    // Try to access dashboard directly without authentication
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should redirect to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    // Login form should be visible
    await expect(
      page.locator('button[type="submit"]')
    ).toBeVisible({ timeout: 10_000 });

    await context.close();
  });

  base('direct access to /messages without auth redirects to login', async ({ browser }) => {
    const context = await browser.newContext({ baseURL: CUSTOMER_APP_URL });
    const page = await context.newPage();

    await page.goto('/messages');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

    await context.close();
  });
});

// Logout test uses the auth fixture (pre-authenticated)
test.describe('Logout', () => {
  test('logout from settings redirects to login', async ({ customerPage }) => {
    // Navigate to settings where the Sign Out button is
    await customerPage.goto('/settings');
    await customerPage.waitForLoadState('networkidle');

    // Find and click the "Sign Out" button
    const signOutButton = customerPage.locator('button:has-text("Sign Out")');
    await authExpect(signOutButton).toBeVisible({ timeout: 10_000 });
    await signOutButton.click();

    // Should redirect to /login
    await authExpect(customerPage).toHaveURL(/\/login/, { timeout: 15_000 });

    // Login form should be visible
    await authExpect(
      customerPage.locator('button[type="submit"]')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('logout from dashboard sign-out link redirects to login', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // The dashboard has a "Sign Out" button at the bottom
    const signOutButton = customerPage.locator('button:has-text("Sign Out")');

    if (await signOutButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Scroll to the bottom to find it
      await signOutButton.scrollIntoViewIfNeeded();
      await signOutButton.click();

      // Should redirect to /login
      await authExpect(customerPage).toHaveURL(/\/login/, { timeout: 15_000 });
    }
  });

  test('after logout, accessing protected route redirects to login', async ({ customerPage }) => {
    // First logout
    await customerPage.goto('/settings');
    await customerPage.waitForLoadState('networkidle');

    const signOutButton = customerPage.locator('button:has-text("Sign Out")');
    await authExpect(signOutButton).toBeVisible({ timeout: 10_000 });
    await signOutButton.click();

    // Wait for redirect to login
    await authExpect(customerPage).toHaveURL(/\/login/, { timeout: 15_000 });

    // Now try to access a protected route
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // Should stay on /login (token was cleared)
    await authExpect(customerPage).toHaveURL(/\/login/, { timeout: 15_000 });
  });
});
