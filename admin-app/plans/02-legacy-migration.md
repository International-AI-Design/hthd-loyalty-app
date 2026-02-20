# Segment 2: Legacy Page Migration + LoginPage

> **Status:** Complete
> **Dependencies:** Segment 1 (shared components must exist)
> **Blocks:** None (Segment 3 can run in parallel)

## Objective

Migrate 4 legacy pages to use the shared component library from Segment 1. Refactor the oversized CustomerDetailPage into sub-components. Update LoginPage branding. After this, every page in the app has consistent visual treatment.

## Brand Tokens

```css
--color-brand-blue: #62A2C3;     --color-brand-blue-dark: #4F8BA8;
--color-brand-navy: #1B365D;     --color-brand-cream: #FDF8F3;
--color-brand-warm-white: #F8F6F3;  --color-brand-coral: #E8837B;
--color-brand-golden-yellow: #F5C65D; --color-brand-soft-green: #7FB685;
--font-heading: 'Playfair Display';  --font-body: 'Open Sans';
```

## Shared Components Available (from Segment 1)

`admin-app/src/components/ui/`: PageHeader, Card, Spinner, Skeleton, Badge, DataTable, EmptyState, Button (fixed)

## Task 1: CustomersPage Migration

**File:** `admin-app/src/pages/CustomersPage.tsx`

Changes:
- Remove custom `<h1>` header → use `<PageHeader title="Customers" subtitle="..." />`
- Replace `bg-green-*` button/accent classes → brand-blue via `<Button>` component
- Replace custom table markup → `<DataTable>` with columns for name, email, phone, points, status
- Replace inline loading spinner → `<Spinner>`
- Replace "no customers" text → `<EmptyState>`
- Wrap sections in `<Card>`

## Task 2: CustomerDetailPage Refactor

**File:** `admin-app/src/pages/CustomerDetailPage.tsx` (~1,190 lines)

Break into sub-components in `admin-app/src/pages/customer-detail/`:

| Component | Lines (approx) | Content |
|-----------|---------------|---------|
| `CustomerHeader.tsx` | ~80 | Name, contact, status badge, points, quick actions |
| `CustomerDogs.tsx` | ~150 | Dog cards with name, breed, vaccination status indicators |
| `CustomerBookings.tsx` | ~200 | Booking history table using DataTable |
| `CustomerTransactions.tsx` | ~150 | Points transaction log using DataTable |
| `CustomerVisits.tsx` | ~150 | Gingr visit history using DataTable |

**CustomerDetailPage.tsx** becomes ~100 lines: loads data, passes to sub-components in a tab or stacked layout.

Additional fixes:
- Remove duplicate header (Layout provides it)
- Replace all `bg-green-*` → brand-blue
- Use PageHeader with back button (`backTo="/customers"`)
- Use Badge for status indicators
- Use Card for section wrappers

## Task 3: LoyaltyPage Migration

**File:** `admin-app/src/pages/LoyaltyPage.tsx`

Changes:
- Remove custom header section → `<PageHeader title="Loyalty Points" />`
- Replace custom table → `<DataTable>` for customer points listing
- Replace green accent colors → brand-blue
- Use Card, Spinner, EmptyState, Badge

## Task 4: GingrSyncPage Migration

**File:** `admin-app/src/pages/GingrSyncPage.tsx`

Changes:
- Remove custom header → `<PageHeader title="Gingr Sync" subtitle="Manage Gingr API integration" />`
- Replace green buttons → `<Button>` component
- Wrap status/history sections in `<Card>`
- Use Spinner for loading, Badge for sync status

## Task 5: LoginPage Brand Update

**File:** `admin-app/src/pages/LoginPage.tsx`

Current: Generic login page
Target:
- Background: Navy gradient (`from-[#1B365D] to-[#0f2340]`)
- Card: White with subtle shadow on brand-cream
- Heading: "Happy Tail Happy Dog" in Playfair Display
- Subtitle: "Staff Portal" in Open Sans
- Input fields: 44px+ height, brand-blue focus ring
- Button: brand-blue primary
- HTHD text logo or placeholder logo area

## Acceptance Criteria

1. No page has its own custom `<h1>` header — all use `<PageHeader>`
2. No green color classes remain in any page file
3. CustomerDetailPage is < 200 lines, with sub-components in `customer-detail/`
4. LoginPage matches brand identity
5. `npx tsc --noEmit` passes
6. All pages render correctly at mobile (375px) and desktop (1280px)

## Files to Read Before Starting

- `admin-app/src/pages/CustomersPage.tsx`
- `admin-app/src/pages/CustomerDetailPage.tsx`
- `admin-app/src/pages/LoyaltyPage.tsx`
- `admin-app/src/pages/GingrSyncPage.tsx`
- `admin-app/src/pages/LoginPage.tsx`
- `admin-app/src/components/Layout.tsx` — Understand what Layout already provides
- `admin-app/src/lib/api.ts` — Understand API functions used by these pages
