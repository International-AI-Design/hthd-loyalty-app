import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';

// Re-export prisma for convenience in tests
export { prisma };

// ---------------------------------------------------------------------------
// Factory helpers — each generates unique data to avoid conflicts
// ---------------------------------------------------------------------------

export async function createTestStaff(overrides?: Partial<{
  username: string;
  role: string;
  firstName: string;
  lastName: string;
}>) {
  const unique = crypto.randomUUID().slice(0, 8);
  const passwordHash = await bcrypt.hash('testpass123', 10);

  return prisma.staffUser.create({
    data: {
      username: overrides?.username ?? `teststaff-${unique}`,
      passwordHash,
      role: overrides?.role ?? 'admin',
      firstName: overrides?.firstName ?? 'Test',
      lastName: overrides?.lastName ?? `Staff-${unique}`,
      isActive: true,
    },
  });
}

export async function createTestCustomer(overrides?: Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}>) {
  const unique = crypto.randomUUID().slice(0, 8);

  return prisma.customer.create({
    data: {
      firstName: overrides?.firstName ?? 'Test',
      lastName: overrides?.lastName ?? `Customer-${unique}`,
      email: overrides?.email ?? `test-${unique}@example.com`,
      phone: overrides?.phone ?? `+1555${unique.replace(/\D/g, '').slice(0, 7).padEnd(7, '0')}`,
      referralCode: `HT-${unique.toUpperCase()}`,
      accountStatus: 'active',
    },
  });
}

export async function createTestDog(customerId: string, overrides?: Partial<{
  name: string;
  breed: string;
}>) {
  const unique = crypto.randomUUID().slice(0, 8);

  return prisma.dog.create({
    data: {
      customerId,
      name: overrides?.name ?? `Buddy-${unique}`,
      breed: overrides?.breed ?? 'Golden Retriever',
    },
  });
}

export async function createTestBooking(
  customerId: string,
  serviceTypeId: string,
  dogIds: string[],
  overrides?: Partial<{
    date: string;
    status: string;
  }>
) {
  const dateStr = overrides?.date ?? new Date().toISOString().split('T')[0];

  const booking = await prisma.booking.create({
    data: {
      customerId,
      serviceTypeId,
      date: new Date(dateStr + 'T00:00:00Z'),
      status: overrides?.status ?? 'confirmed',
      totalCents: 5000,
      dogs: {
        create: dogIds.map((dogId) => ({ dogId })),
      },
    },
    include: { dogs: true },
  });

  return booking;
}

/**
 * Get or create a service type by name (idempotent).
 */
export async function getOrCreateServiceType(name: string) {
  const existing = await prisma.serviceType.findUnique({ where: { name } });
  if (existing) return existing;

  const displayNames: Record<string, string> = {
    daycare: 'Daycare',
    boarding: 'Boarding',
    grooming: 'Grooming',
  };

  return prisma.serviceType.create({
    data: {
      name,
      displayName: displayNames[name] ?? name,
      basePriceCents: 5000,
    },
  });
}

/**
 * Clean up test data by deleting staff and customer records.
 * Removes dependent records first to avoid FK constraint violations.
 */
export async function cleanupTestData(staffIds: string[], customerIds: string[]) {
  // Clean up customer-owned records
  if (customerIds.length > 0) {
    await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
  }

  // Clean up staff-owned records that don't cascade automatically
  if (staffIds.length > 0) {
    // AIM conversations have FK to staff_users (no cascade)
    const aimConvos = await (prisma as any).aimConversation.findMany({
      where: { staffUserId: { in: staffIds } },
      select: { id: true },
    });
    const aimConvoIds = aimConvos.map((c: any) => c.id);
    if (aimConvoIds.length > 0) {
      await (prisma as any).aimMessage.deleteMany({ where: { conversationId: { in: aimConvoIds } } });
      await (prisma as any).aimConversation.deleteMany({ where: { id: { in: aimConvoIds } } });
    }

    await prisma.staffUser.deleteMany({ where: { id: { in: staffIds } } });
  }
}
