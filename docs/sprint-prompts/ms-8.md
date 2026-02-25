# MS-8: Integration Verification + Deploy

## Session Protocol
> **One micro-sprint per session.** Each session: execute this sprint only, pass build gates, commit, push, then shut down. Do NOT start the next sprint in the same session. Fresh context prevents compaction disasters.
>
> **Startup:** Ensure Docker Postgres (`happy-tail-postgres`) is running on port 5432 — tests need it.
>
> **Shutdown sequence (FINAL):** After deploy succeeds → finalize CHANGELOG.md with unified release entry → archive session → update memory files → verify all logs → confirm ready to exit. This is the last sprint — celebrate!

## Context
This is micro-sprint 8 of 8 — the final sprint. All features are built and tested. This sprint verifies everything works together, fixes any integration issues, and deploys.

**Prior sprints completed:** MS-1 (schema), MS-2 (uploads), MS-3 (frontend dog profile), MS-3.1 (retroactive E2E), MS-4 (grooming pricing + E2E), MS-5 (agreements + boarding + E2E), MS-6 (badges + analytics + E2E), MS-7 (cross-module integration tests)

## Read First
- `CHANGELOG.md` — verify all MS entries are present
- `server/src/index.ts` — verify all routes are mounted
- `customer-app/src/App.tsx` — verify all routes are registered
- `admin-app/src/App.tsx` — verify all routes are registered
- `server/prisma/schema.prisma` — verify schema integrity
- `CLAUDE.md` — deployment instructions (Vercel project names, Railway auto-deploy)

## What to Do

### 1. Full Build Verification

Run all builds from scratch:
```bash
cd server
npm install
npx prisma generate
npx tsc --noEmit
echo "--- Server: OK ---"

cd ../customer-app
npm install
npx tsc --noEmit
npm run build
echo "--- Customer App: OK ---"

cd ../admin-app
npm install
npx tsc --noEmit
npm run build
echo "--- Admin App: OK ---"
```

If ANY build fails, fix it before proceeding. Do not skip errors.

### 2. Route Mount Audit

Verify `server/src/index.ts` has ALL these routes mounted:
- `/api/v2/uploads` — uploads module (MS-2)
- `/api/v2/admin/grooming` — admin grooming pricing (MS-4)
- `/api/v2/agreements` — customer agreements (MS-5)
- `/api/v2/admin/agreements` — admin agreements (MS-5)
- `/api/v2/badges` — customer badges (MS-6)
- `/api/v2/admin/analytics` — admin analytics (MS-6)

Verify `customer-app/src/App.tsx` has routes for:
- `/agreements` — AgreementsPage

Verify `admin-app/src/App.tsx` has routes for:
- Analytics page (if created in MS-6)

### 3. Import/Export Audit

Check that all new modules export correctly and there are no circular dependencies:
```bash
cd server && npx tsc --noEmit 2>&1 | head -20
```

Check customer-app for any missing imports:
```bash
cd customer-app && npx tsc --noEmit 2>&1 | head -20
```

Check admin-app:
```bash
cd admin-app && npx tsc --noEmit 2>&1 | head -20
```

### 4. API Client Completeness Audit

Verify `customer-app/src/lib/api.ts` has API methods for:
- `dogProfileApi` — uploadPhoto, updated types
- `groomingApi` — getPricingSheet, getAddOns
- `agreementApi` — getRequired, getMySignatures, checkCompliance, sign
- `badgeApi` — getBadges, getNextBadge, evaluate, markNotified

Verify `admin-app/src/lib/api.ts` has:
- Admin grooming pricing methods
- Admin analytics methods
- Admin agreements methods

### 5. Schema Validation

```bash
cd server && npx prisma validate
```

Verify the migration exists and has been applied:
```bash
npx prisma migrate status
```

### 6. E2E Test Suite

Run the full test suite (includes per-sprint tests from MS-3.1/4/5/6 + cross-module tests from MS-7):
```bash
cd e2e && npx playwright test --reporter=list
```

Target: 83 existing + ~15 (MS-3.1) + ~8 (MS-4) + ~5 (MS-5) + ~7 (MS-6) + ~15 (MS-7) = ~130+ total tests.

