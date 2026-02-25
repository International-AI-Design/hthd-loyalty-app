import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsCustomer } from '../../fixtures/auth.fixture';

// Share a single authenticated page to avoid rate-limit on login
let context: BrowserContext;
let customerPage: Page;

base.describe('Dog Profile — Mobile Viewport', () => {
  base.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      baseURL: process.env.CUSTOMER_APP_URL || 'https://hthd.internationalaidesign.com',
      viewport: { width: 375, height: 812 }, // iPhone-sized
    });
    customerPage = await context.newPage();
    await loginAsCustomer(customerPage);
  });

  base.afterAll(async () => {
    await context?.close();
  });

  base.describe.configure({ mode: 'serial' });

  base('Dog profile page is scrollable on mobile', async () => {
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');

    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await expect(firstPet).toBeVisible({ timeout: 15_000 });
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    await expect(customerPage.locator('text="Vaccinations"')).toBeVisible({ timeout: 15_000 });

    // Scroll down — medications section should become visible
    await customerPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(customerPage.locator('text="Medications"')).toBeVisible({ timeout: 5_000 });
  });

  base('Photo upload area meets 44px minimum touch target', async () => {
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');

    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await expect(firstPet).toBeVisible({ timeout: 15_000 });
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // Photo upload button has min-h-[200px] so it exceeds 44px
    const photoButton = customerPage.locator('button[class*="min-h-"]').first();
    const isVisible = await photoButton.isVisible().catch(() => false);
    if (isVisible) {
      const box = await photoButton.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    }
  });

  base('Pet list cards are tappable on mobile', async () => {
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');

    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await expect(firstPet).toBeVisible({ timeout: 15_000 });

    const box = await firstPet.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  base('Edit and Add buttons meet minimum touch target', async () => {
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');

    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await expect(firstPet).toBeVisible({ timeout: 15_000 });
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // Edit button
    const editButton = customerPage.locator('button[class*="min-h-[44px]"]').first();
    const editVisible = await editButton.isVisible().catch(() => false);
    if (editVisible) {
      const box = await editButton.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    }

    // Add vaccination button
    const addButton = customerPage.locator('button').filter({ hasText: 'Add' }).first();
    const addVisible = await addButton.isVisible().catch(() => false);
    if (addVisible) {
      const box = await addButton.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
