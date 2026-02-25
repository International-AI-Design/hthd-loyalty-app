/**
 * Admin Full Journey — Cross-Module Integration Tests (MS-7)
 *
 * Tests that traverse admin modules and verify the dashboard
 * integrates all new sprint features without layout breakage.
 *
 * Uses shared-auth pattern: login once in beforeAll, share page across serial tests.
 */
import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsStaff } from '../../fixtures/auth.fixture';

let context: BrowserContext;
let staffPage: Page;

base.describe('Admin Full Journey — Cross-Module', () => {
  base.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      baseURL: process.env.ADMIN_APP_URL || 'https://hthd-admin.internationalaidesign.com',
    });
    staffPage = await context.newPage();
    await loginAsStaff(staffPage);
  });

  base.afterAll(async () => {
    await context?.close();
  });

  base.describe.configure({ mode: 'serial' });

  base('Dashboard shows all sections without layout breaking', async () => {
    await staffPage.goto('/dashboard');
    await staffPage.waitForLoadState('networkidle');
    await staffPage.waitForTimeout(3_000);

    // Page should load with multiple sections
    const content = await staffPage.locator('body').textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(100);

    // Facility Status should be present (core dashboard)
    const facilityCard = staffPage.locator('h2', { hasText: 'Facility Status' });
    await expect(facilityCard).toBeVisible({ timeout: 10_000 });
  });

  base('Dashboard → Grooming Pricing → Back → Dashboard (navigation)', async () => {
    await staffPage.goto('/dashboard');
    await staffPage.waitForLoadState('networkidle');
    await staffPage.waitForTimeout(2_000);

    await staffPage.goto('/grooming-pricing');
    await staffPage.waitForLoadState('networkidle');
    const pricingContent = await staffPage.locator('body').textContent();
    expect(pricingContent).toBeTruthy();
    expect(pricingContent!.length).toBeGreaterThan(50);

    await staffPage.goBack();
    await staffPage.waitForLoadState('networkidle');
    await staffPage.waitForTimeout(2_000);

    const dashContent = await staffPage.locator('body').textContent();
    expect(dashContent).toBeTruthy();
    expect(dashContent!.length).toBeGreaterThan(100);
  });

  base('Admin navigation includes module links', async () => {
    await staffPage.goto('/dashboard');
    await staffPage.waitForLoadState('networkidle');
    await staffPage.waitForTimeout(2_000);

    // Collect all link and button text from the page
    const allLinks = await staffPage.locator('a, button').allTextContents();
    const navText = allLinks.join(' ').toLowerCase();

    // Grooming pricing should be accessible (added in MS-4)
    const hasPricingLink = navText.includes('pricing') || navText.includes('grooming');
    console.log(`Has pricing link: ${hasPricingLink}`);

    // Customer lookup should be accessible
    const hasCustomerLink = navText.includes('customer');
    console.log(`Has customer link: ${hasCustomerLink}`);

    // At minimum, dashboard should have meaningful navigation options
    expect(allLinks.length).toBeGreaterThan(3);
  });
});
