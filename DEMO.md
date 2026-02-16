# Happy Tail Happy Dog - Loyalty App Demo

**Demo Date:** February 2, 2026
**Audience:** Ted & Julian
**Goal:** Show working app, transition to ongoing relationship discussion

---

## Pre-Demo Checklist

Before the meeting, verify everything works:

- [ ] **API Health:** `curl https://hthd-api.internationalaidesign.com/api/health`
- [ ] **Admin Login:** https://hthd-admin.internationalaidesign.com (use staff credentials from secure storage)
- [ ] **Customer App Loads:** https://hthd.internationalaidesign.com
- [ ] **Phone has customer app bookmarked** (for live demo)
- [ ] **Test customer ready** (use a real customer from their data)

---

## Live URLs

| Service | URL |
|---------|-----|
| Customer App | https://hthd.internationalaidesign.com |
| Admin App | https://hthd-admin.internationalaidesign.com |
| API | https://hthd-api.internationalaidesign.com |

**Staff login:** Use credentials from secure storage (never commit passwords to git)

---

## Demo Flow

### Part 1: Customer Experience (5 min)

**Setup:** Open customer app on phone or laptop

#### Step 1: Landing Page
*"This is what your customers see when they first visit."*

- Clean, branded design matching HTHD aesthetic
- Simple call-to-action: "Claim Your Account"
- No app download required - works in any browser

#### Step 2: Account Claim Flow
*"Let me show you how a customer claims their existing account."*

1. Tap "Claim Your Account"
2. Enter email address (use a test customer)
3. Verification code sent to email
4. Customer sets their PIN
5. **Done** - they're logged in

**Talking Point:** *"All 151 of your existing customers from Gingr are already in the system. They just need to claim their account."*

#### Step 3: Customer Dashboard
*"Once logged in, here's what they see."*

- **Points balance** - prominent display
- **Their dogs** - with photos from Gingr
- **Recent activity** - points earned, redemptions
- **Referral code** - unique to each customer (HT-XXXXXX format)

**Talking Point:** *"Points are 1 per dollar, with a 1.5x multiplier for grooming services - driving them to book grooming."*

#### Step 4: Redemption Request
*"When they have enough points, they can request a redemption."*

1. Tap "Redeem Points"
2. Choose tier: 100 pts = $10, 250 pts = $25, 500 pts = $50
3. Confirm request
4. Points are reserved (not deducted) until you approve

**Talking Point:** *"You stay in control. Nothing happens until your staff approves it."*

---

### Part 2: Admin Experience (5 min)

**Setup:** Open admin app on laptop

#### Step 1: Admin Login
1. Navigate to admin URL
2. Login with staff credentials
3. Dashboard loads

**Talking Point:** *"Jorge or anyone on staff can use this. It's designed to be simple enough for anyone."*

#### Step 2: Customer Lookup
*"Let's say a customer comes in. Here's how you find them."*

1. Click "Customers" in sidebar
2. Search by name, email, or phone
3. Click customer to see full profile

**What you see:**
- Contact info
- All their dogs
- Points balance
- Transaction history
- Pending redemptions

#### Step 3: Award Points
*"Customer just spent $50. Here's how you give them points."*

1. On customer profile, click "Award Points"
2. Enter amount spent ($50)
3. Select service type (daycare, grooming, retail)
4. Click Award
5. Points calculated automatically (grooming gets 1.5x!)

**Talking Point:** *"75 points for a $50 grooming service. They're incentivized to book more grooming."*

#### Step 4: Process Redemption
*"Customer wants to use their $10 reward. Here's the flow."*

1. Customer shows their app or you look them up
2. See pending redemption on their profile
3. Click "Process Redemption"
4. Confirm they received the discount
5. Points deducted, audit trail created

**Talking Point:** *"Full audit log of everything. You always know who did what and when."*

---

### Part 3: Behind the Scenes (2 min)

*"Let me show you what makes this work."*

#### Gingr Sync
- **151 customers imported** from your existing Gingr data
- **Auto-syncs every 30 minutes** - new customers automatically added
- No manual data entry required

#### What's Tracked
- Every points transaction
- Every redemption
- Staff actions logged with timestamps
- Full audit trail for accountability

---

## Key Talking Points

### Value Propositions

1. **Drives Repeat Business**
   - Customers see their points, want to earn more
   - Grooming multiplier specifically drives grooming bookings
   - Referral codes turn customers into marketers

2. **Reduces Ted's Admin Work**
   - Staff can handle points/redemptions
   - No tracking spreadsheets needed
   - Audit trail means accountability without micromanagement

3. **Professional Touch**
   - Customers feel valued
   - Differentiates from competitors
   - "Big company" feature at small business scale

4. **Data You Own**
   - Not locked into Gingr's limitations
   - Can be expanded with SMS, more features
   - You own all the data, forever

### Objection Handling

**"We're busy, who's going to manage this?"**
> Jorge can handle it. It takes 30 seconds to award points. The system does the work.

**"Our customers aren't tech-savvy."**
> No app download. Works in any web browser. Their grandkids can help if needed.

**"What if the system goes down?"**
> Just give them the discount anyway and record it later. The system catches up.

**"How much is this going to cost us?"**
> Let's talk about that - I have options that fit different budgets.

---

## Transition to Proposal

*"So that's the app. It's live, it's working, and your customers are ready to use it."*

*"The question is: what do you want to do with it?"*

*"I have a few options for you - from just taking the app and running with it yourself, to having me handle all your digital stuff so you can focus on the dogs."*

[Hand over transformation proposal document]

---

## Post-Demo Checklist

After the meeting:

- [ ] Note any questions or concerns raised
- [ ] Document which option they're leaning toward
- [ ] Schedule follow-up if they need time to decide
- [ ] Send summary email with next steps
