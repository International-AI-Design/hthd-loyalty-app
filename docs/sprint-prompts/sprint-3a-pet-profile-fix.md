# HTHD — Sprint 3A: Pet Profile Crash Fix

## Session Protocol
- **Project:** `production/happy-tail/`
- **Estimated scope:** 3-5 files in `customer-app/`
- **Prerequisites:** Stripe integration complete. Customer app builds clean.
- **Build gates:** `npx tsc --noEmit` (customer-app), `npm run build` (customer-app), manual mobile verification
- **One sprint per session.** Read CLAUDE.md, then start.

## Context

Family tested the customer app and found a **P0 crash**: tapping a pet name in MyPetsPage causes a white screen. The user can't recover without force-refreshing the browser. This is blocking real user adoption.

Root causes to investigate:
- Missing loading state (component renders before data arrives)
- Null/undefined access on dog data that hasn't loaded
- No error boundary (unhandled throw → white screen of death)
- API response shape mismatch

## Read First

- `customer-app/src/pages/DogProfilePage.tsx` — The page that crashes
- `customer-app/src/pages/MyPetsPage.tsx` — Where users tap pet names
- `customer-app/src/App.tsx` — Router setup, see how `/dogs/:id` routes
- `customer-app/src/contexts/AuthContext.tsx` — Auth state that profile pages depend on
- `customer-app/src/lib/api.ts` — `dogProfileApi.getDog()` — actual API call
- `docs/SPRINT-PLAN.md` — Sprint 3 acceptance criteria (lines 60-75)

## Steps

### Step 1: Reproduce and Diagnose
1. Start customer app (`cd customer-app && npm run dev`)
2. Log in as test customer
3. Navigate to My Pets → tap a pet name
4. Document: white screen? Console error? Network error?
5. Check: Does `/dogs/:id` route exist? Does DogProfilePage fetch data correctly?

### Step 2: Fix DogProfilePage Loading State
The loading spinner must be wrapped in `AppShell` (the app's layout wrapper). A bare spinner outside the layout causes rendering issues.

- Ensure the loading state renders inside the page layout (not a bare `<Spinner />`)
- Add null-safe check on the fetched dog data: `if (!data?.dog)` → show "Pet not found" UI
- Handle API error state with a user-friendly message + retry button

### Step 3: Create PageErrorBoundary Component
Create `customer-app/src/components/PageErrorBoundary.tsx`:

- React class component with `componentDidCatch` / `getDerivedStateFromError`
- Friendly error UI: "Something went wrong" heading, brief message, retry button
- Retry button calls `window.location.reload()` or resets error state
- Style consistent with HTHD brand (use brand colors from SKILL.md)
- Must render inside AppShell so navigation chrome stays visible

### Step 4: Wrap Pet Profile Route in ErrorBoundary
In `App.tsx`:
- Import `PageErrorBoundary`
- Wrap the `/dogs/:id` route element in `<PageErrorBoundary>`
- Consider wrapping other data-fetching routes too (preventive measure)

### Step 5: Loading States Audit
Quick audit of pages that fetch data:
- DogProfilePage: loading spinner ✓ (just fixed)
- MyPetsPage: check for loading state on pet list
- Any other page that could show blank/white while waiting for API

Fix any missing loading states found.

## Build Gates (ALL must pass before commit)
```bash
cd customer-app && npx tsc --noEmit && npm run build
```

## Verification Checklist
- [ ] Tap pet name → profile loads (no white screen)
- [ ] If API fails → friendly error with retry button (not white screen)
- [ ] Navigate away and back → still works
- [ ] Deep link to `/dogs/:id` directly → works (not just via navigation)
- [ ] New user with no pets → empty state, not crash
- [ ] Mobile viewport tested (Chrome DevTools responsive mode at minimum)
- [ ] Back button works from pet profile
- [ ] Error boundary shows inside app layout (nav still visible)

## Anti-Pattern Checklist
- [ ] No white screens on any path through pet profile
- [ ] No `catch(e) {}` swallowing errors silently
- [ ] Loading states render inside AppShell, not bare
- [ ] API response shape verified with actual call (not assumed)

## Commit Checkpoint
```bash
git add customer-app/src/pages/DogProfilePage.tsx customer-app/src/components/PageErrorBoundary.tsx customer-app/src/App.tsx
git commit -m "fix: resolve pet profile white screen crash with error boundary

DogProfilePage loading state wrapped in AppShell layout. Null-safe
dog data check prevents render-before-load crash. PageErrorBoundary
component added to catch unhandled errors with friendly retry UI.
Pet profile route wrapped in error boundary.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

Note: Adjust `git add` paths based on actual files changed.

## Progress Updates
1. Update `CHANGELOG.md` — add entry under new Sprint 3A section
2. Append to `ferroai/spine/memory/daily/` (current date)
3. Archive session to `archive/sessions/`

## Shutdown Protocol
1. Summarize: what was fixed, what files changed, any open items
2. Verify build gates pass one final time
3. Confirm commit is clean

## Handoff → Sub-Session B

Paste into a fresh Claude Code instance:

```
Read and execute docs/sprint-prompts/sprint-3b-welcome-onboarding.md

Context from 3A: Pet profile crash fixed — error boundary and loading
states added. DogProfilePage loads correctly with null-safe data check.
PageErrorBoundary component created at customer-app/src/components/
PageErrorBoundary.tsx. Navigation forward/back works. Customer app
builds clean.
```
