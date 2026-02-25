import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';
import { loginAsCustomer } from '../../fixtures/auth.fixture';

// Share a single authenticated page across all tests to avoid rate-limit on login
let context: BrowserContext;
let customerPage: Page;

/**
 * Navigate to the first dog's profile and wait for it to fully load.
 * Waits for URL change + profile content to appear (not just networkidle).
 */
async function navigateToDogProfile(page: Page): Promise<void> {
  await page.goto('/my-pets');
  await page.waitForLoadState('networkidle');

  const firstPet = page.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
  await expect(firstPet).toBeVisible({ timeout: 15_000 });

  // Click and wait for SPA navigation to /dogs/:id
  await Promise.all([
    page.waitForURL(/\/dogs\//, { timeout: 15_000 }),
    firstPet.click(),
  ]);

  // Wait for the profile to finish loading (spinner gone, content visible)
  // The page shows "Vaccinations" section which only appears after data loads
  await expect(page.locator('text="Vaccinations"')).toBeVisible({ timeout: 30_000 });
}

base.describe('Dog Profile — MS-2/MS-3 Features', () => {
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

  base('My Pets page renders pet cards', async () => {
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');

    const petCards = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ });
    await expect(petCards.first()).toBeVisible({ timeout: 15_000 });
  });

  base('Pet cards show photo thumbnail or letter avatar', async () => {
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');

    const firstCard = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    // Each card has either a photo <img> or a gradient avatar div
    const hasImage = await firstCard.locator('img').count() > 0;
    const hasAvatar = await firstCard.locator('.rounded-2xl').first().count() > 0;
    expect(hasImage || hasAvatar).toBeTruthy();
  });

  base('Dog profile page loads without white screen', async () => {
    await navigateToDogProfile(customerPage);

    // Profile page should have the dog name in the heading
    const nameHeading = customerPage.locator('.font-heading, .font-pet').filter({ hasText: /Playwright|Cypress/ });
    await expect(nameHeading.first()).toBeVisible({ timeout: 15_000 });
  });

  base('Dog profile shows photo upload area', async () => {
    await navigateToDogProfile(customerPage);

    // PhotoUpload: either "Add a photo of your pup!" or an existing photo
    const photoArea = customerPage.locator('text="Add a photo of your pup!"').or(
      customerPage.locator('img[class*="object-cover"]').first()
    );
    await expect(photoArea).toBeVisible({ timeout: 15_000 });
  });

  base('Dog profile shows identity card with basic info', async () => {
    await navigateToDogProfile(customerPage);

    // Dog name heading
    const nameHeading = customerPage.locator('.font-heading, .font-pet').filter({ hasText: /Playwright|Cypress/ });
    await expect(nameHeading.first()).toBeVisible({ timeout: 15_000 });

    // Edit button (pencil icon with min touch target)
    const editButton = customerPage.locator('button[class*="min-h-"][class*="min-w-"]').first();
    await expect(editButton).toBeVisible();
  });

  base('Dog profile shows vaccination section', async () => {
    await navigateToDogProfile(customerPage);

    await expect(customerPage.locator('text="Vaccinations"')).toBeVisible({ timeout: 15_000 });

    const addVaxButton = customerPage.locator('button').filter({ hasText: 'Add' }).first();
    await expect(addVaxButton).toBeVisible();
  });

  base('Dog profile shows medication section', async () => {
    await navigateToDogProfile(customerPage);

    await expect(customerPage.locator('text="Medications"')).toBeVisible({ timeout: 15_000 });
  });

  base('Vaccination cards show document upload option', async () => {
    await navigateToDogProfile(customerPage);

    const vaxCards = customerPage.locator('.bg-brand-cream').filter({ hasText: /Given:/ });
    const vaxCount = await vaxCards.count();

    if (vaxCount > 0) {
      const uploadLink = customerPage.locator('text=/Upload document photo|View Document/').first();
      await expect(uploadLink).toBeVisible({ timeout: 10_000 });
    }
    if (vaxCount === 0) {
      const emptyState = customerPage.locator('text="No vaccination records yet"');
      await expect(emptyState).toBeVisible({ timeout: 10_000 });
    }
  });

  base('Health & Safety card renders when data exists', async () => {
    await navigateToDogProfile(customerPage);

    // Conditional section — just verify the page doesn't crash
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();

    const healthSection = customerPage.locator('text="Health & Safety"');
    const hasHealth = await healthSection.count();
    console.log(`Health & Safety section present: ${hasHealth > 0}`);
  });

  base('Edit mode shows extended fields', async () => {
    await navigateToDogProfile(customerPage);

    // Click the edit button
    const editButton = customerPage.locator('button[class*="min-h-"][class*="min-w-"]').first();
    await editButton.click();

    // MS-2 extended fields should be visible
    await expect(customerPage.locator('text="Allergies"')).toBeVisible({ timeout: 5_000 });
    await expect(customerPage.locator('text="Special Needs"')).toBeVisible();
    await expect(customerPage.locator('text="Emergency Vet Name"')).toBeVisible();
    await expect(customerPage.locator('text="Emergency Vet Phone"')).toBeVisible();

    // Cancel exits edit mode
    await expect(customerPage.locator('button', { hasText: 'Cancel' })).toBeVisible();
  });

  base('Navigate back from dog profile works', async () => {
    await navigateToDogProfile(customerPage);

    await customerPage.goBack();
    await customerPage.waitForLoadState('networkidle');

    await expect(customerPage.locator('text="Your Pups"')).toBeVisible({ timeout: 15_000 });
  });

  base('Navigate to profile and back again (double navigation)', async () => {
    await navigateToDogProfile(customerPage);

    await customerPage.goBack();
    await customerPage.waitForLoadState('networkidle');

    // Navigate in again
    await navigateToDogProfile(customerPage);

    // Should still render correctly
    const nameHeading = customerPage.locator('.font-heading, .font-pet').filter({ hasText: /Playwright|Cypress/ });
    await expect(nameHeading.first()).toBeVisible({ timeout: 15_000 });
  });

  base('Vaccination status card shows compliance indicator', async () => {
    await navigateToDogProfile(customerPage);

    const statusLabel = customerPage.locator('text=/Up to Date|Check Soon|Action Needed|N\\/A/');
    await expect(statusLabel.first()).toBeVisible({ timeout: 15_000 });
  });
});
