# Segment 5: AIM Frontend

> **Status:** Not started
> **Dependencies:** Segment 4 (AIM backend must be deployed)
> **Blocks:** Segment 6

## Objective

Build the AIM frontend — a floating drawer accessible from every page with chat, activity feed, and alerts tabs. Plus a notification system for real-time toasts. When done, staff can chat with AIM, see live facility activity, and get proactive alerts from any page in the app.

## Brand Tokens

```css
--color-brand-blue: #62A2C3;     --color-brand-blue-dark: #4F8BA8;
--color-brand-navy: #1B365D;     --color-brand-cream: #FDF8F3;
--color-brand-warm-white: #F8F6F3;  --color-brand-coral: #E8837B;
--color-brand-golden-yellow: #F5C65D; --color-brand-soft-green: #7FB685;
```

## Backend API Available (from Segment 4)

```
POST /api/v2/admin/aim/chat          → { message, conversationId? } → AI response
GET  /api/v2/admin/aim/conversations → list of staff's conversations
GET  /api/v2/admin/aim/conversations/:id → conversation with messages
GET  /api/v2/admin/aim/alerts        → alerts list (?unread=true for count)
PATCH /api/v2/admin/aim/alerts/:id/read → mark read
```

API client functions in `admin-app/src/lib/api.ts`: `adminAimApi.chat()`, `.getConversations()`, `.getAlerts()`, `.markAlertRead()`

## Task 1: AIM Context Provider

**New file:** `admin-app/src/contexts/AimContext.tsx`

State managed:
- `isOpen: boolean` — drawer open/closed
- `activeTab: 'chat' | 'activity' | 'alerts'`
- `unreadAlertCount: number`
- `currentConversationId: string | null`

Provided functions:
- `openAim(tab?: string)` — Open drawer, optionally to specific tab
- `closeAim()` — Close drawer
- `askAim(prompt: string)` — Open drawer to chat tab with pre-filled prompt
- `refreshAlertCount()` — Re-fetch unread count

Polling: Every 60s, call `adminAimApi.getAlerts(true)` to update badge count.

Wrap in `admin-app/src/App.tsx` (or wherever AuthProvider wraps).

## Task 2: AIM Floating Button

**New file:** `admin-app/src/components/aim/AimButton.tsx`

- Fixed position: `fixed bottom-6 right-6 z-50`
- Circular button: 56px, brand-navy background, white icon
- Icon: Sparkle/brain icon (SVG) or "AIM" text
- Pulse animation when unread alerts > 0
- Badge: coral circle with unread count (top-right of button)
- Click: `openAim()`
- Hidden on LoginPage (check route)

**Integration:** Render in `admin-app/src/components/Layout.tsx` — add `<AimButton />` inside the layout wrapper so it appears on all authenticated pages.

## Task 3: AIM Drawer

**New file:** `admin-app/src/components/aim/AimDrawer.tsx`

- Slide-in panel from right side
- Width: 400px on desktop, full-width on mobile
- Backdrop: semi-transparent overlay (click to close)
- Header: "AIM" title + close button
- Three tabs below header: Chat | Activity | Alerts
- Tab content area fills remaining height
- Animation: `transition-transform duration-300`
- Z-index: above everything (`z-50`)

Uses AimContext for state (isOpen, activeTab).

## Task 4: AIM Chat Tab

**New file:** `admin-app/src/components/aim/AimChat.tsx`

Chat interface (similar pattern to MessagingPage — see `admin-app/src/pages/MessagingPage.tsx` for reference):

- Message bubbles: user (staff) on right (navy bg), assistant (AIM) on left (light gray bg)
- Input area at bottom: textarea + send button
- Quick prompt chips above input: "How's today looking?", "Any compliance issues?", "Who's working tomorrow?"
- Tool usage indicator: When AIM is using tools, show subtle "Checking schedule..." / "Searching customers..." text
- Auto-scroll to bottom on new messages
- Conversation history loads from API on open

Flow:
1. Staff types message → call `adminAimApi.chat(message, conversationId)`
2. Show loading indicator (typing dots)
3. Display response
4. Store conversationId for follow-up messages

