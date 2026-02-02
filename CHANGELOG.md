# Changelog

All notable changes to this project will be documented in this file.

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

### Demo Readiness
- [x] API health verified
- [x] 151 customers synced from Gingr
- [x] Auto-sync running every 30 minutes
- [x] Admin login working (admin / admin123)
- [x] Demo materials created

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

**Staff Login:** `admin` / `admin123` (case-sensitive username)

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
