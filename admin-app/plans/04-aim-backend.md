# Segment 4: AIM Backend (AI Manager)

> **Status:** Not started
> **Dependencies:** None (can run parallel with Segments 1-3)
> **Blocks:** Segment 5 (AIM Frontend)

## Objective

Build the full backend for AIM — the AI Manager that staff interact with to run the facility. This includes database models, an AI orchestrator (adapting the existing SMS orchestrator pattern), staff-specific tools, and an alert system. When this segment is complete, the AIM API is fully functional and testable via curl.

## Brand Context

AIM is the staff-facing AI assistant. Unlike the customer-facing SMS AI (which uses Claude Sonnet 4.5 and customer tools), AIM uses Claude Sonnet 4.5 (same model, different system prompt and tools) to help staff manage operations: check schedules, look up customers, get compliance alerts, create bookings, and monitor the facility.

## Existing AI Infrastructure to Reuse

| File | What to reuse |
|------|--------------|
| `server/src/modules/ai/orchestrator.ts` | Tool-loop pattern: build context → system prompt → call Claude → execute tools → loop until done. AIM orchestrator follows same pattern. |
| `server/src/modules/ai/tools.ts` | Tool definition structure and `executeTool` switch/case pattern. AIM has different tools but same architecture. |
| `server/src/modules/ai/prompts.ts` | System prompt builder pattern. AIM prompt is staff-facing instead of customer-facing. |
| `server/src/modules/ai/context.ts` | Context builder for conversation history. AIM needs similar but queries AimConversation/AimMessage instead. |
| `server/src/modules/booking/service.ts` | BookingService — reuse directly for `create_booking` and `check_schedule` AIM tools. |
| `server/src/modules/dashboard/service.ts` | DashboardService — reuse for `get_today_summary` tool. |

**Key difference from SMS orchestrator:** AIM conversations belong to staff users (not customers). The system prompt gives AIM awareness of the full business context, not just one customer's data.

## Task 1: Prisma Schema Additions

**File:** `server/prisma/schema.prisma`

Add these models:

```prisma
model AimConversation {
  id          String       @id @default(uuid())
  staffUserId String       @map("staff_user_id")
  title       String?
  status      String       @default("active") // active, archived
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  staffUser   StaffUser    @relation(fields: [staffUserId], references: [id])
  messages    AimMessage[]

  @@index([staffUserId, updatedAt])
  @@map("aim_conversations")
}

model AimMessage {
  id             String          @id @default(uuid())
  conversationId String          @map("conversation_id")
  role           String          // 'user' (staff), 'assistant' (AI)
  content        String
  toolCalls      Json?           @map("tool_calls")
  modelUsed      String?         @map("model_used")
  createdAt      DateTime        @default(now()) @map("created_at")

  conversation   AimConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId, createdAt])
  @@map("aim_messages")
}

model AimAlert {
  id          String    @id @default(uuid())
  type        String    // 'staffing_gap', 'capacity_warning', 'compliance', 'weather', 'booking_spike'
  severity    String    @default("info") // info, warning, critical
  title       String
  description String
  data        Json?
  readAt      DateTime? @map("read_at")
  resolvedAt  DateTime? @map("resolved_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  @@index([type, createdAt])
  @@index([readAt])
  @@map("aim_alerts")
}

model StaffBreak {
  id              String        @id @default(uuid())
  staffScheduleId String        @map("staff_schedule_id")
  startTime       String        @map("start_time") // HH:MM
  endTime         String        @map("end_time")
  type            String        @default("lunch") // lunch, short, personal
  createdAt       DateTime      @default(now()) @map("created_at")

  staffSchedule   StaffSchedule @relation(fields: [staffScheduleId], references: [id], onDelete: Cascade)

  @@map("staff_breaks")
}
```

Add to existing `StaffUser` model:
```prisma
aimConversations AimConversation[]
```

