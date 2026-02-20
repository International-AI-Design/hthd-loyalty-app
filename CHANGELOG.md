# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0-alpha.14] - AIM Backend (Segment 4) - 2026-02-19

### Schema — 4 New Tables
- **aim_conversations** — Staff-to-AIM chat sessions with title, status, staff ownership
- **aim_messages** — Individual messages (user/assistant roles) with tool call logging
- **aim_alerts** — Proactive operational alerts (staffing gaps, capacity warnings, compliance)
- **staff_breaks** — Break periods within staff schedules (lunch, short, personal)
- Added `aimConversations` relation to `StaffUser`, `breaks` relation to `StaffSchedule`

### AIM Module (`server/src/modules/aim/`) — 6 Files
- **types.ts** — `AimChatInput`, `AimChatOutput`, `AimAlertData` interfaces
- **prompts.ts** — System prompt builder injecting live facility status, staff on duty, compliance flags
- **tools.ts** — 8 Claude tool definitions: `get_today_summary`, `search_customer`, `search_dog`, `check_schedule`, `get_staff_schedule`, `create_booking`, `check_compliance`, `get_revenue_summary`
- **service.ts** — Orchestrator (same Claude tool-loop as SMS AI, adapted for staff context)
- **alerts.ts** — Alert generator: staffing gaps (>8:1 dog:staff), capacity (>80%/95%), compliance issues; deduplication per day
- **router.ts** — 7 endpoints behind `authenticateStaff` middleware

### API Endpoints — `/api/v2/admin/aim/`
- `POST /chat` — Send message to AIM, get AI response with tool usage
- `GET /conversations` — List staff's AIM conversations (paginated, most recent first)
- `GET /conversations/:id` — Full conversation with message history
- `DELETE /conversations/:id` — Archive conversation (soft delete)
- `GET /alerts` — Get alerts with optional `?unread=true` filter; auto-generates fresh alerts
- `PATCH /alerts/:id/read` — Mark alert as read
- `PATCH /alerts/:id/resolve` — Mark alert as resolved

### Admin App API Client
- Added `adminAimApi` with typed interfaces (`AimChatResponse`, `AimConversationSummary`, `AimConversationDetail`, `AimAlert`)
- Added `api.patch()` method to base API client

### TypeScript
- Both `admin-app` and `server` pass `npx tsc --noEmit` clean

## [2.0.0-alpha.13] - Interactive Dashboard (Segment 3) - 2026-02-19

### Backend
- **Facility details endpoint** — `GET /v2/admin/dashboard/facility-details?date=&service=` returns dog-level breakdown (name, breed, owner, check-in time) for daycare/boarding/grooming on a given date
- **Admin booking creation** — `POST /v2/admin/bookings` allows staff to create bookings directly (was previously missing; BookingService methods existed but had no route)
- **Availability check endpoint** — `GET /v2/admin/bookings/availability` for live capacity checking in the QuickBook modal

### Frontend — 6 New Components
- **ServiceDrilldownModal** — Click any service count on dashboard to see every dog in that service, with breed, owner, check-in time; each row navigates to customer detail
- **DogProfileCard** — Compact card with avatar/initials, breed, size, owner name, vaccination status dot (green/amber/red), clickable to customer profile
- **CustomerQuickCard** — Customer summary with points badge, quick actions (Call via `tel:`, Message, View Profile)
- **StaffProfileCard** — Staff card with role badge, shift times, optional dog count
- **QuickBookModal** — 5-step booking flow: search customer → select dogs → choose service → pick date (live availability) → confirm & create
- **WeatherWidget** — Compact Denver weather in dashboard header; 30-min sessionStorage cache; hidden if no `VITE_OPENWEATHER_API_KEY`

### Dashboard Integration
- Service counts (Daycare/Boarding/Grooming) are now clickable buttons that open drilldown modals
- "New Booking" primary quick action button added (blue, prominent)
- WeatherWidget renders in header next to date picker
- QuickBook triggers facility/arrivals refresh on booking creation
- Grid updated from 4-col to 5-col quick actions to accommodate New Booking

### TypeScript
- Both `admin-app` and `server` pass `npx tsc --noEmit` clean

## [2.0.0-alpha.12] - Admin Design System Segments 1 & 2 - 2026-02-19

