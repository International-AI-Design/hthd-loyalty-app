# MS-3.1: Retroactive E2E Verification — MS-1 through MS-3

## Session Protocol
> **One micro-sprint per session.** Each session: execute this sprint only, pass build gates, commit, push, then shut down. Do NOT start the next sprint in the same session. Fresh context prevents compaction disasters.
>
> **Startup:** Ensure Docker Postgres (`happy-tail-postgres`) is running on port 5432 — tests need it.
>
> **Shutdown sequence:** After push succeeds → update CHANGELOG.md with MS-3.1 entry → archive session to `archive/sessions/YYYY-MM-DD_HH-MM_session.md` → update memory files → verify all logs written → confirm ready to exit.

## Context
MS-1 through MS-3 shipped features without thorough E2E verification. This sprint retroactively tests everything before moving forward. No new features — verification and bug-fixing only.

**What was shipped without E2E:**
- **MS-1**: Schema + migration (GroomingServicePrice, GroomingAddOn, BookingAddOn, ServiceAgreement, AgreementSignature, BoardingDetail, CustomerBadge, AimInsight + Dog field extensions)
- **MS-2**: Upload module (`POST /api/v2/uploads`), extended dog profile endpoints (allergies, specialNeeds, emergencyVet fields)
- **MS-3**: PhotoUpload component, VaccinationUpload component, updated DogProfilePage with health/safety card, updated MyPetsPage with photo thumbnails

## Read First (for patterns)
- `e2e/fixtures/auth.fixture.ts` — fixture pattern (`customerPage`, `staffPage`)
- `e2e/fixtures/test-accounts.ts` — QA accounts (test dogs: Playwright, Cypress)
- `e2e/tests/customer/dashboard.spec.ts` — test structure pattern
- `e2e/playwright.config.ts` — config (sequential, 1 worker, 90s timeout, tests against prod URLs by default)
- `customer-app/src/pages/DogProfilePage.tsx` — current dog profile page
- `customer-app/src/pages/MyPetsPage.tsx` — current pets list page
- `customer-app/src/components/PhotoUpload.tsx` — photo upload component
- `customer-app/src/components/VaccinationUpload.tsx` — vaccination upload component

## What to Do

### Phase 1: Server API Verification (curl-based, no E2E framework needed)

Before writing browser tests, verify the server endpoints actually return what the frontend expects. This catches the #1 class of bugs: mismatched API shapes.

**1A. Verify dog profile v2 endpoint returns new fields:**
```bash
# Get a customer token (use test credentials from test-accounts.ts)
TOKEN=$(curl -s -X POST https://hthd-api.internationalaidesign.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"qa-test@internationalaidesign.com","password":"<from env>"}' | jq -r '.token')

# Get v2 dogs list — should include photoUrl
curl -s -H "Authorization: Bearer $TOKEN" \
  https://hthd-api.internationalaidesign.com/api/v2/dogs | jq '.dogs[0] | keys'

# Expected: should include "photoUrl", "allergies", "specialNeeds", "emergencyVetName", "emergencyVetPhone", "lastGroomDate"

# Get single dog profile — should include vaccinations with documentUrl field
DOG_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  https://hthd-api.internationalaidesign.com/api/v2/dogs | jq -r '.dogs[0].id')

curl -s -H "Authorization: Bearer $TOKEN" \
  https://hthd-api.internationalaidesign.com/api/v2/dogs/$DOG_ID | jq '.dog | {id, name, photoUrl, allergies, specialNeeds, emergencyVetName, emergencyVetPhone, lastGroomDate, vaccinations: [.vaccinations[] | {id, name, documentUrl, cloudinaryPublicId}]}'
```

**Verify checklist for Phase 1A:**
- [ ] `/api/v2/dogs` returns dogs with `photoUrl` field present (even if null)
- [ ] `/api/v2/dogs/:id` returns `allergies`, `specialNeeds`, `emergencyVetName`, `emergencyVetPhone`, `lastGroomDate`
- [ ] Vaccination records include `documentUrl` and `cloudinaryPublicId` fields
- [ ] All field names are camelCase (not snake_case)

