# Sprint 3 Roadmap — Happy Tail Happy Dog v2

> Created: 2026-02-06 | Status: Planning | Target: Sprint 3 (Feb 2026)

Sprint 3 expands the v2 platform from booking into a full operational system: multi-day booking, rich dog profiles, in-app messaging, checkout/payment, admin dashboard overhaul, and staff scheduling.

---

## Sprint 3a: Core Flow Fixes (Foundation)

### Multi-Day Booking Calendar
- Date range selection for daycare and boarding (check-in → check-out)
- Calendar UI shows contiguous date range selection
- Capacity checks span full date range
- Single booking record with `startDate` / `endDate` fields

### Checkout & Payment Flow
- **Simulated first** — full UX, local recording, Stripe integration later
- Staff records payment at checkout: method (cash/card/wallet), total, discounts, tips
- Admin checkout screen prompts for payment details before completing check-out
- Payment record created on BookingDog or Booking
- Receipts viewable by customer in booking history

### Post-Checkout Experience
- Follow-up message sent after checkout (thank you + next booking CTA)
- Review link tied to loyalty points (leave review → earn points)
- Points awarded on checkout completion

### Admin Checkout Fix
- Current check-out action doesn't prompt for payment details
- Add payment modal before status transition to `checked_out`

---

## Sprint 3b: Rich Customer Experience

### Dog Profile Expansion
Schema needs new fields on the `Dog` model:
- **Health records**: vaccinations (type, date, expiry), medications (name, dosage, schedule)
- **Care instructions**: feeding instructions, allergies, special needs
- **Behavior**: behavior grades (staff-assigned), temperament notes
- **Social**: staff photos/notes from visits, birthday, awards/achievements
- **History**: visit count, last visit, favorite activities

### In-App Messaging
- **Claude AI + staff hybrid model**: AI handles first response, staff can jump in anytime
- SMS-style chat UX in customer app
- Conversation threads per customer (uses existing `Conversation` + `Message` models)
- Staff dashboard shows active conversations with AI/human indicator
- AI trained on HTHD-specific FAQs, policies, hours, pricing

### Report Cards with Photos
- Staff creates report cards after visits (uses existing `ReportCard` model)
- Photo upload from staff mobile device
- Customer sees report card in booking history with photos
- Push notification when report card is ready

### Multi-Dog Grooming Sequencing
- Back-to-back slot logic for customers with multiple dogs
- Single booking, sequential time slots
- Groomer sees full queue for the day

---

## Sprint 3c: Operations & Admin

### Admin Dashboard Overhaul
Current dashboard is basic. New dashboard shows:
- **Facility status**: open/closed, current capacity vs max
- **Dog count**: dogs currently on-site (checked in, not yet checked out)
- **Arrivals/departures**: today's expected check-ins and check-outs
- **Staff ratios**: current staff-to-dog ratio vs required
- **Record flags**: dogs with expired vaccinations, missing records, compliance issues
- **Quick actions**: check-in, check-out, create booking

### Staff Scheduling System
- Shift management: start/end times, break schedules
- Role-based scheduling (groomer, daycare staff, manager)
- Staff-to-dog ratio tracking and alerts
- Uses existing `StaffSchedule` model
- Calendar view for week/month scheduling

### Points-Based Checkout Option
- Customer can pay with loyalty points at checkout
- Wallet balance deduction (uses existing `Wallet` model)
- Staff sees points balance and can apply during checkout
- Partial points + partial payment supported

### Vaccination/Record Compliance
- Vaccination expiry tracking with automated flags
- Required records checklist per service type
- Block booking if critical records expired (configurable)
- Admin view: compliance dashboard showing all dogs with issues

---

## Architecture Decisions

### Payment Strategy
**Simulated first, Stripe later.** Build the full checkout UX and local payment recording now. When ready for real payments, swap the backend from local recording to Stripe Checkout/Payment Intents. This lets us:
- Ship the UX immediately
- Test the flow with real staff workflows
- Add Stripe without changing the frontend

### Messaging AI
**Claude-based hybrid.** AI handles initial customer messages using HTHD-specific context (hours, pricing, policies, FAQs). Staff can take over any conversation at any time. Benefits:
- 24/7 responsiveness
- Consistent answers for common questions
- Staff focuses on complex/emotional conversations
- Uses Anthropic API (already in `.env.example`)

### Dog Model Expansion
The `Dog` model needs significant schema additions. Plan to add:
- `vaccinations` — JSON field or related table (type, date, expiry, document URL)
- `medications` — JSON field (name, dosage, schedule, notes)
- `feedingInstructions` — text field
- `allergies` — text field
- `behaviorGrade` — enum (A/B/C/D/F) assigned by staff
- `temperamentNotes` — text field
- `birthday` — date field
- `specialNeeds` — text field

### Existing Schema Assets
These Prisma models already exist and should be leveraged:
- `StaffSchedule` — shift management
- `Payment` — payment recording
- `Wallet` / `WalletTransaction` — points-based payments
- `Conversation` / `Message` — messaging system
- `ReportCard` — post-visit report cards
- `ScheduledNotification` — automated follow-ups

---

## Sub-Sprint Sequencing

```
Sprint 3a (Foundation)     → Multi-day booking, checkout/payment, post-checkout
Sprint 3b (Experience)     → Dog profiles, messaging, report cards, multi-dog grooming
Sprint 3c (Operations)     → Admin dashboard, staff scheduling, points checkout, compliance
```

Each sub-sprint is independently deployable. 3a is prerequisite for payment-dependent features in 3b/3c.

---

## Success Criteria

- [ ] Multi-day bookings work for daycare and boarding
- [ ] Checkout records payment details (simulated)
- [ ] Dog profiles show health records, vaccinations, behavior
- [ ] In-app messaging works (AI + staff hybrid)
- [ ] Report cards with photos viewable by customers
- [ ] Admin dashboard shows facility status at a glance
- [ ] Staff scheduling functional with ratio tracking
- [ ] No regressions in Sprint 1-2 features