If tests fail:
- Fix actual bugs (wrong selector, missing route, broken component)
- Skip tests that need seed data with `test.skip` + comment
- Do NOT delete failing tests — investigate root cause

### 7. Environment Variable Checklist

Verify these env vars are documented in `server/.env.example`:
- `CLOUDINARY_CLOUD_NAME` (new — MS-2)
- `CLOUDINARY_API_KEY` (new — MS-2)
- `CLOUDINARY_API_SECRET` (new — MS-2)

These must be set in Railway before deploying.

### 8. CHANGELOG Finalization

Update `CHANGELOG.md` with a cohesive release entry. Replace individual MS entries with a unified section:

```markdown
## [3.2.0] - 2026-02-XX — Sprints A-D Feature Expansion

### Added
- **Photo Uploads**: Dog profile photos and vaccination document uploads via Cloudinary
- **Extended Dog Profiles**: Allergies, special needs, emergency vet contact info
- **Grooming Pricing**: Sub-service pricing by dog size, grooming add-ons with real-time quotes
- **Service Agreements**: Digital agreement signing with type-to-sign, compliance tracking
- **Boarding Intake**: Feeding schedule, food details, drop-off/pick-up times, emergency contact
- **Customer Badges**: 10 achievement badges earned through visits, referrals, and compliance
- **Badge Animations**: Unlock notifications with progress tracking toward next badge
- **Admin Intelligence**: Revenue snapshots, customer segments, AI-generated business insights
- **Admin Pricing Management**: Inline editing for grooming service prices and add-ons
- **E2E Tests**: ~40 new test cases covering all sprint A-D features

### Database
- Migration: `sprints_abcd_schema` — 5 new Dog fields, 1 new Vaccination field, 8 new tables
```

### 9. Deploy

**Step 1: Push to GitHub (deploys server via Railway)**
```bash
git push origin main
```
Railway will auto-deploy the server. Wait 2-3 minutes.

**Step 2: Verify server health**
```bash
curl https://hthd-api.internationalaidesign.com/api/health/deep
```
Should return `{"status":"ok", "db":{"connected":true,...}}`.

**IMPORTANT:** Before deploying, ensure Cloudinary env vars are set in Railway:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

If these aren't set yet, tell Johnny to add them in the Railway dashboard before the server restarts.

**Step 3: Deploy customer app (from monorepo root)**
```bash
cd /Users/johnny/Documents/01_VibeCoding/production/happy-tail
vercel link --project hthd-loyalty-app --yes
vercel --prod --yes
```

**Step 4: Deploy admin app**
```bash
vercel link --project hthd-loyalty-app-3fgb --yes
vercel --prod --yes
```

**Step 5: Re-link to default project**
```bash
vercel link --project hthd-loyalty-app --yes
```

### 10. Post-Deploy Smoke Test

Tell Johnny to manually verify these flows:
1. **Customer**: Register/login → go to My Pets → open dog profile → see new fields (allergies, emergency vet) → upload photo
2. **Customer**: Start grooming booking → see pricing grid → select add-ons → see quote summary
3. **Customer**: Go to Agreements page → view an agreement → sign it
4. **Customer**: Dashboard → see badge progress → check badge grid
5. **Customer**: Start boarding booking → see intake form → verify all fields
6. **Admin**: Dashboard → see revenue snapshot, customer segments, insights
7. **Admin**: Grooming Pricing → see price matrix → edit a price → manage add-ons

## Build Gate (Final)
- [ ] Server: `npx tsc --noEmit` passes
- [ ] Customer app: `npm run build` succeeds
- [ ] Admin app: `npm run build` succeeds
- [ ] Prisma: `npx prisma validate` passes
- [ ] E2E: test suite runs (report pass/fail count)
- [ ] All route mounts verified
- [ ] All API client methods verified
- [ ] CHANGELOG finalized
- [ ] Deployed to Railway + Vercel
- [ ] Health check passes

## Git Commit
```bash
git add -A
git commit -m "chore: MS-8 integration verification and CHANGELOG finalization

Verified all builds, route mounts, API completeness.
Finalized CHANGELOG for v3.2.0 release.
All sprints A-D features verified and deployed.

MS-8 of 8 micro-sprint rebuild — complete."
```

## Done!
All 8 micro-sprints complete. The Sprints A-D features are live in production.
