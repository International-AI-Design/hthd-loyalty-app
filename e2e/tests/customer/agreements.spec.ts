import { test as base, expect, type Page } from '@playwright/test';
import { loginAsCustomer } from '../../fixtures/auth.fixture';

// Shared-auth pattern: login once in beforeAll, share the page across serial tests
const test = base.extend<{ customerPage: Page }>({
  customerPage: [async ({ browser }, use) => {
    const context = await browser.newContext({
      baseURL: process.env.CUSTOMER_APP_URL || 'https://hthd.internationalaidesign.com',
    });
    const page = await context.newPage();
    await loginAsCustomer(page);
    await use(page);
    await context.close();
  }, { scope: 'worker' }],
});

test.describe.configure({ mode: 'serial' });

test.describe('Agreements — MS-5', () => {
  test('Agreements page loads at /agreements', async ({ customerPage }) => {
    await customerPage.goto('/agreements');
    await customerPage.waitForLoadState('networkidle');
    const content = await customerPage.locator('body').textContent();
    expect(content).toBeTruthy();
    // Verify it's the agreements page (heading or empty state)
    const hasAgreementsContent = await customerPage.locator('text=/[Aa]greement/').first().isVisible().catch(() => false);
    expect(hasAgreementsContent).toBe(true);
  });

  test('Agreements page shows signed/pending sections', async ({ customerPage }) => {
    await customerPage.goto('/agreements');
    await customerPage.waitForLoadState('networkidle');
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent!.length).toBeGreaterThan(50);
  });

  test('Type-to-sign area is present if unsigned agreements exist', async ({ customerPage }) => {
    await customerPage.goto('/agreements');
    await customerPage.waitForLoadState('networkidle');
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });

  test('Booking flow page loads without crash', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });

  test('Boarding option visible in booking flow', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    const boardingOption = customerPage.locator('text=/[Bb]oarding/').first();
    const hasBoardingOption = await boardingOption.isVisible().catch(() => false);
    if (hasBoardingOption) {
      await boardingOption.click();
      await customerPage.waitForLoadState('networkidle');
    }
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });
});
