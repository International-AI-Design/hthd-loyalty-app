---
name: happy-tail-brand
description: Brand guidelines and design system for Happy Tail Happy Dog, a Denver boutique dog hotel and spa. Use this skill when creating any customer-facing UI, marketing materials, emails, or content for Happy Tail Happy Dog's loyalty app, website features, or business communications. Ensures consistent branding, tone, colors, typography, and messaging aligned with their kennel-free, family-like, holistic pet care positioning.
---

# Happy Tail Happy Dog Brand Guidelines

## Brand Overview

**Company:** Happy Tail Happy Dog, LLC  
**Location:** 4352 Cherokee St, Denver, CO 80216  
**Founded:** 2013 by Ted Gualtier  
**Positioning:** Premier boutique dog hotel and spa with 24-hour staff  
**Tagline Options:** "Your dog's home away from home" | "We believe in caring, not staring"

## Brand Story & Voice

### Origin Story
Happy Tail Happy Dog was born from Ted Gualtier's experience with his English Lab, Jake, a certified therapy dog who helped him through a life-threatening illness. Jake's compassion and healing spirit inspired the creation of a kennel-free, holistic pet care center.

### Core Values
- **Unconditional Love** - Treat every dog like family
- **Kennel-Free Philosophy** - No cages unless specifically requested
- **Holistic Care** - Physical, mental, and emotional wellbeing
- **Trust & Reliability** - 24/7 attentive care, never unattended
- **Community** - Clients become friends, dogs become family

### Brand Voice
- **Warm & Welcoming** - Like talking to a trusted friend
- **Professional but Personal** - Expertise delivered with heart
- **Reassuring** - Peace of mind for pet parents
- **Enthusiastic** - Genuine love for dogs shines through
- **Inclusive** - Dogs of all sizes, breeds, and temperaments welcome

### Key Phrases to Use
- "Home away from home"
- "Your furry family member"
- "Peace of mind"
- "Dog-loving professionals"
- "Personalized, loving care"
- "Kennel-free experience"
- "24-hour attentive care"
- "Premier boutique"
- "Holistic pet care"
- "The fun awaits"

### Phrases to Avoid
- "Kennel" or "boarding facility" (use "boutique dog hotel" instead)
- "Pet storage" or clinical language
- "Cheap" or "discount" (use "value" or "special offer")
- Overly corporate or impersonal language

## Visual Identity

### Color Palette

**Primary Colors:**
```
Brand Blue        #62A2C3 (RGB: 98, 162, 195)   - Primary brand color, headers, CTAs
Navy Blue         #1B365D (RGB: 27, 54, 93)    - Text, accents, trust/professionalism
```

**Secondary Colors:**
```
Warm White        #F8F6F3 (RGB: 248, 246, 243) - Backgrounds, clean space
Soft Cream        #FDF8F3 (RGB: 253, 248, 243) - Card backgrounds, warmth
Light Gray        #E8E8E8 (RGB: 232, 232, 232) - Borders, dividers
```

**Accent Colors:**
```
Coral/Salmon      #E8837B (RGB: 232, 131, 123) - Highlights, notifications, warmth
Golden Yellow     #F5C65D (RGB: 245, 198, 93)  - Rewards, badges, celebration
Soft Green        #7FB685 (RGB: 127, 182, 133) - Success states, positive feedback
```

