# Happy Tail Happy Dog Loyalty App

## Project Overview
Pet business loyalty program - MVP complete with 25 user stories implemented. Active development for v2 features while maintaining stability.

## Production URLs
| Service | URL | Platform |
|---------|-----|----------|
| **Customer App** | https://hthd.internationalaidesign.com | Vercel |
| **Admin App** | https://hthd-admin.internationalaidesign.com | Vercel |
| **API** | https://hthd-api.internationalaidesign.com | Railway |

**Staff Login:** `admin` / `admin123`

## Deployment Workflow
**Repository:** `https://github.com/International-AI-Design/hthd-loyalty-app.git`

**All deployments are automatic on push to `main`:**
```bash
# 1. Stage and commit changes
git add <files>
git commit -m "Description of changes"

# 2. Push to trigger deployment
git push origin main

# 3. Monitor deployment
# - Railway: Check dashboard at railway.app (API deploys in ~2-3 min)
# - Vercel: Check dashboard at vercel.com (Apps deploy in ~1-2 min)
```

**What deploys where:**
- `server/` changes → Railway (API)
- `customer-app/` changes → Vercel (Customer App)
- `admin-app/` changes → Vercel (Admin App)

**Rollback:** Use Railway/Vercel dashboards to redeploy previous version if needed.

See `DEPLOYMENT.md` for initial setup, environment variables, and DNS configuration.

## Brand Guidelines
**IMPORTANT:** See `SKILL.md` for complete brand guidelines including:
- Color palette (Teal #5BBFBA primary, Navy #1B365D text)
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

## Session Management
- Archive sessions before shutdown to `archive/sessions/YYYY-MM-DD_HH-MM_session.md`
- Update `CHANGELOG.md` with user-facing changes
- Keep session summaries concise but complete

## Project Log
All significant changes tracked in `CHANGELOG.md` at project root.
