import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/lib/prisma';

const SALT_ROUNDS = 10;

// Generate unique codes
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'HT-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateRedemptionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'RD-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Sample staff data
const staffUsers = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    firstName: 'Sarah',
    lastName: 'Manager',
  },
  {
    username: 'staff1',
    password: 'staff123',
    role: 'staff',
    firstName: 'Mike',
    lastName: 'Receptionist',
  },
  {
    username: 'groomer1',
    password: 'groomer123',
    role: 'groomer',
    firstName: 'Emma',
    lastName: 'Groomer',
  },
];

// Sample customer data with realistic names
const customers = [
  { firstName: 'John', lastName: 'Smith', email: 'john.smith@email.com', phone: '5551234567' },
  { firstName: 'Maria', lastName: 'Garcia', email: 'maria.garcia@email.com', phone: '5552345678' },
  { firstName: 'David', lastName: 'Johnson', email: 'david.johnson@email.com', phone: '5553456789' },
  { firstName: 'Jennifer', lastName: 'Brown', email: 'jennifer.brown@email.com', phone: '5554567890' },
  { firstName: 'Michael', lastName: 'Davis', email: 'michael.davis@email.com', phone: '5555678901' },
  { firstName: 'Lisa', lastName: 'Miller', email: 'lisa.miller@email.com', phone: '5556789012' },
  { firstName: 'Robert', lastName: 'Wilson', email: 'robert.wilson@email.com', phone: '5557890123' },
  { firstName: 'Emily', lastName: 'Anderson', email: 'emily.anderson@email.com', phone: '5558901234' },
  { firstName: 'James', lastName: 'Taylor', email: 'james.taylor@email.com', phone: '5559012345' },
  { firstName: 'Ashley', lastName: 'Thomas', email: 'ashley.thomas@email.com', phone: '5550123456' },
  { firstName: 'Chris', lastName: 'Martinez', email: 'chris.martinez@email.com', phone: '5551122334' },
  { firstName: 'Amanda', lastName: 'Jackson', email: 'amanda.jackson@email.com', phone: '5552233445' },
];

// Sample transactions for each customer
const transactionTemplates = [
  { type: 'purchase', serviceType: 'daycare', dollarAmount: 45, description: 'Full day daycare' },
  { type: 'purchase', serviceType: 'daycare', dollarAmount: 25, description: 'Half day daycare' },
  { type: 'purchase', serviceType: 'boarding', dollarAmount: 65, description: 'Overnight boarding' },
  { type: 'purchase', serviceType: 'boarding', dollarAmount: 195, description: 'Weekend boarding (3 nights)' },
  { type: 'purchase', serviceType: 'grooming', dollarAmount: 55, description: 'Full grooming package' },
  { type: 'purchase', serviceType: 'grooming', dollarAmount: 35, description: 'Bath and brush' },
  { type: 'purchase', serviceType: 'grooming', dollarAmount: 75, description: 'Premium spa grooming' },
];

