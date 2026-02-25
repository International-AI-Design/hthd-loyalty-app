/**
 * Customer Full Journey — Cross-Module Integration Tests (MS-7)
 *
 * Tests that traverse multiple features in a single session,
 * the way a real user would navigate between modules.
 *
 * Uses shared-auth pattern: login once in beforeAll, share page across serial tests.
 */
import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsCustomer } from '../../fixtures/auth.fixture';

let context: BrowserContext;
let customerPage: Page;

base.describe('Customer Full Journey — Cross-Module', () => {
  base.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      baseURL: process.env.CUSTOMER_APP_URL || 'https://hthd.internationalaidesign.com',
    });
    customerPage = await context.newPage();
    await loginAsCustomer(customerPage);
  });

  base.afterAll(async () => {
    await context?.close();
  });

  base.describe.configure({ mode: 'serial' });

  base('Dashboard → My Pets → Dog Profile → Back to Dashboard', async () => {
    // Start at dashboard
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');
    await expect(customerPage.locator('body')).not.toBeEmpty();

    // Navigate to My Pets
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await expect(firstPet).toBeVisible({ timeout: 15_000 });

    // Open dog profile via SPA navigation
    await Promise.all([
      customerPage.waitForURL(/\/dogs\//, { timeout: 15_000 }),
      firstPet.click(),
    ]);
    await expect(customerPage.locator('text="Vaccinations"')).toBeVisible({ timeout: 30_000 });

    // Navigate back to dashboard
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');
    await expect(customerPage.locator('body')).not.toBeEmpty();
    const dashContent = await customerPage.locator('body').textContent();
    expect(dashContent!.length).toBeGreaterThan(50);
  });

  base('Dashboard → Book → Back → Rewards → Back (multi-page navigation)', async () => {
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
    expect(dashContent!.length).toBeGreaterThan(50);
  });

  base('Dog Profile shows data that matches My Pets card', async () => {
    // Get dog info from My Pets page
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await expect(firstPet).toBeVisible({ timeout: 15_000 });

    // Get the pet name text before navigating
    const petCardText = await firstPet.textContent();
    const petName = petCardText!.match(/Playwright|Cypress/)?.[0];
    expect(petName).toBeTruthy();

    // Navigate to profile
    await Promise.all([
      customerPage.waitForURL(/\/dogs\//, { timeout: 15_000 }),
      firstPet.click(),
    ]);
    await customerPage.waitForLoadState('networkidle');

    // Profile should show the same dog name
    const profileContent = await customerPage.locator('body').textContent();
    expect(profileContent).toContain(petName);
  });

  base('Agreements page accessible and renders content', async () => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // Navigate to agreements
    await customerPage.goto('/agreements');
    await customerPage.waitForLoadState('networkidle');
    const content = await customerPage.locator('body').textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(50);

    // Should contain agreement-related content
    const hasAgreementContent = await customerPage
      .locator('text=/[Aa]greement/')
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasAgreementContent).toBe(true);
  });

  base('Badge progress visible alongside dashboard content', async () => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');
    await customerPage.waitForTimeout(2_000);

    // Dashboard should have substantial content (points + badges coexist)
    const content = await customerPage.locator('body').textContent();
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(100);

    // Points or badge content should be present somewhere on dashboard
    const hasPoints = content!.toLowerCase().includes('point');
    const hasBadge = content!.toLowerCase().includes('badge');
    expect(hasPoints || hasBadge).toBeTruthy();
  });
});