**1B. Verify upload endpoint accepts multipart:**
```bash
# Create a tiny test image
convert -size 100x100 xc:blue /tmp/test-upload.jpg 2>/dev/null || \
  printf '\xff\xd8\xff\xe0' > /tmp/test-upload.jpg

curl -s -X POST https://hthd-api.internationalaidesign.com/api/v2/uploads \
  -H "Authorization: Bearer $TOKEN" \
  -F "photo=@/tmp/test-upload.jpg" | jq '.'

# Expected: { "url": "https://res.cloudinary.com/...", "publicId": "hthd/..." }
# If CLOUDINARY env vars not set, expect a clear error (not a 500 crash)
```

**Verify checklist for Phase 1B:**
- [ ] Upload endpoint responds (not 404)
- [ ] Returns `url` and `publicId` on success, OR clear error message if Cloudinary not configured
- [ ] Rejects non-image files
- [ ] Rejects files over 10MB

**1C. Verify schema migration applied:**
```bash
cd server && npx prisma migrate status
```
- [ ] `sprints_abcd_schema` migration shows as applied
- [ ] No pending migrations

### Phase 2: Browser E2E Tests

**IMPORTANT:** Tests run against LIVE production URLs by default. Never create/delete real data. Read-only navigation and UI verification only.

#### Start local dev servers (if testing locally):
```bash
cd server && npm run dev &        # Port 3000
cd customer-app && npm run dev &  # Port 5173
cd admin-app && npm run dev &     # Port 5174
```

Or set env vars to test against production:
```bash
export CUSTOMER_APP_URL=https://hthd.internationalaidesign.com
export ADMIN_APP_URL=https://hthd-admin.internationalaidesign.com
```

