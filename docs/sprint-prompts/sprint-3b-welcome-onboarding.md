# HTHD — Sprint 3B: Welcome Modal + Service Reminders

## Session Protocol
- **Project:** `production/happy-tail/`
- **Estimated scope:** 2-3 files in `customer-app/` (1 new, 1-2 modified)
- **Prerequisites:** Sprint 3A complete — pet profile crash fixed, error boundary in place. Customer app builds clean.
- **Build gates:** `npx tsc --noEmit` (customer-app), `npm run build` (customer-app), manual mobile verification
- **One sprint per session.** Read CLAUDE.md, then start.

## Context

Users currently land on the dashboard with no introduction — no welcome, no terms agreement, no orientation. The Otto competitor app has a polished welcome popup on first launch that sets expectations and captures terms acceptance. We're adding the same.

This session also adds lightweight service reminders to the dashboard (vaccination expiring, grooming overdue) to surface data that already exists in the API.

## Read First

- `customer-app/src/pages/DashboardPage.tsx` — Current home screen (where modal will trigger)
- `customer-app/src/App.tsx` — Router and layout structure
- `customer-app/src/components/PageErrorBoundary.tsx` — Error boundary from 3A (wrap new components too)
- `customer-app/src/lib/api.ts` — Check what dashboard/pet data APIs exist
- `docs/screenshots from otto app/IMG_8585.PNG` — Otto's welcome popup (visual reference)
- `docs/SPRINT-PLAN.md` — Sprint 4 acceptance criteria (lines 82-97)
- `SKILL.md` — Brand guidelines (colors, typography, component styles)

## Steps

### Step 1: Create WelcomeModal Component
Create `customer-app/src/components/WelcomeModal.tsx`:

**Content:**
- "Hello!" heading with a paw/dog icon
- "Thank you for trusting us with the care of your pet" subtitle
- Bullet list of app features:
  - Book grooming appointments
  - Track your pup's visits and health
  - Earn loyalty rewards
  - Message us anytime
- Footer text: "By clicking Continue you agree to our Terms of Service and Privacy Policy"
  - "Terms of Service" and "Privacy Policy" as tappable links (to `/terms` and `/privacy` if they exist, or `#` placeholder)
- Continue button (prominent, brand-colored)

**Behavior:**
- Modal overlay with backdrop
- On Continue: dismiss modal, set `localStorage.setItem('hthd_welcomed', 'true')`
- Prevent closing by tapping outside (user must tap Continue to accept terms)

**Style:**
- Follow SKILL.md brand guidelines (Blue #62A2C3, Navy #1B365D, Playfair Display headings, Open Sans body)
- Mobile-first: full-width on small screens, max-width ~400px centered on desktop
- Warm, welcoming tone — matches HTHD kennel-free philosophy

### Step 2: Integrate WelcomeModal on DashboardPage
In `DashboardPage.tsx`:

1. On mount, check `localStorage.getItem('hthd_welcomed')`
2. If not set → show `<WelcomeModal onContinue={handleWelcomeDismiss} />`
3. `handleWelcomeDismiss`: sets localStorage flag, hides modal
4. Modal renders on top of the dashboard (dashboard content visible but dimmed behind)

### Step 3: Add Service Reminders Section
On the dashboard, add a lightweight reminders section:

**Data to surface (if available from existing APIs):**
- Vaccinations expiring within 30 days
- Last grooming visit date (suggest rebooking if > 6 weeks ago)

**Implementation:**
- Check what data the dashboard already fetches (pets, bookings, etc.)
- If vaccination expiry data is available: show "Vaccination due soon" card
- If grooming history is available: show "Time for a grooming visit?" card
- If no data available for reminders: skip the section (don't show empty)
- Keep it lightweight — use existing API responses, don't add new endpoints

**Fallback:** If the existing APIs don't have reminder-ready data, create a simple "Quick Links" section instead:
- Book grooming
- View your pets
- Check rewards balance

### Step 4: Mobile Verification
- Test welcome modal on mobile viewport (Chrome DevTools, 375px width)
- Ensure Continue button is within thumb reach (bottom of modal)
- Ensure modal text is readable without zooming
- Test dashboard reminders section scrolls properly on mobile

## Build Gates (ALL must pass before commit)
```bash
cd customer-app && npx tsc --noEmit && npm run build
```

## Verification Checklist
- [ ] Welcome modal shows on first launch (no `hthd_welcomed` in localStorage)
- [ ] Welcome modal dismissed → sets localStorage flag → never shows again
- [ ] Clearing localStorage → modal shows again on next visit
- [ ] Cannot dismiss modal by tapping outside (must tap Continue)
- [ ] Terms/Privacy links are tappable
- [ ] Dashboard content visible (dimmed) behind modal overlay
- [ ] Service reminders show when data is available
- [ ] No crash/blank when user has no pets or no bookings (empty state)
- [ ] Mobile viewport tested (375px width minimum)
- [ ] Continue button is large enough for touch (44x44px minimum)
- [ ] Typography matches brand (Playfair headings, Open Sans body)
- [ ] Colors match brand palette (#62A2C3 primary, #1B365D text)

## Anti-Pattern Checklist
- [ ] Modal doesn't break if localStorage is unavailable (Safari private browsing)
- [ ] No white screen if dashboard data fails to load behind modal
- [ ] Reminders section handles empty/null data gracefully
- [ ] No hardcoded test data left in components

## Commit Checkpoint
```bash
git add customer-app/src/components/WelcomeModal.tsx customer-app/src/pages/DashboardPage.tsx
git commit -m "feat: add welcome onboarding modal and service reminders

Otto-style welcome popup on first launch with terms acceptance.
Shows once per device via localStorage flag. Service reminders
section on dashboard surfaces vaccination and grooming status.
Mobile-first, brand-consistent styling.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

Note: Adjust `git add` paths based on actual files changed.

## Progress Updates
1. Update `CHANGELOG.md` — add entry under Sprint 3B section
2. Append to `ferroai/spine/memory/daily/` (current date)
3. Archive session to `archive/sessions/`

## Shutdown Protocol
1. Summarize: what was built, what files changed, any open items
2. Verify build gates pass one final time
3. Confirm commit is clean
4. Mark Sprint 3 as complete in orchestrator

## Handoff → Sprint 4

Paste into a fresh Claude Code instance:

```
Read docs/SPRINT-PLAN.md for Sprint 5 scope, then read and execute
the corresponding sprint prompt doc.

Context from Sprint 3: Pet profile crash fixed (3A) — error boundary
and loading states added. Welcome onboarding modal added (3B) — shows
on first launch with terms acceptance, localStorage flag. Service
reminders on dashboard. Customer app builds clean, all pages verified
on mobile viewport.
```
