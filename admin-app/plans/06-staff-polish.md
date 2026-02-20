# Segment 6: Staff Enhancements + Final Polish

> **Status:** Complete
> **Dependencies:** Segments 4, 5 (AIM must be functional)
> **Blocks:** None (final segment)

## Objective

Wire up staff break management, staffing shortfall detection into AIM alerts, and do a final visual audit pass to ensure every page is consistent. This is the polish pass that brings everything together.

## Brand Tokens

```css
--color-brand-blue: #62A2C3;     --color-brand-blue-dark: #4F8BA8;
--color-brand-navy: #1B365D;     --color-brand-cream: #FDF8F3;
--color-brand-warm-white: #F8F6F3;  --color-brand-coral: #E8837B;
--color-brand-golden-yellow: #F5C65D; --color-brand-soft-green: #7FB685;
```

## Task 1: Staff Break Backend

**Prerequisite:** StaffBreak model exists in schema (added in Segment 4).

**File to modify:** `server/src/modules/staff-schedule/service.ts`

Add methods:
- `addBreak(staffScheduleId, { startTime, endTime, type })` — Create StaffBreak record
- `removeBreak(breakId)` — Delete StaffBreak
- `getBreaks(staffScheduleId)` — List breaks for a schedule entry

**File to modify:** `server/src/modules/staff-schedule/admin-router.ts`

Add routes:
- `POST /admin/staff-schedule/:scheduleId/breaks` — Add break
- `DELETE /admin/staff-schedule/breaks/:breakId` — Remove break

## Task 2: Staff Break Frontend

**File to modify:** `admin-app/src/pages/StaffSchedulePage.tsx`

Add break management to schedule entries:
- Each staff schedule row shows break indicators (lunch icon, time range)
- "Add Break" button on each schedule entry
- Inline break creation: start time, end time, type dropdown (lunch/short/personal)
- Delete break with confirmation

## Task 3: Staffing Shortfall Detection

**File to modify:** `server/src/modules/aim/alerts.ts`

Implement `checkStaffingGaps(date)`:
1. Count total booked dogs for the date (sum of daycare + boarding + grooming bookings)
2. Count staff scheduled for the date
3. If ratio > 8 dogs per staff → create `staffing_gap` alert (warning)
4. If ratio > 12 dogs per staff → create `staffing_gap` alert (critical)
5. Factor in breaks: if a staff member has a 1hr lunch during peak hours, they're effectively unavailable for that window

Wire into AIM alert generation — call on dashboard load or periodically.

## Task 4: Capacity Forecasting Alert

**File to modify:** `server/src/modules/aim/alerts.ts`

Implement `checkCapacity(date)`:
1. Get total bookings for next 7 days
2. Compare to capacity rules (from CapacityRule table)
3. If any day > 80% → `capacity_warning` (info)
4. If any day > 90% → `capacity_warning` (warning)
5. If any day > 95% → `capacity_warning` (critical)

## Task 5: Full Visual Audit

Scan every page for consistency issues:

**Pages to check:**
- `DashboardPage.tsx` — Should be good (modern)
- `SchedulePage.tsx` — Verify using brand colors
- `StaffSchedulePage.tsx` — Verify using brand colors
- `StaffPage.tsx` — Check for green remnants, use PageHeader
- `BundleManagementPage.tsx` — Check for green remnants, use shared components
- `GroomingPricingPage.tsx` — Check for green remnants, use shared components
- `AIMonitoringPage.tsx` — Check consistency with brand
- `MessagingPage.tsx` — Should be good (modern)

**Checklist per page:**
- [ ] Uses `<PageHeader>` (no custom h1)
- [ ] Uses `<Card>` for content sections
- [ ] Uses `<Spinner>` for loading (no inline spinners)
- [ ] Uses `<Button>` component (no inline button styles)
- [ ] Uses `<Badge>` for status indicators
- [ ] No `bg-green-*` classes
- [ ] No `text-green-*` classes
- [ ] Touch targets ≥ 44px
- [ ] Fonts: Playfair Display for headings, Open Sans for body
- [ ] Mobile responsive

## Task 6: Final Integration Test

1. Login → verify brand styling
2. Dashboard → verify facility counts are clickable (Segment 3)
3. Dashboard → click AIM button → drawer opens
4. AIM Chat → "How's today looking?" → get response with facility data
5. AIM Alerts → verify any staffing/capacity alerts appear
6. Navigate to Customers → verify consistent styling
7. Navigate to Customer Detail → verify sub-components work
8. Navigate to Messaging → verify consistent with AIM drawer styling
9. Navigate to Staff Schedule → verify breaks are manageable
10. Mobile test: repeat key flows at 375px width

## Acceptance Criteria

1. Staff breaks can be created and deleted from StaffSchedulePage
2. Staffing shortfall alerts appear in AIM when ratio exceeds threshold
3. Capacity forecasting alerts appear for upcoming high-demand days
4. Zero pages with green color classes
5. All pages use shared components (PageHeader, Card, Spinner, Badge)
6. `npx tsc --noEmit` passes for both admin-app and server
7. All 10 integration test steps pass
8. Push to main → Railway deploys → test at https://hthd-admin.internationalaidesign.com

## Files to Read Before Starting

- `server/src/modules/staff-schedule/service.ts` — Extend with break methods
- `server/src/modules/staff-schedule/admin-router.ts` — Add break routes
- `server/src/modules/aim/alerts.ts` — Add shortfall + capacity checks
- `admin-app/src/pages/StaffSchedulePage.tsx` — Add break UI
- `admin-app/src/pages/StaffPage.tsx` — Audit for consistency
- `admin-app/src/pages/BundleManagementPage.tsx` — Audit for consistency
- `admin-app/src/pages/GroomingPricingPage.tsx` — Audit for consistency
- `admin-app/src/pages/AIMonitoringPage.tsx` — Audit for consistency
