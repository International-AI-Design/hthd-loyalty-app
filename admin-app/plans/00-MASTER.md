# HTHD Admin App — Full Transformation Sprint

> **Created:** 2026-02-19
> **Status:** Planned — not yet started
> **Context:** Johnny reviewed the HTHD Admin App and wants: visual consistency, interactive drill-downs, AIM (AI Manager) deeply integrated. Full sprint, full stack, full production build.

## Overview

Transform the HTHD admin app from functional-but-inconsistent to a polished, professional, AI-integrated operations hub. Six self-contained segments, each with all context needed for independent execution.

## Segment Dependency Graph

```
[1: Design System] ──┬──> [2: Legacy Migration]
                      └──> [3: Interactive Dashboard]

[4: AIM Backend] ────────> [5: AIM Frontend]
                                    │
[1] + [4] + [5] ─────────> [6: Staff + Polish]
```

**Parallelizable:** Segments 1 and 4 can run simultaneously. Segments 2 and 3 can run simultaneously after 1. Segment 5 waits for 4. Segment 6 is final.

## Segments

| # | Name | Backend | Frontend | Depends On |
|---|------|---------|----------|------------|
| 1 | Design System + Button Fix | None | 8 new components | None |
| 2 | Legacy Page Migration | None | 4-6 page rewrites | 1 |
| 3 | Interactive Dashboard | 1 new endpoint | 6 new components | 1 |
| 4 | AIM Backend | Schema + module (5 files) | None | None |
| 5 | AIM Frontend | None | 8 new components + context | 4 |
| 6 | Staff Enhancements + Polish | Schema addition + alerts | Minor tweaks | 4, 5 |

## Production Info

- **API:** https://hthd-api.internationalaidesign.com
- **Admin App:** https://hthd-admin.internationalaidesign.com
- **Deploy:** Push to main → Railway auto-deploys
- **Admin login:** admin / `2St79VUwf5EcFZzv` (role: owner)

## Brand Reference

```css
--color-brand-blue: #62A2C3;
--color-brand-blue-dark: #4F8BA8;
--color-brand-navy: #1B365D;
--color-brand-cream: #FDF8F3;
--color-brand-warm-white: #F8F6F3;
--color-brand-coral: #E8837B;
--color-brand-golden-yellow: #F5C65D;
--color-brand-soft-green: #7FB685;
--font-heading: 'Playfair Display', Georgia, serif;
--font-body: 'Open Sans', sans-serif;
```

## Project Structure

```
production/happy-tail/
├── admin-app/src/
│   ├── components/
│   │   ├── ui/          # Button, Alert, Modal, Select, Input (existing)
│   │   ├── Layout.tsx   # Sidebar + main content
│   │   └── ...
│   ├── pages/           # 13 page components
│   ├── contexts/        # AuthContext (existing)
│   ├── lib/api.ts       # API client functions
│   └── index.css        # Brand design tokens
├── server/src/
│   ├── modules/         # ai, booking, dashboard, messaging, etc.
│   ├── services/        # gingr.ts
│   └── routes/          # admin routes
└── server/prisma/schema.prisma
```

## How to Pick Up a Segment

1. Open Claude Code in `production/happy-tail/`
2. Read the specific segment file: `admin-app/plans/0X-*.md`
3. Each segment lists all files to read, create, and modify
4. Each segment has its own acceptance criteria
5. Mark segment as complete in this master file when done

## Completion Tracker

- [x] Segment 1: Design System + Button Fix
- [x] Segment 2: Legacy Page Migration
- [x] Segment 3: Interactive Dashboard
- [ ] Segment 4: AIM Backend
- [ ] Segment 5: AIM Frontend
- [ ] Segment 6: Staff Enhancements + Polish
