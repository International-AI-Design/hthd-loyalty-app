# Segment 3: Interactive Dashboard

> **Status:** Complete (2026-02-19)
> **Dependencies:** Segment 1 (shared components must exist)
> **Blocks:** None

## Objective

Make the dashboard interactive — clickable service counts open drilldowns, customer/dog/staff names show profile cards, a QuickBook modal enables booking from multiple entry points, and a weather widget adds operational context.

## Brand Tokens

```css
--color-brand-blue: #62A2C3;     --color-brand-blue-dark: #4F8BA8;
--color-brand-navy: #1B365D;     --color-brand-cream: #FDF8F3;
--color-brand-warm-white: #F8F6F3;  --color-brand-coral: #E8837B;
--color-brand-golden-yellow: #F5C65D; --color-brand-soft-green: #7FB685;
```

## Task 1: Backend — Facility Details Endpoint

**File to modify:** `server/src/modules/dashboard/service.ts`

Add method:
```typescript
async getFacilityDetails(date: string, serviceType: 'daycare' | 'boarding' | 'grooming') {
  // Query Booking + BookingDog + Dog + Customer for given date + service
  // Return: { dogs: [{ dogName, breed, ownerName, ownerId, checkInTime, notes }] }
}
```

**File to modify:** `server/src/modules/dashboard/admin-router.ts`

Add route:
```
GET /admin/dashboard/facility-details?date=YYYY-MM-DD&service=daycare|boarding|grooming
```

Returns dog-level detail for a specific service on a specific date.

**File to modify:** `admin-app/src/lib/api.ts`

Add function:
```typescript
getFacilityDetails: (date: string, service: string) => apiCall<FacilityDetail[]>(`/admin/dashboard/facility-details?date=${date}&service=${service}`)
```

## Task 2: ServiceDrilldownModal

**New file:** `admin-app/src/components/dashboard/ServiceDrilldownModal.tsx`

Props:
- `isOpen: boolean`
- `onClose: () => void`
- `service: 'daycare' | 'boarding' | 'grooming'`
- `date: string`

Content:
- Modal header: "{Service} — {date}" with count
- List of dogs: avatar circle (initials), dog name, breed, owner name, check-in time
- Each row clickable → navigates to `/customers/{customerId}`
- Loading state: Skeleton rows
- Empty state: "No {service} dogs for this date"

Uses existing `Modal` component from `admin-app/src/components/ui/Modal.tsx`.

**Dashboard integration:** In `DashboardPage.tsx`, make the Daycare/Boarding/Grooming count cells clickable:
```tsx
<button onClick={() => openDrilldown('daycare')} className="text-center cursor-pointer hover:bg-brand-blue/5 rounded-lg p-2 transition-colors">
  <div className="text-lg font-bold text-[#1B365D]">{facility.daycare}</div>
  <div className="text-xs text-gray-500">Daycare</div>
</button>
```

## Task 3: DogProfileCard

**New file:** `admin-app/src/components/cards/DogProfileCard.tsx`

Props:
- `dog: { id, name, breed, sizeCategory, photoUrl?, customerId }`
- `ownerName: string`
- `vaccinationStatus?: 'current' | 'expiring' | 'expired'`
- `onClick?: () => void`

Compact card (not modal):
- Photo/initials circle, name bold, breed + size
- Owner name (gray)
- Vaccination indicator: green dot (current), amber (expiring soon), red (expired/missing)
- Click → navigate to customer detail

Used in: ServiceDrilldownModal dog list, arrivals/departures, schedule views.

## Task 4: CustomerQuickCard

**New file:** `admin-app/src/components/cards/CustomerQuickCard.tsx`

Props:
- `customer: { id, firstName, lastName, phone, email, pointsBalance, dogsCount, lastVisit? }`
- `onMessage?: () => void`
- `onViewProfile?: () => void`

Shows:
- Name (bold), phone, email
- Points balance with golden badge
- Dogs count
- Last visit date
- Quick actions: "Call" (`tel:` link), "Message" (navigate to messaging), "View Profile"

## Task 5: StaffProfileCard

**New file:** `admin-app/src/components/cards/StaffProfileCard.tsx`

Props:
- `staff: { id, name, role, shiftStart, shiftEnd }`
- `dogCount?: number`

Shows:
- Initials circle, name, role badge
- Shift time range
- Dogs:Staff ratio for this person

Used in: Staff On Duty section, staff schedule page.

## Task 6: QuickBookModal

**New file:** `admin-app/src/components/booking/QuickBookModal.tsx`

Multi-step modal:
1. **Search customer** — Typeahead search (uses existing customer search API)
2. **Select dogs** — Show customer's dogs as checkboxes
3. **Select service** — Daycare / Boarding / Grooming buttons
4. **Select date(s)** — Date picker, check availability inline
5. **Confirm** — Summary + submit

Uses:
- Existing `Modal` component
- Existing `adminBookingApi.create()` for booking creation
- Existing `adminBookingApi.checkAvailability()` for availability
- React Hook Form for state management

**Dashboard integration:** Add "New Booking" quick action button to DashboardPage (alongside existing Manage Schedule, Customer Lookup, etc.)

## Task 7: WeatherWidget

**New file:** `admin-app/src/components/dashboard/WeatherWidget.tsx`

- Fetches from OpenWeatherMap API: `https://api.openweathermap.org/data/2.5/weather?zip=80202,us&appid={key}&units=imperial`
- Shows: current temp, weather icon, condition text
- Compact: fits in dashboard header area (right side)
- Uses `VITE_OPENWEATHER_API_KEY` env var
- If no API key set, component returns null (doesn't render)
- Caches response in sessionStorage for 30 minutes
- Denver zip code (80202) hardcoded or configurable via env var

**Dashboard integration:** Add to DashboardPage header area, right side next to date picker.

## Acceptance Criteria

1. Click Daycare/Boarding/Grooming counts → modal shows dogs in that service
2. Dog names in drilldown show profile card styling, clickable to customer detail
3. QuickBookModal works end-to-end: search → select → book → confirmation
4. Weather widget shows Denver weather (or gracefully hidden if no API key)
5. `npx tsc --noEmit` passes for both admin-app and server
6. New endpoint returns data correctly: test with `curl https://hthd-api.internationalaidesign.com/api/v2/admin/dashboard/facility-details?date=2026-02-20&service=daycare`

## Files to Read Before Starting

- `admin-app/src/pages/DashboardPage.tsx` — Main page to enhance
- `admin-app/src/components/ui/Modal.tsx` — Reuse for modals
- `admin-app/src/lib/api.ts` — API client pattern
- `server/src/modules/dashboard/service.ts` — DashboardService to extend
- `server/src/modules/dashboard/admin-router.ts` — Routes to add to
- `server/src/modules/booking/service.ts` — BookingService for QuickBook
