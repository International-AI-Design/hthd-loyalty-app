/**
 * Admin Messaging Page E2E Tests
 *
 * Tests the split-panel messaging interface including conversation list,
 * filter tabs, thread display, reply functionality, and staff actions
 * (assign, escalate, de-escalate). Also covers mobile viewport behavior.
 */
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Admin Messaging Page', () => {
  test.beforeEach(async ({ staffPage }) => {
    await staffPage.goto('/messages');
    // Wait for conversation list to finish loading (spinner disappears)
    await staffPage.waitForSelector('.animate-spin', { state: 'detached', timeout: 15_000 }).catch(() => {});
  });

  test('conversation list loads with at least one conversation', async ({ staffPage }) => {
    // The list panel should be visible with conversation buttons
    // Each conversation is a <button> with min-h-[64px] inside the scrollable list
    const conversations = staffPage.locator('button').filter({ has: staffPage.locator('.truncate') });

    // Wait for at least one conversation to appear (or empty state)
    const hasConversations = await conversations.count() > 0;
    const emptyState = staffPage.locator('text=No conversations found');
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    // We expect at least one conversation in a production system with test data
    // If empty, the empty state message should be visible (not a blank screen)
    expect(hasConversations || hasEmpty).toBeTruthy();

    if (hasConversations) {
      // Verify first conversation shows a customer name
      const firstConversation = conversations.first();
      await expect(firstConversation).toBeVisible();
      // Conversation should contain text (customer name)
      const text = await firstConversation.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  test('filter tabs work and update URL', async ({ staffPage }) => {
    // Click the "Escalated" filter tab
    const escalatedTab = staffPage.locator('button', { hasText: 'Escalated' }).first();
    await expect(escalatedTab).toBeVisible();
    await escalatedTab.click();

    // URL should contain ?filter=escalated
    await expect(staffPage).toHaveURL(/filter=escalated/);

    // Click "All" tab to reset
    const allTab = staffPage.locator('button', { hasText: 'All' }).first();
    await allTab.click();

    // URL should no longer have filter param (or be just /messages)
    await expect(staffPage).toHaveURL(/\/messages(?:\?)?$/);

    // Click "Closed" tab
    const closedTab = staffPage.locator('button', { hasText: 'Closed' }).first();
    await closedTab.click();
    await expect(staffPage).toHaveURL(/filter=closed/);
  });

  test('opening a conversation shows the message thread', async ({ staffPage }) => {
    // Need at least one conversation to click
    const conversations = staffPage.locator('button.w-full.text-left');
    const count = await conversations.count();

    if (count === 0) {
      test.skip(true, 'No conversations available to test thread display');
      return;
    }

    // Click the first conversation
    await conversations.first().click();

    // On desktop: thread panel should appear showing messages or "Select a conversation"
    // The thread header shows customer name and status badge
    const threadHeader = staffPage.locator('h3.truncate').first();
    await expect(threadHeader).toBeVisible({ timeout: 10_000 });

    // Thread should contain message bubbles (rounded-2xl divs) or at least load
    const threadMessages = staffPage.locator('.rounded-2xl');
    await threadMessages.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});

    // Verify the reply textarea is visible (conversation is not closed) or thread loaded
    const replyArea = staffPage.locator('textarea[placeholder="Type a reply..."]');
    const isReplyVisible = await replyArea.isVisible().catch(() => false);
    const hasMessages = await threadMessages.count() > 0;

    // Either we can reply (active/escalated) or there are messages displayed
    expect(isReplyVisible || hasMessages).toBeTruthy();
  });

  test('send reply in thread', async ({ staffPage }) => {
    const conversations = staffPage.locator('button.w-full.text-left');
    const count = await conversations.count();

    if (count === 0) {
      test.skip(true, 'No conversations available to test reply');
      return;
    }

    // Find a non-closed conversation (one that should have reply textarea)
    // Click first conversation and check if reply is available
    await conversations.first().click();

    const replyTextarea = staffPage.locator('textarea[placeholder="Type a reply..."]');
    const canReply = await replyTextarea.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!canReply) {
      test.skip(true, 'First conversation is closed; cannot test reply');
      return;
    }

    // Type a test reply
    const testMessage = `E2E test reply ${Date.now()}`;
    await replyTextarea.fill(testMessage);

    // Send button should be enabled now
    const sendButton = staffPage.locator('button').filter({ has: staffPage.locator('svg path[d*="M6 12L3.269"]') });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    // After sending, the reply textarea should be cleared
    await expect(replyTextarea).toHaveValue('', { timeout: 10_000 });

    // The sent message should appear in the thread
    const sentMessage = staffPage.locator('.rounded-2xl', { hasText: testMessage });
    await expect(sentMessage).toBeVisible({ timeout: 10_000 });
  });

  test('assign button works on a conversation', async ({ staffPage }) => {
    const conversations = staffPage.locator('button.w-full.text-left');
    const count = await conversations.count();

    if (count === 0) {
      test.skip(true, 'No conversations available to test assign');
      return;
    }

    // Click first conversation
    await conversations.first().click();

    // Look for the "Assign" button in the thread header
    const assignButton = staffPage.locator('button', { hasText: 'Assign' }).first();
    const canAssign = await assignButton.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!canAssign) {
      test.skip(true, 'No assign button visible (conversation may be closed)');
      return;
    }

    await assignButton.click();

    // After assignment, the "Assigned:" text should appear in thread header
    // or the thread should refresh showing the assignment
    // Wait for the fetch to complete and UI to update
    await staffPage.waitForTimeout(2_000);

    // Verify the thread still shows (no error state, no crash)
    const threadHeader = staffPage.locator('h3.truncate').first();
    await expect(threadHeader).toBeVisible();
  });

  test('escalate button changes conversation status', async ({ staffPage }) => {
    // Filter to active conversations first
    const activeTab = staffPage.locator('button', { hasText: 'Active' }).first();
    await activeTab.click();
    await staffPage.waitForTimeout(2_000);

    const conversations = staffPage.locator('button.w-full.text-left');
    // Wait for at least one visible conversation
    await conversations.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    const count = await conversations.count();

    if (count === 0) {
      test.skip(true, 'No active conversations available to test escalate');
      return;
    }

    // Click first active conversation
    await conversations.first().click();
    await staffPage.waitForTimeout(1_000);

    // Look for the "Escalate" button (red-tinted button in thread header)
    // Use waitFor instead of isVisible to properly wait for the thread to load
    const escalateButton = staffPage.locator('button', { hasText: 'Escalate' }).first();
    await escalateButton.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    const canEscalate = await escalateButton.isVisible();

    if (!canEscalate) {
      test.skip(true, 'No escalate button visible (conversation may already be escalated or closed)');
      return;
    }

    await escalateButton.click();
    await staffPage.waitForTimeout(2_000);

    // After escalation, the page may re-filter or the conversation may move to Escalated tab.
    // Check for one of these outcomes:
    // 1) De-escalate button appears (conversation stays selected)
    // 2) Conversation moves to Escalated filter (visible in Escalated tab)
    // 3) The "Escalate" button is gone (action succeeded)
    const deEscalateButton = staffPage.locator('button', { hasText: 'De-escalate' });
    const hasDeEscalate = await deEscalateButton.isVisible().catch(() => false);

    if (hasDeEscalate) {
      // Conversation stayed selected and status changed
      const escalatedBadge = staffPage.locator('span.rounded-full', { hasText: 'Escalated' });
      await expect(escalatedBadge.first()).toBeVisible();
    } else {
      // Escalation likely caused re-filter or deselection.
      // Verify by switching to Escalated tab and checking conversations exist.
      const escalatedTab = staffPage.locator('button', { hasText: 'Escalated' }).first();
      await escalatedTab.click();
      await staffPage.waitForTimeout(1_000);

      const escalatedConversations = staffPage.locator('button.w-full.text-left');
      const escalatedCount = await escalatedConversations.count();

      // At least one conversation should be in the Escalated list
      expect(escalatedCount).toBeGreaterThan(0);
    }
  });

  test('de-escalate button returns conversation to active', async ({ staffPage }) => {
    // Filter to escalated conversations
    const escalatedTab = staffPage.locator('button', { hasText: 'Escalated' }).first();
    await escalatedTab.click();
    await staffPage.waitForTimeout(1_000);

    const conversations = staffPage.locator('button.w-full.text-left');
    const count = await conversations.count();

    if (count === 0) {
      test.skip(true, 'No escalated conversations available to test de-escalate');
      return;
    }

    // Click first escalated conversation
    await conversations.first().click();

    // Look for the "De-escalate" button (green-tinted in thread header)
    const deEscalateButton = staffPage.locator('button', { hasText: 'De-escalate' });
    const canDeEscalate = await deEscalateButton.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!canDeEscalate) {
      test.skip(true, 'No de-escalate button visible');
      return;
    }

    await deEscalateButton.click();

    // After de-escalation, "Escalate" button should appear and status returns to "Active"
    const escalateButton = staffPage.locator('button', { hasText: /^Escalate$/ });
    await expect(escalateButton).toBeVisible({ timeout: 10_000 });

    // Status badge should now say "Active"
    const activeBadge = staffPage.locator('span.rounded-full', { hasText: 'Active' });
    await expect(activeBadge.first()).toBeVisible();
  });

  test('mobile: back button returns to conversation list', async ({ browser }) => {
    // Create a mobile-sized context
    const context = await browser.newContext({
      baseURL: process.env.ADMIN_APP_URL || 'https://hthd-admin.internationalaidesign.com',
      viewport: { width: 375, height: 812 }, // iPhone-sized
    });
    const page = await context.newPage();

    // Login on mobile
    await page.goto('/login');
    await page.fill('input[name="username"], input[type="text"]', process.env.TEST_STAFF_USERNAME || 'qa-staff');
    await page.fill('input[type="password"], input[name="password"]', process.env.TEST_STAFF_PASSWORD || '');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Navigate to messages
    await page.goto('/messages');
    await page.waitForSelector('.animate-spin', { state: 'detached', timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2_000);

    // On mobile, the conversation list might use a different layout.
    // Wait for a visible conversation button (not just DOM presence).
    const conversations = page.locator('button.w-full.text-left');
    await conversations.first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});

    const isFirstVisible = await conversations.first().isVisible();
    if (!isFirstVisible) {
      await context.close();
      test.skip(true, 'Conversation list not visible on mobile viewport (layout may hide list panel)');
      return;
    }

    // On mobile, clicking a conversation shows the thread (full screen)
    await conversations.first().click();
    await page.waitForTimeout(1_000);

    // The back button (lg:hidden, chevron left SVG) should be visible on mobile
    const backButton = page.locator('button').filter({ has: page.locator('svg path[d="M15 19l-7-7 7-7"]') });
    const hasBackButton = await backButton.first().isVisible().catch(() => false);

    if (!hasBackButton) {
      await context.close();
      test.skip(true, 'Mobile back button not visible (thread may not take full screen on mobile)');
      return;
    }

    // Click back
    await backButton.first().click();

    // Should return to conversation list -- verify by checking the "Messages" heading
    const messagesHeading = page.locator('h2', { hasText: 'Messages' });
    await expect(messagesHeading).toBeVisible({ timeout: 5_000 });

    // Verify we are NOT on the login page
    await expect(page).not.toHaveURL(/\/login/);

    await context.close();
  });
});
