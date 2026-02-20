# HTHD Master Sprint Plan
**Created:** 2026-02-13
**Status:** Active
**Starting Point:** Sprint 3 (Sprints 1-2 complete)

---

## Context

Family tested the customer app and found critical issues. Competitor analysis done against Otto (vet app) and Gingr (admin app we're replacing). Screenshots in `docs/screenshots from otto app/`, `docs/screenshots of gingrapp/`, and `docs/screenshots of grooming services and pricing/`.

### Critical Issues from Family Testing
1. **Pet profile crashes** - white screen on tap, can't recover without force-refresh
2. **Grooming service selection broken** - users get a quoted range instead of picking specific services
3. **No onboarding** - users land cold with no welcome, no terms agreement

---

## Feature Gap Summary

### vs Otto (Customer App)
| Feature | HTHD Status |
|---|---|
| Welcome popup ("Hello!") with terms/privacy | Missing |
| Pet Profile tabs (Profile / Appointments / Reminders) | Partial - no appointment/reminder tabs |
| Pet ID Card (pet + owner + vet info) | Missing - no vet info anywhere |
| Medical History with vaccination expiry | Partial - tracked but no timeline view |
| Service Reminders on home screen | Missing |

### vs Gingr (Admin App)
| Feature | HTHD Status |
|---|---|
| At-a-glance dashboard with icon badges | Missing |
| Expired immunization badges | Missing on admin side |
| Altered/unaltered status | Missing from schema |
| Lodge together flag (boarding) | Missing |
| Owner balance display inline | Missing from admin list |
| Missing agreements alert | Missing - no agreements/waivers |
| Comprehensive animal detail (vet, microchip, allergies, feeding, authorized agent, "good with" notes) | Mostly missing |
| Digital release/waiver with signature | Missing |
| Emergency vet authorization ($X limit) | Missing |

### Grooming Pricing Matrix (from HTHD website)
| Service | Small | Medium | Large | XL |
|---|---|---|---|---|
| Just a Bath | $48 | $75 | $95 | $124 |
| Bath & Trim | $78 | $98 | $120 | $142 |
| Bath & Haircut | $95 | $117 | $148 | $167 |
| Nail Trimming | $20 flat | | | |
| Teeth Brushing | $10 flat | | | |

**Add-Ons:** De-shedding ($40), Dental Brushing ($10), Deep Conditioning ($15)

**Key Rule:** Once pet size is entered and admin-confirmed, it's STICKY. Never ask again for that pet.

---

## Sprint Breakdown

### Sprint 3: Critical Bug Fix - Pet Profile Crash
**Priority: P0 - Blocking**
**Scope: ~1 session**

- [ ] Fix white screen crash when tapping pet name in MyPetsPage
- [ ] Root cause investigation (likely missing data fetch / unhandled error / missing error boundary)
- [ ] Add React error boundaries to prevent white-screen-of-death across BOTH apps
- [ ] Add proper loading states and error fallback UI
- [ ] Verify fix on actual mobile device
- [ ] **Real user test**: tap pet name, see profile load, navigate back, tap again - must work every time

**Acceptance Criteria:**
- User taps pet name → sees pet profile (never white screen)
- If data fails to load → user sees friendly error with retry button
- Back navigation works without needing manual refresh

---

### Sprint 4: Welcome/Onboarding Flow
**Priority: P0 - First Impression**
**Scope: ~1 session**

- [ ] Otto-style welcome popup on first launch:
  - "Hello!" heading with dog icon
  - "Thank you for trusting us with the care of your pet" caption
  - Bullet list: Book grooming, Track your pup, Earn rewards, Message us
  - "By clicking Continue you agree to Terms of Service and Privacy Policy"
  - Links to existing /terms and /privacy pages
  - Continue button
- [ ] First-time user detection (localStorage flag, show once)
- [ ] After Continue → land on home dashboard
- [ ] Home screen refinements:
  - Service Reminders section (vaccination expiring, grooming due)
  - Upcoming Appointments section with date/time
- [ ] Verify on mobile

**Reference:** `docs/screenshots from otto app/IMG_8585.PNG` (welcome popup)

---

### Sprint 5: Pet Profile Enrichment + Pet ID Card
**Priority: P1 - Core Data Model**
**Scope: ~2 sessions (5a: schema/API, 5b: UI)**

#### Sprint 5a: Schema & API
- [ ] Add to Dog model:
  - `vetName`, `vetPhone`, `vetAddress`, `vetEmail`
  - `microchipNumber`
  - `allergies` (text)
  - `feedingMethod`, `foodType`, `feedingNotes`
  - `alteredStatus` (enum: intact/spayed/neutered), `alteredDate`
  - `color` / markings
  - `emergencyAgent`, `emergencyAgentRelationship`, `emergencyAgentPhone`
  - `emergencyVetCostLimit` (integer, cents)
  - `goodWith` (text - "large dogs only", "cats ok", etc.)
  - `careInstructions` (text)
  - `dateOfBirth` (verify exists and displays correctly)
- [ ] Migration + seed data update
- [ ] API endpoints for all new fields (extend existing PUT /api/v2/dogs/:id)
- [ ] Pet ID Card endpoint: GET /api/v2/dogs/:id/id-card (returns pet + owner + vet info)

#### Sprint 5b: Customer App UI
- [ ] Pet Profile tabs (Otto-style):
  - **Profile tab**: all fields, editable sections
  - **Appointments tab**: upcoming + past bookings for this dog
  - **Reminders tab**: vaccination expiry, upcoming services
- [ ] Pet ID Card modal (Otto-style):
  - Pet info section (name, DOB, breed, sex, altered, weight, color)
  - Owner info section (name, address, email, phone)
  - Vet info section (name, phone, email, address)
  - Medical History section (vaccination list with "Good until" dates)
  - "Send ID Card" / share button
- [ ] Photo upload for pet avatar (camera + file picker)

**Acceptance Criteria:**
- Size entered ONCE → sticky across all modules for that pet
- All Otto Pet ID Card fields populated and displayable
- Vet info visible and editable by customer

**Reference:** `docs/screenshots from otto app/IMG_8587.PNG` through `IMG_8590.PNG`

---

### Sprint 6: Grooming Service Selection Overhaul
**Priority: P1 - Revenue Blocker**
**Scope: ~2 sessions (6a: schema/API/pricing, 6b: booking UI)**

#### Sprint 6a: Schema & Pricing Engine
- [ ] Expand ServiceType to support grooming sub-categories:
  - `grooming_bath` - Just a Bath
  - `grooming_bath_trim` - Bath & Trim
  - `grooming_bath_haircut` - Bath & Haircut
  - `nail_trimming` - Nail Trimming
  - `teeth_brushing` - Teeth Brushing
- [ ] Add-on service model:
  - De-shedding Treatment ($40)
  - Dental Brushing ($10)
  - Deep Conditioning ($15)
- [ ] BookingAddon model: links add-on services to bookings
- [ ] Update GroomingPriceTier: service × size → exact price (not range)
- [ ] Pricing API: given dog ID + service → return exact price (using stored size)
- [ ] Add-on pricing API

#### Sprint 6b: Booking UI Overhaul
- [ ] Replace grooming step in booking wizard:
  - Service category cards with icons (like pricing screenshot)
  - Each card: name, description of what's included, price for YOUR dog
  - Price auto-pulled from dog's stored size
  - If size not set → one-time prompt, then save permanently
- [ ] Add-on services step:
  - Grid of add-on cards with photos/icons
  - Toggle on/off, running total updates
- [ ] Service descriptions: "Includes brush-out, nail trim, and ear cleaning"
- [ ] Review step: itemized breakdown (base service + add-ons = total)
- [ ] Admin: service & pricing management UI
- [ ] Admin: add-on service management

**Acceptance Criteria:**
- User sees specific services with exact prices (not ranges)
- Price based on pet's stored size - no re-entry
- Add-ons selectable and reflected in total
- Admin can manage all service types and pricing

**Reference:** `docs/screenshots of grooming services and pricing/` (all 6 screenshots)

---

### Sprint 7: Vet Records Upload + Medical History
**Priority: P1 - Differentiation**
**Scope: ~2 sessions (7a: upload/extraction, 7b: display/integration)**

- [ ] Upload vet records (PDF/photo) on pet profile
- [ ] AI extraction: parse records for vaccination names, dates, expiry, vet info
- [ ] VetRecord model: file URL, upload date, extraction status, raw JSON
- [ ] Display extracted data as structured medical history timeline
- [ ] Manual correction UI for AI-extracted data
- [ ] Auto-populate Vaccination model from extracted records
- [ ] Medical history on Pet ID Card (like Otto: vaccine name + "Good until" date)

**Reference:** `docs/screenshots from otto app/IMG_8590.PNG` (Pet ID Card with medical history)

---

### Sprint 8: Agreements, Waivers & Boarding Logic
**Priority: P1 - Legal/Compliance**
**Scope: ~2 sessions**

- [ ] Agreement template system (admin-configurable)
- [ ] Required agreements per service type
- [ ] Customer signing flow with digital signature capture
- [ ] Emergency vet authorization form:
  - Cost limit ($)
  - Euthanasia consent checkbox
  - Unauthorized procedures list
- [ ] Agreement compliance tracking
- [ ] Multi-dog boarding: book multiple dogs, "lodge together" toggle
- [ ] Admin: missing agreements alerts (Gingr-style badge)
- [ ] Admin: view signed agreements per customer
- [ ] Admin: agreement template management

**Reference:** `docs/screenshots of gingrapp/Screenshot 2026-02-13 at 10.19.50 AM.png` and `10.20.05 AM.png`

---

### Sprint 9: Admin Dashboard Intelligence
**Priority: P2 - Operations**
**Scope: ~1 session**

- [ ] Gingr-style at-a-glance view with icon badges per animal:
  - Immunization expired (red shield)
  - Altered/unaltered (gender symbol)
  - Lodge together flag
  - Missing agreements (orange asterisk)
- [ ] Owner column: account balance inline, outstanding balance alert
- [ ] Expandable animal summary panel with all Gingr detail fields
- [ ] Quick filters: show only animals with alerts

**Reference:** `docs/screenshots of gingrapp/Screenshot 2026-02-13 at 10.18.10 AM.png` through `10.18.58 AM.png`

---

### Sprint 10: Cross-Module Polish & Data Flow
**Priority: P2 - Seamlessness**
**Scope: ~1 session**

- [ ] Pet size flows everywhere: booking, pricing, grooming, profile
- [ ] Service reminders on customer home screen
- [ ] Appointment tab on pet profile pulling real booking data
- [ ] Reminder tab with notification preferences
- [ ] Conversation improvements (Otto-style history with previews)
- [ ] Admin: customer list shows dogs with compliance badges inline
- [ ] End-to-end smoke testing of full customer journey

---

## Total Estimated Sessions: ~12

| Sprint | Focus | Priority | Sessions |
|---|---|---|---|
| 3 | Bug fix: Pet profile crash | P0 | 1 |
| 4 | Welcome/onboarding flow | P0 | 1 |
| 5 | Pet profile enrichment + Pet ID Card | P1 | 2 |
| 6 | Grooming service selection overhaul | P1 | 2 |
| 7 | Vet records upload + AI extraction | P1 | 2 |
| 8 | Agreements/waivers + boarding logic | P1 | 2 |
| 9 | Admin dashboard intelligence | P2 | 1 |
| 10 | Cross-module polish & data flow | P2 | 1 |
| | **Total** | | **~12** |
