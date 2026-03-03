# HTHD — Sprint 3 Orchestrator

## Overview
Sprint 3 fixes two P0 blockers from family testing:
- **3A**: Pet profile white screen crash (blocking — users can't view their pets)
- **3B**: No onboarding flow (first-impression gap — users land cold)

These are independent sub-sessions. Run 3A first (it's the P0 crash fix), then 3B.

## Prerequisites
- Stripe integration complete (3 phases, commit `361f9ba`)
- Both apps build clean: `cd customer-app && npx tsc --noEmit && npm run build`
- Docker Postgres running (`happy-tail-postgres` on port 5432)

---

## Sub-Session Tracker

### Sub-Session A: Pet Profile Crash Fix
- **Doc:** `docs/sprint-prompts/sprint-3a-pet-profile-fix.md`
- **Scope:** Fix white screen on pet tap, add error boundary, fix loading states
- **Files:** DogProfilePage.tsx, new ErrorBoundary component, App.tsx
- **Status:** [ ] Not started / [ ] In progress / [ ] Complete

### Sub-Session B: Welcome + Onboarding
- **Doc:** `docs/sprint-prompts/sprint-3b-welcome-onboarding.md`
- **Scope:** Welcome modal on first launch, service reminders on dashboard
- **Files:** New WelcomeModal component, DashboardPage.tsx
- **Depends on:** 3A complete (so the app is stable before adding features)
- **Status:** [ ] Not started / [ ] In progress / [ ] Complete

---

## Verification Gate: 3A → 3B

Before starting 3B, confirm:
- [ ] Pet profile loads on tap (no white screen)
- [ ] Error boundary catches failures with retry button
- [ ] Forward/back navigation works on pet pages
- [ ] `cd customer-app && npx tsc --noEmit && npm run build` passes
- [ ] Commit from 3A is clean on main

---

## Copy-Paste Prompts

### Start Sub-Session A
```
Read and execute docs/sprint-prompts/sprint-3a-pet-profile-fix.md

Context: This is Sprint 3A — fixing the pet profile white screen crash.
Stripe integration is complete (3 phases). Both apps build clean.
Family testing found that tapping a pet name in MyPetsPage causes a
white screen with no recovery. This is a P0 blocker.
```

### Start Sub-Session B
```
Read and execute docs/sprint-prompts/sprint-3b-welcome-onboarding.md

Context from 3A: Pet profile crash fixed — error boundary and loading
states added. DogProfilePage loads correctly, navigation forward/back
works. Customer app builds clean. This session adds the welcome modal
and service reminders.
```

---

## Sprint 3 Complete When
- [ ] Both sub-sessions committed
- [ ] CHANGELOG.md updated with both changes
- [ ] Customer app builds and all changed pages verified on mobile viewport
- [ ] No white screens anywhere in the customer app
