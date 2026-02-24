/**
 * Seed QA test accounts in the production database.
 *
 * Creates:
 * 1. Customer: qa-test@internationalaidesign.com ("QA Testdog")
 *    - 2 dogs: "Playwright" (Golden Retriever), "Cypress" (Labrador)
 *    - 1 conversation with 70+ messages (catches pagination bugs)
 *    - 150 loyalty points
 *    - 1 confirmed daycare booking
 *
 * 2. Staff: qa-staff (manager role)
 *
 * Safe to re-run: skips accounts that already exist.
 *
 * Usage: cd server && npx ts-node prisma/seed-qa-accounts.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcrypt';
const SALT_ROUNDS = 10;
const PASSWORD = 'QaTest2026!';

async function main() {
  console.log('Seeding QA test accounts...\n');

  // ── 1. Customer Account ───────────────────────────────────────────

  const customerEmail = 'qa-test@internationalaidesign.com';
  let customer = await prisma.customer.findUnique({ where: { email: customerEmail } });

  if (customer) {
    console.log(`Customer already exists: ${customerEmail} (id: ${customer.id})`);
  } else {
    const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

    customer = await prisma.customer.create({
      data: {
        email: customerEmail,
        phone: '+15550000001',
        passwordHash,
        firstName: 'QA',
        lastName: 'Testdog',
        referralCode: 'HT-QATEST',
        accountStatus: 'active',
        pointsBalance: 150,
        source: 'organic',
      },
    });

    // Points transaction for the 150 points
    await prisma.pointsTransaction.create({
      data: {
        customerId: customer.id,
        type: 'bonus',
        amount: 150,
        description: 'QA test account setup — initial points',
      },
    });

    console.log(`Created customer: ${customerEmail} (id: ${customer.id})`);
  }

  // ── 2. Dogs ────────────────────────────────────────────────────────

  const existingDogs = await prisma.dog.findMany({
    where: { customerId: customer.id },
  });

  if (existingDogs.length >= 2) {
    console.log(`Dogs already exist: ${existingDogs.map(d => d.name).join(', ')}`);
  } else {
    // Only create dogs that don't exist yet
    const dogNames = ['Playwright', 'Cypress'];
    const dogBreeds = ['Golden Retriever', 'Labrador'];

    for (let i = 0; i < dogNames.length; i++) {
      const existingDog = existingDogs.find(d => d.name === dogNames[i]);
      if (existingDog) {
        console.log(`Dog "${dogNames[i]}" already exists (id: ${existingDog.id})`);
        continue;
      }

      const dog = await prisma.dog.create({
        data: {
          customerId: customer.id,
          name: dogNames[i],
          breed: dogBreeds[i],
          sizeCategory: 'large',
        },
      });
      console.log(`Created dog: ${dogNames[i]} (id: ${dog.id})`);
    }
  }

  // Refresh dogs list
  const dogs = await prisma.dog.findMany({
    where: { customerId: customer.id },
  });

  // ── 3. Conversation with 70+ messages ──────────────────────────────

  const existingConversations = await prisma.conversation.findMany({
    where: { customerId: customer.id },
    include: { messages: { select: { id: true } } },
  });

  const hasLargeConversation = existingConversations.some(c => c.messages.length >= 70);

  if (hasLargeConversation) {
    console.log(`Conversation with 70+ messages already exists`);
  } else {
    // Create a conversation
    const conversation = await prisma.conversation.create({
      data: {
        customerId: customer.id,
        channel: 'web_chat',
        status: 'active',
      },
    });

    // Generate 75 realistic messages
    const messageTopics = [
      // Opening
      { role: 'customer', content: 'Hi! I have a question about daycare for my Golden Retriever.' },
      { role: 'assistant', content: 'Welcome to Happy Tail Happy Dog! I\'d be happy to help you with daycare information for your Golden Retriever. What would you like to know?' },

      // Hours & pricing
      { role: 'customer', content: 'What are your daycare hours?' },
      { role: 'assistant', content: 'Our daycare runs Monday through Friday, 7:00 AM to 6:30 PM, and Saturday 8:00 AM to 5:00 PM. We\'re closed on Sundays. Drop-off is between 7-9 AM and pickup is between 4-6:30 PM.' },
      { role: 'customer', content: 'And how much does it cost?' },
      { role: 'assistant', content: 'Our daycare rates start at $45 per day for a single dog. We offer multi-dog discounts if you bring more than one pup! We also have membership plans that can save you money if you\'re a regular visitor.' },

      // Vaccination
      { role: 'customer', content: 'Do I need to bring vaccination records?' },
      { role: 'assistant', content: 'Yes! We require up-to-date records for Rabies, Bordetella, DHPP, and Canine Influenza. You can upload them through the app or bring them on your first visit. Safety is our top priority!' },
      { role: 'customer', content: 'My dog just got his bordetella vaccine last week. Is that ok?' },
      { role: 'assistant', content: 'That should be fine! As long as the vaccination is current and not expired, we\'re good to go. We\'ll verify the records when you check in for the first time.' },

      // Socialization
      { role: 'customer', content: 'Is Playwright good with other dogs? Should I be worried?' },
      { role: 'assistant', content: 'That\'s a great question! Golden Retrievers are generally very social dogs. During the first visit, we do a temperament assessment to make sure everyone plays safely together. We group dogs by size and play style.' },
      { role: 'customer', content: 'He\'s very friendly but sometimes gets too excited.' },
      { role: 'assistant', content: 'That\'s totally normal, especially for Goldens! Our trained staff monitors play groups throughout the day and will redirect any overly enthusiastic pups. We use positive reinforcement to encourage calm behavior.' },

      // Grooming
      { role: 'customer', content: 'Do you offer grooming too?' },
      { role: 'assistant', content: 'We sure do! We offer a full range of grooming services including baths, haircuts, nail trims, and ear cleaning. You can book grooming separately or combine it with a daycare day for convenience.' },
      { role: 'customer', content: 'How much is a bath for a Golden?' },
      { role: 'assistant', content: 'For a large breed like a Golden Retriever, a bath and dry starts at around $55-65 depending on coat condition. A full groom (bath + haircut) is typically $85-110. We assess the coat condition when your pup arrives for the most accurate quote.' },
      { role: 'customer', content: 'Can I book daycare and grooming on the same day?' },
      { role: 'assistant', content: 'Absolutely! That\'s actually a popular combo. You can drop off in the morning for daycare, and we\'ll fit the grooming in during the day. Your pup goes home tired, clean, and happy!' },

      // Boarding
      { role: 'customer', content: 'What about boarding? We have a trip coming up.' },
      { role: 'assistant', content: 'We offer overnight boarding too! Our kennel-free philosophy means your dog sleeps in a comfortable, home-like environment. Rates depend on the length of stay, and we offer discounts for extended bookings.' },
      { role: 'customer', content: 'How far in advance should I book?' },
      { role: 'assistant', content: 'For boarding, I recommend booking at least 2 weeks in advance, especially during holiday periods. Summer and major holidays fill up fast! You can book right through the app.' },

      // Points & rewards
      { role: 'customer', content: 'I noticed I have some loyalty points. How do those work?' },
      { role: 'assistant', content: 'Great question! You earn 1 point per dollar spent on any service. Grooming services earn 1.5x points! You can redeem points for discounts: 100 points = $10 off, 250 points = $25 off, or 500 points = $50 off.' },
      { role: 'customer', content: 'So if I spend $45 on daycare I get 45 points?' },
      { role: 'assistant', content: 'Exactly right! And if you add a grooming service for, say, $60, that\'d earn 90 points (because of the 1.5x grooming multiplier). Points add up quickly!' },
      { role: 'customer', content: 'Nice! And there\'s a referral program too?' },
      { role: 'assistant', content: 'Yes! Share your referral code with friends. When they sign up and make their first booking, you both get bonus points. Check your referral code on the dashboard — it starts with HT-.' },

      // Feeding
      { role: 'customer', content: 'Can you feed Playwright during daycare? He eats at noon.' },
      { role: 'assistant', content: 'Of course! Just bring his food in a labeled container and let us know his feeding schedule when you drop off. We keep detailed notes for each pup to make sure everyone gets their meals on time.' },
      { role: 'customer', content: 'He\'s on a grain-free diet. Is that ok?' },
      { role: 'assistant', content: 'No problem at all! We accommodate all dietary needs. Just make sure to bring his specific food and any treats you want us to use. We won\'t give him anything that\'s not from his bag.' },

      // Report cards
      { role: 'customer', content: 'Do I get updates during the day?' },
      { role: 'assistant', content: 'Yes! You\'ll receive a daily report card through the app after each visit. It includes notes about your dog\'s activities, social behavior, meals, and mood. We sometimes include photos too!' },
      { role: 'customer', content: 'That\'s awesome. My wife would love that.' },
      { role: 'assistant', content: 'It\'s one of our most popular features! Many of our customers share the report cards on social media. Your pup becomes a little celebrity!' },

      // Second dog
      { role: 'customer', content: 'We also have a Labrador named Cypress. Can both come to daycare?' },
      { role: 'assistant', content: 'Absolutely! We love having siblings attend together. They\'ll be in the same play group since they\'re both large breeds. And remember, you get a multi-dog discount!' },
      { role: 'customer', content: 'Do they need separate vaccination records?' },
      { role: 'assistant', content: 'Yes, each dog needs their own up-to-date vaccination records. You can add Cypress to your profile in the app and upload his records there. Makes check-in much smoother!' },

      // Booking
      { role: 'customer', content: 'Ok I think I want to book a daycare day for next Tuesday. How do I do that?' },
      { role: 'assistant', content: 'Easy! Just tap the "Book" button on your dashboard or navigate to the booking page. Select Daycare, choose which dogs are coming, pick your date, and confirm. You can also add notes about anything we should know.' },
      { role: 'customer', content: 'Can I cancel if something comes up?' },
      { role: 'assistant', content: 'Yes! You can cancel up to 24 hours before your booking with no penalty. Same-day cancellations may be subject to our cancellation policy. You can cancel right from the bookings page in the app.' },

      // Weather & activities
      { role: 'customer', content: 'What do the dogs do all day? Is there outdoor time?' },
      { role: 'assistant', content: 'Our dogs enjoy a mix of supervised indoor and outdoor play time. We have a large fenced yard for running and fetch, plus indoor play areas for when the weather isn\'t ideal. We also have rest periods throughout the day.' },
      { role: 'customer', content: 'What if it rains?' },
      { role: 'assistant', content: 'We have plenty of indoor space! Our indoor play areas are climate-controlled and have lots of toys and activities. Rainy days are actually some of the most fun — the dogs love the indoor obstacle courses!' },

      // Safety
      { role: 'customer', content: 'How many staff members supervise the dogs?' },
      { role: 'assistant', content: 'We maintain a staff-to-dog ratio that ensures every pup gets proper attention. Our team members are trained in canine behavior, first aid, and CPR. There\'s always someone watching!' },
      { role: 'customer', content: 'What happens if a dog gets sick or injured?' },
      { role: 'assistant', content: 'We have a first aid kit on-site and staff trained in pet first aid. In case of a serious emergency, we\'ll contact you immediately and can transport to the nearest emergency vet. We take every precaution to keep pups safe.' },

      // Follow-up questions
      { role: 'customer', content: 'One more thing — do you have webcams so I can check in?' },
      { role: 'assistant', content: 'We don\'t have live webcams at this time, but our staff sends regular photo updates and you\'ll get that detailed report card at the end of each visit. Many of our customers find the report cards even better than cameras!' },
      { role: 'customer', content: 'Ok that makes sense. Thanks for all the info!' },
      { role: 'assistant', content: 'You\'re welcome! I\'m excited to meet Playwright and Cypress. Don\'t hesitate to reach out if you have any more questions. Happy tails! 🐕' },
      { role: 'customer', content: 'Actually wait — one more question about the membership' },
      { role: 'assistant', content: 'Of course! Ask away. I\'m here to help!' },
      { role: 'customer', content: 'Is the membership monthly or annual?' },
      { role: 'assistant', content: 'Our memberships are billed monthly, so you can cancel anytime. We offer a Gold plan and a VIP plan, each with included daycare days and additional discounts. The VIP plan includes grooming discounts too!' },
      { role: 'customer', content: 'How many days are included?' },
      { role: 'assistant', content: 'The Gold plan includes 8 daycare days per month, and the VIP plan includes 12 days. Any additional days beyond your plan are charged at a discounted member rate.' },
      { role: 'customer', content: 'Can I switch plans later?' },
      { role: 'assistant', content: 'Absolutely! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle. We make it easy and flexible!' },
      { role: 'customer', content: 'Ok I think I\'ll start with just pay-per-visit and see how it goes' },
      { role: 'assistant', content: 'That\'s a smart approach! You can always upgrade to a membership later once you see how often Playwright and Cypress visit. Your loyalty points will keep accumulating either way!' },

      // Closing
      { role: 'customer', content: 'Perfect. Thanks again for everything!' },
      { role: 'assistant', content: 'My pleasure! Looking forward to welcoming your pups. Have a wonderful day! 🐾' },
    ];

    // Create messages with sequential timestamps
    const baseTime = new Date();
    baseTime.setDate(baseTime.getDate() - 7); // Start from a week ago

    for (let i = 0; i < messageTopics.length; i++) {
      const timestamp = new Date(baseTime.getTime() + i * 2 * 60 * 1000); // 2 min apart
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: messageTopics[i].role,
          content: messageTopics[i].content,
          channel: 'web_chat',
          createdAt: timestamp,
        },
      });
    }

    // Update conversation lastMessageAt
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(baseTime.getTime() + (messageTopics.length - 1) * 2 * 60 * 1000),
      },
    });

    console.log(`Created conversation with ${messageTopics.length} messages (id: ${conversation.id})`);
  }

  // ── 4. Confirmed daycare booking ───────────────────────────────────

  const existingBookings = await prisma.booking.findMany({
    where: { customerId: customer.id },
  });

  if (existingBookings.length > 0) {
    console.log(`Booking already exists (${existingBookings.length} found)`);
  } else {
    // Find or create daycare service type
    let daycareService = await prisma.serviceType.findUnique({
      where: { name: 'daycare' },
    });

    if (!daycareService) {
      console.log('Warning: daycare service type not found. Skipping booking creation.');
    } else {
      // Book for 3 days from now
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + 3);
      const dateOnly = new Date(bookingDate.toISOString().split('T')[0] + 'T00:00:00Z');

      const booking = await prisma.booking.create({
        data: {
          customerId: customer.id,
          serviceTypeId: daycareService.id,
          date: dateOnly,
          status: 'confirmed',
          totalCents: 4500, // $45
          notes: 'QA test booking — do not check in',
          dogs: {
            create: dogs.slice(0, 1).map(dog => ({ dogId: dog.id })),
          },
        },
      });

      console.log(`Created daycare booking for ${dateOnly.toISOString().split('T')[0]} (id: ${booking.id})`);
    }
  }

  // ── 5. Staff Account ───────────────────────────────────────────────

  const staffUsername = 'qa-staff';
  let staff = await prisma.staffUser.findUnique({ where: { username: staffUsername } });

  if (staff) {
    console.log(`Staff already exists: ${staffUsername} (id: ${staff.id})`);
  } else {
    const passwordHash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

    staff = await prisma.staffUser.create({
      data: {
        username: staffUsername,
        passwordHash,
        role: 'manager',
        firstName: 'QA',
        lastName: 'Staff',
        isActive: true,
      },
    });

    console.log(`Created staff: ${staffUsername} (id: ${staff.id})`);
  }

  // ── Summary ────────────────────────────────────────────────────────

  console.log('\n=== QA Account Summary ===');
  console.log(`Customer: ${customerEmail} / QaTest2026!`);
  console.log(`  - ID: ${customer.id}`);
  console.log(`  - Points: 150`);
  console.log(`  - Dogs: ${dogs.map(d => `${d.name} (${d.breed})`).join(', ')}`);
  console.log(`Staff: ${staffUsername} / QaTest2026!`);
  console.log(`  - ID: ${staff.id}`);
  console.log(`  - Role: manager`);
  console.log('\nDone!');
}

main()
  .catch((e) => {
    console.error('Error seeding QA accounts:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