### Design System (Segment 1)
- **8 shared UI components** — PageHeader, Card, Spinner, Skeleton, Badge, DataTable, EmptyState added to `admin-app/src/components/ui/`
- **Button brand fix** — Primary button color updated from green to brand-blue (#62A2C3)
- **Brand tokens** — All components use HTHD brand colors (blue, navy, cream, coral, golden-yellow, soft-green)

### Legacy Page Migration (Segment 2)
- **LoginPage** — Navy gradient background, Playfair Display heading, "Staff Portal" subtitle, brand-blue accents
- **CustomersPage** — PageHeader, Card, Spinner, EmptyState, Badge; removed duplicate header/logout; green → brand-blue
- **GingrSyncPage** — PageHeader, Card, Spinner, Badge, EmptyState; all sections wrapped in Cards; green → brand-blue/soft-green
- **LoyaltyPage** — PageHeader, Card, EmptyState; green gradient → brand-blue gradient; removed standalone sign-out footer
- **CustomerDetailPage refactor** — 1,190 lines → 197 lines + 7 sub-components:
  - `CustomerHeader.tsx` — Name, contact, points balance, action buttons
  - `CustomerDogs.tsx` — Dog cards with vaccination badges, behavior note modal
  - `CustomerBookings.tsx` — Upcoming/history with status badges, pagination
  - `CustomerTransactions.tsx` — Points transaction log with load more
  - `CustomerRedemptions.tsx` — Pending (golden-yellow) and completed redemptions
  - `AddPointsModal.tsx` — Dollar input, service type, points preview with grooming bonus
  - `RedeemModal.tsx` — Tier selection, confirmation, processing flow
- **Zero green color classes** remaining in any migrated page
- **All pages use PageHeader** — no custom `<h1>` headers
- **TypeScript clean** — `npx tsc --noEmit` passes with zero errors

## [2.0.0-alpha.11] - Security Hardening + Full Gingr Import - 2026-02-18

### Security
- **Staff password change endpoint** — `PUT /api/v2/admin/staff/:id/password`. Admin/owner can change any password; staff can change their own (requires current password). 8-char minimum.
- **Production password rotation** — All 3 staff accounts rotated from default passwords. Env-driven reset script (`prisma/reset-passwords.ts`) for future use.
- **Seed script hardened** — Replaced hardcoded passwords with `crypto.randomBytes()`. Replaced `Math.random()` with `crypto.randomInt()` (4 locations). Added env var overrides.

### Features
- **Full Gingr import** — `POST /api/admin/gingr/full-import` pulls ALL data from Gingr:
  - Paginates through `/owners` to get all customers
  - Fetches 730 days (2 years) of reservations in 30-day batches
  - Applies real loyalty points (no artificial cap)
  - Creates visit history for each customer
  - Imports dogs via `/animals` endpoint
- **Configurable points cap** — `importCustomers()` now accepts `pointsCap` parameter (default 50, full import uses Infinity)

### Infrastructure
- **Timezone fix** — `TZ=America/Denver` set on Railway (resolves business hours bug)
- **Password reset on deploy** — `start.sh` runs `reset-passwords.ts` if `RESET_*_PASSWORD` env vars are set

### Import Results (Production)
- 427 Gingr owners found → 268 customer accounts created
- 4,682 invoices processed → 4,277 visits imported
- 391,632 loyalty points applied from real transaction history

## [2.0.0-alpha.9] - QA Bug Sprint + iOS Mobile Fixes - 2026-02-10

### Bug Fixes (15 bugs from QA walkthrough)
- **P0: Pet profile white screen** — API response shape mismatch, added unwrap logic
- **P1: Add Pet routing** — replaced hardcoded navigate('/book') with Add Pet modal
- **P1: Missing back buttons** — added showBack to AppShell on 5 subpages
- **P1: Multi-day date picker** — extended Calendar with range/multi selection modes
- **P1: Chat alignment** — added normalizeMessage() mapping server `role` to UI `senderType`
- **P1: Branding consistency** — fixed 7 instances of "Happy Tail" → "Happy Tail Happy Dog" across 4 files
- **P1: Admin "Invalid Date"** — fixed camelCase/snake_case field mismatch in admin messaging
- **P1: AI escalation routing** — added escalate_to_staff tool, updated prompts and service
- **P2: Booking header** — added logo, removed progress bar, added dynamic title
- **P2: Continue button below fold** — sticky bottom container with gradient
- **P2: QR redemption** — replaced code display with auto-apply messaging
- **P2: Admin send icon** — replaced up-pointing arrow with paper-plane send icon
- **P3: Activity feed** — added expandable detail panels (accordion pattern)

### iOS Mobile Fixes
- **iOS auto-zoom on input focus** — set all inputs/textareas to `text-base` (16px min)
- **Viewport meta** — added `maximum-scale=1.0` to both customer and admin index.html

### Infrastructure
- **QA Registry** — created `spine/senses/qa/known-bugs.jsonl` with structured bug tracking
- **Deployment docs** — corrected Vercel project name mapping in CLAUDE.md
- **Observer protocol** — updated to require bug registry reads before client app work

## [2.0.0-alpha.8] - Frontend Redesign: Earth-Tone Design System, New Pages, Real-Time Features - 2026-02-07

### Design System Overhaul
- **New color palette**: Terracotta (#C2704E), Sage (#8BA888), Cream (#FAF6F1), Amber (#D4A843), Forest (#2C3E2D) — replaces blue theme
- **New typography**: Fraunces (headings), Plus Jakarta Sans (body), Quicksand (pet names)
- **Updated UI components**: Button (ghost/danger variants), Input, Modal (mobile bottom-sheet), Toast (typed icons)
- **Dark mode support**: `darkMode: 'class'` with dark color tokens
- **44px minimum touch targets**, `active:scale-[0.98]` tactile feedback

### New Features
- **Bottom tab navigation** (AppShell): Home, Book, Messages, My Pets, Rewards with active indicators
- **In-app notification system**: Bell icon with unread count, slide-in panel, priority tiers, toast alerts
- **Real-time pet status tracker**: SSE-powered 5-step progress (Booked→Checked In→In Service→Ready→Picked Up)
- **Pet Day activity feed**: Timeline UI with 9 activity types, photo support, 30s polling
- **Enhanced messaging**: Quick reply chips, photo support, read receipts, pet-specific thread starters

### New Pages
- **MyPetsPage**: Pet card grid with gradient avatars, breed/age/size, navigation to dog profiles
- **RewardsPage**: Animated points counter, tier progress, full redemption flow, referral sharing
- **SettingsPage**: Profile display, notification/dark mode toggles, logout
- **ActivityFeedPage**: Live pet day view with status tracker + activity timeline

### Redesigned Pages
- **DashboardPage**: Hero card with gradient, Pet Day banner, quick actions grid, skeleton loaders
- **LoginPage**: Earth-tone styling with warm cards
- **MessagingPage**: Quick replies, photo messages, read receipts UI

### Server
- `GET /api/v2/notifications` — builds notifications from bookings + conversations
- `PUT /api/v2/notifications/:id/read` and `/read-all`
- `GET /api/v2/activities/today` — returns today's booking activities

### Infrastructure
- **Ferro Ops Dashboard** (ferro-ops.vercel.app): Real-time deployment monitoring, health checks, build logs, commit history for all 3 services
- **MCP servers**: Vercel + Railway MCP integrations registered for Claude Code direct access
- Vercel serverless API functions proxy Vercel/Railway/GitHub APIs with encrypted env vars

## [2.0.0-alpha.7] - Sprint 3b/3c: Dog Profiles, Messaging, Report Cards, Operations Dashboard, Staff Scheduling - 2026-02-07

### Added — Server: New Modules

- **Dog Profile module** (`modules/dog-profile/`) — Full pet health record management:
  - Health records, vaccination tracking, medication management, behavior notes
  - Vaccination compliance checking against facility requirements
  - Customer routes: CRUD for dogs, vaccinations, medications, behavior notes
  - Admin routes: view any dog's full profile, add staff behavior notes
- **Messaging module** (`modules/messaging/`) — In-app communication:
  - AI-powered chat with Claude (Anthropic SDK) for customer questions
  - Automatic staff escalation when AI cannot resolve
  - Conversation history, read receipts, typing indicators
  - Customer routes: list conversations, send/receive messages
  - Admin routes: view all conversations, send staff replies
- **Report Card module** (`modules/report-card/`) — Post-visit pet reports:
  - Staff-created report cards with photos, mood tracking, activity notes
  - Customer routes: view report cards for their dogs
  - Admin routes: create, update, and manage report cards
- **Dashboard module** (`modules/dashboard/`) — Operations intelligence:
  - Facility status: current occupancy, arrivals/departures, capacity
  - Staff coverage tracking and scheduling gaps
  - Vaccination compliance alerts for upcoming bookings
  - Admin route: `GET /v2/admin/dashboard/stats`
- **Staff Schedule module** (`modules/staff-schedule/`) — Workforce management:
  - Week-view scheduling with shift management
  - Coverage tracking against capacity needs
  - Bulk schedule operations (copy week, clear week)
  - Admin routes: CRUD for schedules, coverage reports

### Added — Server: Schema Changes

- **New models:** `Vaccination`, `Medication`, `BehaviorNote`, `VaccinationRequirement`
- **Enhanced models:** `Dog` (health records relations), `StaffUser` (schedule relations), `Conversation` (AI/staff routing), `StaffSchedule` (shift types), `ReportCard` (photos, mood)
- **Prisma migration:** `20260207000000_v2_platform/migration.sql` (549 lines)

### Added — Server: Enhancements

- **Points-based checkout** — Checkout service now supports paying with loyalty points (partial or full)
- **Vaccination compliance** — Booking flow checks vaccination status, warns on non-compliant dogs
- **Route mounting** — 5 new server route groups: dog-profile, messaging, report-card, dashboard, staff-schedule

### Added — Customer App: New Pages

- **DogProfilePage** (`pages/DogProfilePage.tsx`, 719 lines) — Full pet health profile:
  - Vaccination records with expiry tracking and compliance status
  - Medication management with dosage and schedule
  - Behavior notes from staff visible to owners
  - Health summary with alerts for expiring vaccinations
- **MessagingPage** (`pages/MessagingPage.tsx`, 470 lines) — In-app chat:
  - AI-powered concierge for instant answers
  - Typing indicators and real-time message updates
  - Staff escalation for complex issues
  - Conversation history with timestamps
- **ReportCardsPage** (`pages/ReportCardsPage.tsx`, 358 lines) — Pet visit reports:
  - Timeline view of all report cards
  - Photo gallery from visits
  - Mood and activity tracking per visit
- **VaccinationStatus component** (`components/VaccinationStatus.tsx`, 220 lines) — Reusable compliance display

### Added — Customer App: Enhancements

- **Dashboard updates** — New navigation cards for Dog Profiles, Messages, and Report Cards
- **Booking flow** — Vaccination compliance warnings before booking confirmation
- **Pet setup** — Made skippable during registration (backlog fix)
- **Welcome message** — Fixed for new user accounts (backlog fix)
- **Points checkout** — Added loyalty points as payment option in CheckoutPage

### Added — Admin App: New Pages

- **Operations Dashboard** (`pages/DashboardPage.tsx`, rewritten ~1466 lines) — Complete overhaul:
  - Facility status: real-time occupancy, capacity utilization
  - Today's arrivals and departures
  - Staff coverage overview with gap alerts
  - Vaccination compliance alerts for upcoming bookings
  - Quick-action cards for common operations
- **StaffSchedulePage** (`pages/StaffSchedulePage.tsx`, 692 lines) — Workforce scheduling:
  - Week-view calendar with drag-and-drop shift management
  - Coverage tracking against capacity requirements
  - Bulk operations: copy week, clear week
  - Staff availability indicators
- **LoyaltyPage** (`pages/LoyaltyPage.tsx`, 992 lines) — Extracted from old dashboard:
  - Points management, customer lookup, redemptions
  - All original dashboard loyalty features preserved in dedicated page

### Added — Admin App: Enhancements

- **CustomerDetailPage** — Expanded with pet profiles, health status, vaccination compliance, booking history
- **Layout navigation** — New nav items for Operations, Staff Schedule, and Loyalty pages
- **Admin API layer** — New API methods for dashboard stats, staff schedules, dog profiles, messaging, report cards

### Changed

- **Admin Dashboard** — Completely rewritten from loyalty-focused to operations-focused
- **Admin navigation** — Reorganized: Operations (home), Schedule, Customers, Staff Schedule, Grooming Pricing, Bundles, Loyalty, Staff, Gingr Sync
- **Customer App routing** — Added routes for `/dogs/:id`, `/messages`, `/report-cards`
- **Checkout service** — Extended to support points-based payments alongside wallet/card/cash/split

### Fixed (Backlog Items)

- **Pet setup flow** — Made skippable during registration so new customers are not blocked
- **Welcome message** — Fixed display for newly registered users
- **500-point cap** — Enforced consistently across all point-earning operations

### Files Changed (78 total)

- **New (28):** DogProfilePage, MessagingPage, ReportCardsPage, VaccinationStatus, LoyaltyPage, StaffSchedulePage, dog-profile module (4 files), messaging module (4 files), report-card module (4 files), dashboard module (3 files), staff-schedule module (3 files), migration SQL, BACKLOG.md
- **Modified (50):** Schema, server index, checkout module (3 files), customer App/api/pages (12 files), admin App/api/pages (10 files), routes, components, styles, configs

### Stats

- **78 files changed**, 9,748 insertions, 1,431 deletions
- Customer app: 6 new files, 12 modified
- Admin app: 3 new pages, 8 modified files
- Server: 5 new modules (20 files), migration, enhanced routes

---

## [2.0.0-alpha.6] - Sprint 3a: Foundation — Multi-Day Booking, Checkout, Admin Payments - 2026-02-07

### Added — Server
- **Multi-day booking API** — `startDate`/`endDate` fields on Booking model, availability checking with 40 dogs/day global cap, date range schedule queries, overlap detection
- **Checkout module** (`modules/checkout/`) — Complete payment processing:
  - Customer routes: `POST /v2/checkout`, `GET /v2/checkout/:paymentId/receipt`
  - Admin routes: `GET /v2/admin/checkout/wallet-balance/:customerId`, `POST /v2/admin/checkout/process`, `GET /v2/admin/checkout/receipt/:paymentId`
  - Simulated payments (wallet/card/split/cash), atomic transactions (payment + wallet deduction + booking status + audit log)
  - Idempotency key support, receipt generation
- **Admin checkout auth** — Staff-authenticated routes with RBAC (admin role), audit logging for all staff-initiated payments
- **Booking types** — `createMultiDayBookingSchema` Zod validation, `adminDateRangeSchema` for schedule queries
- **Multi-day booking route** — `POST /v2/bookings/multi-day` with date range validation (max 30 days)
- **Schedule range endpoint** — `GET /v2/admin/bookings/schedule-range` with service type and status filtering

### Added — Customer App
- **Calendar component** (`components/Calendar.tsx`, 267 lines) — Custom date range picker with availability indicators (green/yellow/red), mobile swipe navigation, 44px touch targets
- **ServiceSelector component** (`components/ServiceSelector.tsx`, 128 lines) — 6 service options with pricing and icons
- **DogSelector component** (`components/DogSelector.tsx`, 87 lines) — Multi-select dog picker with breed/size display
- **BookingSummary component** (`components/BookingSummary.tsx`, 172 lines) — Price calculator with per-dog line items
- **CheckoutPage** (`pages/CheckoutPage.tsx`, 279 lines) — Payment method tabs (Wallet/Card/Split), simulated card form, wallet balance display
- **CheckoutConfirmationPage** (`pages/CheckoutConfirmationPage.tsx`, 257 lines) — Animated success receipt with copy-to-clipboard transaction ID
- **Checkout routes** — `/checkout/:bookingId` and `/checkout/confirmation/:paymentId` as protected routes
- **Pay Now flow** — BookingPage success screen links to checkout with booking data via router state
- **API client types** — `CheckoutResult`, `ReceiptData`, `WalletResponse`, `multiDayBookingApi`, `checkoutApi`

### Added — Admin App
- **PaymentModal** (`components/PaymentModal.tsx`, 449 lines) — Multi-step payment flow: method selection → confirmation → processing → success/receipt. Supports card, wallet, cash (with change calculation), and split payments. Receipt printing via CSS `@media print`. RBAC: owner/manager only.
- **SchedulePage payment integration** — "Payment" buttons on pending/confirmed booking cards, modal wired with schedule refresh on success
- **Admin checkout API** — `adminCheckoutApi` with `getWalletBalance()` and `processPayment()` methods
- **Admin types** — `CheckoutResponse`, `WalletBalanceResponse`, `endDate` on `AdminBooking` for multi-day support

### Changed
- **Booking model** — Added optional `startDate`/`endDate` DateTime fields (backward compatible, `date` field preserved)
- **BookingService.calculatePrice** — Changed from private to public (needed by checkout)
- **Prisma OR clauses** — Fixed duplicate property names in multi-day booking queries (wrapped in `AND`)

### Files Changed (24 total)
- **New (11):** CheckoutPage, CheckoutConfirmationPage, Calendar, ServiceSelector, DogSelector, BookingSummary, PaymentModal, checkout/service, checkout/router, checkout/admin-router, checkout/types, checkout/index
- **Modified (13):** schema.prisma, server index.ts, booking/types, booking/service, booking/router, booking/admin-router, customer App.tsx, customer api.ts, BookingPage, pages/index, admin api.ts, admin SchedulePage

### TypeScript Status
- Customer app: 0 errors
- Admin app: 0 errors
- Server: 10 pre-existing errors (query param types, not from this sprint)

### Known Issues
- No Prisma migration file — schema synced via `db push`, needs `prisma migrate dev` before production deploy
- Server payment simulation always succeeds — Stripe integration planned for Sprint 3b

---

## [2.0.0-alpha.5] - Sprint 2: Polish & Close-Out - 2026-02-06

### Bug Fixes (10 total across 9 files this session)

**Session 1: Browser Testing Polish (8 fixes, commit `3c37e24`)**
- `DashboardPage.tsx` — Fixed `formatDate` timezone bug: ISO datetime strings (with `T`) were getting `T00:00:00` appended, creating invalid dates
- `DashboardPage.tsx` — Fixed upcoming bookings rendering: used wrong variable name for bookings array
- `DashboardPage.tsx` — Fixed booking card touch targets: cancel button too small for mobile (now min-h-[44px])
- `BookingsPage.tsx` — Fixed missing `serviceType` include on booking queries causing undefined display names
- `BookingPage.tsx` — Fixed grooming photo upload state not clearing on service change
- `admin-app/SchedulePage.tsx` — Fixed status action buttons not updating booking list after state change
- `admin-app/SchedulePage.tsx` — Fixed grooming condition rating not submitting (missing API call)
- `admin-app/Layout.tsx` — Fixed mobile sidebar not closing after navigation

**Session 2: Date Format Fixes (2 fixes)**
- `BookingsPage.tsx` (line 77) — Same timezone bug as DashboardPage: `formatDate` now checks if dateString already contains `T` before appending `T00:00:00`
- `BookingPage.tsx` (line 181) — Same fix applied to booking wizard's `formatDate` function

### Documentation
- Created `docs/SPRINT3-ROADMAP.md` — Full Sprint 3 vision organized into 3a/3b/3c sub-sprints
- Archived session to `ferroai/memory/cold/sessions/2026-02-06-sprint2-polish.md`

### Files Changed
1. `customer-app/src/pages/DashboardPage.tsx` — timezone fix, variable fix, touch targets
2. `customer-app/src/pages/BookingsPage.tsx` — serviceType include, date format fix
3. `customer-app/src/pages/BookingPage.tsx` — photo state, date format fix
4. `admin-app/src/pages/SchedulePage.tsx` — status actions, grooming rating
5. `admin-app/src/components/Layout.tsx` — mobile sidebar close
6. `customer-app/src/pages/DashboardPage.tsx` — upcoming bookings render
7. `admin-app/src/pages/SchedulePage.tsx` — condition rating API
8. `admin-app/src/components/Layout.tsx` — sidebar nav fix
9. `customer-app/src/pages/BookingsPage.tsx` — formatDate timezone
10. `customer-app/src/pages/BookingPage.tsx` — formatDate timezone

---

## [2.0.0-alpha.4] - Sprint 2: Testing & Bug Fixes - 2026-02-06

### Critical Bugs Fixed (10 files, 269 insertions)

**Customer App — Booking API 404s (`customer-app/src/lib/api.ts`)**
- All 8 booking endpoints used `/v2/booking/` (singular) but server mounts at `/v2/bookings/` (plural)
- Every customer booking API call was returning 404
- Fixed all paths to `/v2/bookings/`
- Added `addDog()` method for dog creation

**Admin Schedule Empty (`server/src/modules/booking/admin-router.ts`)**
- Backend returned `{ schedule }`, frontend expected `{ bookings, total }`
- Schedule page always showed empty even with bookings present
- Changed response shape to `{ bookings, total: bookings.length }`

**Admin Schedule Filter Broken (`server/src/modules/booking/admin-router.ts`)**
- Frontend sent `serviceType` (name like 'daycare'), backend only read `serviceTypeId` (UUID)
- Service type filter never worked
- Now accepts both params; resolves name → UUID via DB lookup
- Added `/service-types` endpoint for admin UI

**Admin Bundles 401 (`server/src/modules/bundles/router.ts`)**
- `GET /v2/bundles` used `authenticateCustomer` middleware
- Admin app sends staff token → always got 401
- Rewrote to accept both customer tokens (active bundles only) and staff tokens (all bundles)

**Admin Desktop Layout Broken (`admin-app/src/components/Layout.tsx`)**
- Parent container wasn't flex on desktop — sidebar stacked on top of content
- Added `lg:flex` to parent and `flex-1` to main content area

**Dog Size Update 500 (`server/src/modules/booking/router.ts`)**
- Dog size update endpoint used `prisma` but file didn't import it → 500 error
- Added missing `import { prisma } from '../../lib/prisma'`

**Dogs Missing sizeCategory (`server/src/routes/customers.ts`)**
- GET /customers/me/dogs didn't return `sizeCategory` field
- Grooming booking wizard size check failed silently
- Added sizeCategory to select + response

**No Dog Creation Endpoint (`server/src/routes/customers.ts`)**
- New customers couldn't add dogs — booking wizard was a dead end
- Added `POST /customers/me/dogs` with name, breed, birthDate, sizeCategory
- Added inline "Add Your Dog" form to BookingPage step 2

**Grooming Pricing Matrix Breaks After Edit (`admin-app/src/pages/GroomingPricingPage.tsx`)**
- Backend returned `{ tier }`, frontend treated response as raw tier object
- Added unwrapping: `(result.data as any).tier ?? result.data`

**Bundle Management Response Shapes (`admin-app/src/pages/BundleManagementPage.tsx`)**
- Toggle, create, and update all had response wrapper mismatches
- Added unwrapping for all three operations
- Added service type picker (checkboxes) to create/edit modal
- Added `getServiceTypes` to admin api.ts

### Verified Working (API-Level Testing)
- Full daycare lifecycle: create → confirm → check-in → check-out
- Grooming: slots, pricing tiers, condition rating (size × condition matrix), booking
- Bundles: create, list, toggle active/inactive
- Staff: list, create, update role
- Customer: register, add dog, book, cancel
- Admin schedule: date nav, service type filters
- Both frontend builds: 0 TypeScript errors

### NOT Yet Tested
- Browser-based end-to-end (all testing was curl/API)
- Mobile responsiveness polish
- Admin role visibility (groomer role nav filtering)
- StaffPage `handleRoleChange` missing `created_at` in update response (cosmetic, not a crash)

### Files Changed
1. `customer-app/src/lib/api.ts` — 8 booking path fixes + addDog
2. `customer-app/src/pages/BookingPage.tsx` — inline dog creation form (step 2)
3. `server/src/modules/booking/admin-router.ts` — schedule response, filter, service-types
4. `server/src/modules/booking/router.ts` — prisma import fix
5. `server/src/modules/bundles/router.ts` — dual auth (customer + staff tokens)
6. `server/src/routes/customers.ts` — sizeCategory + POST dog creation
7. `admin-app/src/components/Layout.tsx` — desktop flex layout fix
8. `admin-app/src/lib/api.ts` — getServiceTypes for admin
9. `admin-app/src/pages/BundleManagementPage.tsx` — response unwrapping + service type picker
10. `admin-app/src/pages/GroomingPricingPage.tsx` — response unwrapping

---

## [2.0.0-alpha.3] - Sprint 2: Frontend Complete - 2026-02-05

### Added — Customer App
- **BookingPage** (`pages/BookingPage.tsx`) — 7-step booking wizard: select service → select dogs → pick date (calendar grid, 30-day availability) → pick time (grooming only) → photo upload (grooming only, skippable) → bundle upsell → review & confirm. Progress dots, back nav, mobile-first, 44px touch targets
- **BookingsPage** (`pages/BookingsPage.tsx`) — Upcoming/Past tabs with status badges, cancel with confirmation dialog
- **Dashboard booking CTA** — "Book an Appointment" gradient navy card + "Upcoming Bookings" section on DashboardPage
- **Booking API layer** (`lib/api.ts`) — `bookingApi` object with 12 methods: getServiceTypes, checkAvailability, getGroomingSlots, getGroomingPriceRange, createBooking, getBookings, cancelBooking, uploadDogPhoto, updateDogSize, getBundleSuggestions, calculateBundlePrice, updateSmsPreference
- **Routes** — `/book` and `/bookings` as ProtectedRoutes in App.tsx

### Added — Admin App
- **SchedulePage** (`pages/SchedulePage.tsx`) — Daily schedule view with date nav, summary bar, filter tabs (All/Daycare/Boarding/Grooming), booking cards with status actions (confirm, check-in, check-out, no-show), inline grooming coat rating (1-5) with auto-price
- **GroomingPricingPage** (`pages/GroomingPricingPage.tsx`) — 4×5 price matrix editor (owner/manager only), editable prices and estimated minutes
- **BundleManagementPage** (`pages/BundleManagementPage.tsx`) — Bundle CRUD with active/inactive toggles (owner only)
- **StaffPage** (`pages/StaffPage.tsx`) — Staff list with role management, create staff form (owner only)
- **Layout** (`components/Layout.tsx`) — Sidebar nav with role-based visibility: Dashboard, Schedule, Customers, Grooming Pricing (owner/manager), Bundles (owner), Staff (owner), Gingr Sync. Collapsible on mobile
- **Admin API layer** (`lib/api.ts`) — 4 new API objects: adminBookingApi, adminGroomingApi, adminStaffApi, adminBundleApi
- **Brand theme** — Full @theme block in admin-app/src/index.css with brand colors and fonts

### Added — Backend
- **Grooming pricing engine** — `GroomingPriceTier` model with 4×5 size/condition matrix, price range lookups, groomer coat rating with auto-price calculation
- **Service bundles** — `ServiceBundle` + `ServiceBundleItem` models for package deals, CRUD endpoints, bundle price calculator
- **RBAC middleware** (`middleware/rbac.ts`) — role-based access control with owner/manager/staff permission tiers
- **Grooming module** (`modules/grooming/`) — pricing service + routes: GET /pricing/:size, POST /rate/:bookingDogId, GET /matrix, PUT /matrix/:id
- **Bundles module** (`modules/bundles/`) — bundle service + routes: list, suggestions, calculate, CRUD
- **Admin staff management** (`routes/v2/admin/staff.ts`) — list staff, update roles, create staff users (owner only)
- **Booking module extensions** — GET /service-types, GET /grooming-slots, PUT /dogs/:id/size, POST /:bookingId/dogs/:dogId/photo
- **SMS preferences** — PUT /customers/me/preferences for deal opt-out
- **Seed data** — 3 service types, 11 capacity rules (inc. 8 grooming time slots), 20 grooming price tiers, multi-dog discount rule

### Changed
- **Schema** — added Dog.sizeCategory, BookingDog.conditionRating/conditionPhoto/quotedPriceCents, Customer.smsDealsOptedOut, 3 new models (GroomingPriceTier, ServiceBundle, ServiceBundleItem)
- **Color migration** — brand-teal #5BBFBA → #62A2C3, brand-teal-dark #4AA9A4 → #4F8BA8 (customer + admin apps, both CSS and Tailwind config)
- **Route mounting** — 3 new server route groups: /api/v2/grooming, /api/v2/bundles, /api/v2/admin/staff
- **StaffUser roles** — expanded from admin/staff/groomer to owner/manager/staff (admin preserved as legacy)
- **Admin AuthContext** — updated StaffUser role type to include owner/manager
- **Admin App.tsx** — all protected routes wrapped in Layout component

### Fixed
- **Placeholder route wildcards** — `router.all('*')` → `router.all('/{*path}')` in payments, memberships, intakes, report-cards (Express 5 / path-to-regexp v8 compat)
- **Seed script** — added PrismaPg adapter + dotenv for Prisma 7 compatibility, replaced upsert with delete+create for nullable composite keys
- **Staff route import** — `bcryptjs` → `bcrypt` (matching existing codebase dependency)

---

## [2.0.0-alpha.1] - v2 Platform Foundation (Sprint 1) - 2026-02-05

### Added
- **500-point cap** on loyalty points balance — enforced in admin points, registration referral bonus, and Gingr auto-sync
- **Points utility** (`lib/points.ts`) — shared `capPoints()` function and constants
- **v2 Prisma schema** — 16 new models: ServiceType, CapacityRule, CapacityOverride, Booking, BookingDog, PricingRule, Wallet, WalletTransaction, Payment, MembershipPlan, Subscription, Conversation, Message, ScheduledNotification, StaffSchedule, ReportCard, IntakeForm
- **Booking module** (`modules/booking/`) — availability checking, booking CRUD, check-in/check-out, pricing rules, admin schedule view
- **Wallet module** (`modules/wallet/`) — Starbucks-style prepaid balance, 2x points for wallet payments, auto-reload config, daily load limits, transaction history
- **v2 route scaffold** — all new endpoints under `/api/v2/` namespace; existing v1 routes unchanged
- **Seed data** (`prisma/seed-v2.ts`) — daycare ($45), boarding ($65), grooming ($75) service types with capacity rules
- **v2 platform plan** (`docs/v2-platform-plan.md`) — full architecture, market analysis, sprint roadmap, security audit, AI cost projections

### Changed
- `.env.example` — added STRIPE_*, TWILIO_*, ANTHROPIC_API_KEY variables

### Note
- Schema is NOT migrated yet — requires `prisma migrate dev` + `prisma generate`
- v2 models use `(prisma as any)` casts until migration completes
- No production behavior changes — all v2 code is additive

---

## [1.4.2] - Production Stability - 2026-02-05

### Fixed
- **Intermittent network errors on login** - Root cause: unconfigured pg.Pool + Railway container sleep causing stale DB connections
- **Database connection pool** - Configured with keepAlive, 10s connection timeout, 30s idle timeout, max 10 connections, and error handler for stale connections
- **Rate limiter too aggressive** - Increased from 100 to 300 requests per 15 minutes (was causing issues during multi-device/demo scenarios)
- **Frontend requests hang forever** - Added 10s request timeout via AbortController to both customer-app and admin-app
- **Single-failure user errors** - Added retry logic (2 retries with exponential backoff) for transient network failures in both frontend apps
- **Graceful shutdown** - Server now cleanly closes HTTP server, Prisma client, and pg pool on SIGTERM/SIGINT (prevents connection leaks during Railway redeploys)

### Changed
- Better error messaging: distinguishes "server starting up" (timeout) from "check your connection" (offline)

### Action Required
- **Railway dashboard**: Verify container is not set to auto-sleep (needs paid plan setting)

---

## [1.4.1] - Bug Fixes & Branding - 2026-02-04

### Fixed
- **Walkthrough race condition** - Walkthrough now waits for customer data to load before triggering (was firing on mount, before data available)
- **Scroll position issues** - Page scrolls to top on dashboard mount and after walkthrough completes
- **Walkthrough rendering** - Multiple fixes for spotlight stability and positioning
- **Duplicate referral UI** - Fixed referral badge showing twice on registration page
- **Password auto-capitalization** - Fixed password inputs auto-capitalizing on mobile (added autoCapitalize="off")

### Added
- **Open Graph meta tags** - Link previews now show title, description, and branded image for iMessage/social sharing
- **HTHD logo in header** - Replaced text "Happy Tail Happy Dog" with actual logo
- **Sign Out moved to footer** - Coral-colored exit button at page bottom (cleaner header)
- **Referral URL in share text** - Share messages now include full registration URL with referral code
- **Custom favicon** - Replaced Vite default with HTHD logo favicon

### Changed
- Header simplified (logo only, no sign out button)
- Social preview image added (`social-preview.png`, 1200x630)

---

## [1.4.0] - Referral System + Onboarding - 2026-02-04

### Added

**Referral URL Attribution (Bug Fix)**
- RegisterPage now reads `?ref=HT-XXXXXX` from URL params
- Validates referral code via `/api/referrals/validate/:code`
- Shows "Referred by [Name]!" teal badge when valid
- Pre-fills and locks referral code field for valid referrals
- Invalid codes silently cleared (no error shown)

**Venmo-Style Referral Modal**
- New `ReferralModal` component with:
  - QR code (scannable, links to `/register?ref=CODE`)
  - Large referral code display
  - Stats: friends referred + bonus points earned
  - Share button (native share on mobile, clipboard on desktop)
- Opens from new "Refer Friends, Earn Points!" tile on dashboard

**Refer Friends Tile**
- Prominent gradient teal CTA card on dashboard
- Positioned after points balance card
- 100 points incentive messaging

**First-Login Walkthrough**
- New `Walkthrough` component with spotlight tooltip tour
- 3 steps: Points Balance → Reward Tiers → Refer Tile
- Dynamic messaging ("You're X points away from $Y discount!")
- Skip option and localStorage persistence
- Triggers after registration or account claim

### Technical
- Added `qrcode.react` dependency for QR generation
- Walkthrough uses box-shadow spotlight (performant)
- Scroll-first-then-position pattern for tooltip placement

---

## [1.3.0] - Rollout & Onboarding Phase - 2026-01-28

### Added

**New Customer Welcome Bonus**
- 25 welcome points awarded automatically to new organic signups
- Welcome email with 25-point bonus mention and referral code
- Imported customers (claiming accounts) keep their imported points without additional bonus

**Enhanced Claim Flow**
- Claim page now shows preview of imported data:
  - Points balance (already existed)
  - Dogs (new - if imported from Gingr)
  - Recent visit history (new - last 5 visits)
- API returns dogs and visits in claim lookup response

**Gingr Integration Enhancements**
- Dog import from Gingr API (via `/animals` endpoint)
  - `gingrAnimalId` field on Dog model for sync tracking
  - Dogs imported automatically during customer import
- Visit history storage and display
  - New `GingrVisit` model storing reservation data
  - Visits imported during customer import
  - Customer dashboard shows recent visits with service type badges
- `gingrOwnerId` field on Customer model for pet/visit sync

**Automatic Gingr Sync**
- Cron job for automatic point syncing (disabled by default)
- Runs every 30 minutes during business hours (7am-8pm)
- System user created for audit trail ("System Auto-Sync")
- Environment variables: `GINGR_AUTO_SYNC_ENABLED`, `GINGR_AUTO_SYNC_INTERVAL`
- Admin API returns auto-sync status in `/api/admin/gingr/status`

**Admin Checkout Optimization**
- Quick phone lookup widget on admin dashboard
  - Prominent green card at top of page
  - Instant search as you type (4+ digits)
  - Inline results with customer name, phone, points
  - One-tap to select customer
- Prominent discount display after redemption
  - Large yellow banner: "APPLY IN GINGR: $XX"
  - Impossible to miss during checkout
  - Shows for both code-based and direct redemptions

**Customer Dashboard Enhancements**
- "My Pups" section showing dogs (if any)
- "Recent Visits" section with service type badges and points earned
- API endpoints: `GET /api/customers/me/dogs`, `GET /api/customers/me/visits`

### Database Changes
- `Customer.gingrOwnerId` - Unique Gingr owner ID for sync
- `Dog.gingrAnimalId` - Unique Gingr animal ID for sync
- `GingrVisit` model - Stores visit history from Gingr reservations
- `StaffUser.role` - Now includes 'system' role for auto-sync

### Environment Variables (New)
```
GINGR_AUTO_SYNC_ENABLED=false   # Set to 'true' to enable auto-sync
GINGR_AUTO_SYNC_INTERVAL=30     # Minutes between syncs
```

### Migration Required
Run `npx prisma migrate dev` to apply schema changes.

---

## [1.4.0] - Demo Day Prep - 2026-02-02

### Added
- **DEMO.md** - Complete demo walkthrough for Ted & Julian presentation
  - Pre-demo checklist
  - Customer flow walkthrough with talking points
  - Admin flow walkthrough with talking points
  - Objection handling
  - Transition to proposal script
- **docs/** directory for project documentation
- **docs/original-proposal-oct-2025.txt** - Original Phase 1-3 proposal for reference
- **docs/transformation-proposal-feb-2026.md** - Updated proposal with three options:
  - Option 1: Buy app outright ($2,500)
  - Option 2: Intro Bundle ($150/mo)
  - Option 3: Full Digital Takeover ($1,000 + $250/mo)
- **Demo Reset Feature** - Reset claimed accounts for fresh demo walkthroughs
  - API endpoints: `POST /api/admin/demo/reset`, `GET /api/admin/demo/status`
  - "Reset Demo" button in admin dashboard header
  - Resets all Gingr-imported accounts to unclaimed state
  - Clears passwords and verification codes
  - Confirmation modal with clear feedback

### Demo Readiness
- [x] API health verified
- [x] 151 customers synced from Gingr
- [x] Auto-sync running every 30 minutes
- [x] Admin login working (credentials rotated — see secure storage)
- [x] Demo materials created
- [x] Demo reset functionality for fresh walkthroughs

---

## [Unreleased] - Production Prep

### Fixed
- **Error messages** - Replaced 5 generic "Internal server error" messages with user-friendly alternatives in auth and claim routes
- **Claim page dev text** - Removed "(and server console for demo)" from code sent message

### Added
- **Password reset** - Complete forgot password flow with email verification codes
  - New endpoints: `/api/auth/forgot-password`, `/api/auth/verify-reset-code`, `/api/auth/reset-password`
  - Password reset email template in email service
  - ForgotPasswordPage with multi-step form (identifier → code + password → success)
  - "Forgot password?" link on login page

---

## [1.3.1] - Production Prep - 2026-01-27

### Added
- **Deployment configuration files** - `railway.toml`, `vercel.json` for customer-app and admin-app
- **DEPLOYMENT.md** - Step-by-step deployment guide for Railway + Vercel + Namecheap DNS

### Fixed
- **API URL fallback bug** - Customer and admin apps now correctly fallback to port 3001 (was 3000)
- **Global error handler** - Server now catches unhandled errors to prevent crashes
- **TypeScript strict mode errors** - Fixed `response.json()` type assertions in gingr.ts
- **Prisma schema** - Added `url = env("DATABASE_URL")` to datasource config (was missing)

### Added
- **Pre-commit hook** - Scans for API keys/secrets before allowing commits
- **.env.example files** - Added for customer-app and admin-app
- **Expanded server .env.example** - Now includes Gingr, CORS, and email service configuration
- **Dockerfile** - Production container config with migrations on startup
- **start.sh** - Startup script for Railway deployments
- **railway.toml** - Forces Dockerfile builder

### Security
- Rotated Gingr API key (old key invalidated)
- Session management section added to CLAUDE.md

### Deployment Status (2026-01-27)
**✅ FULLY DEPLOYED**

| Service | URL | Status |
|---------|-----|--------|
| API | https://hthd-api.internationalaidesign.com | ✅ Live |
| Customer App | https://hthd.internationalaidesign.com | ✅ Live |
| Admin App | https://hthd-admin.internationalaidesign.com | ✅ Live |

**Infrastructure:**
- Railway: Express API + PostgreSQL
- Vercel: Customer app + Admin app (Hobby plan, public repo)
- DNS: Namecheap CNAMEs configured

**Staff Login:** Credentials in secure storage (case-sensitive username)

### Fixed (2026-01-28)
- **Gingr API integration** - Fixed 404 error on import. The `/invoices` endpoint doesn't exist in Gingr's API. Switched to `POST /reservations` which returns all needed data (owner info, pricing, services). Import now works correctly.
- **Admin app CSS** - Confirmed working (was likely a caching issue)
- **Brand compliance (customer-app)** - Full audit and fix of brand guideline violations:
  - Added missing Tailwind brand colors (coral, golden-yellow, soft-green, light-gray, soft-cream)
  - Replaced all hardcoded hex values in DashboardPage with brand tokens
  - Fixed Input component border to use brand-light-gray
  - Updated Button secondary variant to use brand colors
  - Changed reward tier buttons from green to brand teal for consistency

### Gingr Import Results (2026-01-28)
- **151 customers imported** from last 90 days of reservations
- **7,435 total points applied** (capped at 50 per customer)
- **0 skipped** - all customers had valid email + phone
- Customer claim flow verified working

### Known Issues
1. **Admin /register route blank** - Page doesn't render (low priority, staff can be added via DB)

### Known Technical Debt (Brand Compliance)
Identified during brand audit - lower priority, would require significant refactoring:
- **Tailwind gray usage** - `text-gray-600`, `bg-gray-50`, `border-gray-100`, etc. used throughout instead of brand equivalents
- **Alert component** - Uses generic red/green/yellow colors instead of brand palette

**Root cause analysis:** The initial Tailwind config was incomplete (missing accent colors like coral, golden-yellow, soft-green). Developers used Tailwind's arbitrary value syntax (`text-[#1B365D]`) as a shortcut since proper tokens didn't exist. SKILL.md brand guidelines may have been added after initial development, and no linting rules enforced token usage. Common pattern in fast MVP development.

### Demo Readiness Checklist
- [x] Fix admin app CSS/styling issue
- [x] Seed production DB with real customer data via Gingr import
- [x] Verify Gingr sync works in production
- [ ] Test full customer flow (claim account → view points → redeem)
- [ ] Test admin flow (customer lookup → award points → process redemption)

### Technical Notes
- Prisma 7 uses `prisma.config.ts` for database URL, NOT `url` in schema.prisma
- Migrations were run manually from local machine due to Prisma 7 config issues in Docker
- Railway public DB URL: `postgresql://postgres:***@hopper.proxy.rlwy.net:47664/railway`

---

## [1.2.0] - 2026-01-21

### Added

**Pre-Import & Claim Onboarding Flow**
- Database schema updates:
  - `Customer.passwordHash` now nullable for unclaimed accounts
  - `Customer.accountStatus` field ('unclaimed' | 'active')
  - `Customer.source` field ('organic' | 'gingr_import')
  - `Customer.claimedAt` timestamp
  - New `VerificationCode` table for claim verification codes
- Claim API endpoints (`/api/claim/*`):
  - `POST /lookup` - Find unclaimed account by phone/email
  - `POST /send-code` - Send 6-digit verification code to email
  - `POST /verify` - Verify code, set password, return JWT
- Email service (`server/src/services/email.ts`) - MVP console logger for verification codes
- Claim service (`server/src/services/claim.ts`) - Account lookup, code generation, verification
- Customer import from Gingr (`importCustomers` in gingr.ts):
  - Extracts unique customers from completed invoices
  - Creates unclaimed accounts with points pre-loaded
  - Admin endpoint: `POST /api/admin/gingr/import-customers`
  - Admin endpoint: `GET /api/admin/gingr/unclaimed-customers`
- Customer-app Claim page (`/claim`) with multi-step flow:
  1. Lookup - Enter phone/email to find account
  2. Verify - Receive and enter 6-digit code
  3. Password - Set account password
  4. Success - Welcome screen with points balance
- Login page updated with "Claim your account" link
- Auto-redirect to `/claim` when unclaimed account tries to login
- Admin Gingr Sync page updates:
  - "Import Customers from Gingr" button to create unclaimed accounts from invoices
  - Import results display (imported/skipped counts, points applied)
  - "Unclaimed Accounts" table showing pending claims with name, email, phone, points, date
  - Real-time count updates when customers claim accounts

### Fixed
- **Gingr API authentication** - Changed query parameter from `api_key=` to `key=` per Gingr API documentation. Connection now works correctly.
- **Import points cap** - Limited imported customer points to 50 max to prevent immediate large redemptions. Shows value without breaking the bank. (Configurable admin settings planned for v2)
- **Input whitespace trimming** - Login, Register, and Claim forms now trim whitespace from email/phone inputs to handle copy/paste issues gracefully.

### Technical Notes
- Verification codes expire after 10 minutes
- Demo mode: verification codes logged to server console (check terminal)
- Customer import requires both email AND phone from Gingr data
- Gingr API uses `key=` query parameter for authentication (not `api_key=`)
- Future: Replace console email with SendGrid/Nodemailer

---

## [1.1.0] - 2026-01-21

### Added

**Gingr Integration**
- New `GingrImport` and `GingrImportRow` database tables for tracking invoice syncs
- Gingr API service (`server/src/services/gingr.ts`) with connection testing and invoice sync
- Admin API endpoints for Gingr status, sync, and history (`/api/admin/gingr/*`)
- Admin Gingr Sync page with:
  - Connection status indicator (green/red)
  - One-click "Sync from Gingr" button
  - Results display showing invoices processed, customers matched, points applied
  - Unmatched customers list
  - Sync history table
- Navigation button to Gingr Sync from admin dashboard

**Brand Polish (Customer App)**
- Custom Tailwind config with brand colors:
  - Teal (#5BBFBA) - primary actions
  - Navy (#1B365D) - text
  - Cream (#FDF8F3) and Warm White (#F8F6F3) - backgrounds
- Google Fonts integration: Playfair Display (headings), Open Sans (body)
- Updated all UI components from default blue to brand teal

### Changed

**Admin UX Improvements**
- Renamed "Redemption Code Lookup" to "Customer Has a Code" with helper text
- Renamed "Redeem Points" to "Quick Redemption (No Code Needed)" with helper text
- Clearer workflow guidance for staff

### Technical Notes
- Gingr API connection requires "Can Access API" permission enabled in Gingr settings
- Gingr API authentication uses `key=` query parameter
- Grooming services automatically receive 1.5x points multiplier during sync

---

## [1.0.0] - Initial MVP

### Added
- Customer registration and authentication
- Points balance tracking
- Redemption code generation and processing
- Dog profile management
- Referral system (HT-XXXXXX codes)
- Staff admin portal with customer lookup
- Points awarding and redemption workflows
- Audit logging for all staff actions
