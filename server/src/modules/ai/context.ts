import { prisma } from '../../lib/prisma';
import { ConversationContext } from './types';
import { logger } from '../../middleware/security';
import { normalizePhoneNumber } from '../sms/service';

export async function buildContext(phoneNumber: string): Promise<ConversationContext> {
  const normalized = normalizePhoneNumber(phoneNumber);

  const customer = await prisma.customer.findFirst({
    where: {
      OR: [
        { phone: normalized },
        { phone: phoneNumber },
        { phone: normalized.replace('+1', '') },
      ],
    },
    include: {
      dogs: true,
      wallet: true,
    },
  });

  if (!customer) {
    logger.info(`No customer found for phone: ${normalized}`);
    return {
      customer: null,
      dogs: [],
      upcomingBookings: [],
      walletBalance: null,
      recentMessages: [],
    };
  }

  const now = new Date();
  const upcomingBookings = await prisma.booking.findMany({
    where: {
      customerId: customer.id,
      status: { in: ['pending', 'confirmed', 'checked_in'] },
      OR: [
        { date: { gte: now } },
        { endDate: { gte: now } },
      ],
    },
    include: {
      serviceType: true,
      dogs: {
        include: { dog: true },
      },
    },
    orderBy: { date: 'asc' },
    take: 10,
  });

  // Load recent conversation messages for this customer
  const conversation = await prisma.conversation.findFirst({
    where: {
      customerId: customer.id,
      channel: 'sms',
      status: 'active',
    },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return {
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      pointsBalance: customer.pointsBalance,
    },
    dogs: customer.dogs.map((d) => ({
      id: d.id,
      name: d.name,
      breed: d.breed,
      sizeCategory: d.sizeCategory,
      birthDate: d.birthDate,
    })),
    upcomingBookings: upcomingBookings.map((b) => ({
      id: b.id,
      date: b.date,
      startDate: b.startDate,
      endDate: b.endDate,
      status: b.status,
      serviceType: b.serviceType.name,
      dogs: b.dogs.map((bd) => bd.dog.name),
      totalCents: b.totalCents,
    })),
    walletBalance: customer.wallet?.balanceCents ?? null,
    recentMessages: conversation
      ? conversation.messages.reverse().map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        }))
      : [],
  };
}

export async function buildContextForCustomerId(customerId: string): Promise<ConversationContext> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      dogs: true,
      wallet: true,
    },
  });

  if (!customer) {
    logger.info(`No customer found for ID: ${customerId}`);
    return {
      customer: null,
      dogs: [],
      upcomingBookings: [],
      walletBalance: null,
      recentMessages: [],
    };
  }

  const now = new Date();
  const upcomingBookings = await prisma.booking.findMany({
    where: {
      customerId: customer.id,
      status: { in: ['pending', 'confirmed', 'checked_in'] },
      OR: [
        { date: { gte: now } },
        { endDate: { gte: now } },
      ],
    },
    include: {
      serviceType: true,
      dogs: {
        include: { dog: true },
      },
    },
    orderBy: { date: 'asc' },
    take: 10,
  });

  // Load recent web_chat messages for this customer
  const conversation = await prisma.conversation.findFirst({
    where: {
      customerId: customer.id,
      channel: 'web_chat',
      status: 'active',
    },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return {
    customer: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      pointsBalance: customer.pointsBalance,
    },
    dogs: customer.dogs.map((d) => ({
      id: d.id,
      name: d.name,
      breed: d.breed,
      sizeCategory: d.sizeCategory,
      birthDate: d.birthDate,
    })),
    upcomingBookings: upcomingBookings.map((b) => ({
      id: b.id,
      date: b.date,
      startDate: b.startDate,
      endDate: b.endDate,
      status: b.status,
      serviceType: b.serviceType.name,
      dogs: b.dogs.map((bd) => bd.dog.name),
      totalCents: b.totalCents,
    })),
    walletBalance: customer.wallet?.balanceCents ?? null,
    recentMessages: conversation
      ? conversation.messages.reverse().map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        }))
      : [],
  };
}

export async function findOrCreateConversation(
  phoneNumber: string,
  customerId: string | null
): Promise<string> {
  const normalized = normalizePhoneNumber(phoneNumber);

  // Try to find an active SMS conversation for this phone
  const existing = await prisma.conversation.findFirst({
    where: {
      phoneNumber: normalized,
      channel: 'sms',
      status: 'active',
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (existing) return existing.id;

  // Create a new conversation
  // Split into explicit branches to satisfy Prisma's discriminated union types
  if (customerId) {
    const conversation = await prisma.conversation.create({
      data: {
        channel: 'sms',
        status: 'active',
        phoneNumber: normalized,
        customerId,
      },
    });
    logger.info(`Created new SMS conversation ${conversation.id} for ${normalized}`);
    return conversation.id;
  } else {
    const conversation = await prisma.conversation.create({
      data: {
        channel: 'sms',
        status: 'active',
        phoneNumber: normalized,
      },
    });
    logger.info(`Created new SMS conversation ${conversation.id} for ${normalized} (no customer)`);
    return conversation.id;
  }
}

export async function storeMessage(
  conversationId: string,
  role: string,
  content: string,
  metadata?: {
    intent?: string;
    confidence?: number;
    modelUsed?: string;
    toolCalls?: unknown;
    twilioSid?: string;
  }
): Promise<void> {
  await prisma.message.create({
    data: {
      conversationId,
      role,
      content,
      channel: 'sms',
      ...(metadata?.intent ? { intent: metadata.intent } : {}),
      ...(metadata?.confidence ? { confidence: metadata.confidence } : {}),
      ...(metadata?.modelUsed ? { modelUsed: metadata.modelUsed } : {}),
      ...(metadata?.toolCalls ? { toolCalls: metadata.toolCalls as any } : {}),
      ...(metadata?.twilioSid ? { twilioSid: metadata.twilioSid } : {}),
    },
  });

  // Update conversation's updatedAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}
