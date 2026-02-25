/**
 * Mobile Integration — Cross-Module Tests (MS-7)
 *
 * Tests that verify cross-module flows work on mobile viewport.
 * File named "integration-mobile" (not "mobile-*") to match
 * customer-desktop testMatch pattern (sets own viewport override).
 *
 * Uses shared-auth pattern: login once in beforeAll, share page across serial tests.
 */
import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsCustomer } from '../../fixtures/auth.fixture';

let context: BrowserContext;
let customerPage: Page;

base.describe('Mobile Integration — Cross-Module', () => {
  base.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      baseURL: process.env.CUSTOMER_APP_URL || 'https://hthd.internationalaidesign.com',
      viewport: { width: 375, height: 812 },
    });
    customerPage = await context.newPage();
    await loginAsCustomer(customerPage);
  });

  base.afterAll(async () => {
    await context?.close();
  });

  base.describe.configure({ mode: 'serial' });

  base('Bottom nav works across all pages', async () => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // Bottom nav should be visible
    const bottomNav = customerPage.locator('nav');
    await expect(bottomNav).toBeVisible({ timeout: 15_000 });

    // Navigate via bottom nav items — each tap should load the page
    const navLabels = ['Book', 'Messages', 'My Pets', 'Rewards', 'Home'];
    for (const label of navLabels) {
      const button = bottomNav.locator(`button:has-text("${label}")`);
      const isVisible = await button.isVisible().catch(() => false);
      if (isVisible) {
        await button.click();
        await customerPage.waitForLoadState('networkidle');
        const content = await customerPage.locator('body').textContent();
        expect(content).toBeTruthy();
      }
    }
  });

  base('Dog profile is fully functional on mobile viewport', async () => {
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');

    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await expect(firstPet).toBeVisible({ timeout: 15_000 });

    await Promise.all([
      customerPage.waitForURL(/\/dogs\//, { timeout: 15_000 }),
      firstPet.click(),
    ]);

    // Wait for profile content to load
    await expect(customerPage.locator('text="Vaccinations"')).toBeVisible({ timeout: 30_000 });

    // Scroll to bottom — all sections should be reachable
    await customerPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await customerPage.waitForTimeout(500);

    // Medications section should be reachable by scrolling
    await expect(customerPage.locator('text="Medications"')).toBeVisible({ timeout: 5_000 });
  });

  base('No horizontal overflow on any page (mobile)', async () => {
    const routes = ['/dashboard', '/my-pets', '/book', '/rewards', '/agreements', '/badges'];
    for (const route of routes) {
      await customerPage.goto(route);
      await customerPage.waitForLoadState('networkidle');
      await customerPage.waitForTimeout(1_000);

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
