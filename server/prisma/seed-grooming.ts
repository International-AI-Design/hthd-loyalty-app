/**
 * Seed grooming data: GroomingSubService, GroomingServicePrice,
 * GroomingPriceTier, and GroomingAddOn.
 *
 * Safe to run multiple times — uses upsert throughout.
 * Run with: npm run seed:grooming
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding grooming data...\n');

  // ─── Grooming Sub-Services ───────────────────────────────────────
  const subServices = [
    {
      name: 'nails',
      displayName: 'Nail Trim',
      description: 'Nail trimming and filing',
      basePriceCents: 2000,
      isCoatRelated: false,
      sortOrder: 1,
    },
    {
      name: 'ear_cleaning',
      displayName: 'Ear Cleaning',
      description: 'Gentle ear cleaning and inspection',
      basePriceCents: 1500,
      isCoatRelated: false,
      sortOrder: 2,
    },
    {
      name: 'bath',
      displayName: 'Bath & Dry',
      description: 'Shampoo, blow-dry, and brush-out',
      basePriceCents: 5500,
      isCoatRelated: true,
      sortOrder: 3,
    },
    {
      name: 'cut',
      displayName: 'Bath & Haircut',
      description: 'Full bath plus breed-style haircut',
      basePriceCents: 7500,
      isCoatRelated: true,
      sortOrder: 4,
    },
    {
      name: 'full_groom',
      displayName: 'Full Groom',
      description: 'Bath, haircut, nails, ears, and finishing',
      basePriceCents: 8500,
      isCoatRelated: true,
      sortOrder: 5,
    },
  ];

  const seededSubServices: Record<string, string> = {};

  for (const ss of subServices) {
    const result = await (prisma as any).groomingSubService.upsert({
      where: { name: ss.name },
      update: {
        displayName: ss.displayName,
        description: ss.description,
        basePriceCents: ss.basePriceCents,
        isCoatRelated: ss.isCoatRelated,
        sortOrder: ss.sortOrder,
      },
      create: ss,
    });
    seededSubServices[ss.name] = result.id;
    console.log(
      `  SubService: ${result.displayName} — base $${(result.basePriceCents / 100).toFixed(2)}`,
    );
  }

  // ─── Size-Based Pricing per Sub-Service ──────────────────────────
  // GroomingServicePrice links a sub-service to a size with a specific price.
  // Non-coat-related services (nails, ear cleaning) have a single null-size price.
  // Coat-related services have per-size pricing.
  const servicePrices: Array<{
    subServiceName: string;
    sizeCategory: string | null;
    priceCents: number;
  }> = [
    // Nail Trim — flat price regardless of size
    { subServiceName: 'nails', sizeCategory: null, priceCents: 2000 },

    // Ear Cleaning — flat price regardless of size
    { subServiceName: 'ear_cleaning', sizeCategory: null, priceCents: 1500 },

    // Bath & Dry — size-based
    { subServiceName: 'bath', sizeCategory: 'small', priceCents: 2500 },
    { subServiceName: 'bath', sizeCategory: 'medium', priceCents: 3500 },
    { subServiceName: 'bath', sizeCategory: 'large', priceCents: 4500 },
    { subServiceName: 'bath', sizeCategory: 'xl', priceCents: 5500 },

    // Bath & Haircut — size-based
    { subServiceName: 'cut', sizeCategory: 'small', priceCents: 4500 },
    { subServiceName: 'cut', sizeCategory: 'medium', priceCents: 6000 },
    { subServiceName: 'cut', sizeCategory: 'large', priceCents: 7500 },
    { subServiceName: 'cut', sizeCategory: 'xl', priceCents: 9500 },

    // Full Groom — size-based
    { subServiceName: 'full_groom', sizeCategory: 'small', priceCents: 6500 },
    { subServiceName: 'full_groom', sizeCategory: 'medium', priceCents: 8000 },
    { subServiceName: 'full_groom', sizeCategory: 'large', priceCents: 9500 },
    { subServiceName: 'full_groom', sizeCategory: 'xl', priceCents: 11500 },
  ];

  let priceCount = 0;
  for (const sp of servicePrices) {
    const subServiceId = seededSubServices[sp.subServiceName];
    await (prisma as any).groomingServicePrice.upsert({
      where: {
        subServiceId_sizeCategory: {
          subServiceId,
          sizeCategory: sp.sizeCategory,
        },
      },
      update: { priceCents: sp.priceCents },
      create: {
        subServiceId,
        sizeCategory: sp.sizeCategory,
        priceCents: sp.priceCents,
      },
    });
    priceCount++;
  }
  console.log(`  ServicePrices: ${priceCount} price rows seeded`);

  // ─── Grooming Price Tiers (size × condition matrix) ──────────────
  // These are condition-based surcharges used for quoting.
  const priceTiers = [
    // Small
    { size: 'small', rating: 1, label: 'Normal', cents: 4500, mins: 60 },
    { size: 'small', rating: 2, label: 'Slightly Matted', cents: 5500, mins: 75 },
    { size: 'small', rating: 3, label: 'Moderately Matted', cents: 6500, mins: 90 },
    { size: 'small', rating: 4, label: 'Heavy', cents: 8000, mins: 105 },
    { size: 'small', rating: 5, label: 'Severe', cents: 9500, mins: 120 },
    // Medium
    { size: 'medium', rating: 1, label: 'Normal', cents: 6000, mins: 60 },
    { size: 'medium', rating: 2, label: 'Slightly Matted', cents: 7000, mins: 75 },
    { size: 'medium', rating: 3, label: 'Moderately Matted', cents: 8500, mins: 90 },
    { size: 'medium', rating: 4, label: 'Heavy', cents: 10000, mins: 120 },
    { size: 'medium', rating: 5, label: 'Severe', cents: 12000, mins: 150 },
    // Large
    { size: 'large', rating: 1, label: 'Normal', cents: 7500, mins: 75 },
    { size: 'large', rating: 2, label: 'Slightly Matted', cents: 9000, mins: 90 },
    { size: 'large', rating: 3, label: 'Moderately Matted', cents: 10500, mins: 105 },
    { size: 'large', rating: 4, label: 'Heavy', cents: 12500, mins: 135 },
    { size: 'large', rating: 5, label: 'Severe', cents: 15000, mins: 165 },
    // XL
    { size: 'xl', rating: 1, label: 'Normal', cents: 9500, mins: 90 },
    { size: 'xl', rating: 2, label: 'Slightly Matted', cents: 11000, mins: 105 },
    { size: 'xl', rating: 3, label: 'Moderately Matted', cents: 13000, mins: 120 },
    { size: 'xl', rating: 4, label: 'Heavy', cents: 15500, mins: 150 },
    { size: 'xl', rating: 5, label: 'Severe', cents: 18500, mins: 180 },
  ];

  for (const row of priceTiers) {
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
  console.log(`  PriceTiers: ${priceTiers.length} condition-based tiers seeded`);

  // ─── Grooming Add-Ons ───────────────────────────────────────────
  const addOns = [
    {
      name: 'deshedding',
      displayName: 'De-shedding Treatment',
      description: 'Deep undercoat removal to reduce shedding at home',
      priceCents: 2000,
      sortOrder: 1,
    },
    {
      name: 'teeth_brushing',
      displayName: 'Teeth Brushing',
      description: 'Gentle brushing with dog-safe toothpaste',
      priceCents: 1000,
      sortOrder: 2,
    },
    {
      name: 'paw_moisturizing',
      displayName: 'Paw Pad Moisturizing',
      description: 'Moisturizing balm for dry or cracked paw pads',
      priceCents: 800,
      sortOrder: 3,
    },
    {
      name: 'bandana',
      displayName: 'Bandana / Bow',
      description: 'Finishing touch — choose a bandana or bow',
      priceCents: 500,
      sortOrder: 4,
    },
  ];

  for (const addon of addOns) {
    const result = await (prisma as any).groomingAddOn.upsert({
      where: { name: addon.name },
      update: {
        displayName: addon.displayName,
        description: addon.description,
        priceCents: addon.priceCents,
        sortOrder: addon.sortOrder,
      },
      create: addon,
    });
    console.log(
      `  AddOn: ${result.displayName} — $${(result.priceCents / 100).toFixed(2)}`,
    );
  }

  console.log('\nGrooming seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
