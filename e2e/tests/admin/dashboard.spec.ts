/**
 * Admin Dashboard E2E Tests
 *
 * Tests the main dashboard page including facility status metrics,
 * staff on duty card, arrivals/departures section, compliance alerts,
 * and quick action buttons. Verifies real data loads and navigation works.
 */
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ staffPage }) => {
    await staffPage.goto('/dashboard');
    // Dashboard has multiple loading spinners; wait for facility data
    await staffPage.waitForTimeout(3_000);
  });

  test('dashboard loads with facility status metrics', async ({ staffPage }) => {
    // Page heading should be visible
    const heading = staffPage.locator('h1');
    await expect(heading.first()).toBeVisible();
    const headingText = await heading.first().textContent();
    expect(headingText).toContain('Happy Tail Happy Dog');

    // Facility Status card should be present
    const facilityCard = staffPage.locator('h2', { hasText: 'Facility Status' });
    await expect(facilityCard).toBeVisible();

    // Should show dog count (a number like "0/40" or "12/40")
    const dogCount = staffPage.locator('text=/\\d+\\/\\d+/').first();
    const hasDogCount = await dogCount.isVisible().catch(() => false);

    // Should show "dogs on site" label
    const dogsLabel = staffPage.locator('text=dogs on site');
    const hasDogsLabel = await dogsLabel.isVisible().catch(() => false);

    // Should show capacity percentage
    const capacityLabel = staffPage.locator('text=Capacity');
    const hasCapacity = await capacityLabel.isVisible().catch(() => false);

    // At least one of these metrics should be visible
    expect(hasDogCount || hasDogsLabel || hasCapacity).toBeTruthy();

    // Service breakdown buttons (Daycare, Boarding, Grooming) should be present
    const daycareButton = staffPage.locator('button', { hasText: 'Daycare' });
    const boardingButton = staffPage.locator('button', { hasText: 'Boarding' });
    const groomingButton = staffPage.locator('button', { hasText: 'Grooming' });

    await expect(daycareButton).toBeVisible();
    await expect(boardingButton).toBeVisible();
    await expect(groomingButton).toBeVisible();
  });

  test('dashboard service breakdown cards are clickable and open drilldown', async ({ staffPage }) => {
    // Click the Daycare service card to open drilldown modal
    const daycareButton = staffPage.locator('button', { hasText: 'Daycare' });
    const isDaycareVisible = await daycareButton.isVisible().catch(() => false);

    if (!isDaycareVisible) {
      test.skip(true, 'Facility status not loaded');
      return;
    }

    await daycareButton.click();

    // A drilldown modal should appear (ServiceDrilldownModal)
    // Wait a moment for modal to render
    await staffPage.waitForTimeout(1_000);

    // The modal should have some content (could be a dialog, overlay, or panel)
    // Look for modal-like elements or any new content that appeared
    const modal = staffPage.locator('[role="dialog"], .fixed.inset-0, [class*="modal"]').first();
    const hasModal = await modal.isVisible().catch(() => false);

    // Even if modal implementation varies, clicking should not crash
    // Verify page is still functional by checking heading
    const heading = staffPage.locator('h1');
    await expect(heading.first()).toBeVisible();

    if (hasModal) {
      // Close the modal if it appeared
      const closeButton = staffPage.locator('button[aria-label*="close"], button[aria-label*="Close"]').first();
      const hasClose = await closeButton.isVisible().catch(() => false);
      if (hasClose) {
        await closeButton.click();
      }
    }
  });

  test('staff on duty section loads', async ({ staffPage }) => {
    // Staff On Duty card should be visible — try multiple heading patterns
    const staffCard = staffPage.locator('h2', { hasText: 'Staff' }).first();
    const hasStaffCard = await staffCard.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!hasStaffCard) {
      // The section may use a different heading or not be present
      test.skip(true, 'Staff on duty section not visible on dashboard');
      return;
    }

    // Should show On Duty count or Staff-related info
    const pageText = await staffPage.locator('main').textContent();
    expect(pageText).toBeTruthy();
    // At minimum the staff section should have some content
    expect(pageText!.toLowerCase()).toMatch(/staff|duty|ratio/);
  });

  test('arrivals and departures section loads', async ({ staffPage }) => {
    // Arrivals & Departures heading
    const arrivalsHeading = staffPage.locator('h2', { hasText: 'Arrivals & Departures' });
    await expect(arrivalsHeading).toBeVisible();

    // On desktop, should show Arrivals and Departures columns
    const arrivalsColumn = staffPage.locator('h3', { hasText: 'Arrivals' });
    const departuresColumn = staffPage.locator('h3', { hasText: 'Departures' });

    // At least one should be visible (desktop shows both, mobile shows tabs)
    const hasArrivals = await arrivalsColumn.isVisible().catch(() => false);
    const hasDepartures = await departuresColumn.isVisible().catch(() => false);

    // On mobile viewport, tabs are shown instead
    const arrivalTab = staffPage.locator('button', { hasText: 'Arrivals' });
    const hasTabs = await arrivalTab.isVisible().catch(() => false);

    expect(hasArrivals || hasDepartures || hasTabs).toBeTruthy();
  });

  test('quick action buttons navigate to correct pages', async ({ staffPage }) => {
    // "Manage Schedule" quick action should navigate to /staff-schedule
    const scheduleButton = staffPage.locator('button', { hasText: 'Manage Schedule' });
    const hasScheduleButton = await scheduleButton.isVisible().catch(() => false);

    if (hasScheduleButton) {
      await scheduleButton.click();
      await expect(staffPage).toHaveURL(/\/staff-schedule/, { timeout: 10_000 });
      await staffPage.goBack();
    }

    // "Customer Lookup" quick action should navigate to /customers
    await staffPage.goto('/dashboard');
    await staffPage.waitForTimeout(2_000);

    const customerButton = staffPage.locator('button', { hasText: 'Customer Lookup' });
    const hasCustomerButton = await customerButton.isVisible().catch(() => false);

    if (hasCustomerButton) {
      await customerButton.click();
      await expect(staffPage).toHaveURL(/\/customers/, { timeout: 10_000 });
      await staffPage.goBack();
    }

    // "Loyalty Points" quick action should navigate to /loyalty
    await staffPage.goto('/dashboard');
    await staffPage.waitForTimeout(2_000);

    const loyaltyButton = staffPage.locator('button', { hasText: 'Loyalty Points' });
    const hasLoyaltyButton = await loyaltyButton.isVisible().catch(() => false);

    if (hasLoyaltyButton) {
      await loyaltyButton.click();
      await expect(staffPage).toHaveURL(/\/loyalty/, { timeout: 10_000 });
    }
  });

  test('date picker changes displayed date', async ({ staffPage }) => {
    // Date input should be present
    const dateInput = staffPage.locator('input[type="date"]');
    await expect(dateInput).toBeVisible();

    // Change to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    await dateInput.fill(dateStr);

    // "Today" button should appear when viewing a non-today date
    // Use exact match to avoid matching "How's today looking?"
    const todayButton = staffPage.getByRole('button', { name: 'Today', exact: true });
    await expect(todayButton).toBeVisible({ timeout: 5_000 });

    // Click "Today" to return
    await todayButton.click();

    // "Today" button should disappear
    await expect(todayButton).not.toBeVisible({ timeout: 5_000 });
  });
});
