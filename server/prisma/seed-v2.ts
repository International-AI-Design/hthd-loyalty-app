/**
 * Seed v2 data: ServiceTypes, CapacityRules, and a test wallet.
 * Run with: npx ts-node prisma/seed-v2.ts
 *
 * NOTE: Requires prisma generate after migration to work.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding v2 data...');

  // --- Service Types ---
  const daycare = await (prisma as any).serviceType.upsert({
    where: { name: 'daycare' },
    update: {},
    create: {
      name: 'daycare',
      displayName: 'Daycare',
      description: 'Full-day dog daycare with supervised play and socialization',
      basePriceCents: 4500, // $45
      durationMinutes: null, // full day
      isActive: true,
      sortOrder: 1,
    },
  });
  console.log(`  ServiceType: ${daycare.displayName} ($${(daycare.basePriceCents / 100).toFixed(2)})`);

  const boarding = await (prisma as any).serviceType.upsert({
    where: { name: 'boarding' },
    update: {},
    create: {
      name: 'boarding',
      displayName: 'Boarding',
      description: 'Overnight boarding with daycare included',
      basePriceCents: 6500, // $65
      durationMinutes: null, // overnight
      isActive: true,
      sortOrder: 2,
    },
  });
  console.log(`  ServiceType: ${boarding.displayName} ($${(boarding.basePriceCents / 100).toFixed(2)})`);

  const grooming = await (prisma as any).serviceType.upsert({
    where: { name: 'grooming' },
    update: {},
    create: {
      name: 'grooming',
      displayName: 'Grooming',
      description: 'Professional grooming with bath, trim, and nail care',
      basePriceCents: 7500, // $75
      durationMinutes: 90,
      isActive: true,
      sortOrder: 3,
    },
  });
  console.log(`  ServiceType: ${grooming.displayName} ($${(grooming.basePriceCents / 100).toFixed(2)})`);

  // --- Capacity Rules (clear + recreate to avoid null composite key issues) ---
  await (prisma as any).capacityRule.deleteMany({});

  await (prisma as any).capacityRule.create({
    data: { serviceTypeId: daycare.id, maxCapacity: 25 },
  });
  console.log('  CapacityRule: Daycare = 25 dogs/day');

  await (prisma as any).capacityRule.create({
    data: { serviceTypeId: boarding.id, maxCapacity: 10 },
  });
  console.log('  CapacityRule: Boarding = 10 dogs/night');

  await (prisma as any).capacityRule.create({
    data: { serviceTypeId: grooming.id, maxCapacity: 8 },
  });
  console.log('  CapacityRule: Grooming = 8 slots/day');

  // --- Multi-dog discount (10% off 2nd+ dog for daycare) ---
  await (prisma as any).pricingRule.deleteMany({});
  await (prisma as any).pricingRule.create({
    data: {
      serviceTypeId: daycare.id,
      name: 'multi_dog_discount',
      type: 'percentage_discount',
      percentage: 10,
      minDogs: 2,
      isActive: true,
      priority: 1,
    },
  });
  console.log('  PricingRule: 10% multi-dog discount for daycare (2+ dogs)');

  // --- Grooming Time Slots (8 x 90-min slots, capacity 1 each) ---
  const groomingSlots = [
    { start: '07:00', end: '08:30' },
    { start: '08:30', end: '10:00' },
    { start: '10:00', end: '11:30' },
    { start: '11:30', end: '13:00' },
    { start: '13:00', end: '14:30' },
    { start: '14:30', end: '16:00' },
    { start: '16:00', end: '17:30' },
    { start: '17:30', end: '19:00' },
  ];

  for (const slot of groomingSlots) {
    await (prisma as any).capacityRule.create({
      data: {
        serviceTypeId: grooming.id,
        maxCapacity: 1,
        startTime: slot.start,
        endTime: slot.end,
      },
    });
  }
  console.log(`  CapacityRules: ${groomingSlots.length} grooming time slots (1 dog each)`);

  // --- Grooming Price Matrix (4 sizes × 5 condition ratings = 20 rows) ---
  const priceMatrix = [
    // Small
    { size: 'small', rating: 1, label: 'Normal',           cents: 4500,  mins: 60 },
    { size: 'small', rating: 2, label: 'Slightly Matted',  cents: 5500,  mins: 75 },
    { size: 'small', rating: 3, label: 'Moderately Matted', cents: 6500, mins: 90 },
    { size: 'small', rating: 4, label: 'Heavy',            cents: 8000,  mins: 105 },
    { size: 'small', rating: 5, label: 'Severe',           cents: 9500,  mins: 120 },
    // Medium
    { size: 'medium', rating: 1, label: 'Normal',           cents: 6000,  mins: 60 },
    { size: 'medium', rating: 2, label: 'Slightly Matted',  cents: 7000,  mins: 75 },
    { size: 'medium', rating: 3, label: 'Moderately Matted', cents: 8500, mins: 90 },
    { size: 'medium', rating: 4, label: 'Heavy',            cents: 10000, mins: 120 },
    { size: 'medium', rating: 5, label: 'Severe',           cents: 12000, mins: 150 },
    // Large
    { size: 'large', rating: 1, label: 'Normal',           cents: 7500,  mins: 75 },
    { size: 'large', rating: 2, label: 'Slightly Matted',  cents: 9000,  mins: 90 },
    { size: 'large', rating: 3, label: 'Moderately Matted', cents: 10500, mins: 105 },
    { size: 'large', rating: 4, label: 'Heavy',            cents: 12500, mins: 135 },
    { size: 'large', rating: 5, label: 'Severe',           cents: 15000, mins: 165 },
    // XL
    { size: 'xl', rating: 1, label: 'Normal',           cents: 9500,  mins: 90 },
    { size: 'xl', rating: 2, label: 'Slightly Matted',  cents: 11000, mins: 105 },
    { size: 'xl', rating: 3, label: 'Moderately Matted', cents: 13000, mins: 120 },
    { size: 'xl', rating: 4, label: 'Heavy',            cents: 15500, mins: 150 },
    { size: 'xl', rating: 5, label: 'Severe',           cents: 18500, mins: 180 },
  ];

  for (const row of priceMatrix) {
    await (prisma as any).groomingPriceTier.upsert({
      where: {
        sizeCategory_conditionRating: {
          sizeCategory: row.size,
          conditionRating: row.rating,
        },
      },
      update: {
        label: row.label,
        priceCents: row.cents,
        estimatedMinutes: row.mins,
      },
      create: {
        sizeCategory: row.size,
        conditionRating: row.rating,
        label: row.label,
        priceCents: row.cents,
        estimatedMinutes: row.mins,
      },
    });
  }
  console.log(`  GroomingPriceTier: ${priceMatrix.length} price tiers seeded`);

  // --- Promote admin staff user to 'owner' role ---
  const promoted = await prisma.staffUser.updateMany({
    where: { role: 'admin' },
    data: { role: 'owner' },
  });
  console.log(`  StaffUser: ${promoted.count} admin user(s) promoted to owner`);

  console.log('\nv2 seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