**Styling reference:** Follow bubble styles from MessagingPage (lines 64-80):
- Staff bubble: `bg-[#1B365D] text-white self-end rounded-tr-sm`
- AIM bubble: `bg-gray-100 text-gray-900 self-start rounded-tl-sm`

## Task 5: AIM Activity Tab

**New file:** `admin-app/src/components/aim/AimActivity.tsx`

Real-time facility event feed:
- Source: Poll existing dashboard APIs every 30s (arrivals, departures, check-ins)
- Each item: icon + description + timestamp
- Event types:
  - Check-in: green dot + "{Dog} checked in by {Staff}"
  - Check-out: blue dot + "{Dog} checked out"
  - New booking: navy dot + "New booking: {Customer} - {Service}"
  - Escalated message: coral dot + "Message escalated: {Customer}"
- Each item clickable → navigates to relevant page
- Newest at top, max 50 items
- Empty state: "No recent activity"

Data sources:
- `adminDashboardApi.getArrivals(today)` — arrivals + departures
- `adminMessagingApi.getConversations('escalated')` — escalated messages

## Task 6: AIM Alerts Tab

**New file:** `admin-app/src/components/aim/AimAlerts.tsx`

Alert list:
- Fetch from `adminAimApi.getAlerts()`
- Each alert: severity icon + title + description + timestamp
- Severity colors:
  - `info`: brand-blue icon + light blue bg
  - `warning`: golden-yellow icon + light yellow bg
  - `critical`: coral icon + light coral bg
- Actions per alert:
  - "Dismiss" → `adminAimApi.markAlertRead(id)`, remove from list
  - "Ask AIM" → calls `askAim("Tell me about this alert: {title}")`, switches to chat tab
- Auto-refresh every 60s
- Empty state: "No alerts — everything looks good!"

## Task 7: Notification Toast System

**New file:** `admin-app/src/contexts/NotificationContext.tsx`

Provides `useNotification()` hook:
```typescript
const { notify } = useNotification();
notify({ title: 'Booking Created', message: 'Daycare for Bella on Feb 20', type: 'success' });
```

Types: `success` (green), `info` (blue), `warning` (amber), `error` (coral)

**New file:** `admin-app/src/components/notifications/NotificationToast.tsx`

- Toast slides in from top-right
- Auto-dismiss after 5s (configurable)
- Stack up to 3 toasts
- Close button on each
- Icon per type + title + message

Used by: AIM alerts (critical alerts auto-toast), booking confirmations, escalation notifications.

**Integration:** Wrap in App.tsx alongside AimContext.

## Task 8: Layout.tsx Integration

**File to modify:** `admin-app/src/components/Layout.tsx`

Changes:
- Import and render `<AimButton />` inside the layout (after the main content area)
- Import and render `<AimDrawer />` at the root of the layout
- Both components read state from AimContext (which wraps the app)

The existing escalated message polling in Layout.tsx (every 30s) can be integrated with the notification system — when escalated count changes, fire a toast notification.

## Acceptance Criteria

1. AIM button visible on every page (except login), bottom-right corner
2. Click button → drawer slides in from right with 3 tabs
3. Chat tab: type a message, get AI response, conversation persists
4. Quick prompts work (pre-fill and send)
5. Activity tab shows recent facility events (or empty state)
6. Alerts tab shows alerts with severity colors (or "all clear" empty state)
7. "Ask AIM" on alert switches to chat with context
8. Toast notifications appear for critical alerts
9. Mobile: drawer is full-width, touch-friendly (44px targets)
10. `npx tsc --noEmit` passes

## Files to Read Before Starting

- `admin-app/src/pages/MessagingPage.tsx` — Chat UI pattern to replicate
- `admin-app/src/components/Layout.tsx` — Where to integrate button + drawer
- `admin-app/src/components/ui/Modal.tsx` — Reference for overlay/animation patterns
- `admin-app/src/contexts/AuthContext.tsx` — Context provider pattern
- `admin-app/src/lib/api.ts` — API client (should have AIM functions from Segment 4)
- `admin-app/src/App.tsx` — Where to wrap providers
