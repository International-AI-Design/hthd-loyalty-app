import { test as base, expect, type Page } from '@playwright/test';
import { TEST_CUSTOMER, TEST_STAFF } from './test-accounts';

/**
 * Log in as the test customer via the customer app login page.
 *
 * Form fields (from LoginPage.tsx):
 *   - input[name="identifier"] (type=text) — "Email or Phone"
 *   - input[name="password"] (type=password)
 *   - button[type="submit"] — "Sign In"
 */
async function loginAsCustomer(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill the "Email or Phone" field (name="identifier", type="text")
  await page.fill('input[name="identifier"]', TEST_CUSTOMER.email);
  await page.fill('input[name="password"]', TEST_CUSTOMER.password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard (successful login)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

/**
 * Log in as the test staff via the admin app login page.
 *
 * Form fields (from admin LoginPage.tsx):
 *   - input[name="username"] (type=text)
 *   - input[name="password"] (type=password)
 *   - button[type="submit"] — "Sign In"
 */
async function loginAsStaff(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill the username + password fields
  await page.fill('input[name="username"]', TEST_STAFF.username);
  await page.fill('input[name="password"]', TEST_STAFF.password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard (successful login)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}

/**
 * Extended test fixture that provides pre-authenticated pages.
 *
 * Usage in test files:
 *   import { test, expect } from '../fixtures/auth.fixture';
 *
 *   test('something with customer login', async ({ customerPage }) => {
 *     await customerPage.goto('/messages');
 *   });
 */
export const test = base.extend<{
  customerPage: Page;
  staffPage: Page;
}>({
  customerPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      baseURL: process.env.CUSTOMER_APP_URL || 'https://hthd.internationalaidesign.com',
    });
    const page = await context.newPage();
    await loginAsCustomer(page);
    await use(page);
    await context.close();
  },

  staffPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      baseURL: process.env.ADMIN_APP_URL || 'https://hthd-admin.internationalaidesign.com',
    });
    const page = await context.newPage();
    await loginAsStaff(page);
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
export { loginAsCustomer, loginAsStaff };
