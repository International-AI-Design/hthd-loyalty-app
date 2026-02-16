# Happy Tail Happy Dog Loyalty App

## Project Overview
Pet business loyalty program - MVP complete with 25 user stories implemented. Active development for v2 features while maintaining stability.

## Production URLs
| Service | URL | Platform |
|---------|-----|----------|
| **Customer App** | https://hthd.internationalaidesign.com | Vercel |
| **Admin App** | https://hthd-admin.internationalaidesign.com | Vercel |
| **API** | https://hthd-api.internationalaidesign.com | Railway |

**Staff Login:** See Railway environment variables or ask Johnny for credentials. Never store passwords in git-tracked files.

## Deployment Workflow
**Repository:** `https://github.com/International-AI-Design/hthd-loyalty-app.git`

### Server (Railway) — Auto-deploys on push
```bash
git push origin main  # Railway auto-deploys server/ changes (~2-3 min)
```

### Customer & Admin Apps (Vercel) — Manual deploy required
Vercel is NOT connected to GitHub for auto-deploy. You must deploy manually from the **monorepo root** (`happy-tail/`).

**CRITICAL: Vercel project names do NOT match directory names:**

| App | Directory | Vercel Project Name | Custom Domain |
|-----|-----------|-------------------|---------------|
| Customer | `customer-app/` | `hthd-loyalty-app` | `hthd.internationalaidesign.com` |
| Admin | `admin-app/` | `hthd-loyalty-app-3fgb` | `hthd-admin.internationalaidesign.com` |

```bash
# Deploy customer app (from monorepo root!)
cd production/happy-tail
vercel link --project hthd-loyalty-app --yes
vercel --prod --yes

# Deploy admin app (from monorepo root!)
vercel link --project hthd-loyalty-app-3fgb --yes
vercel --prod --yes

# Re-link to customer project after (default)
vercel link --project hthd-loyalty-app --yes
```

**Why from monorepo root?** Each Vercel project has Root Directory set (`customer-app/` or `admin-app/`). Deploying from a subdirectory causes path errors.

**Rollback:** Use Railway/Vercel dashboards to redeploy previous version if needed.

See `DEPLOYMENT.md` for initial setup, environment variables, and DNS configuration.

