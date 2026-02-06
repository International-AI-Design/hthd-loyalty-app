# HTHD v2: AI-Native Pet Care Platform — Full Gingr Replacement

> Created: Feb 5, 2026
> Status: Sprint 1 complete, Sprints 2-5 remaining

## The Big Picture

Replace Gingr ($154/mo legacy software in decline) with an **AI-native pet care operating system** where AI isn't a feature — it IS the system. Customers book and pay via SMS or app. Owners get an AI business partner. Staff get streamlined tools. Nobody else in the market is doing this.

---

## Market Analysis

### Gingr (Current — $154/mo)
- **Declining:** Sold twice, now owned by a payment processing company
- **User complaints:** Glitchy software, non-existent support, broken payment processing (random batch closes), $2K gateway fees, "a company in steep decline"
- **Features:** Booking, POS, customer portal, report cards, PreCheck, staff scheduling
- **Gingr is read-only for HTHD** — we can only pull data, never push back

### MoeGo (Closest Competitor)
- Modern UI, 2-way SMS messaging, smart scheduling, online booking
- Best-in-class for grooming businesses
- **Not AI-native** — automation layer, not intelligence layer
- Higher pricing, some complaints about cost scaling

### Others
- **PetExec:** Established, Stripe integration, but legacy feel
- **Time To Pet:** DaySmart company, better for dog walkers/pet sitters
- **DaySmart Pet:** Traditional desktop-era software
- **None are AI-native.** All are "software with notifications."

### The Opportunity
The pet care software market is fragmented with legacy players. Gingr is hemorrhaging users. MoeGo is the only modern option but still follows the traditional paradigm (UI -> scheduling engine -> notifications). **Nobody is building AI-in-the-middle** where the intelligence layer IS the core.

---

## What Makes It Category-Defining

1. **SMS-first, app-optional:** Customers don't need to download anything. Text to book, text to pay, text to ask questions. The app is a premium experience, not a requirement.

2. **AI receptionist that actually works:** Not a chatbot with buttons. Claude-powered natural language understanding that handles booking, payments, FAQs, and escalation.

3. **Starbucks wallet model in pet care:** Prepaid balance, 2x points incentive, auto-reload. Creates float/working capital AND customer lock-in. Nobody in pet care does this.

4. **AI business partner for owners:** Ted can text "How was today?" and get a full business briefing. Real-time revenue, bookings, staff notes, customer insights, lead pipeline.

5. **TurboTax onboarding:** New pet intake as a guided conversation, not a wall of fields. Can be done via SMS or app.

### Future Phases (Phase 3+)
- AI that learns pet behavior patterns and proactively suggests services
- Predictive staffing (AI recommends schedule based on booking trends)
- Automated marketing (AI writes and sends personalized re-engagement)
- Voice AI for phone calls (after-hours answering)
- Multi-business marketplace (customers discover HTHD through the platform)
- Vet record integration (photo of vaccine card -> AI reads it)

---

## Architecture: AI-in-the-Middle

```
INPUTS                        AI ORCHESTRATOR                 BUSINESS LOGIC
(SMS, App, Voice, Web)  ->  (Claude API + Tool Use)  ->  (Booking, Payments, etc.)
                                    |
                              CONTEXT LAYER
                        (Customer profile, dogs,
                         wallet, history, conversation)
```

### How It Works
Every interaction — customer SMS, app tap, owner question, staff query — routes through the AI orchestrator. The orchestrator:
1. **Identifies** who's talking (phone number -> customer lookup)
2. **Understands** intent (Claude parses natural language)
3. **Loads context** (customer profile, dogs, bookings, wallet)
4. **Executes actions** via tool_use (check availability, create booking, process payment)
5. **Responds** in the right format (160-char SMS vs full app response)

### Tech Stack
- **Existing:** Vite+React (2 apps), Express+Prisma+PostgreSQL, Vercel, Railway
- **New:** Twilio (SMS/Voice), Stripe (payments/wallet), Claude API (AI orchestrator)
- **Architecture:** Extend existing Express monolith with v2 route groups — no microservices

---

## Starbucks Model Adaptation

### Happy Tail Version
| Feature | Implementation |
|---------|---------------|
| **Wallet** | Customers load $25/$50/$100 via Stripe. Balance stored in DB. |
| **2x Points** | Pay from wallet = 2 pts/$1. Pay by card = 1 pt/$1. Grooming still gets 1.5x multiplier on top. |
| **Auto-reload** | Set threshold ($10) + reload amount ($50). Stripe charges saved card automatically. |
| **Tiers** | Basic (free), Gold (300+ pts/yr), VIP (membership plan) |
| **Rewards** | 100 pts = $10, 250 pts = $25, 500 pts = free daycare day |
| **Float** | HTHD holds prepaid balances — working capital at zero cost |

---

## Database Schema (New v2 Models)

Added to existing Prisma schema in Sprint 1:

### Booking & Availability
- **ServiceType** — daycare/boarding/grooming with base prices, durations
- **CapacityRule** — max dogs per day/slot by service + day-of-week
- **CapacityOverride** — holiday closures, special events
- **Booking** — core scheduling record with status workflow
- **BookingDog** — many-to-many: which dogs on which booking
- **PricingRule** — dynamic pricing, multi-dog discounts, membership discounts

### Wallet & Payments
- **Wallet** — per-customer balance, tier, auto-reload config, Stripe customer link
- **WalletTransaction** — load/payment/refund ledger
- **Payment** — unified payment record (wallet, card, or split)
- **MembershipPlan** — tier definitions
- **Subscription** — customer subscription with Stripe billing

