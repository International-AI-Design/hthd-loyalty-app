# Happy Tail Happy Dog — Backlog

Tracked UX issues, feature requests, and improvements. Items here are queued for implementation.

---

## UX Issues

### 1. Pet Setup Flow — Too Rigid on First Booking
**Priority:** High
**Area:** Customer App — Booking Flow / Pet Profile
**Status:** Open
**Status: RESOLVED** — Fixed in overnight autonomous session (2026-02-08)

The "add a pet" flow during first-time booking forces full profile setup before proceeding. This is too much friction.

**Required behavior:**
- User should be able to **skip the full pet profile setup** and proceed with booking
- Show a **warning** that certain info is required before the appointment (e.g., vaccination records, breed, weight)
- Messaging: "Save time by completing this now, or come back anytime"
- User can **return to the pet profile page and resume setup** at any point — progress should be saved
- Only truly required fields should block booking confirmation, not the entire profile

### 2. Welcome Message Shows "Welcome Back" for New Users
**Priority:** Medium
**Area:** Customer App — Onboarding / Dashboard
**Status:** Open
**Status: RESOLVED** — Fixed in overnight autonomous session (2026-02-08)

After signing up as a brand new user, the app displayed "Welcome back" messaging. Should detect first-time users and show appropriate welcome copy (e.g., "Welcome to Happy Tail!" or similar).

### 3. Admin Customer Detail View — Missing Key Info
**Priority:** High
**Area:** Admin App — Customer Management
**Status:** Open
**Status: RESOLVED** — Fixed in overnight autonomous session (2026-02-08)

When navigating to Customers → [specific customer], the detail view only shows loyalty points. Missing critical information that staff needs:

**Should display:**
- **Pets** — List of customer's pets with key details
- **Customer info** — Contact details, account info, notes
- **Upcoming bookings** — Scheduled appointments

Currently just shows the points section, which is insufficient for staff to manage customer relationships.

---

## Notes

- Items added from Johnny's UX review on 2026-02-06
- Other session actively working on app — coordinate before picking up items
