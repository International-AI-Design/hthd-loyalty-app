/**
 * Seed v2 data: ServiceTypes, CapacityRules, and a test wallet.
 * Run with: npx ts-node prisma/seed-v2.ts
 *
 * NOTE: Requires prisma generate after migration to work.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  // --- Capacity Rules (default = all days) ---
  await (prisma as any).capacityRule.upsert({
    where: {
      serviceTypeId_dayOfWeek_startTime: {
        serviceTypeId: daycare.id,
        dayOfWeek: null,
        startTime: null,
      },
    },
    update: { maxCapacity: 25 },
    create: {
      serviceTypeId: daycare.id,
      dayOfWeek: null, // all days
      maxCapacity: 25,
    },
  });
  console.log('  CapacityRule: Daycare = 25 dogs/day');

  await (prisma as any).capacityRule.upsert({
    where: {
      serviceTypeId_dayOfWeek_startTime: {
        serviceTypeId: boarding.id,
        dayOfWeek: null,
        startTime: null,
      },
    },
    update: { maxCapacity: 10 },
    create: {
      serviceTypeId: boarding.id,
      dayOfWeek: null,
      maxCapacity: 10,
    },
  });
  console.log('  CapacityRule: Boarding = 10 dogs/night');

  await (prisma as any).capacityRule.upsert({
    where: {
      serviceTypeId_dayOfWeek_startTime: {
        serviceTypeId: grooming.id,
        dayOfWeek: null,
        startTime: null,
      },
    },
    update: { maxCapacity: 8 },
    create: {
      serviceTypeId: grooming.id,
      dayOfWeek: null,
      maxCapacity: 8,
    },
  });
  console.log('  CapacityRule: Grooming = 8 slots/day');

  // --- Multi-dog discount (10% off 2nd+ dog for daycare) ---
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
  }).catch(() => {
    console.log('  PricingRule: multi_dog_discount already exists, skipping');
  });
  console.log('  PricingRule: 10% multi-dog discount for daycare (2+ dogs)');

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
