# Implementation Plan

## Project: Happy Tail Happy Dog Loyalty App - v2

## Description
Complete referral system with native share functionality for the Happy Tail loyalty program.

## Tasks (Priority Order)

### Share Button (Customer App)
- [x] Add "Share Your Code" button to customer dashboard near referral code display
- [x] Implement Web Share API for native share tray (iOS/Android)
- [x] Create fallback for browsers without Web Share API (copy to clipboard)
- [x] Share message includes: referral code, brief promo text, link to registration
- [x] Test share functionality in Safari, Chrome, Firefox

### Referral Code Entry (Registration)
- [x] Add optional "Referral Code" field to registration form
- [x] Validate referral code format (HT-XXXXXX) on frontend
- [x] Create API endpoint to validate referral code exists and is active
- [x] Store referring customer ID on new customer record when valid code used

### Referral Credit System (Backend)
- [x] Create database field on Customer model: referredBy (relation to referring customer)
- [x] Create POST /api/referrals/apply endpoint to link referral at registration
- [x] Award referral bonus points (100 pts) to referring customer when new customer registers
- [x] Create points transaction record with type 'referral' for the bonus
- [x] Prevent self-referral (cannot use own code)

### Referral Stats (Customer App)
- [x] Add "My Referrals" section to customer dashboard
- [x] Display count of successful referrals
- [x] Show total bonus points earned from referrals
- [x] List referred customers (first name only for privacy)

### Admin Visibility
- [x] Add referral info to admin customer detail page
- [x] Show who referred this customer (if applicable)
- [x] Show list of customers this person has referred

## Notes
- Session 1: Added Share button with brand-compliant teal (#5BBFBA), no click handler yet
- Session 2: Implemented Web Share API with clipboard fallback. Share message includes referral code, promo text, and registration link. Success feedback shows "Copied to clipboard!" for 3 seconds on fallback.
- Session 3: Added optional "Referral Code" field to registration form with HT-XXXXXX format validation. Updated RegisterData interface in api.ts to include referral_code. Verified in browser: invalid codes show error, valid codes and empty field pass validation.
- Session 4: Created GET /api/referrals/validate/:code endpoint. Returns {valid: true, referrer_first_name} for existing codes, {valid: false, error} for invalid format or non-existent codes. Case insensitive. Verified via Playwright browser test.
- Session 5: Verified "Store referring customer ID" task was already implemented in auth.ts (lines 54-66, 91). Registration endpoint looks up referrer by code and stores referredById on new customer. Tested via browser: registered Alice (referrer), then Bob with Alice's code HT-53LKT8. Database confirmed Bob.referredById matches Alice.id.
- Session 6: Completed Referral Credit System. Updated registration endpoint in auth.ts to: (1) Award 100 bonus points to referrer using Prisma transaction, (2) Create points transaction record with type 'referral', (3) Prevent self-referral by checking if referrer email matches new customer email. Verified via Playwright: registered TestReferral with Alice's code, confirmed Alice received 100 pts and referral transaction. Self-referral test showed error "You cannot use your own referral code".
- Session 7: Completed Referral Stats section for Customer App. Added GET /api/customers/me/referrals endpoint to server/src/routes/customers.ts that returns referral_count, total_bonus_points, and referred_customers list. Added ReferralStatsResponse type and getReferralStats() to customer-app API. Added "My Referrals" section to DashboardPage with brand-compliant styling: shows stats (Friends Referred count, Bonus Points Earned), lists referred customers with avatar initials and join date. Empty state shows "No referrals yet" message. Verified via Playwright: new user sees empty state, Alice sees 3 referrals with +200 bonus points.
- Session 8: Completed Admin Visibility for referrals. Updated GET /api/admin/customers/:id endpoint in server/src/routes/admin/customers.ts to include referredBy and referrals relations. Added CustomerReferralInfo and CustomerReferral types to admin-app API. Added "Referral Information" section to CustomerDetailPage.tsx showing: (1) "Referred By" with avatar initials and clickable link to referrer, (2) "Referred Customers" list with names, initials, join dates, and clickable links. Section only displays when customer has referral relationships. Verified via Playwright: Alice shows 3 referrals, Bob shows Alice as referrer with working navigation links, Jon (no referral relationships) correctly hides the section.
