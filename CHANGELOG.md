# Changelog

All notable changes to this project will be documented in this file.

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
- Service tries multiple auth formats (Token, Bearer, X-Authorization, query param)
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
