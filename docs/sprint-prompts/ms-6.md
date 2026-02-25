# MS-6: Sprint D — Badges + Admin Intelligence (Full-Stack)

## Session Protocol
> **One micro-sprint per session.** Each session: execute this sprint only, pass build gates, commit, push, then shut down. Do NOT start the next sprint in the same session. Fresh context prevents compaction disasters.
>
> **Startup:** Ensure Docker Postgres (`happy-tail-postgres`) is running on port 5432 — tests need it.
>
> **Shutdown sequence:** After push succeeds → update CHANGELOG.md with MS-6 entry → archive session to `archive/sessions/YYYY-MM-DD_HH-MM_session.md` → update memory files → verify all logs written → confirm ready to exit.

## Context
This is micro-sprint 6 of 8. MS-1 added schema (CustomerBadge, AimInsight tables). MS-2-5 handled uploads, dog profile, grooming pricing, agreements, and boarding.

**Prior sprints completed:** MS-1 (schema), MS-2 (uploads), MS-3 (frontend dog profile), MS-4 (grooming pricing), MS-5 (agreements + boarding)

## Read First (for patterns)
- `server/prisma/schema.prisma` — CustomerBadge, AimInsight models
- `server/src/modules/aim/router.ts` — existing AIM (AI Manager) routes
- `server/src/modules/dog-profile/service.ts` — Service class pattern
- `server/src/modules/dog-profile/types.ts` — Zod types pattern
- `customer-app/src/pages/DashboardPage.tsx` — existing customer dashboard
- `admin-app/src/pages/DashboardPage.tsx` — existing admin dashboard
- `admin-app/src/lib/api.ts` — admin API patterns

## What to Do

### Server: Badges Module

**Create `server/src/modules/badges/types.ts`:**
```typescript
import { z } from 'zod';

// Badge definitions — not stored in DB, used for evaluation logic
export const BADGE_DEFINITIONS = {
  first_visit: { displayName: 'First Visit', description: 'Completed first visit', icon: '🐾' },
  loyal_5: { displayName: 'Regular', description: '5 visits completed', icon: '⭐' },
  loyal_10: { displayName: 'VIP Pup', description: '10 visits completed', icon: '🌟' },
  loyal_25: { displayName: 'Best Friend', description: '25 visits completed', icon: '💎' },
  grooming_first: { displayName: 'Fresh & Clean', description: 'First grooming appointment', icon: '✨' },
  boarding_first: { displayName: 'Sleepover Star', description: 'First boarding stay', icon: '🏠' },
  referral_first: { displayName: 'Social Butterfly', description: 'First successful referral', icon: '🦋' },
  referral_5: { displayName: 'Pack Leader', description: '5 successful referrals', icon: '👑' },
  points_500: { displayName: 'Points Pro', description: 'Earned 500 points', icon: '🎯' },
  perfect_compliance: { displayName: 'Health Hero', description: 'All vaccinations up to date', icon: '💚' },
} as const;

export type BadgeName = keyof typeof BADGE_DEFINITIONS;

export const BadgeAwardSchema = z.object({
  customerId: z.string().uuid(),
  badge: z.string(),
});
```

