# MS-1: Schema + Migration — COMPLETE

**Status: DONE** — Completed 2026-02-24. Commit `c0392bf`.

## Session Protocol
> **One micro-sprint per session.** Each session: execute the sprint, pass build gates, commit, push, then shut down. Do NOT start the next sprint in the same session. Fresh context prevents compaction disasters.
>
> **Shutdown sequence:** After push succeeds → update CHANGELOG.md → archive session to `archive/sessions/` → update memory files → verify all logs written → confirm ready to exit.

## Context
This is micro-sprint 1 of 8 for the HTHD feature expansion. The codebase is clean (all prior uncommitted work was wiped). You are adding new models and fields to the Prisma schema, then generating a migration.

**Prior sprints completed:** None — this is the foundation.

## Read First
- `server/prisma/schema.prisma` — the full current schema (754 lines)

## What to Do

### 1. Add fields to the `Dog` model

After the `socialNotes` field (line ~62), add:
```prisma
allergies          String?
specialNeeds       String?   @map("special_needs")
emergencyVetName   String?   @map("emergency_vet_name")
emergencyVetPhone  String?   @map("emergency_vet_phone")
lastGroomDate      DateTime? @map("last_groom_date") @db.Date
```

### 2. Add field to the `Vaccination` model

After the `notes` field (line ~631), add:
```prisma
cloudinaryPublicId String?  @map("cloudinary_public_id")
```

### 3. Add new models

**After `GroomingPriceTier` model (~line 587), add:**

```prisma
model GroomingServicePrice {
  id           String             @id @default(uuid())
  subServiceId String             @map("sub_service_id")
  sizeCategory String?            @map("size_category")
  priceCents   Int                @map("price_cents")
  isActive     Boolean            @default(true) @map("is_active")
  subService   GroomingSubService @relation(fields: [subServiceId], references: [id], onDelete: Cascade)
  @@unique([subServiceId, sizeCategory])
  @@map("grooming_service_prices")
}

model GroomingAddOn {
  id          String       @id @default(uuid())
  name        String       @unique
  displayName String       @map("display_name")
  description String?
  priceCents  Int          @map("price_cents")
  isActive    Boolean      @default(true) @map("is_active")
  sortOrder   Int          @default(0) @map("sort_order")
  bookings    BookingAddOn[]
  @@map("grooming_add_ons")
}

model BookingAddOn {
  id         String        @id @default(uuid())
  bookingId  String        @map("booking_id")
  addOnId    String        @map("add_on_id")
  priceCents Int           @map("price_cents")
  booking    Booking       @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  addOn      GroomingAddOn @relation(fields: [addOnId], references: [id])
  @@unique([bookingId, addOnId])
  @@map("booking_add_ons")
}
```

**After `VaccinationRequirement` model (~line 690), add:**

```prisma
model ServiceAgreement {
  id          String               @id @default(uuid())
  name        String               @unique
  displayName String               @map("display_name")
  content     String
  version     Int                  @default(1)
  isActive    Boolean              @default(true) @map("is_active")
  requiredFor String[]             @map("required_for")
  createdAt   DateTime             @default(now()) @map("created_at")
  updatedAt   DateTime             @updatedAt @map("updated_at")
  signatures  AgreementSignature[]
  @@map("service_agreements")
}

model AgreementSignature {
  id            String           @id @default(uuid())
  agreementId   String           @map("agreement_id")
  customerId    String           @map("customer_id")
  typedName     String           @map("typed_name")
  agreedToTerms Boolean          @default(true) @map("agreed_to_terms")
  ipAddress     String?          @map("ip_address")
  userAgent     String?          @map("user_agent")
  signedAt      DateTime         @default(now()) @map("signed_at")
  agreement     ServiceAgreement @relation(fields: [agreementId], references: [id])
  customer      Customer         @relation(fields: [customerId], references: [id], onDelete: Cascade)
  @@index([customerId, agreementId])
  @@map("agreement_signatures")
}

model BoardingDetail {
  id               String   @id @default(uuid())
  bookingId        String   @unique @map("booking_id")
  feedingSchedule  String?  @map("feeding_schedule")
  foodType         String?  @map("food_type")
  foodBrand        String?  @map("food_brand")
  feedingNotes     String?  @map("feeding_notes")
  dropOffTime      String?  @map("drop_off_time")
  pickUpTime       String?  @map("pick_up_time")
  specialItems     String?  @map("special_items")
  emergencyContact String?  @map("emergency_contact")
  createdAt        DateTime @default(now()) @map("created_at")
  booking          Booking  @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  @@map("boarding_details")
}
```