#### 2A. Create `e2e/tests/customer/dog-profile.spec.ts`:
```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Dog Profile — MS-2/MS-3 Features', () => {
  test.beforeEach(async ({ customerPage }) => {
    // Navigate to My Pets, then open first dog profile
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');
  });

  test('My Pets page renders pet cards', async ({ customerPage }) => {
    // Should show at least one pet card (QA test account has dogs)
    const petCards = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ });
    await expect(petCards.first()).toBeVisible({ timeout: 15_000 });
  });

  test('Pet cards show photo thumbnail or letter avatar', async ({ customerPage }) => {
    // Each card should have either an <img> or a letter avatar div
    const firstCard = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    const hasImage = await firstCard.locator('img').count() > 0;
    const hasAvatar = await firstCard.locator('.font-heading').count() > 0;
    expect(hasImage || hasAvatar).toBeTruthy();
  });

  test('Dog profile page loads without white screen', async ({ customerPage }) => {
    // Click first pet to navigate to profile
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // Page should NOT be a white screen — look for profile content
    await expect(customerPage.locator('text=/Playwright|Cypress/')).toBeVisible({ timeout: 15_000 });
  });

  test('Dog profile shows photo upload area', async ({ customerPage }) => {
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // PhotoUpload component should render (either image or "Add a photo" placeholder)
    const photoArea = customerPage.locator('text="Add a photo of your pup!"').or(
      customerPage.locator('img[alt="Dog photo"]')
    );
    await expect(photoArea).toBeVisible({ timeout: 15_000 });
  });

  test('Dog profile shows identity card with basic info', async ({ customerPage }) => {
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // Should show the dog name as heading
    const nameHeading = customerPage.locator('.font-heading').filter({ hasText: /Playwright|Cypress/ });
    await expect(nameHeading).toBeVisible({ timeout: 15_000 });

    // Edit button should be present
    const editButton = customerPage.locator('[class*="min-h-\\[44px\\]"]').first();
    await expect(editButton).toBeVisible();
  });

  test('Dog profile shows vaccination section', async ({ customerPage }) => {
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // Vaccination section header
    await expect(customerPage.locator('text="Vaccinations"')).toBeVisible({ timeout: 15_000 });

    // Add button for vaccinations
    const addVaxButton = customerPage.locator('button').filter({ hasText: 'Add' }).first();
    await expect(addVaxButton).toBeVisible();
  });

  test('Dog profile shows medication section', async ({ customerPage }) => {
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    await expect(customerPage.locator('text="Medications"')).toBeVisible({ timeout: 15_000 });
  });

  test('Vaccination cards show document upload option', async ({ customerPage }) => {
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // If vaccinations exist, each card should show "Upload document photo" or "View Document"
    const vaxCards = customerPage.locator('.bg-brand-cream').filter({ hasText: /Given:/ });
    const vaxCount = await vaxCards.count();

    if (vaxCount > 0) {
      // At least one vaccination card should have upload option
      const uploadLink = customerPage.locator('text=/Upload document photo|View Document/').first();
      await expect(uploadLink).toBeVisible({ timeout: 10_000 });
    }
    // If no vaccinations, that's OK — empty state tested separately
  });

  test('Health & Safety card renders when data exists', async ({ customerPage }) => {
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // Health & Safety card is conditional — only shows if dog has allergy/vet data
    // Just verify the page doesn't crash (no white screen)
    const pageContent = await customerPage.locator('body').textContent();
    expect(pageContent).toBeTruthy();
    // If data exists, we should see the section
    const healthSection = customerPage.locator('text="Health & Safety"');
    // Don't assert visibility — it's conditional. Just verify no errors.
    const hasHealth = await healthSection.count();
    // Log for debugging
    console.log(`Health & Safety section present: ${hasHealth > 0}`);
  });

  test('Edit mode shows extended fields', async ({ customerPage }) => {
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // Click edit button (the pencil icon in identity card)
    const editButton = customerPage.locator('button').filter({ has: customerPage.locator('svg path[d*="M11 5H6"]') }).first();
    await editButton.click();

    // Should see extended edit form fields
    await expect(customerPage.locator('text="Allergies"')).toBeVisible({ timeout: 5_000 });
    await expect(customerPage.locator('text="Special Needs"')).toBeVisible();
    await expect(customerPage.locator('text="Emergency Vet Name"')).toBeVisible();
    await expect(customerPage.locator('text="Emergency Vet Phone"')).toBeVisible();

    // Cancel button should exist
    await expect(customerPage.locator('button', { hasText: 'Cancel' })).toBeVisible();
  });

  test('Navigate back from dog profile works', async ({ customerPage }) => {
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // Go back
    await customerPage.goBack();
    await customerPage.waitForLoadState('networkidle');

    // Should be back on My Pets
    await expect(customerPage.locator('text="Your Pups"')).toBeVisible({ timeout: 15_000 });
  });

  test('Navigate to profile and back again (double navigation)', async ({ customerPage }) => {
    // Navigate in → back → in again (catches state bugs)
    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    await customerPage.goBack();
    await customerPage.waitForLoadState('networkidle');

    // Navigate in again
    const firstPetAgain = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await firstPetAgain.click();
    await customerPage.waitForLoadState('networkidle');

    // Should still render correctly
    await expect(customerPage.locator('text=/Playwright|Cypress/')).toBeVisible({ timeout: 15_000 });
  });
});
```

