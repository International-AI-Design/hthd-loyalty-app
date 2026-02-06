# Session Archive: Sprint 2 Testing & Bug Fixes — 2026-02-06

## Summary
Systematic API-level testing of all Sprint 2 v2 endpoints. Found and fixed 10 critical bugs across 10 files (269 insertions). All booking, grooming, bundle, and staff flows verified working via curl. Both frontend builds pass clean.

## Bugs Found & Fixed

### 1. Customer Booking API 404s
- **Root cause**: `customer-app/src/lib/api.ts` used `/v2/booking/` (singular), server mounts `/v2/bookings/` (plural)
- **Impact**: ALL customer booking features completely broken
- **Fix**: Changed all 8 paths in `bookingApi` object

### 2. Admin Schedule Always Empty
- **Root cause**: `admin-router.ts` returned `{ schedule }`, SchedulePage reads `{ bookings }`
- **Fix**: Changed response to `{ bookings, total: bookings.length }`

### 3. Admin Schedule Filter Never Worked
- **Root cause**: Frontend sends `serviceType` (name), backend only read `serviceTypeId` (UUID)
- **Fix**: Accept both params, resolve name → UUID via DB lookup

### 4. Admin Bundles 401 Unauthorized
- **Root cause**: `GET /v2/bundles` used `authenticateCustomer`, admin sends staff token
- **Fix**: Dual-auth handler accepting both token types

### 5. Admin Desktop Layout Broken
- **Root cause**: Parent div not `flex` on desktop, sidebar stacks above content
- **Fix**: Added `lg:flex` + `flex-1` to Layout.tsx

### 6. Dog Size Update 500
- **Root cause**: Missing `prisma` import in `booking/router.ts`
- **Fix**: Added import

### 7. Dogs Endpoint Missing sizeCategory
- **Root cause**: Field not in select/response of GET /customers/me/dogs
- **Fix**: Added to both

### 8. No Dog Creation Endpoint
- **Root cause**: Dead end for new customers in booking wizard
- **Fix**: Added `POST /customers/me/dogs` + inline form in BookingPage step 2

### 9. Grooming Pricing Breaks After Edit
- **Root cause**: Backend returns `{ tier }`, frontend treats as raw object
- **Fix**: Unwrapping in GroomingPricingPage.tsx

### 10. Bundle Management Response Shapes
- **Root cause**: Toggle/create/update all return wrapped objects, frontend expects raw
- **Fix**: Unwrapping for all three + added service type picker to form

## Testing Coverage (API-Level)
- ✅ Customer registration + login
- ✅ Dog creation (new endpoint)
- ✅ Dog size update
- ✅ Service types listing
- ✅ Availability check (date range)
- ✅ Grooming slots (date-specific)
- ✅ Grooming pricing (by size)
- ✅ Booking creation (daycare + grooming)
- ✅ Booking listing (with status filter)
- ✅ Booking cancellation
- ✅ Admin: confirm booking
- ✅ Admin: check-in
- ✅ Admin: check-out
- ✅ Admin: grooming coat rating (condition 1-5 with auto-price)
- ✅ Admin: schedule with date nav + service filter
- ✅ Admin: grooming pricing matrix (GET + PUT)
- ✅ Admin: bundle CRUD (create, list, toggle)
- ✅ Admin: staff CRUD (list, create, role update)
- ✅ Both frontends build clean (0 TS errors)

## NOT Done (Next Session)
1. **Browser testing** — All testing was API/curl. Need to open both apps in browser and verify UI renders, interactions work, no console errors
2. **Mobile responsiveness** — Not started. Check booking wizard + admin on small screens, 44px touch targets, no horizontal overflow
3. **Admin role visibility** — Groomer role nav filtering, restricted pages for non-owner roles
4. **StaffPage cosmetic** — `handleRoleChange` response missing `created_at` (not a crash, just field won't update in UI)
5. **DashboardPage** — "Book an Appointment" CTA and upcoming bookings section not browser-tested
6. **CustomerBookingsPage** — Upcoming/past tabs and cancel modal not browser-tested

## Files Changed (Uncommitted → Now Committing)
1. `customer-app/src/lib/api.ts`
2. `customer-app/src/pages/BookingPage.tsx`
3. `server/src/modules/booking/admin-router.ts`
4. `server/src/modules/booking/router.ts`
5. `server/src/modules/bundles/router.ts`
6. `server/src/routes/customers.ts`
7. `admin-app/src/components/Layout.tsx`
8. `admin-app/src/lib/api.ts`
9. `admin-app/src/pages/BundleManagementPage.tsx`
10. `admin-app/src/pages/GroomingPricingPage.tsx`

## Test Data Created During Session
- Customer: testcust / test123 (has dog "Buddy", bookings for daycare + grooming)
- Staff: admin (owner role) — used for all admin operations
- Grooming booking with condition rating applied
- Bundle created via API

## Server Ports
- Backend: 3001
- Customer app: 5173
- Admin app: 5174
