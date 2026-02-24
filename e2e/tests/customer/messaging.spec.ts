/**
 * Messaging E2E Tests — HIGHEST PRIORITY
 *
 * Validates the AI chat experience: sending messages, receiving AI responses,
 * message history/pagination, navigation integrity, and quick replies.
 *
 * Test account has 70+ messages in at least one conversation for pagination testing.
 */
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Messaging', () => {
  test('send message and see AI response', async ({ customerPage }) => {
    await customerPage.goto('/messages');
    await customerPage.waitForLoadState('networkidle');

    // If we land on conversation list, open the first conversation or start a new one
    const conversationButton = customerPage.locator(
      'button:has-text("Active Conversation"), button:has-text("About ")'
    ).first();
    const startNewButton = customerPage.locator('button:has-text("Start New Conversation")');

    if (await conversationButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await conversationButton.click();
    } else if (await startNewButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startNewButton.click();
    }

    // Wait for the chat view to load — textarea should be visible
    const textarea = customerPage.locator('textarea[placeholder]');
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    // Type and send a message
    const testMessage = `E2E test message ${Date.now()}`;
    await textarea.fill(testMessage);
    // Click the send button (the round button next to the textarea)
    const sendButton = customerPage.locator(
      'button:has(svg path[d*="M6 12L3.269"])'
    );
    await sendButton.click();

    // Verify our message appears in the chat (optimistic rendering)
    await expect(
      customerPage.locator(`text=${testMessage}`)
    ).toBeVisible({ timeout: 10_000 });

    // Verify AI thinking indicator appears (cycling messages like "Sniffing", "Fetching", etc.)
    // Use .first() because the banner and chat area both show thinking text
    const thinkingIndicator = customerPage.locator(
      'text=/Sniffing|Fetching|Chasing|Tail is wagging|Hot on the scent|Almost got it|Digging|Woof/'
    ).first();
    await expect(thinkingIndicator).toBeVisible({ timeout: 10_000 });

    // Wait for AI response — a non-customer message bubble with >10 chars of text content
    // AI messages are in the chat area (below the banner), look for the last assistant message
    await expect(async () => {
      // Find all paragraphs that are likely AI response text in the chat
      const aiMessages = customerPage.locator('[class*="justify-start"] p[class*="text-sm"]');
      const count = await aiMessages.count();
      expect(count).toBeGreaterThan(0);
      const lastText = await aiMessages.last().textContent();
      expect(lastText).toBeTruthy();
      expect(lastText!.length).toBeGreaterThan(10);
    }).toPass({ timeout: 60_000, intervals: [3_000] });

    // Verify thinking indicator disappears after AI responds
    await expect(thinkingIndicator).not.toBeVisible({ timeout: 15_000 });
  });

  test('message history loads with older messages (pagination)', async ({ customerPage }) => {
    await customerPage.goto('/messages');
    await customerPage.waitForLoadState('networkidle');

    // Open the first active conversation (should have 70+ messages)
    const conversationButton = customerPage.locator(
      'button:has-text("Active Conversation"), button:has-text("About ")'
    ).first();

    if (await conversationButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await conversationButton.click();
    }

    // Wait for messages to load
    const messageArea = customerPage.locator('.overflow-y-auto');
    await expect(messageArea).toBeVisible({ timeout: 15_000 });

    // Wait for message bubbles to appear
    await customerPage.waitForTimeout(3_000);

    // Count visible message bubbles — the API fetches up to 500 messages
    // If the Zod limit bug is present, we would see fewer than expected
    const messageBubbles = customerPage.locator('.rounded-2xl p.text-sm.whitespace-pre-wrap');
    const messageCount = await messageBubbles.count();

    // The test account should have 70+ messages. If we get significantly fewer,
    // the Zod validation limit bug may be truncating results.
    expect(messageCount).toBeGreaterThan(10);

    // Scroll to the top of the message area to verify older messages loaded
    await messageArea.evaluate((el) => el.scrollTo(0, 0));
    await customerPage.waitForTimeout(500);

    // Verify date separators are visible (older messages have different dates)
    const dateSeparators = customerPage.locator('.rounded-full.font-medium:has-text("Today"), .rounded-full.font-medium:has-text("Yesterday"), .rounded-full.font-medium');
    const separatorCount = await dateSeparators.count();
    expect(separatorCount).toBeGreaterThanOrEqual(1);
  });

  test('back button goes to conversation list or dashboard, NOT login', async ({ customerPage }) => {
    await customerPage.goto('/messages');
    await customerPage.waitForLoadState('networkidle');

    // Open a conversation first
    const conversationButton = customerPage.locator(
      'button:has-text("Active Conversation"), button:has-text("About ")'
    ).first();

    if (await conversationButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await conversationButton.click();
    }

    // Wait for chat view
    const textarea = customerPage.locator('textarea[placeholder]');
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    // Click the back button in the chat header
    const backButton = customerPage.locator(
      'header button:has(svg path[d*="15.75 19.5"])'
    ).first();
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Wait for navigation
    await customerPage.waitForTimeout(1_000);

    // The URL should NOT be /login — it should be conversation list (/messages) or /dashboard
    const url = customerPage.url();
    expect(url).not.toMatch(/\/login/);
    expect(url).toMatch(/\/(messages|dashboard)/);
  });

  test('new conversation opens empty chat or messaging page is functional', async ({ customerPage }) => {
    await customerPage.goto('/messages');
    await customerPage.waitForLoadState('networkidle');

    // The messaging page may auto-open an existing conversation if one exists,
    // or show a conversation list with a "Start New Conversation" button.
    const startNewButton = customerPage.locator('button:has-text("Start New Conversation")');
    const textarea = customerPage.locator('textarea[placeholder]');

    if (await startNewButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await startNewButton.click();

      // Wait for the chat view to load with an empty state
      await expect(textarea).toBeVisible({ timeout: 15_000 });
      await expect(textarea).toHaveValue('');
      await expect(textarea).toBeEditable();
    } else {
      // Page auto-opened existing conversation — verify chat is functional
      await expect(textarea).toBeVisible({ timeout: 15_000 });
      await expect(textarea).toBeEditable();

      // Verify messages are visible (existing conversation loaded)
      const messageCount = await customerPage.locator('p[class*="text-sm"]').count();
      expect(messageCount).toBeGreaterThan(0);
    }
  });

  test('quick reply buttons send preset text', async ({ customerPage }) => {
    await customerPage.goto('/messages');
    await customerPage.waitForLoadState('networkidle');

    // Start a new conversation to see quick replies
    const startNewButton = customerPage.locator('button:has-text("Start New Conversation")');
    if (await startNewButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await startNewButton.click();
    }

    // Wait for chat view
    const textarea = customerPage.locator('textarea[placeholder]');
    await expect(textarea).toBeVisible({ timeout: 15_000 });

    // Quick replies should be visible for new/empty conversations
    const quickReplySection = customerPage.locator('text="Quick replies"');

    if (await quickReplySection.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Click the first quick reply button (e.g., "What are your hours?")
      const firstQuickReply = customerPage.locator(
        'button:has-text("What are your hours?")'
      );

      if (await firstQuickReply.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await firstQuickReply.click();

        // Verify the quick reply text appears as a sent message
        await expect(
          customerPage.locator('text="What are your hours?"').first()
        ).toBeVisible({ timeout: 10_000 });

        // Verify AI thinking indicator appears after sending
        const thinkingIndicator = customerPage.locator(
          'text=/Sniffing|Fetching|Chasing|Tail is wagging|Hot on the scent|Almost got it|Digging|Woof/'
        ).first();
        await expect(thinkingIndicator).toBeVisible({ timeout: 10_000 });
      }
    }
  });
});
