# PRD: Happy Tail Happy Dog Loyalty Program MVP

## Introduction

Build a customer loyalty app for Happy Tail Happy Dog, a pet services business offering daycare, boarding, and grooming. The app enables customers to earn points on purchases and redeem them for grooming discounts. This MVP focuses on core loyalty functionality with a web-based customer interface and admin panel.

**Business Context:**
- Current revenue: ~$600K/year
- Challenge: Grooming at only 10% of revenue
- Solution: Loyalty program that drives grooming purchases

**Loyalty Rules (MVP):**
- $1 spent = 1 point
- Grooming purchases = 1.5x points
- Points redeemable ONLY on grooming services
- Redemption tiers: 100 pts = $10 off, 250 pts = $25 off, 500 pts = $50 off

## Goals

- Enable customers to self-register and view their points balance
- Allow staff to add points when customers make purchases
- Support both customer-initiated and staff-initiated redemptions
- Provide admin panel for customer management and point operations
- Deploy working prototype within 10 days
- Mobile-responsive web interface (native app deferred to Phase 2)

## User Stories

### US-001: Initialize project structure and database schema
**Description:** As a developer, I need the project scaffolded with the database schema so development can begin.

**Acceptance Criteria:**
- [ ] Create project structure: customer-app/, admin-app/, server/ directories
- [ ] Initialize React + Vite + Tailwind for customer-app
- [ ] Initialize React + Vite + Tailwind for admin-app
- [ ] Initialize Express.js server with Prisma ORM
- [ ] Create Prisma schema with tables: customers, dogs, points_transactions, redemptions, staff_users, audit_log
- [ ] Run initial migration successfully
- [ ] Docker Compose file for local PostgreSQL
- [ ] Typecheck passes

### US-002: Implement customer registration API
**Description:** As a customer, I want to register with my phone/email and password so I can track my loyalty points.

**Acceptance Criteria:**
- [ ] POST /api/auth/register endpoint accepts: phone, email, password, first_name, last_name
- [ ] Password hashed with bcrypt before storing
- [ ] Unique referral_code generated for each customer
- [ ] Returns JWT token on successful registration
- [ ] Validates required fields with Zod
- [ ] Returns appropriate error for duplicate email/phone
- [ ] Typecheck passes

### US-003: Implement customer login API
**Description:** As a customer, I want to log in with my email/phone and password so I can access my account.

**Acceptance Criteria:**
- [ ] POST /api/auth/login endpoint accepts email or phone + password
- [ ] Compares password hash with bcrypt
- [ ] Returns JWT token (7 day expiry) on success
- [ ] Returns 401 for invalid credentials
- [ ] Typecheck passes

### US-004: Implement customer profile API
**Description:** As a customer, I want to view my profile and points balance.

**Acceptance Criteria:**
- [ ] GET /api/customers/me returns current customer profile
- [ ] Response includes: id, first_name, last_name, email, phone, points_balance, referral_code
- [ ] Requires valid JWT token
- [ ] Returns 401 if not authenticated
- [ ] Typecheck passes

### US-005: Implement points transaction history API
**Description:** As a customer, I want to see my points history so I understand how I earned and spent points.

**Acceptance Criteria:**
- [ ] GET /api/customers/me/transactions returns paginated transaction history
- [ ] Each transaction shows: date, type, points_amount, description
- [ ] Supports pagination with limit/offset query params
- [ ] Ordered by most recent first
- [ ] Requires valid JWT token
- [ ] Typecheck passes

### US-006: Build customer registration page
**Description:** As a customer, I want a registration form so I can create my loyalty account.

**Acceptance Criteria:**
- [ ] Registration form with fields: first name, last name, email, phone, password, confirm password
- [ ] Client-side validation with React Hook Form + Zod
- [ ] Shows loading state during submission
- [ ] Redirects to dashboard on success
- [ ] Displays error messages for validation/server errors
- [ ] Mobile-responsive design with Tailwind
- [ ] Typecheck passes
- [ ] Verify in browser using Playwright MCP tools