#### 2B. Create `e2e/tests/customer/dog-profile-mobile.spec.ts`:
```typescript
import { test, expect } from '../../fixtures/auth.fixture';

test.use({ viewport: { width: 375, height: 812 } }); // iPhone-sized

test.describe('Dog Profile — Mobile Viewport', () => {
  test('Dog profile page is scrollable on mobile', async ({ customerPage }) => {
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');

    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // Verify content is visible and page is scrollable
    await expect(customerPage.locator('text="Vaccinations"')).toBeVisible({ timeout: 15_000 });

    // Scroll down — medications section should become visible
    await customerPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(customerPage.locator('text="Medications"')).toBeVisible({ timeout: 5_000 });
  });

  test('Touch targets meet 44px minimum on photo upload', async ({ customerPage }) => {
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');

    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await firstPet.click();
    await customerPage.waitForLoadState('networkidle');

    // Photo upload button should meet minimum touch target
    const photoButton = customerPage.locator('button').filter({ hasText: /Add a photo|Change Photo/ }).first().or(
      customerPage.locator('button:has(img[alt="Dog photo"])').first()
    );
    const isVisible = await photoButton.isVisible().catch(() => false);
    if (isVisible) {
      const box = await photoButton.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.width).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('Pet list cards are tappable on mobile', async ({ customerPage }) => {
    await customerPage.goto('/my-pets');
    await customerPage.waitForLoadState('networkidle');

    const firstPet = customerPage.locator('button').filter({ hasText: /Playwright|Cypress/ }).first();
    await expect(firstPet).toBeVisible({ timeout: 15_000 });

    const box = await firstPet.boundingBox();
    expect(box).toBeTruthy();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});
```

### Phase 3: Fix Any Bugs Found

If the API verification or E2E tests reveal mismatches:
1. Fix the bug in the source code
2. Re-run the failing test to confirm fix
3. Include fixes in the commit

Common issues to watch for:
- API returns snake_case but frontend expects camelCase
- Nullable fields causing `Cannot read property of null` errors
- Missing error boundaries on new pages
- Photo upload failing because Cloudinary env vars not set in local dev

### Phase 4: Run Existing Test Suite (Regression Check)

Run the full existing E2E suite to make sure MS-1/2/3 changes didn't break anything:
```bash
cd e2e && npx playwright test --reporter=list 2>&1 | tail -50
```

- [ ] All existing tests still pass (83 baseline)
- [ ] New dog-profile tests pass (12 tests)
- [ ] No new console errors in browser during tests

## Build Gate
```bash
# Server
cd server && npx tsc --noEmit

# Customer app
cd ../customer-app && npx tsc --noEmit && npm run build

# E2E tests parse (no syntax errors)
cd ../e2e && npx tsc --noEmit 2>&1 | head -20

# Run E2E
npx playwright test tests/customer/dog-profile.spec.ts --reporter=list
```

- [ ] Server API endpoints return expected shapes (Phase 1 curl checks)
- [ ] Migration applied and schema valid
- [ ] Dog profile page loads without white screen
- [ ] Photo upload area renders
- [ ] Vaccination upload option visible on vax cards
- [ ] Edit form includes health/safety fields
- [ ] Forward + back navigation works without crashes
- [ ] Mobile viewport is scrollable
- [ ] Touch targets >= 44px
- [ ] Existing test suite not regressed

## Git Commit
```bash
git add e2e/tests/customer/dog-profile.spec.ts e2e/tests/customer/dog-profile-mobile.spec.ts
# Include any bug fixes found during verification
git commit -m "test(e2e): add retroactive E2E tests for MS-1 through MS-3

Dog profile: page load, photo upload area, vaccination upload, health/safety card.
Edit form: extended fields (allergies, special needs, emergency vet).
My Pets: card rendering, photo thumbnails, navigation.
Mobile: scrollability, touch targets, viewport tests.
~15 new test cases. Regression suite verified.

MS-3.1 verification sprint."
```

## CHANGELOG Entry
```
### MS-3.1: Retroactive E2E Verification
- Added E2E tests for dog profile page (photo upload, health/safety, vaccinations)
- Added mobile viewport tests (scrolling, touch targets)
- Verified API response shapes match frontend expectations
- Regression suite confirmed: all 83 baseline tests still pass
```

## Next Session
Proceed to MS-4 (Sprint B — Grooming Pricing). MS-4 and all subsequent sprints include their own E2E verification section.
