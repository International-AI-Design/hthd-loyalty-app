# MS-3.1: Retroactive E2E Verification Session
**Date:** 2026-02-25 ~00:00-01:00 MST
**Commit:** 6fff847

## What Was Done
Retroactive E2E verification of MS-1 through MS-3 features (schema, uploads, dog profile UI).

## Bugs Found & Fixed
1. **Server crash on startup (CRITICAL)** — `/:publicId(*)` is Express 4 syntax, server runs Express 5.2.1. Changed to `/{*publicId}`. This was causing the production API 502.
2. **Upload error handling** — Multer file filter errors (wrong type, too large) were thrown before the route handler's try/catch, resulting in 500 instead of 400. Added `handleMulterUpload` wrapper.

## API Verification (Phase 1)
- `/api/v2/dogs` returns `photoUrl` field ✓
- `/api/v2/dogs/:id` returns extended fields (allergies, specialNeeds, emergencyVet, lastGroomDate) ✓
- Vaccination records include `documentUrl` and `cloudinaryPublicId` ✓
- All field names camelCase ✓
- Upload endpoint responds, rejects non-images with clear 400 ✓
- Migration applied, schema valid ✓

## E2E Tests Written (Phase 2)
- `e2e/tests/customer/dog-profile.spec.ts` — 13 tests (desktop)
- `e2e/tests/customer/dog-profile-mobile.spec.ts` — 4 tests (mobile viewport)
- All 17 pass locally against localhost

## Key Pattern: Shared Auth Page
Tests use `beforeAll` login + shared page to avoid rate-limiter (5 logins per 15 min). The `navigateToDogProfile()` helper uses `Promise.all([waitForURL, click])` for reliable SPA navigation.

## Regression
- Full regression suite blocked by rate limiter on existing test files (each file logs in independently)
- Pre-push hook ran 50 server unit tests — all passed
- 17 new E2E tests — all passed

## Open Items
- Existing E2E test files should adopt shared-auth pattern to avoid rate limiter
- Production API was 502 due to Express 5 route bug — fixed by this push