### US-007: Build customer login page
**Description:** As a customer, I want a login form so I can access my account.

**Acceptance Criteria:**
- [ ] Login form with email/phone and password fields
- [ ] "Remember me" checkbox option
- [ ] Link to registration page
- [ ] Shows loading state during submission
- [ ] Redirects to dashboard on success
- [ ] Displays error for invalid credentials
- [ ] Mobile-responsive design
- [ ] Typecheck passes
- [ ] Verify in browser using Playwright MCP tools

### US-008: Build customer dashboard with points display
**Description:** As a customer, I want to see my points balance and recent activity on a dashboard.

**Acceptance Criteria:**
- [ ] Large, prominent points balance display
- [ ] Shows available redemption tiers (100/$10, 250/$25, 500/$50)
- [ ] Highlights which tiers customer qualifies for
- [ ] Recent transactions list (last 5-10)
- [ ] Pull-to-refresh or refresh button
- [ ] Mobile-responsive design
- [ ] Typecheck passes
- [ ] Verify in browser using Playwright MCP tools

### US-009: Implement staff authentication API
**Description:** As a staff member, I need to log in to the admin panel.

**Acceptance Criteria:**
- [ ] POST /api/admin/auth/login accepts username + password
- [ ] Returns JWT with role claim (admin/staff/groomer)
- [ ] Token expires in 8 hours
- [ ] Returns 401 for invalid credentials
- [ ] Typecheck passes

### US-010: Implement add points API (staff)
**Description:** As a staff member, I want to add points to a customer's account when they make a purchase.

**Acceptance Criteria:**
- [ ] POST /api/admin/points/add accepts: customer_id, dollar_amount, service_type
- [ ] Calculates points: 1 point per dollar, 1.5x for grooming
- [ ] Creates points_transaction record with type 'purchase'
- [ ] Updates customer points_balance
- [ ] Requires staff JWT token
- [ ] Logs action to audit_log
- [ ] Typecheck passes

### US-011: Implement customer lookup API (staff)
**Description:** As a staff member, I want to look up customers by phone or email to add points.

**Acceptance Criteria:**
- [ ] GET /api/admin/customers/search?q={query} searches by phone, email, or name
- [ ] Returns list of matching customers with id, name, phone, email, points_balance
- [ ] Partial match supported (contains search)
- [ ] Requires staff JWT token
- [ ] Typecheck passes

### US-012: Build admin login page
**Description:** As a staff member, I want to log in to the admin panel.

**Acceptance Criteria:**
- [ ] Login form with username and password
- [ ] Redirects to admin dashboard on success
- [ ] Displays error for invalid credentials
- [ ] Happy Tail branding
- [ ] Typecheck passes
- [ ] Verify in browser using Playwright MCP tools

### US-013: Build admin customer lookup and points entry
**Description:** As a staff member, I want to search for a customer and add points for their purchase.

**Acceptance Criteria:**
- [ ] Search bar to find customer by phone/email/name
- [ ] Search results show customer name, phone, current points
- [ ] Click customer to select them
- [ ] Form to enter: dollar amount, service type dropdown (daycare/boarding/grooming)
- [ ] Shows calculated points before confirming (with 1.5x indicator for grooming)
- [ ] Success confirmation with new balance
- [ ] Typecheck passes
- [ ] Verify in browser using Playwright MCP tools

### US-014: Implement customer redemption request API
**Description:** As a customer, I want to request a points redemption so I can get a discount on grooming.

**Acceptance Criteria:**
- [ ] POST /api/redemptions/request accepts: reward_tier (100/250/500)
- [ ] Validates customer has sufficient points
- [ ] Creates redemption record with status 'pending'
- [ ] Generates unique redemption_code
- [ ] Does NOT deduct points yet (deducted on completion)
- [ ] Returns redemption details with code
- [ ] Typecheck passes