### AI & Communication
- **Conversation** — SMS/chat threads with context accumulator
- **Message** — individual messages with AI intent, confidence, tool calls logged
- **ScheduledNotification** — booking confirmations, reminders, report cards

### Staff & Operations
- **StaffSchedule** — shifts by date
- **ReportCard** — photos/notes per booking, SMS/MMS delivery
- **IntakeForm** — progressive data collection with step tracking

---

## API Design

All new endpoints under `/api/v2/` namespace (existing v1 unchanged):

- `/api/v2/bookings` — CRUD, availability checking
- `/api/v2/wallet` — balance, load funds, auto-reload, payment methods
- `/api/v2/payments` — process, refund, history
- `/api/v2/memberships` — plans, subscribe, cancel
- `/api/v2/sms/webhook` — Twilio inbound handler
- `/api/v2/ai/chat` — authenticated web chat
- `/api/v2/ai/briefing` — owner business briefing
- `/api/v2/admin/bookings` — schedule view, check-in/out
- `/api/v2/admin/report-cards` — create, send
- `/api/v2/admin/intakes` — review submissions
- `/api/v2/webhooks/stripe` — payment/subscription events
- `/api/v2/webhooks/twilio` — delivery status

---

## Module Architecture (Plug-and-Play)

Each module is self-contained with its own schema, services, routes, and types:

```
server/src/modules/
  booking/        -> Calendar, availability, reservations
  wallet/         -> Prepaid balance, credits, Starbucks model
  payments/       -> Stripe integration, split payments (Sprint 2)
  loyalty/        -> Points, tiers, rewards, multipliers (existing + enhanced)
  ai-orchestrator/ -> Claude tool_use, intent routing (Sprint 2)
  sms-gateway/    -> Twilio SMS/MMS/Voice webhooks (Sprint 3)
  notifications/  -> Scheduled reminders, confirmations (Sprint 3)
  intake/         -> Progressive forms, TurboTax-style (Sprint 4)
  staff/          -> Schedules, roles, report cards (Sprint 5)
  pet-profiles/   -> Dog-specific: breed, behavior, health (Sprint 5)
```

---

## Sprint Execution Plan

### Sprint 1: Foundation (COMPLETE - Feb 5, 2026)
- [x] v2 Prisma schema with all new models (16 models added)
- [x] 500-point cap implemented (lib/points.ts, enforced in 3 paths)
- [x] v2 route scaffold (9 route files, mounted in index.ts)
- [x] Booking module (service, types, customer routes, admin routes)
- [x] Wallet module (service, types, customer routes)
- [x] Seed data (service types, capacity rules, pricing rules)
- [x] TypeScript compiles clean (zero errors)
- [ ] DB migration (needs staging environment)

### Sprint 2: Payments + AI Core
- Wire booking + wallet together with payment flow
- Stripe checkout (PaymentIntents, split wallet/card, receipts, tipping)
- AI orchestrator (tool registry, Claude API, intent routing, system prompts)

### Sprint 3: SMS + Communication
- SMS gateway (Twilio webhooks, conversation storage, message formatting)
- Wire AI orchestrator to booking/payment tools
- Notification module (scheduled reminders, confirmations, report card delivery)

### Sprint 4: Customer Experience
- Customer app v2 (booking UI, wallet page, chat interface)
- Intake module (TurboTax onboarding, progressive forms)
- Color update (#62A2C3 blue)
- Integration testing, SMS end-to-end flow

### Sprint 5: Admin + Owner AI
- Staff module (schedules, report cards, check-in/out)
- Owner AI briefing (daily summary, revenue, customer insights)
- Admin dashboard enhancements

---

## AI Cost Projections (at HTHD scale)

| Category | Volume/Month | Model | Cost/Month |
|----------|-------------|-------|------------|
| Intent classification | 3,000 SMS | Haiku | ~$0.90 |
| Booking conversations | 900 bookings | Sonnet | ~$18.00 |
| Balance/simple queries | 1,500 | Haiku | ~$0.45 |
| Owner briefings | 60 (2/day) | Opus | ~$6.00 |
| Report cards | 600 | Sonnet | ~$6.00 |
| **Total AI API cost** | | | **~$32/month** |
| **Twilio SMS** | ~6,000 messages | | **~$47/month** |

AI cost (~$32/mo) is less than the Gingr subscription ($154/mo) it replaces.

---

## Pre-requisites (Johnny Action Items)

| Item | Status |
|------|--------|
| Twilio account + Denver phone number | Needed |
| Stripe account + API keys | Needed |
| Anthropic API key | Needed |
| Railway staging environment | Recommended |
| 500-point cap | DONE |
| Color update (blue) | Sprint 4 |

---

## Gingr Coexistence Strategy

1. Build new booking system alongside existing Gingr sync
2. Run parallel — staff uses both during transition
3. Gradually move booking activity to HTHD system
4. Once proven, stop using Gingr for bookings
5. Full migration complete -> cancel Gingr ($154/mo saved)

---

## Security Architecture

Full security audit documented separately. Key points:
- Prompt injection defense: 5+ layers (input filtering, structured prompts, tool permission boundaries, confirmation gates, output validation)
- SMS spoofing mitigated via Twilio webhook signature validation
- Wallet fraud prevention: Prisma transactions, load limits, idempotency keys
- All card data handled by Stripe (PCI compliant) — never touches our servers
- Rate limiting per phone number for SMS interactions
- Circuit breaker on suspected injection attempts
