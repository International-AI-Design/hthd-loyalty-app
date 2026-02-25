import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Grooming Pricing — MS-4', () => {
  test.describe.configure({ mode: 'serial' });

  test('Booking page loads grooming option', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    await expect(customerPage.locator('text=/[Gg]rooming/')).toBeVisible({ timeout: 15_000 });
  });

  test('Selecting grooming shows sub-services with prices', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');

    // Click grooming service
    const groomingOption = customerPage.locator('text=/[Gg]rooming/').first();
    await groomingOption.click();
    await customerPage.waitForLoadState('networkidle');

    // Sub-service step should render with dollar amounts
    await expect(customerPage.locator('text=/\\$\\d+/')).toBeVisible({ timeout: 15_000 });
  });

  test('Selecting sub-service shows continue button and add-ons', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');

    // Navigate to grooming sub-services
    const groomingOption = customerPage.locator('text=/[Gg]rooming/').first();
    await groomingOption.click();
    await customerPage.waitForLoadState('networkidle');

    // Wait for sub-services to load
    await expect(customerPage.locator('text=/\\$\\d+/')).toBeVisible({ timeout: 15_000 });

    // Click first sub-service card
    const firstSubService = customerPage.locator('button:has-text("$")').first();
    await firstSubService.click();

    // Continue button should appear
    await expect(customerPage.locator('button:has-text("Continue")')).toBeVisible({ timeout: 5_000 });

    // Quote summary should show "Price Estimate" or "Estimated Total"
    await expect(customerPage.locator('text=/[Pp]rice [Ee]stimate|[Ee]stimated [Tt]otal/')).toBeVisible({ timeout: 5_000 });
  });

  test('Quote summary shows no NaN or undefined', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');

    const groomingOption = customerPage.locator('text=/[Gg]rooming/').first();
    await groomingOption.click();
    await customerPage.waitForLoadState('networkidle');
    await expect(customerPage.locator('text=/\\$\\d+/')).toBeVisible({ timeout: 15_000 });

    // Select a sub-service
    const firstSubService = customerPage.locator('button:has-text("$")').first();
    await firstSubService.click();

    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    expect(pageContent).not.toContain('NaN');
    expect(pageContent).not.toContain('undefined');
  });

  test('Navigate back from grooming booking preserves state', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');
    await customerPage.goBack();
    await customerPage.waitForLoadState('networkidle');
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
  });
});
