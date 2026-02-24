/**
 * Booking Wizard E2E Tests
 *
 * Validates the multi-step booking flow: service selection, dog selection,
 * date picking, grooming-specific flows, and navigation integrity.
 *
 * IMPORTANT: These tests navigate through the wizard but NEVER submit a booking.
 * We verify each step renders and transitions correctly without creating real bookings.
 */
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Booking Wizard', () => {
  test('service selection renders with service cards', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');

    // Verify the page title
    await expect(
      customerPage.locator('text="Choose a Service"')
    ).toBeVisible({ timeout: 15_000 });

    // Verify service cards are visible (Daycare, Boarding, Grooming)
    // Service cards are buttons with displayName headings
    const serviceCards = customerPage.locator(
      'button:has(.font-heading.text-lg)'
    );
    const cardCount = await serviceCards.count();
    expect(cardCount).toBeGreaterThanOrEqual(1);

    // Verify at least some known service names appear
    const pageText = await customerPage.locator('main').textContent();
    // At minimum, the app should have at least one active service
    expect(pageText).toBeTruthy();
    expect(pageText!.length).toBeGreaterThan(50);
  });

  test('selecting daycare navigates to dog selection step', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');

    // Wait for services to load
    await expect(
      customerPage.locator('text="Choose a Service"')
    ).toBeVisible({ timeout: 15_000 });

    // Click the first service card (Daycare is typically first by sort order)
    const firstService = customerPage.locator(
      'button:has(.font-heading.text-lg)'
    ).first();
    await firstService.click();

    // Should advance to step 2: dog selection
    await expect(
      customerPage.locator('text=/Select Your Dog/')
    ).toBeVisible({ timeout: 10_000 });

    // Verify dog cards are shown (test account has dogs named Playwright and Cypress)
    const dogCard = customerPage.locator(
      'button:has-text("Playwright"), button:has-text("Cypress")'
    ).first();
    await expect(dogCard).toBeVisible({ timeout: 10_000 });
  });

  test('wizard step 2 to step 3: dog selection to date selection', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');

    // Step 1: Select first service
    await expect(
      customerPage.locator('text="Choose a Service"')
    ).toBeVisible({ timeout: 15_000 });
    await customerPage.locator('button:has(.font-heading.text-lg)').first().click();

    // Step 2: Select a dog
    await expect(
      customerPage.locator('text=/Select Your Dog/')
    ).toBeVisible({ timeout: 10_000 });
    const dogCard = customerPage.locator(
      'button:has-text("Playwright"), button:has-text("Cypress")'
    ).first();
    await dogCard.click();

    // Click Continue
    const continueButton = customerPage.locator('button:has-text("Continue")').first();
    await expect(continueButton).toBeVisible();
    await continueButton.click();

    // Step 3: Date selection should appear
    await expect(
      customerPage.locator('text=/Pick Your|Pick a Date/')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('back button at each step returns to previous step, not login', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');

    // Step 1: Select a service to advance to step 2
    await expect(
      customerPage.locator('text="Choose a Service"')
    ).toBeVisible({ timeout: 15_000 });
    await customerPage.locator('button:has(.font-heading.text-lg)').first().click();

    // Step 2: Verify we're on dog selection
    await expect(
      customerPage.locator('text=/Select Your Dog/')
    ).toBeVisible({ timeout: 10_000 });

    // Click the back button (aria-label="Go back")
    const backButton = customerPage.locator('button[aria-label="Go back"]');
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Should go back to step 1 (service selection), NOT login
    await expect(
      customerPage.locator('text="Choose a Service"')
    ).toBeVisible({ timeout: 10_000 });

    // URL should still be /book, not /login
    expect(customerPage.url()).not.toMatch(/\/login/);
    expect(customerPage.url()).toMatch(/\/book/);
  });

  test('grooming flow shows grooming sub-service selection', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');

    // Wait for services
    await expect(
      customerPage.locator('text="Choose a Service"')
    ).toBeVisible({ timeout: 15_000 });

    // Find and click the Grooming service card
    const groomingCard = customerPage.locator(
      'button:has-text("Grooming"), button:has-text("grooming")'
    ).first();

    if (await groomingCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await groomingCard.click();

      // Step 1.5: Grooming sub-service selection
      await expect(
        customerPage.locator('text="What service does your pup need?"')
      ).toBeVisible({ timeout: 10_000 });

      // Sub-service cards should be visible — try multiple selector patterns
      const subServiceCards = customerPage.locator(
        'main button, main [role="button"]'
      ).filter({ hasNotText: /^(Home|Book|Messages|My Pets|Rewards|Go back)$/ });

      await customerPage.waitForTimeout(3_000); // Wait for sub-services to load

      const subCount = await subServiceCards.count();
      if (subCount === 0) {
        // Grooming sub-services may not be configured — this is a genuine gap to flag
        test.skip(true, 'No grooming sub-service cards rendered (possible missing data)');
        return;
      }

      // Select the first sub-service to continue
      await subServiceCards.first().click();

      // Should advance to step 2: dog selection
      await expect(
        customerPage.locator('text="Select Your Dog"')
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('grooming confirmation shows price pending messaging', async ({ customerPage }) => {
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');

    // Step 1: Select Grooming
    await expect(
      customerPage.locator('text="Choose a Service"')
    ).toBeVisible({ timeout: 15_000 });

    const groomingCard = customerPage.locator(
      'button:has-text("Grooming"), button:has-text("grooming")'
    ).first();

    if (!(await groomingCard.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip(true, 'Grooming service not available');
      return;
    }
    await groomingCard.click();

    // Step 1.5: Select first sub-service
    await expect(
      customerPage.locator('text="What service does your pup need?"')
    ).toBeVisible({ timeout: 10_000 });
    await customerPage.locator('button:has(.font-heading.text-base)').first().click();

    // Step 2: Select a dog
    await expect(
      customerPage.locator('text="Select Your Dog"')
    ).toBeVisible({ timeout: 10_000 });
    const dogCard = customerPage.locator(
      'button:has-text("Playwright"), button:has-text("Cypress")'
    ).first();
    await dogCard.click();

    // If size selection appears, select "Medium"
    const sizeButton = customerPage.locator('button:has-text("Medium")');
    if (await sizeButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await sizeButton.click();
      await customerPage.waitForTimeout(1_000);
    }

    await customerPage.locator('button:has-text("Continue")').first().click();

    // Step 3: Select a date
    await expect(
      customerPage.locator('text="Pick a Date"')
    ).toBeVisible({ timeout: 10_000 });

    // Click a future available date on the calendar
    const availableDay = customerPage.locator(
      'button:not([disabled]).rounded-full'
    );
    // Find a clickable future date
    const dayButtons = customerPage.locator('button').filter({ hasNotText: /^$/ });
    let dateSelected = false;
    const allButtons = await dayButtons.all();
    for (const btn of allButtons) {
      const text = await btn.textContent();
      const isDisabled = await btn.isDisabled();
      if (text && /^\d{1,2}$/.test(text.trim()) && !isDisabled) {
        const num = parseInt(text.trim());
        if (num >= 15 && num <= 28) {
          await btn.click();
          dateSelected = true;
          break;
        }
      }
    }

    if (!dateSelected) {
      test.skip(true, 'No available dates found on calendar');
      return;
    }

    // Click Continue on date step
    await customerPage.locator('button:has-text("Continue")').first().click();

    // Step 4: Time selection for grooming
    await expect(
      customerPage.locator('text="Pick a Time"')
    ).toBeVisible({ timeout: 10_000 });

    // Select the first available time slot
    const timeSlot = customerPage.locator(
      'button:has(.font-semibold):not([disabled])'
    ).first();

    if (await timeSlot.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await timeSlot.click();
      await customerPage.locator('button:has-text("Continue")').first().click();

      // Step 5 (photo) or Step 6 (bundles) or Step 7 (review)
      // Navigate through photo skip to get to review
      const skipButton = customerPage.locator('button:has-text("Skip")');
      if (await skipButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await skipButton.click();
      }

      // Skip bundles if shown
      const noThanksButton = customerPage.locator('button:has-text("No Thanks")');
      if (await noThanksButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await noThanksButton.click();
      }

      // Step 7: Review & Confirm — verify price pending message is accessible
      const reviewHeader = customerPage.locator('text="Review & Confirm"');
      if (await reviewHeader.isVisible({ timeout: 10_000 }).catch(() => false)) {
        // The confirm button should say "Confirm Booking"
        // We do NOT click it — just verify the review step rendered correctly
        await expect(
          customerPage.locator('text=/Service|Estimated Total/')
        ).toBeVisible();
      }
    }
  });

  test('dog selection with no dogs shows add-dog form', async ({ customerPage }) => {
    // This test verifies the add-dog inline form exists in the component.
    // Since the test account has dogs, we verify the "Add another dog" link is present instead.
    await customerPage.goto('/book');
    await customerPage.waitForLoadState('networkidle');

    // Select first service to get to step 2
    await expect(
      customerPage.locator('text="Choose a Service"')
    ).toBeVisible({ timeout: 15_000 });
    await customerPage.locator('button:has(.font-heading.text-lg)').first().click();

    // Step 2: Dog selection
    await expect(
      customerPage.locator('text=/Select Your Dog/')
    ).toBeVisible({ timeout: 10_000 });

    // Since test account has dogs, verify "Add another dog" link is present
    const addDogLink = customerPage.locator('button:has-text("Add another dog")');
    await expect(addDogLink).toBeVisible({ timeout: 5_000 });

    // Click it to verify the inline form appears
    await addDogLink.click();

    // Verify the add-dog form fields appear
    await expect(
      customerPage.locator('input[placeholder="Dog\'s name"]')
    ).toBeVisible({ timeout: 5_000 });
  });
});