**After `AimAlert` model (~line 740), add:**

```prisma
model CustomerBadge {
  id         String   @id @default(uuid())
  customerId String   @map("customer_id")
  badge      String
  earnedAt   DateTime @default(now()) @map("earned_at")
  notified   Boolean  @default(false)
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  @@unique([customerId, badge])
  @@map("customer_badges")
}

model AimInsight {
  id          String   @id @default(uuid())
  type        String
  title       String
  summary     String
  data        Json?
  generatedAt DateTime @default(now()) @map("generated_at")
  expiresAt   DateTime @map("expires_at")
  @@index([type, expiresAt])
  @@map("aim_insights")
}
```

### 4. Add relations to existing models

**In `GroomingSubService` model**, add after the `bookings` field:
```prisma
prices     GroomingServicePrice[]
```

**In `Booking` model**, add after the `notifications` field:
```prisma
addOns         BookingAddOn[]
boardingDetail BoardingDetail?
```

**In `Customer` model**, add after the `intakeForms` field:
```prisma
agreementSignatures AgreementSignature[]
badges              CustomerBadge[]
```

### 5. Verify and Migrate

```bash
cd server && npx prisma validate
npx prisma migrate dev --name sprints_abcd_schema --create-only
```

**Review the generated migration SQL.** It should contain:
- `ALTER TABLE "dogs"` adding 5 columns
- `ALTER TABLE "vaccinations"` adding 1 column
- `CREATE TABLE` for 8 new tables: `grooming_service_prices`, `grooming_add_ons`, `booking_add_ons`, `service_agreements`, `agreement_signatures`, `boarding_details`, `customer_badges`, `aim_insights`
- Indexes and unique constraints

Then apply:
```bash
npx prisma migrate dev
npx prisma generate
npx tsc --noEmit
```

All must pass with zero errors.

## Build Gate
- [ ] `npx prisma validate` — passes
- [ ] Migration SQL reviewed — correct tables/columns
- [ ] `npx prisma migrate dev` — applied successfully
- [ ] `npx prisma generate` — client regenerated
- [ ] `npx tsc --noEmit` — zero TypeScript errors

## Git Commit
```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(schema): add sprints A-D models and fields

Add Dog extended fields (allergies, specialNeeds, emergencyVet, lastGroomDate),
Vaccination cloudinaryPublicId, GroomingServicePrice, GroomingAddOn, BookingAddOn,
ServiceAgreement, AgreementSignature, BoardingDetail, CustomerBadge, AimInsight.

MS-1 of 8 micro-sprint rebuild."
```

## CHANGELOG Entry
Add to `CHANGELOG.md` under a new section:
```
## [Unreleased] - Sprints A-D Rebuild

### MS-1: Schema + Migration
- Added Dog extended fields: allergies, specialNeeds, emergencyVetName/Phone, lastGroomDate
- Added Vaccination cloudinaryPublicId for document uploads
- New models: GroomingServicePrice, GroomingAddOn, BookingAddOn
- New models: ServiceAgreement, AgreementSignature, BoardingDetail
- New models: CustomerBadge, AimInsight
- Migration: sprints_abcd_schema
```

## Completion Notes
- Migration applied to both Railway prod DB and local Docker Postgres (`happy-tail-postgres`)
- Used `prisma migrate diff` + `prisma migrate deploy` (not `migrate dev`) due to prod DB drift
- Docker Postgres container must be running for pre-push hook tests to pass
- All 50 server tests pass, all 3 apps type-check clean

## Next Session
Proceed to MS-2 (Sprint A Server — uploads + dog-profile enhancements).
