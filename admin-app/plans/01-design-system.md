# Segment 1: Design System Components + Button Fix

> **Status:** Not started
> **Dependencies:** None
> **Blocks:** Segments 2, 3

## Objective

Create a shared component library and fix the Button component so every page has consistent styling. This is the foundation — all other UI work builds on these components.

## Brand Tokens (from `admin-app/src/index.css`)

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

## Task 1: Fix Button.tsx

**File:** `admin-app/src/components/ui/Button.tsx`

**Current (broken):**
```typescript
const variants = {
  primary: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
  secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
  outline: 'border-2 border-green-600 text-green-600 hover:bg-green-50 focus:ring-green-500',
};
```

**Target:**
```typescript
const variants = {
  primary: 'bg-[#62A2C3] text-white hover:bg-[#4F8BA8] focus:ring-[#62A2C3]',
  secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
  outline: 'border-2 border-[#62A2C3] text-[#62A2C3] hover:bg-[#62A2C3]/5 focus:ring-[#62A2C3]',
  danger: 'bg-[#E8837B] text-white hover:bg-[#d96e66] focus:ring-[#E8837B]',
};
```

## Task 2: Create PageHeader Component

**New file:** `admin-app/src/components/ui/PageHeader.tsx`

Props:
- `title: string` — Main heading (font-heading, text-[#1B365D])
- `subtitle?: string` — Secondary text (text-gray-500)
- `actions?: ReactNode` — Right-aligned action buttons
- `backTo?: string` — Optional back button with navigate target

Pattern: Same style as DashboardPage header (see `pages/DashboardPage.tsx` lines 206-236 for reference).

## Task 3: Create Card Component

**New file:** `admin-app/src/components/ui/Card.tsx`

Props:
- `children: ReactNode`
- `title?: string` — Optional card header
- `subtitle?: string`
- `headerRight?: ReactNode` — Right side of header (spinner, action button)
- `className?: string` — Additional classes
- `noPadding?: boolean` — For tables that need full-width

Base classes: `bg-white rounded-xl shadow-sm border border-gray-100`
With padding: `p-5 sm:p-6`

## Task 4: Create Spinner Component

**New file:** `admin-app/src/components/ui/Spinner.tsx`

Props:
- `size?: 'sm' | 'md' | 'lg'` (default: 'md')
- `className?: string`

Sizes:
- `sm`: `w-4 h-4 border-2`
- `md`: `w-6 h-6 border-2`
- `lg`: `w-8 h-8 border-3`

Base classes: `border-gray-200 border-t-[#62A2C3] rounded-full animate-spin`

This replaces all inline spinner markup across the app (currently ~8 different spinner implementations).

## Task 5: Create Skeleton Component

**New file:** `admin-app/src/components/ui/Skeleton.tsx`

Props:
- `variant?: 'text' | 'card' | 'table-row' | 'circle'`
- `lines?: number` (for text variant, default 3)
- `className?: string`

Base: `animate-pulse bg-gray-200 rounded`
- `text`: `h-4 w-full rounded` (with varied widths for natural look)
- `card`: `h-32 w-full rounded-xl`
- `table-row`: `h-12 w-full rounded`
- `circle`: `h-10 w-10 rounded-full`

## Task 6: Create Badge Component

**New file:** `admin-app/src/components/ui/Badge.tsx`

Props:
- `variant: string` — Preset name or custom
- `children?: ReactNode` — Override label text
- `className?: string`

Presets (maps to bg/text colors):
```typescript
const presets = {
  active:     { bg: 'bg-[#62A2C3]/15', text: 'text-[#4F8BA8]', label: 'Active' },
  confirmed:  { bg: 'bg-[#62A2C3]/15', text: 'text-[#4F8BA8]', label: 'Confirmed' },
  pending:    { bg: 'bg-[#F5C65D]/20', text: 'text-[#B8941F]', label: 'Pending' },
  checked_in: { bg: 'bg-[#7FB685]/15', text: 'text-[#5A9A62]', label: 'Checked In' },
  escalated:  { bg: 'bg-[#E8837B]/15', text: 'text-[#E8837B]', label: 'Escalated' },
  closed:     { bg: 'bg-gray-100',     text: 'text-gray-500',   label: 'Closed' },
  overdue:    { bg: 'bg-[#E8837B]/15', text: 'text-[#E8837B]', label: 'Overdue' },
  cancelled:  { bg: 'bg-gray-100',     text: 'text-gray-500',   label: 'Cancelled' },
};
```

Base classes: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium`

## Task 7: Create DataTable Component

**New file:** `admin-app/src/components/ui/DataTable.tsx`

Generic typed component:
```typescript
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };
  onRowClick?: (item: T) => void;
  rowKey: (item: T) => string;
}
```

Features:
- Sortable column headers (click to toggle asc/desc)
- Loading state shows Skeleton rows
- Empty state uses EmptyState component
- Hover highlight on rows
- Responsive: horizontal scroll on mobile with sticky first column
- Brand-consistent: Navy headers, warm-white stripe on alternate rows

## Task 8: Create EmptyState Component

**New file:** `admin-app/src/components/ui/EmptyState.tsx`

Props:
- `icon?: ReactNode` — SVG icon (optional, has default)
- `title: string`
- `description?: string`
- `action?: { label: string; onClick: () => void }`

Pattern: Centered layout with gray icon, medium title, light description, optional brand-blue action button. See MessagingPage empty state (lines 267-291) for visual reference.

## Acceptance Criteria

1. All 8 files created and export properly
2. Button.tsx uses brand-blue, not green
3. `npx tsc --noEmit` passes in `admin-app/`
4. No existing pages break (components are additive, not replacing anything yet)
5. Components follow mobile-first patterns: 44px touch targets, responsive padding

## Files to Read Before Starting

- `admin-app/src/components/ui/Button.tsx` — Current button, fix this
- `admin-app/src/index.css` — Brand tokens
- `admin-app/src/pages/DashboardPage.tsx` — Reference for good patterns
- `admin-app/src/pages/MessagingPage.tsx` — Reference for empty states, badges