## Brand Guidelines
**IMPORTANT:** See `SKILL.md` for complete brand guidelines including:
- Color palette (Blue #62A2C3 primary, Navy #1B365D text)
- Typography (Playfair Display headings, Open Sans body)
- Voice & tone (warm, welcoming, kennel-free philosophy)
- UI component styles (buttons, cards, inputs)

Apply these guidelines to ALL customer-facing UI in `customer-app/`.

## Frontend Design Requirements

**CRITICAL**: For ALL frontend/UI work, use the `frontend-design` skill to ensure production-grade, mobile-first interfaces.

### Before Starting Frontend Work
1. Invoke `/frontend-design` or ensure skill auto-triggers
2. Read `SKILL.md` for brand guidelines and mobile checklist
3. Design mobile-first, enhance for desktop

### Quality Gate
No frontend is complete until:
- Mobile checklist in SKILL.md is satisfied
- Tested on actual mobile device (staff use tablets/phones at front desk)
- Typography and colors match brand guidelines

## Architecture
Monorepo with three apps:
- `server/` - Express API with Prisma/PostgreSQL
- `customer-app/` - React customer-facing app (uses brand guidelines)
- `admin-app/` - React staff dashboard

All apps share TypeScript strict mode and Zod validation patterns.

## Key Business Logic
- **Points**: 1 point per dollar spent, **1.5x multiplier for grooming services**
- **Redemption tiers**: 100 pts = $10, 250 pts = $25, 500 pts = $50
- **Referral codes**: Auto-generated as HT-XXXXXX format
- Points are reserved (not deducted) until staff completes redemption

## Database
Schema in `server/prisma/schema.prisma`. Key models: Customer, Dog, PointsTransaction, Redemption, StaffUser, AuditLog.

Run `npx prisma studio` from `/server` to browse data.

## API Structure
- `/api/` - Customer endpoints (auth, profile, redemptions)
- `/api/admin/` - Staff endpoints (customer lookup, points, redemptions)

JWT tokens: 7-day expiry for customers, 8-hour for staff. Different payloads - check `server/src/middleware/auth.ts`.

## Development
```bash
# Database
cd server && npx prisma migrate dev
npx prisma db seed  # Loads test data

# Run all three
cd server && npm run dev      # Port 3000
cd customer-app && npm run dev # Port 5173
cd admin-app && npm run dev    # Port 5174
```

## Feature Reference
Check `prd.json` for all user stories and acceptance criteria. Use this as source of truth for expected behavior.

## Code Patterns
- Zod schemas for all API validation
- React Hook Form for form state
- Atomic Prisma transactions for multi-step operations
- AuditLog entries for all staff actions

## Real User Testing Protocol

**WHY THIS EXISTS:** AI-written code tends to pass internal checks (TypeScript compiles, no lint errors, "looks correct") but fail when a real human taps a button on a real phone. This protocol exists to prevent shipping code that works for AI but breaks for users.

### The Rule
**Every user-facing change MUST be verified against real behavior, not just code correctness.** "It compiles" and "the types check out" are necessary but NOT sufficient.

### Before Marking Any Frontend Work "Done"

1. **Error Boundaries Required**: Every page-level component must have an error boundary. A white screen is NEVER acceptable. If data fails to load, show a friendly error with a retry button.

2. **Loading States Required**: Every data-fetching component must show a loading state. A blank screen while waiting is NOT acceptable.

3. **Null/Undefined Safety**: Never assume API data has the shape you expect. Always handle:
   - API returns `null` or `undefined` for a field
   - API returns an empty array when you expected items
   - API returns an error or times out
   - User has no pets, no bookings, no history yet

4. **Navigation Must Survive**:
   - Tap into a page → tap back → tap into it again. Must work every time.
   - Pull-to-refresh must work if implemented.
   - Deep-linking / direct URL access must not crash.
   - Browser back button must work.

5. **Mobile-First Verification**:
   - Touch targets: minimum 44x44px
   - Scrolling: long content must scroll, not overflow/clip
   - Keyboard: forms must not be hidden behind mobile keyboard
   - Orientation: portrait must work (landscape is bonus)

### API Endpoint Verification

Before writing frontend code that calls an API:
1. **Actually call the endpoint** with curl or the test suite. Don't assume it returns what the types say.
2. **Check the response shape** matches what the frontend expects. Mismatched field names (singular vs plural, camelCase vs snake_case, nested vs flat) are the #1 source of "works in code, fails for users" bugs.
3. **Test with empty data** - new user, no pets, no bookings. The app must not crash.

### Anti-Patterns to Avoid

- **"It should work"** - If you can't prove it works by running it, it doesn't work.
- **Optimistic rendering without fallback** - Don't render data you haven't confirmed exists.
- **Catch-all error swallowing** - `catch(e) {}` hides bugs. Log errors, show user-friendly messages.
- **Testing only the happy path** - The sad path (errors, empty states, timeouts) is where real users live.
- **Assuming localStorage/state persists** - Test with cleared storage, expired tokens, logged-out states.

### Sprint Verification Checklist

At the end of each sprint, before declaring it done:
- [ ] Every new/changed page loads without white screen
- [ ] Every new/changed page handles empty data gracefully
- [ ] Navigation to and from every changed page works (forward AND back)
- [ ] API responses match what frontend expects (actually verified, not assumed)
- [ ] Mobile viewport tested (at minimum, Chrome DevTools responsive mode)
- [ ] Error states show friendly UI, not blank screens or raw error text

## Active Sprint Plan
**See `docs/SPRINT-PLAN.md`** for the full breakdown of Sprints 3-10, priorities, acceptance criteria, and screenshot references.

## Session Management
- Archive sessions before shutdown to `archive/sessions/YYYY-MM-DD_HH-MM_session.md`
- Update `CHANGELOG.md` with user-facing changes
- Keep session summaries concise but complete

## Project Log
All significant changes tracked in `CHANGELOG.md` at project root.
