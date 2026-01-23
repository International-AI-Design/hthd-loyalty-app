# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - Production Prep

### Fixed
- **API URL fallback bug** - Customer and admin apps now correctly fallback to port 3001 (was 3000)
- **Global error handler** - Server now catches unhandled errors to prevent crashes

### Added
- **Pre-commit hook** - Scans for API keys/secrets before allowing commits
- **.env.example files** - Added for customer-app and admin-app
- **Expanded server .env.example** - Now includes Gingr, CORS, and email service configuration

### Security
- Rotated Gingr API key (old key invalidated)
- Session management section added to CLAUDE.md

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
