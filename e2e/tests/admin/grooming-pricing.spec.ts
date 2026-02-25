import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Admin Grooming Pricing — MS-4', () => {
  test.describe.configure({ mode: 'serial' });

  test('Grooming pricing page loads', async ({ staffPage }) => {
    await staffPage.goto('/grooming-pricing');
    await staffPage.waitForLoadState('networkidle');
    await expect(staffPage.locator('text=/[Pp]ric/')).toBeVisible({ timeout: 15_000 });
  });

  test('Condition matrix shows sub-services and sizes', async ({ staffPage }) => {
    await staffPage.goto('/grooming-pricing');
    await staffPage.waitForLoadState('networkidle');
    await expect(staffPage.locator('text=/Small|Medium|Large|XL/')).toBeVisible({ timeout: 15_000 });
  });

  test('Add-ons tab renders', async ({ staffPage }) => {
    await staffPage.goto('/grooming-pricing');
    await staffPage.waitForLoadState('networkidle');

    // Click the Add-Ons tab
    const addOnTab = staffPage.locator('button:has-text("Add-Ons")');
    await expect(addOnTab).toBeVisible({ timeout: 15_000 });
    await addOnTab.click();

    // Should see the create form
    await expect(staffPage.locator('text=/Create New Add-On/')).toBeVisible({ timeout: 10_000 });
  });

  test('Service Prices tab renders', async ({ staffPage }) => {
    await staffPage.goto('/grooming-pricing');
    await staffPage.waitForLoadState('networkidle');

    // Click Service Prices tab
    const spTab = staffPage.locator('button:has-text("Service Prices")');
    await expect(spTab).toBeVisible({ timeout: 15_000 });
    await spTab.click();

    // Should see the table header or empty state
    const pageContent = await staffPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    // Should contain either size labels or empty message
    expect(pageContent!.match(/Small|Medium|No service prices/)).toBeTruthy();
  });
});