**Usage Guidelines:**
- Use Blue (#62A2C3) for primary buttons, headers, and key CTAs
- Use Navy (#1B365D) for body text and professional elements
- Use Warm White (#F8F6F3) for backgrounds to feel clean but not sterile
- Use Coral (#E8837B) sparingly for notifications and warmth accents
- Maintain high contrast for accessibility (WCAG AA minimum)

### Typography

**Primary Font (Headings):**
- **Font:** Playfair Display or similar elegant serif
- **Weight:** Bold (700) for main headings
- **Usage:** Page titles, section headers, brand moments

**Secondary Font (Body):**
- **Font:** Open Sans, Lato, or system sans-serif stack
- **Weights:** Regular (400) for body, Medium (500) for emphasis, Bold (700) for labels
- **Usage:** All body text, navigation, buttons, form labels

**Fallback Stack:**
```css
--font-heading: 'Playfair Display', Georgia, serif;
--font-body: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

**Type Scale:**
```
H1: 36px / 2.25rem (bold serif)
H2: 28px / 1.75rem (bold serif)
H3: 22px / 1.375rem (bold sans)
Body: 16px / 1rem (regular sans)
Small: 14px / 0.875rem (regular sans)
Caption: 12px / 0.75rem (medium sans)
```

### Logo Usage

**Primary Logo:** "Happy Tail Happy Dog" wordmark in elegant script/serif with paw print or dog silhouette
**Logo URL:** https://happytailhappydog.com/wp-content/uploads/2023/10/happy-tail-happy-dog-boutique.png

**Logo Clearspace:** Minimum padding of logo height on all sides
**Minimum Size:** 120px width for digital, 1" for print
**Color Variations:**
- Full color (blue + navy) on white/light backgrounds
- White/reversed on dark or blue backgrounds
- Never stretch, rotate, or apply effects

### Iconography

**Style:** Rounded, friendly line icons (not sharp/angular)
**Stroke Weight:** 2px consistent
**Color:** Match brand palette (blue primary, navy secondary)

**Common Icons:**
- 🐕 Dog silhouette - Daycare/general
- ✂️ Scissors - Grooming
- 🏠 House - Boarding
- 🚶 Walking figure - Dog walking
- 🥾 Boot/trail - Hiking
- 💆 Hands - Massage
- ⭐ Star - Rewards/points
- 🎁 Gift - Redemptions
- 👥 People - Referrals

### Imagery Style

**Photography Guidelines:**
- Real dogs, real moments (no stock photos if possible)
- Natural lighting, warm tones
- Dogs playing, relaxing, interacting with staff
- Clean, spacious facility shots
- Happy, wagging tails emphasized
- Staff shown with genuine affection for dogs

**Image Treatment:**
- Soft, warm color grading
- Avoid harsh shadows or clinical lighting
- Round corners on images (8-16px radius)
- Subtle drop shadows for depth

## UI/UX Guidelines

### Layout Principles

**Mobile-First Design:**
- Primary audience uses phones to check points, book services
- Touch-friendly tap targets (minimum 44px)
- Thumb-zone friendly navigation
- Simplified forms with large inputs

**Visual Hierarchy:**
```
1. Logo/Brand (top)
2. Primary Action (prominent CTA)
3. Key Information (points balance, rewards)
4. Supporting Content (history, details)
5. Navigation (bottom on mobile)
```

### Component Styles

**Buttons:**
```css
/* Primary CTA */
.btn-primary {
  background: #62A2C3;
  color: white;
  border-radius: 8px;
  padding: 12px 24px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(98, 162, 195, 0.3);
}

/* Secondary */
.btn-secondary {
  background: white;
  color: #1B365D;
  border: 2px solid #62A2C3;
  border-radius: 8px;
}

/* Hover states: darken 10%, lift shadow */
```

**Cards:**
```css
.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  padding: 20px;
  border: 1px solid #E8E8E8;
}
```

**Input Fields:**
```css
.input {
  border: 1px solid #E8E8E8;
  border-radius: 8px;
  padding: 12px 16px;
  font-size: 16px; /* Prevents zoom on iOS */
}
.input:focus {
  border-color: #62A2C3;
  box-shadow: 0 0 0 3px rgba(98, 162, 195, 0.2);
}
```

### Spacing System

```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
--space-2xl: 48px;
--space-3xl: 64px;
```

### Animation & Transitions

- **Duration:** 200-300ms for micro-interactions
- **Easing:** ease-out for entrances, ease-in for exits
- **Style:** Subtle, delightful, not distracting
- **Examples:** Button hover lift, card hover shadow, points count animation

## Content Guidelines

### Services Reference

| Service | Description | Starting Price |
|---------|-------------|----------------|
| Daycare (Half Day) | 4 hours of play & enrichment | $37 |
| Daycare (Full Day) | 8+ hours with enrichment | $47 |
| Boarding (per night) | Kennel-free overnight stay | $69 |
| Bath Services | Wash, brush, nails, ears | $48-$124 |
| Bath & Trim | Bath + light trimming | $78-$142 |
| Bath & Haircut | Full grooming service | $95-$167 |
| Nail Trim | Standalone service | $20 |
| Teeth Brushing | Enzymatic cleaning | $10 |
| Dog Walking | 30-60 minute walks | Contact |
| Hiking | Mountain trail adventures | Contact |
| Massage | Therapeutic soft tissue | Contact |

### Hours of Operation
- **Daycare/Boarding:** 7:00 AM - 7:00 PM (Mon-Fri), 7:00 AM - 6:30 PM (Sat-Sun)
- **Grooming:** 9:00 AM - 4:00 PM (Tue-Sat)

### Contact Information
- **Phone:** (720) 654-8384
- **Email:** info@HappyTailHappyDog.com
- **Address:** 4352 Cherokee St, Denver, CO 80216
- **Website:** happytailhappydog.com
- **Booking Portal:** happytailhappydogllc.portal.gingrapp.com

### Social Media
- **Facebook:** @happytailhappydog
- **Instagram:** @happytailhappydog

## Loyalty Program Specifics

### Program Name Options
- "Happy Tails Rewards"
- "Tail Wag Rewards"
- "Paw Points Program"
- "Happy Tail Perks"

### Points Messaging
```
Earning:
"You earned [X] points! 🐾"
"[X] points added to your balance"

Redeeming:
"Treat your pup! Redeem [X] points for [reward]"
"Show this code at checkout: [CODE]"

Progress:
"Only [X] points until your next reward!"
"You're [X]% of the way to a free [service]!"
```

### Reward Tiers (Reference)
- 100 points = $10 off grooming
- 250 points = $25 off grooming OR free nail trim
- 500 points = $50 off grooming OR free bath

### Bonus Point Actions
- Google Review: 50 points ("Thanks for spreading the love!")
- Social Media Tag: 25 points ("Thanks for the shoutout!")
- Referral: 100 points ("Thanks for sharing Happy Tail!")

## Email & Notification Templates

### Welcome Email
```
Subject: Welcome to the Happy Tail Family! 🐾

Hi [Name],

Welcome to Happy Tail Happy Dog! We're so excited to have you and [Dog Name] join our family.

Your loyalty journey starts now. Every dollar you spend earns points toward free grooming services—our way of saying thanks for trusting us with your furry family member.

Current Balance: 0 points
First Reward: Just 100 points away!

See you soon,
The Happy Tail Team
```

### Points Earned
```
Subject: You earned [X] points today! 🎉

[Dog Name] had a great day at Happy Tail!

+[X] points earned
New Balance: [Total] points

Only [X] more points until your next reward!

[View Your Rewards →]
```

### Redemption Ready
```
Subject: [Name], you've unlocked a reward! 🎁

Congrats! You have enough points for:

🎁 $[X] off your next grooming service

Ready to redeem? Show this code at your next visit:
[REDEMPTION CODE]

Code expires: [Date]
```

## Accessibility Requirements

- Color contrast ratio: 4.5:1 minimum (WCAG AA)
- Alt text on all images
- Focus states visible on all interactive elements
- Form labels clearly associated with inputs
- Error messages clear and descriptive
- Touch targets minimum 44x44px
- No information conveyed by color alone

## File Naming Conventions

```
Images: happy-tail-[description]-[size].png
Icons: icon-[name].svg
Pages: [feature]-[page].jsx
Components: [ComponentName].jsx
Styles: [component].css or Tailwind classes
```

## Quick Reference: Do's and Don'ts

### Do
✅ Use warm, welcoming language
✅ Emphasize kennel-free, family-like care
✅ Show real dogs and genuine moments
✅ Keep UI clean, simple, mobile-friendly
✅ Use blue as primary action color
✅ Round corners (8-12px) on cards and buttons
✅ Celebrate milestones with enthusiasm

### Don't
❌ Use clinical or corporate language
❌ Show cages, kennels, or sterile environments
❌ Use harsh, angular design elements
❌ Overwhelm with too many options
❌ Use red for non-error states
❌ Forget mobile users
❌ Make redemption complicated

---

## Frontend Design Standards

**MANDATORY**: All frontend work MUST use the `frontend-design` skill. Invoke with `/frontend-design` before building any UI components.

### Mobile Design Checklist

Before any frontend work is considered complete, verify:

- [ ] **Touch targets**: Minimum 44x44px for all interactive elements
- [ ] **Viewport**: Proper meta viewport tag, no horizontal scroll
- [ ] **Typography**: Readable without zoom (min 16px body text)
- [ ] **Spacing**: Adequate padding for thumb navigation
- [ ] **Navigation**: Accessible with one hand, bottom-nav preferred on mobile
- [ ] **Forms**: Large inputs (min 44px height), proper input types, no tiny dropdowns
- [ ] **Tables**: Responsive - card layout or horizontal scroll on mobile, not truncated
- [ ] **Images**: Responsive, lazy-loaded, proper aspect ratios
- [ ] **Performance**: Fast load on 3G, no layout shifts
- [ ] **Test on device**: Actually test on real mobile device, not just DevTools

### Admin App Specific

The admin-app is used by staff on tablets and phones at the front desk:
- Optimize for quick lookups and actions
- Large touch targets for fast customer check-in
- Clear visual hierarchy for scanning customer info
- Forms must be usable with one hand

### Responsive Breakpoints
```css
/* Mobile first - base styles are mobile */
/* sm: 640px  - large phones, small tablets */
/* md: 768px  - tablets */
/* lg: 1024px - laptops */
/* xl: 1280px - desktops */
```

### Quality Gate

No frontend PR is complete until:
1. Mobile checklist above is satisfied
2. Tested on actual mobile device (not just DevTools)
3. Brand colors and typography match this SKILL.md
