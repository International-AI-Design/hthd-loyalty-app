/**
 * Mobile E2E Tests
 *
 * These tests run under the "customer-mobile" project config (iPhone 14 viewport)
 * and validate mobile-specific behaviors: no horizontal scroll, touch target sizes,
 * bottom navigation, and keyboard interaction.
 *
 * The playwright.config.ts matches this file via: testMatch: /customer\/mobile\.spec\.ts/
 */
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Mobile Experience', () => {
  test('no horizontal scroll on dashboard', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');
    await customerPage.waitForTimeout(2_000);

    // Check that document body does not overflow horizontally
    const hasHorizontalScroll = await customerPage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('no horizontal scroll on messages page', async ({ customerPage }) => {
    await customerPage.goto('/messages');
    await customerPage.waitForLoadState('networkidle');
    await customerPage.waitForTimeout(2_000);

    const hasHorizontalScroll = await customerPage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('no horizontal scroll on booking page', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    await customerPage.waitForTimeout(2_000);

    const hasHorizontalScroll = await customerPage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('no horizontal scroll on settings page', async ({ customerPage }) => {
    await customerPage.goto('/settings');
    await customerPage.waitForLoadState('networkidle');
    await customerPage.waitForTimeout(2_000);

    const hasHorizontalScroll = await customerPage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('key interactive elements have adequate touch target size (44x44px)', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');
    await customerPage.waitForTimeout(2_000);

    // Check bottom navigation buttons
    const navButtons = customerPage.locator('nav button');
    const navCount = await navButtons.count();
    expect(navCount).toBeGreaterThan(0);

    for (let i = 0; i < navCount; i++) {
      const box = await navButtons.nth(i).boundingBox();
      if (box) {
        // Touch targets should be at least 44x44 (allowing small tolerance)
        expect(box.width).toBeGreaterThanOrEqual(42);
        expect(box.height).toBeGreaterThanOrEqual(42);
      }
    }

    // Check the refresh button
    const refreshButton = customerPage.locator('button[aria-label="Refresh"]');
    if (await refreshButton.isVisible().catch(() => false)) {
      const box = await refreshButton.boundingBox();
      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(40);
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test('bottom navigation bar is visible and functional', async ({ customerPage }) => {
    await customerPage.goto('/dashboard');
    await customerPage.waitForLoadState('networkidle');

    // Bottom nav should be visible
    const bottomNav = customerPage.locator('nav');
    await expect(bottomNav).toBeVisible({ timeout: 10_000 });

    // Should have 5 navigation tabs: Home, Book, Messages, My Pets, Rewards
    const navLabels = ['Home', 'Book', 'Messages', 'My Pets', 'Rewards'];

    for (const label of navLabels) {
      const button = bottomNav.locator(`button:has-text("${label}")`);
      await expect(button).toBeVisible({ timeout: 5_000 });
    }

    // Tap "My Pets" to verify navigation works
    const myPetsButton = bottomNav.locator('button:has-text("My Pets")');
    await myPetsButton.click();
    await expect(customerPage).toHaveURL(/\/my-pets/, { timeout: 10_000 });

    // Bottom nav should still be visible after navigation
    await expect(bottomNav).toBeVisible();

    // Tap "Home" to go back to dashboard
    const homeButton = bottomNav.locator('button:has-text("Home")');
    await homeButton.click();
    await expect(customerPage).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  test('keyboard does not hide message input on messages page', async ({ customerPage }) => {
    await customerPage.goto('/messages');
    await customerPage.waitForLoadState('networkidle');

    // Open a conversation or start one
    const conversationButton = customerPage.locator(
      'button:has-text("Active Conversation"), button:has-text("About ")'
    ).first();
    const startNewButton = customerPage.locator('button:has-text("Start New Conversation")');

    if (await conversationButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await conversationButton.click();
    } else if (await startNewButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startNewButton.click();
    }

    // Wait for the textarea to appear
    const textarea = customerPage.locator('textarea[placeholder]');
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    // Focus the textarea (simulates tapping to bring up keyboard)
    await textarea.focus();
    await customerPage.waitForTimeout(500);

    // Verify the textarea is still visible and within the viewport
    const box = await textarea.boundingBox();
    expect(box).toBeTruthy();

    // The viewport height on iPhone 14 is 844 — the textarea should be within it
    // (In a real device, the keyboard would push content up, but in Playwright
    // we verify the textarea is positioned at the bottom and visible)
    const viewportSize = customerPage.viewportSize();
    if (viewportSize && box) {
      expect(box.y + box.height).toBeLessThanOrEqual(viewportSize.height + 10);
    }

    // Verify the textarea is still editable after focus
    await textarea.fill('test');
    await expect(textarea).toHaveValue('test');
  });

  test('message send button has adequate touch target size', async ({ customerPage }) => {
    await customerPage.goto('/messages');
    await customerPage.waitForLoadState('networkidle');

    // Open a conversation
    const conversationButton = customerPage.locator(
      'button:has-text("Active Conversation"), button:has-text("About ")'
    ).first();
    const startNewButton = customerPage.locator('button:has-text("Start New Conversation")');

    if (await conversationButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await conversationButton.click();
    } else if (await startNewButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startNewButton.click();
    }

    // Wait for chat view
    const textarea = customerPage.locator('textarea[placeholder]');
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    // The send button is w-11 h-11 (44px) — verify its size
    const sendButton = customerPage.locator(
      'button:has(svg path[d*="M6 12L3.269"])'
    );
    await expect(sendButton).toBeVisible();

    const box = await sendButton.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(42);
      expect(box.height).toBeGreaterThanOrEqual(42);
    }
  });

  test('booking page calendar is usable on mobile', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');

    // Select a service to get to the calendar step
    await expect(
      customerPage.locator('text="Choose a Service"')
    ).toBeVisible({ timeout: 15_000 });

    const firstService = customerPage.locator(
      'button:has(.font-heading.text-lg)'
    ).first();
    await firstService.click();

    // Select a dog
    await expect(
      customerPage.locator('text=/Select Your Dog/')
    ).toBeVisible({ timeout: 10_000 });
    const dogCard = customerPage.locator(
      'button:has-text("Playwright"), button:has-text("Cypress")'
    ).first();
    await dogCard.click();
    await customerPage.locator('button:has-text("Continue")').first().click();

    // Date step should show
    await expect(
      customerPage.locator('text=/Pick Your|Pick a Date/')
    ).toBeVisible({ timeout: 10_000 });

    // Verify no horizontal scroll on the calendar view
    const hasHorizontalScroll = await customerPage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });
});