Add to existing `StaffSchedule` model:
```prisma
breaks StaffBreak[]
```

**Run migration:**
```bash
cd server && npx prisma migrate dev --name add-aim-models
```

## Task 2: AIM Types

**New file:** `server/src/modules/aim/types.ts`

```typescript
export interface AimChatInput {
  staffUserId: string;
  message: string;
  conversationId?: string; // null = new conversation
}

export interface AimChatOutput {
  responseText: string;
  conversationId: string;
  toolsUsed: string[];
  modelUsed: string;
}

export interface AimAlertData {
  type: 'staffing_gap' | 'capacity_warning' | 'compliance' | 'booking_spike';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  data?: Record<string, unknown>;
}
```

## Task 3: AIM System Prompt

**New file:** `server/src/modules/aim/prompts.ts`

System prompt for AIM:
- Identity: "You are AIM (AI Manager), the intelligent operations assistant for Happy Tail Happy Dog."
- Role: Help staff manage daily operations — check schedules, look up customers/dogs, create bookings, monitor compliance, answer questions about the facility
- Tone: Professional but warm, concise, action-oriented
- Context injection: Today's date, facility status (dogs on-site, capacity), staff on duty, upcoming arrivals/departures
- Guidelines: Always verify before creating bookings. Never share customer PII outside the system. Flag compliance issues proactively.

Build context by querying: DashboardService.getFacilityStatus(), DashboardService.getStaffOnDuty(), DashboardService.getComplianceFlags()

## Task 4: AIM Tools

**New file:** `server/src/modules/aim/tools.ts`

Define Anthropic tool definitions and executors:

| Tool Name | Description | Implementation |
|-----------|-------------|----------------|
| `get_today_summary` | Get today's facility overview | Call DashboardService.getDashboardSummary() |
| `search_customer` | Search customers by name/phone/email | Prisma query on Customer with fuzzy match |
| `search_dog` | Search dogs by name, include owner info | Prisma query on Dog with Customer join |
| `check_schedule` | View bookings for a date range | Call BookingService.getScheduleRange() |
| `get_staff_schedule` | View staff schedules for a date | Prisma query on StaffSchedule for date |
| `create_booking` | Create booking for a customer | Reuse BookingService.createBooking() |
| `check_compliance` | Get vaccination/compliance alerts | Call DashboardService.getComplianceFlags() |
| `get_revenue_summary` | Basic revenue stats | Prisma aggregate on Payment/PointsTransaction |
| `send_sms_to_customer` | Send SMS to customer | Reuse existing SMS service (Twilio) |

Each tool follows the same pattern as `server/src/modules/ai/tools.ts`: tool definition object + case in executeTool switch.

## Task 5: AIM Orchestrator

**New file:** `server/src/modules/aim/service.ts`

Follow the exact pattern from `server/src/modules/ai/orchestrator.ts`:

1. Build context (staff info + facility status)
2. Find or create AimConversation for this staff user
3. Store inbound message as AimMessage (role: 'user')
4. Build message history from recent AimMessages
5. Call Claude with system prompt + tools in loop (max 5 rounds)
6. Store AI response as AimMessage (role: 'assistant')
7. Return response text + metadata

**Key differences from SMS orchestrator:**
- Uses `AimConversation` / `AimMessage` instead of `Conversation` / `Message`
- System prompt includes full facility context (not single customer context)
- Tool set is staff-facing (search, schedule, create) not customer-facing
- No Twilio SID tracking
- Model: `claude-sonnet-4-5-20250929` (same as SMS)

## Task 6: AIM Alerts Service

**New file:** `server/src/modules/aim/alerts.ts`

Functions:
- `generateAlerts()` — Run all alert checks, create AimAlert records for new issues
- `checkStaffingGaps(date)` — Compare bookings vs staff for ratio >8:1
- `checkCapacity(date)` — Warn if >80% capacity, critical if >95%
- `checkCompliance()` — Wrap DashboardService.getComplianceFlags()
- `getUnreadAlerts()` — Query AimAlert where readAt is null
- `markAlertRead(id)` — Set readAt timestamp
- `resolveAlert(id)` — Set resolvedAt timestamp