**Create `server/src/modules/badges/service.ts`:**
- `BadgeError` class with `statusCode`
- Methods:
  - `getCustomerBadges(customerId: string)` — returns all badges for a customer with display info
  - `evaluateBadges(customerId: string)` — checks all badge conditions and awards any newly earned badges
    - Queries: booking count, grooming count, boarding count, referral count, points total, vaccination compliance
    - Awards badges not yet earned
    - Returns `{ newBadges: string[], allBadges: CustomerBadge[] }`
  - `awardBadge(customerId: string, badge: string)` — manually award a badge (upsert, no-op if exists)
  - `getNextBadge(customerId: string)` — returns the closest unearned badge with progress info
    - e.g., `{ badge: 'loyal_10', displayName: 'VIP Pup', progress: 7, target: 10, progressPct: 70 }`
  - `markNotified(badgeId: string)` — mark a badge as notified (so UI doesn't re-show animation)

**Create `server/src/modules/badges/router.ts`:**
Customer routes (authenticated):
- `GET /` — get customer's badges
- `GET /next` — get next badge progress
- `POST /evaluate` — trigger badge evaluation (called after booking completion, etc.)
- `PUT /:id/notified` — mark badge notification as seen

### Server: Analytics/Insights Module

**Create `server/src/modules/analytics/service.ts`:**
- `AnalyticsError` class with `statusCode`
- Methods:
  - `generateInsights()` — creates AimInsight records based on current data:
    - Revenue trends (bookings this week vs last week)
    - Capacity utilization (bookings vs capacity by service type)
    - Customer segments (new vs returning vs at-risk based on last visit)
    - Compliance overview (% of active dogs with up-to-date vaccinations)
    - Popular services breakdown
  - `getActiveInsights()` — returns non-expired insights
  - `getInsightsByType(type: string)` — filtered insights
  - `getRevenueSnapshot()` — quick revenue numbers: today, this week, this month, with % change
  - `getCustomerSegments()` — returns counts: new (< 30 days), active (visit in last 60 days), at-risk (no visit in 60+ days), churned (90+ days)

**Create `server/src/modules/analytics/types.ts`:**
```typescript
import { z } from 'zod';

export const InsightQuerySchema = z.object({
  type: z.string().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});

export type InsightQuery = z.infer<typeof InsightQuerySchema>;
```

**Create `server/src/modules/analytics/router.ts`:**
Admin routes (manager+):
- `GET /insights` — get active insights, optional `?type=revenue`
- `POST /insights/generate` — trigger insight generation
- `GET /revenue` — revenue snapshot
- `GET /segments` — customer segments
- `GET /capacity` — capacity utilization by service type for current week

### Mount Routes

In `server/src/index.ts`:
```typescript
import v2BadgesRoutes from './modules/badges/router';
import v2AdminAnalyticsRoutes from './modules/analytics/router';
app.use('/api/v2/badges', v2BadgesRoutes);
app.use('/api/v2/admin/analytics', v2AdminAnalyticsRoutes);
```

### Frontend: Customer Badges

**Update `customer-app/src/lib/api.ts`:**
```typescript
export interface CustomerBadge {
  id: string;
  badge: string;
  displayName: string;
  description: string;
  icon: string;
  earnedAt: string;
  notified: boolean;
}

export interface NextBadgeProgress {
  badge: string;
  displayName: string;
  description: string;
  icon: string;
  progress: number;
  target: number;
  progressPct: number;
}

export const badgeApi = {
  getBadges: () => api.get<{ badges: CustomerBadge[] }>('/v2/badges'),
  getNextBadge: () => api.get<NextBadgeProgress>('/v2/badges/next'),
  evaluate: () => api.post<{ newBadges: string[]; allBadges: CustomerBadge[] }>('/v2/badges/evaluate', {}),
  markNotified: (id: string) => api.put<void>(`/v2/badges/${id}/notified`, {}),
};
```

**`customer-app/src/components/BadgeGrid.tsx`** (new file)
- Displays earned badges in a grid (3 columns on mobile, 4 on desktop)
- Each badge: icon (large emoji), display name, earned date
- Unearned badges shown as locked/grayed out
- Brand styling with subtle shadow on earned badges

**`customer-app/src/components/NextBadgeProgress.tsx`** (new file)
- Shows progress bar toward next badge
- Display: icon + name + "X of Y" + progress bar
- Progress bar uses `brand-primary` fill
- Compact enough to fit on dashboard

**`customer-app/src/components/BadgeUnlockAnimation.tsx`** (new file)
- Overlay animation when a new badge is earned
- Shows badge icon large, name, description
- "Awesome!" dismiss button
- Calls `markNotified` on dismiss
- CSS animation: scale-up + confetti-like effect (CSS-only, no library)

**Update `customer-app/src/pages/DashboardPage.tsx`:**
- Add NextBadgeProgress component below the welcome section
- On page load, call `badgeApi.evaluate()` — if `newBadges.length > 0`, show BadgeUnlockAnimation
- Add "My Badges" link to a badges section or page

**Add route for badges page (optional):**
If there's room, create a simple `/badges` page with BadgeGrid. Otherwise, embed BadgeGrid in the dashboard.

### Frontend: Admin Intelligence Dashboard

**Update `admin-app/src/lib/api.ts`:**
Add analytics API methods:
```typescript
export const analyticsApi = {
  getInsights: (type?: string) =>
    adminApi.get<{ insights: AimInsight[] }>(`/v2/admin/analytics/insights${type ? `?type=${type}` : ''}`),
  generateInsights: () =>
    adminApi.post<{ generated: number }>('/v2/admin/analytics/insights/generate', {}),
  getRevenue: () => adminApi.get<RevenueSnapshot>('/v2/admin/analytics/revenue'),
  getSegments: () => adminApi.get<CustomerSegments>('/v2/admin/analytics/segments'),
  getCapacity: () => adminApi.get<CapacityData>('/v2/admin/analytics/capacity'),
};
```

**`admin-app/src/components/dashboard/InsightsPanel.tsx`** (new file)
- Shows AimInsight cards: title, summary, type badge, generated time
- Grouped by type with collapsible sections
- "Refresh Insights" button to trigger generation

**`admin-app/src/components/dashboard/RevenueChart.tsx`** (new file)
- Simple revenue display: today, this week, this month
- Show % change from previous period
- Use colored indicators: green for up, red for down
- No external charting library — use CSS bar charts or simple number displays

**`admin-app/src/components/dashboard/SegmentCards.tsx`** (new file)
- Four cards: New, Active, At-Risk, Churned
- Each shows count and a color-coded icon
- At-Risk and Churned in warm colors (amber, red) to draw attention

**Update `admin-app/src/pages/DashboardPage.tsx`:**
- Add InsightsPanel, RevenueChart, SegmentCards to the dashboard
- Layout: revenue at top, segments below, insights at bottom
- Responsive grid: 1 column mobile, 2-3 columns desktop

**Optional: `admin-app/src/pages/AnalyticsPage.tsx`** (new file)
- Dedicated analytics page with more detail
- Route: add to admin App.tsx routing
- Capacity utilization view
- Full insights list with filtering

## Build Gate
```bash
cd server && npx tsc --noEmit
cd ../customer-app && npx tsc --noEmit && npm run build
cd ../admin-app && npx tsc --noEmit && npm run build
```

- [ ] Server TypeScript compiles
- [ ] Customer app builds
- [ ] Admin app builds
- [ ] Badge evaluation logic covers all badge types
- [ ] Badge unlock animation is CSS-only (no new deps)
- [ ] Admin dashboard shows revenue, segments, insights
- [ ] All new components have loading/error/empty states

## Git Commit
```bash
git add server/src/modules/badges/ server/src/modules/analytics/ server/src/index.ts customer-app/ admin-app/
git commit -m "feat: add customer badges and admin intelligence dashboard

Server: badges module with evaluation engine and 10 badge types.
Server: analytics module with revenue, segments, capacity, insights.
Customer: BadgeGrid, NextBadgeProgress, BadgeUnlockAnimation.
Customer dashboard shows badge progress and unlock notifications.
Admin: InsightsPanel, RevenueChart, SegmentCards on dashboard.

MS-6 of 8 micro-sprint rebuild."
```

## CHANGELOG Entry
```
### MS-6: Sprint D — Badges + Admin Intelligence
- Customer badge system: 10 badges earned through visits, referrals, compliance
- Badge unlock animation on customer dashboard
- Next badge progress bar showing path to next achievement
- Admin intelligence: revenue snapshot, customer segments, AI-generated insights
- Admin dashboard enriched with analytics panels
```

## Next Session
Proceed to MS-7 (E2E Tests for all sprints).
