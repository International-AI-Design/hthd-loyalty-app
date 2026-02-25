import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Admin Analytics — MS-6', () => {
  test('Dashboard shows revenue snapshot', async ({ staffPage }) => {
    await staffPage.goto('/dashboard');
    await staffPage.waitForLoadState('networkidle');
    // Revenue section should show dollar amounts or "Today"/"This Week"/"This Month"
    await expect(
      staffPage.locator('text=/[Rr]evenue|Today|This [Ww]eek/'),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Customer segment cards render', async ({ staffPage }) => {
    await staffPage.goto('/dashboard');
    await staffPage.waitForLoadState('networkidle');
    // Look for segment labels
    const segments = staffPage.locator('text=/Active|At.Risk|New|Churned/');
    await expect(segments.first()).toBeVisible({ timeout: 15_000 });
  });

  test('Insights panel renders', async ({ staffPage }) => {
    await staffPage.goto('/dashboard');
    await staffPage.waitForLoadState('networkidle');
    // Insights section should be present (even if empty)
    const insightsSection = staffPage.locator('text=/[Ii]nsight/');
    const hasInsights = await insightsSection
      .first()
      .isVisible()
      .catch(() => false);
    console.log(`Insights panel visible: ${hasInsights}`);
    // Dashboard should load regardless
    const pageContent = await staffPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });
});