Alert generation can be called periodically (e.g., on dashboard load) or triggered by AIM tools.

## Task 7: AIM Router

**New file:** `server/src/modules/aim/router.ts`

Routes (all require staff auth):

| Method | Path | Handler |
|--------|------|---------|
| `POST` | `/aim/chat` | Send message, get AI response. Body: `{ message, conversationId? }` |
| `GET` | `/aim/conversations` | List staff's AIM conversations (paginated) |
| `GET` | `/aim/conversations/:id` | Get conversation with messages |
| `DELETE` | `/aim/conversations/:id` | Archive conversation |
| `GET` | `/aim/alerts` | Get alerts. Query: `?unread=true` for badge count |
| `PATCH` | `/aim/alerts/:id/read` | Mark alert as read |
| `PATCH` | `/aim/alerts/:id/resolve` | Mark alert as resolved |

**Register in app:** Add to `server/src/routes/admin/index.ts` (or wherever admin routes are mounted):
```typescript
import aimRouter from '../../modules/aim/router';
router.use('/aim', aimRouter);
```

## Task 8: API Client Functions

**File to modify:** `admin-app/src/lib/api.ts`

Add AIM API functions:
```typescript
export const adminAimApi = {
  chat: (message: string, conversationId?: string) =>
    apiCall<AimChatResponse>('/admin/aim/chat', { method: 'POST', body: { message, conversationId } }),
  getConversations: () =>
    apiCall<AimConversation[]>('/admin/aim/conversations'),
  getConversation: (id: string) =>
    apiCall<AimConversationDetail>(`/admin/aim/conversations/${id}`),
  getAlerts: (unread?: boolean) =>
    apiCall<AimAlert[]>(`/admin/aim/alerts${unread ? '?unread=true' : ''}`),
  markAlertRead: (id: string) =>
    apiCall(`/admin/aim/alerts/${id}/read`, { method: 'PATCH' }),
};
```

## Acceptance Criteria

1. `npx prisma migrate dev` runs cleanly, creates 4 new tables
2. `POST /api/v2/admin/aim/chat` with `{ "message": "How's today looking?" }` returns AI response with facility context
3. AIM can use tools: "Search for customer Mark Huggins" → returns customer data
4. `GET /api/v2/admin/aim/alerts` returns alerts array (may be empty initially)
5. Conversation history persists across multiple chat calls with same conversationId
6. `npx tsc --noEmit` passes for server
7. All routes require staff authentication (401 without token)

## Testing Commands

```bash
# Test chat endpoint
curl -X POST https://hthd-api.internationalaidesign.com/api/v2/admin/aim/chat \
  -H "Authorization: Bearer <staff-token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "How many dogs are here today?"}'

# Test alerts
curl https://hthd-api.internationalaidesign.com/api/v2/admin/aim/alerts \
  -H "Authorization: Bearer <staff-token>"

# Test conversations list
curl https://hthd-api.internationalaidesign.com/api/v2/admin/aim/conversations \
  -H "Authorization: Bearer <staff-token>"
```

## Files to Read Before Starting

- `server/src/modules/ai/orchestrator.ts` — Pattern to replicate
- `server/src/modules/ai/tools.ts` — Tool definition pattern
- `server/src/modules/ai/prompts.ts` — System prompt pattern
- `server/src/modules/ai/context.ts` — Context builder pattern
- `server/src/modules/dashboard/service.ts` — DashboardService to reuse
- `server/src/modules/booking/service.ts` — BookingService to reuse
- `server/prisma/schema.prisma` — Current schema (add new models)
- `server/src/routes/admin/` — Route registration pattern
- `admin-app/src/lib/api.ts` — API client pattern