### US-015: Implement staff redemption completion API
**Description:** As a staff member, I want to complete a redemption when a customer uses their code.

**Acceptance Criteria:**
- [ ] POST /api/admin/redemptions/complete accepts: redemption_code
- [ ] Validates redemption exists and status is 'pending'
- [ ] Deducts points from customer balance
- [ ] Updates redemption status to 'completed'
- [ ] Records approved_by staff user
- [ ] Logs to audit_log
- [ ] Returns success with redemption details
- [ ] Typecheck passes

### US-016: Implement staff-initiated redemption API
**Description:** As a staff member, I want to process a redemption directly for a customer at checkout.

**Acceptance Criteria:**
- [ ] POST /api/admin/redemptions/create accepts: customer_id, reward_tier
- [ ] Validates customer has sufficient points
- [ ] Creates redemption record with status 'completed' immediately
- [ ] Deducts points from customer balance
- [ ] Generates redemption_code for records
- [ ] Records approved_by staff user
- [ ] Logs to audit_log
- [ ] Typecheck passes

### US-017: Build customer redemption request UI
**Description:** As a customer, I want to request a redemption from my dashboard.

**Acceptance Criteria:**
- [ ] "Redeem Points" section on dashboard
- [ ] Shows available tiers with points required and discount value
- [ ] Tiers customer can't afford are grayed out
- [ ] Click tier to request redemption
- [ ] Confirmation dialog before requesting
- [ ] Shows redemption code after successful request
- [ ] Code displayed prominently for showing at checkout
- [ ] Typecheck passes
- [ ] Verify in browser using Playwright MCP tools

### US-018: Build customer active redemptions view
**Description:** As a customer, I want to see my pending redemption codes so I can use them at checkout.

**Acceptance Criteria:**
- [ ] Section showing active/pending redemptions
- [ ] Each shows: code, discount value, date requested, status
- [ ] Pending codes prominently displayed
- [ ] Completed redemptions shown in history
- [ ] Typecheck passes
- [ ] Verify in browser using Playwright MCP tools

### US-019: Build admin redemption lookup and completion
**Description:** As a staff member, I want to look up and complete redemption codes at checkout.

**Acceptance Criteria:**
- [ ] Input field to enter/scan redemption code
- [ ] Shows redemption details: customer name, discount value, status
- [ ] "Complete Redemption" button for pending redemptions
- [ ] Confirmation before completing
- [ ] Success message with discount amount to apply
- [ ] Typecheck passes
- [ ] Verify in browser using Playwright MCP tools

### US-020: Build admin direct redemption flow
**Description:** As a staff member, I want to process a redemption directly for a customer without a code.

**Acceptance Criteria:**
- [ ] After selecting customer (from US-013), option to "Redeem Points"
- [ ] Shows available tiers customer qualifies for
- [ ] Select tier and confirm
- [ ] Points deducted, confirmation shown
- [ ] Typecheck passes
- [ ] Verify in browser using Playwright MCP tools

### US-021: Add JWT authentication middleware
**Description:** As a developer, I need authentication middleware to protect API routes.

**Acceptance Criteria:**
- [ ] Middleware extracts and verifies JWT from Authorization header
- [ ] Attaches decoded user to request object
- [ ] Returns 401 for missing/invalid/expired tokens
- [ ] Separate middleware for customer vs staff routes
- [ ] Role-based authorization for admin routes
- [ ] Typecheck passes

### US-022: Add API security middleware
**Description:** As a developer, I need security middleware to protect the API.

**Acceptance Criteria:**
- [ ] Rate limiting: 100 requests per 15 minutes per IP
- [ ] CORS configured for customer-app and admin-app origins
- [ ] Helmet.js for secure HTTP headers
- [ ] Request logging with Winston
- [ ] Typecheck passes