// Reward tier configuration
const REWARD_TIERS: Record<number, number> = {
  100: 10,
  250: 25,
  500: 50,
};

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('REFUSING to seed in production environment. Set NODE_ENV to something else to seed.');
    process.exit(1);
  }

  console.log('🌱 Starting seed...');

  // 1. Create staff users (upsert for idempotency)
  console.log('Creating staff users...');
  const createdStaff: { id: string; username: string }[] = [];

  for (const staff of staffUsers) {
    const passwordHash = await bcrypt.hash(staff.password, SALT_ROUNDS);
    const created = await prisma.staffUser.upsert({
      where: { username: staff.username },
      update: {
        passwordHash,
        role: staff.role,
        firstName: staff.firstName,
        lastName: staff.lastName,
        isActive: true,
      },
      create: {
        username: staff.username,
        passwordHash,
        role: staff.role,
        firstName: staff.firstName,
        lastName: staff.lastName,
        isActive: true,
      },
    });
    createdStaff.push({ id: created.id, username: created.username });
    console.log(`  ✓ Staff: ${staff.username} (${staff.role})`);
  }

  // 2. Create customers (upsert for idempotency)
  console.log('Creating customers...');
  const createdCustomers: { id: string; email: string; pointsBalance: number }[] = [];

  for (const customer of customers) {
    const passwordHash = await bcrypt.hash('password123', SALT_ROUNDS);

    // Check if customer exists
    const existing = await prisma.customer.findUnique({
      where: { email: customer.email },
    });

    let referralCode = existing?.referralCode;
    if (!referralCode) {
      // Generate unique referral code
      let attempts = 0;
      referralCode = generateReferralCode();
      while (attempts < 5) {
        const codeExists = await prisma.customer.findUnique({
          where: { referralCode },
        });
        if (!codeExists) break;
        referralCode = generateReferralCode();
        attempts++;
      }
    }

    const created = await prisma.customer.upsert({
      where: { email: customer.email },
      update: {
        passwordHash,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
      },
      create: {
        email: customer.email,
        phone: customer.phone,
        passwordHash,
        firstName: customer.firstName,
        lastName: customer.lastName,
        referralCode,
        pointsBalance: 0,
      },
    });
    createdCustomers.push({ id: created.id, email: created.email, pointsBalance: created.pointsBalance });
    console.log(`  ✓ Customer: ${customer.firstName} ${customer.lastName} (${customer.email})`);
  }

  // 3. Create points transactions for each customer
  console.log('Creating points transactions...');
  const adminStaff = createdStaff.find(s => s.username === 'admin');

  for (const customer of createdCustomers) {
    // Check if customer already has transactions (for idempotency)
    const existingTxns = await prisma.pointsTransaction.count({
      where: { customerId: customer.id },
    });

    if (existingTxns === 0) {
      // Give each customer 3-6 random transactions
      const numTransactions = Math.floor(Math.random() * 4) + 3;
      let totalPoints = 0;

      for (let i = 0; i < numTransactions; i++) {
        const template = transactionTemplates[Math.floor(Math.random() * transactionTemplates.length)];
        const multiplier = template.serviceType === 'grooming' ? 1.5 : 1;
        const points = Math.floor(template.dollarAmount * multiplier);
        totalPoints += points;

        // Create transaction with backdated created_at
        const daysAgo = Math.floor(Math.random() * 60) + 1;
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);

        await prisma.pointsTransaction.create({
          data: {
            customerId: customer.id,
            type: template.type,
            amount: points,
            description: template.description,
            serviceType: template.serviceType,
            dollarAmount: template.dollarAmount,
            createdAt,
          },
        });
      }

      // Update customer points balance
      await prisma.customer.update({
        where: { id: customer.id },
        data: { pointsBalance: totalPoints },
      });

      console.log(`  ✓ ${customer.email}: ${numTransactions} transactions, ${totalPoints} points`);
    } else {
      console.log(`  - ${customer.email}: Already has transactions, skipping`);
    }
  }

  // Refresh customer balances for redemption processing
  const refreshedCustomers = await prisma.customer.findMany({
    where: {
      email: { in: createdCustomers.map(c => c.email) },
    },
    select: { id: true, email: true, pointsBalance: true, firstName: true, lastName: true },
  });

  // 4. Create sample redemptions (pending and completed)
  console.log('Creating redemptions...');

  // Create 3 pending redemptions for customers with enough points
  const customersWithEnoughPoints = refreshedCustomers.filter(c => c.pointsBalance >= 100);
  let pendingCount = 0;
  let completedCount = 0;

  for (const customer of customersWithEnoughPoints.slice(0, 3)) {
    // Check if customer already has a pending redemption
    const existingPending = await prisma.redemption.findFirst({
      where: {
        customerId: customer.id,
        status: 'pending',
      },
    });

    if (!existingPending) {
      // Find the highest tier they can afford
      let tier = 100;
      if (customer.pointsBalance >= 500) tier = 500;
      else if (customer.pointsBalance >= 250) tier = 250;

      // Generate unique redemption code
      let redemptionCode = generateRedemptionCode();
      let attempts = 0;
      while (attempts < 5) {
        const codeExists = await prisma.redemption.findUnique({
          where: { redemptionCode },
        });
        if (!codeExists) break;
        redemptionCode = generateRedemptionCode();
        attempts++;
      }

      await prisma.redemption.create({
        data: {
          customerId: customer.id,
          redemptionCode,
          rewardTier: tier,
          discountValue: REWARD_TIERS[tier],
          status: 'pending',
        },
      });

      pendingCount++;
      console.log(`  ✓ Pending: ${customer.firstName} ${customer.lastName} - ${tier} pts ($${REWARD_TIERS[tier]})`);
    }
  }

  // Create 4 completed redemptions (for customers with history)
  for (const customer of customersWithEnoughPoints.slice(3, 7)) {
    if (!customer) continue;

    // Check if customer already has a completed redemption
    const existingCompleted = await prisma.redemption.findFirst({
      where: {
        customerId: customer.id,
        status: 'completed',
      },
    });

    if (!existingCompleted && adminStaff) {
      const tier = 100; // Use lowest tier for completed

      // Generate unique redemption code
      let redemptionCode = generateRedemptionCode();
      let attempts = 0;
      while (attempts < 5) {
        const codeExists = await prisma.redemption.findUnique({
          where: { redemptionCode },
        });
        if (!codeExists) break;
        redemptionCode = generateRedemptionCode();
        attempts++;
      }

      // Backdate the redemption
      const daysAgo = Math.floor(Math.random() * 30) + 1;
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - daysAgo);
      const approvedAt = new Date(createdAt);
      approvedAt.setHours(approvedAt.getHours() + 2);

      await prisma.redemption.create({
        data: {
          customerId: customer.id,
          redemptionCode,
          rewardTier: tier,
          discountValue: REWARD_TIERS[tier],
          status: 'completed',
          approvedBy: adminStaff.id,
          approvedAt,
          createdAt,
        },
      });

      // Create the redemption transaction (points already deducted simulation)
      await prisma.pointsTransaction.create({
        data: {
          customerId: customer.id,
          type: 'redemption',
          amount: -tier,
          description: `Redeemed ${tier} points for $${REWARD_TIERS[tier]} discount`,
          createdAt: approvedAt,
        },
      });

      // Update customer balance
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          pointsBalance: { decrement: tier },
        },
      });

      completedCount++;
      console.log(`  ✓ Completed: ${customer.firstName} ${customer.lastName} - ${tier} pts ($${REWARD_TIERS[tier]})`);
    }
  }

  console.log(`\n✅ Seed complete!`);
  console.log(`   Staff users: ${createdStaff.length}`);
  console.log(`   Customers: ${createdCustomers.length}`);
  console.log(`   Pending redemptions: ${pendingCount}`);
  console.log(`   Completed redemptions: ${completedCount}`);
  console.log(`\n📝 Test credentials:`);
  console.log(`   Admin: admin / admin123`);
  console.log(`   Staff: staff1 / staff123`);
  console.log(`   Customer: john.smith@email.com / password123`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
