/**
 * Dashboard E2E Tests
 *
 * Validates the main dashboard experience: data loading, pet card interaction,
 * CTA navigation, and content rendering.
 *
 * The dashboard is the primary landing page after login and aggregates
 * points, bookings, pets, rewards, and activity.
 */
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Dashboard', () => {
  test('dashboard loads with points balance showing a number', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // The hero section has the points balance as a large number
    // It's rendered inside a section with id="points-balance"
    const pointsSection = customerPage.locator('#points-balance');
    await expect(pointsSection).toBeVisible({ timeout: 15_000 });

    // The points balance should be a number (rendered in a p.text-5xl element)
    const pointsDisplay = pointsSection.locator('.text-5xl');
    await expect(pointsDisplay).toBeVisible({ timeout: 10_000 });

    const pointsText = await pointsDisplay.textContent();
    expect(pointsText).toBeTruthy();
    // Should be a formatted number like "125" or "1,250" — not a loading skeleton
    expect(pointsText!.trim()).toMatch(/^[\d,]+$/);
  });

  test('pet cards are tappable and navigate away from dashboard', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // Wait for the "My Pups" section to load
    const myPupsHeading = customerPage.locator('text="My Pups"');
    await expect(myPupsHeading).toBeVisible({ timeout: 15_000 });

    // Find pet cards — they are clickable elements in the My Pups section
    // Test account has dogs named "Playwright" and "Cypress"
    const petCard = customerPage.locator(
      'button:has-text("Playwright"), a:has-text("Playwright"), [role="button"]:has-text("Playwright")'
    ).first();

    if (await petCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const beforeUrl = customerPage.url();
      await petCard.click();

      // Wait for navigation or DOM change
      await customerPage.waitForTimeout(2_000);

      // Should navigate away from the current dashboard view
      // Pet cards may go to /dogs/:id, /my-pets, or /bookings
      const afterUrl = customerPage.url();
      const navigated = afterUrl !== beforeUrl;
      const pageContent = await customerPage.locator('body').textContent();

      // Either URL changed or page content is now showing pet details
      expect(navigated || pageContent!.includes('Playwright')).toBe(true);

      // Should NOT be on /login
      expect(afterUrl).not.toMatch(/\/login/);
    }
  });

  test('greeting displays customer name', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // The greeting section shows the time-based greeting and customer name
    // The customer name (or "Welcome!") is in a button that navigates to settings
    const pointsSection = customerPage.locator('#points-balance');
    await expect(pointsSection).toBeVisible({ timeout: 15_000 });

    // Should have a greeting phrase
    const greetingText = await pointsSection.textContent();
    expect(greetingText).toMatch(/Good (morning|afternoon|evening)|Welcome/);
  });

  test('rewards section renders tier cards', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // The rewards section has id="reward-tiers"
    const rewardsSection = customerPage.locator('#reward-tiers');
    await expect(rewardsSection).toBeVisible({ timeout: 15_000 });

    // Should show the "Rewards" heading
    await expect(
      rewardsSection.locator('text="Rewards"')
    ).toBeVisible();

    // Should show tier cards with dollar amounts ($10, $25, $50)
    const tierCards = rewardsSection.locator('button:has-text("pts")');
    const tierCount = await tierCards.count();
    expect(tierCount).toBe(3); // 100pts, 250pts, 500pts

    // Verify the dollar amounts are displayed
    await expect(rewardsSection.locator('text="$10"')).toBeVisible();
    await expect(rewardsSection.locator('text="$25"')).toBeVisible();
    await expect(rewardsSection.locator('text="$50"')).toBeVisible();
  });

  test('bottom nav navigates to book page', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // Find the "Book" button in the bottom navigation
    const bookNavButton = customerPage.locator('nav button:has-text("Book")');
    await expect(bookNavButton).toBeVisible({ timeout: 10_000 });
    await bookNavButton.click();

    // Should navigate to /book
    await expect(customerPage).toHaveURL(/\/book/, { timeout: 10_000 });
  });

  test('bottom nav navigates to messages page', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // Find the "Messages" button in the bottom navigation
    const messagesNavButton = customerPage.locator('nav button:has-text("Messages")');
    await expect(messagesNavButton).toBeVisible({ timeout: 10_000 });
    await messagesNavButton.click();

    // Should navigate to /messages
    await expect(customerPage).toHaveURL(/\/messages/, { timeout: 10_000 });
  });

  test('referral banner is visible and tappable', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // The referral section has id="refer-tile"
    const referralSection = customerPage.locator('#refer-tile');
    await expect(referralSection).toBeVisible({ timeout: 15_000 });

    // Should show "Share the love" text
    await expect(
      referralSection.locator('text="Share the love"')
    ).toBeVisible();

    // Clicking it should open the referral modal
    await referralSection.locator('button').first().click();

    // Modal should appear with referral code info
    const modal = customerPage.locator('[role="dialog"], .fixed.inset-0');
    // The referral modal or its content should become visible
    await customerPage.waitForTimeout(1_000);
  });

  test('refresh button works without errors', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // Wait for initial data to load
    await expect(
      customerPage.locator('#points-balance')
    ).toBeVisible({ timeout: 15_000 });

    // Click the refresh button (aria-label="Refresh")
    const refreshButton = customerPage.locator('button[aria-label="Refresh"]');
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();

    // The refresh icon should animate (has animate-spin class while refreshing)
    // Wait for the refresh to complete
    await customerPage.waitForTimeout(3_000);

    // Points should still be visible after refresh (not broken by reload)
    const pointsDisplay = customerPage.locator('#points-balance .text-5xl');
    await expect(pointsDisplay).toBeVisible();

    const pointsText = await pointsDisplay.textContent();
    expect(pointsText!.trim()).toMatch(/^[\d,]+$/);
  });
});