### US-023: Create seed data script
**Description:** As a developer, I need seed data for testing and demos.

**Acceptance Criteria:**
- [ ] Script creates sample staff users (admin, staff roles)
- [ ] Creates 10+ sample customers with realistic data
- [ ] Creates points transaction history for customers
- [ ] Creates sample pending and completed redemptions
- [ ] Idempotent (can run multiple times safely)
- [ ] Typecheck passes

### US-024: Build admin customer list view
**Description:** As a staff member, I want to see a list of all customers and their points.

**Acceptance Criteria:**
- [ ] Table view of all customers
- [ ] Columns: name, phone, email, points balance, join date
- [ ] Sortable by columns
- [ ] Search/filter functionality
- [ ] Click row to view customer details
- [ ] Pagination for large lists
- [ ] Typecheck passes
- [ ] Verify in browser using Playwright MCP tools

### US-025: Build admin customer detail view
**Description:** As a staff member, I want to see a customer's full profile and history.

**Acceptance Criteria:**
- [ ] Shows customer profile information
- [ ] Shows current points balance prominently
- [ ] Lists all points transactions
- [ ] Lists all redemptions (pending and completed)
- [ ] Quick action buttons: Add Points, Process Redemption
- [ ] Typecheck passes
- [ ] Verify in browser using Playwright MCP tools

## Functional Requirements

- FR-1: Customers register with phone, email, first name, last name, password
- FR-2: Customers log in with email or phone plus password
- FR-3: System generates unique referral code per customer (for future use)
- FR-4: Points calculated as 1 point per $1 spent, 1.5x for grooming services
- FR-5: Staff can add points by entering dollar amount and service type
- FR-6: Points transactions logged with type, amount, timestamp, created_by
- FR-7: Redemption tiers: 100 pts = $10 off, 250 pts = $25 off, 500 pts = $50 off
- FR-8: Customers can request redemption, receiving a code to show at checkout
- FR-9: Staff can complete redemption by entering code, which deducts points
- FR-10: Staff can process redemption directly for customer without code
- FR-11: All point-affecting operations logged to audit_log
- FR-12: Staff users have roles: admin, staff, groomer
- FR-13: JWT tokens expire: 7 days for customers, 8 hours for staff

## Non-Goals (Out of Scope for MVP)

- Native mobile app (Phase 2)
- Social media bonus points (Week 3-4)
- Google review bonus points (Week 3-4)
- Referral bonus system (Week 3)
- Advanced anti-fraud measures (v2)
- Online booking integration
- Payment processing
- Push notifications
- Dog profiles management
- Analytics dashboard (Day 8 stretch goal, separate PRD)
- Email/SMS notifications

## Technical Considerations

**Stack (from design doc):**
- Frontend: React 18 + Vite + Tailwind CSS + React Hook Form + Zod
- Backend: Node.js 20 + Express.js + Prisma + PostgreSQL
- Auth: JWT + bcrypt
- Deployment: Docker + PM2 + Nginx

**Database:**
- PostgreSQL 15+ with Prisma ORM
- Schema defined in design doc section 7

**Project Structure:**
```
happy-tail-loyalty/
├── customer-app/     (React customer interface)
├── admin-app/        (React admin interface)
├── server/           (Node.js API)
│   ├── src/routes/
│   ├── src/controllers/
│   ├── src/services/
│   ├── src/middleware/
│   └── prisma/
└── docker-compose.yml
```

## Success Metrics

- Customer can register, log in, and view points in under 2 minutes
- Staff can add points to customer account in under 30 seconds
- Redemption flow (either direction) completes in under 1 minute
- All API responses under 200ms
- Zero critical security vulnerabilities
- Mobile-responsive UI works on phones and tablets

## Open Questions

- Should expired/cancelled redemption codes be shown in customer history?
- What's the expiration policy for pending redemption codes?
- Should there be a maximum points balance cap?
- How should the system handle points for refunded purchases?
