import { prisma } from '../../lib/prisma';
import { ConversationFilter, MessageListParams } from './types';

export class MessagingService {
  /**
   * Find an active web_chat conversation for a customer, or create a new one.
   */
  async getOrCreateConversation(customerId: string) {
    // Look for an existing active web_chat conversation
    const existing = await (prisma as any).conversation.findFirst({
      where: {
        customerId,
        channel: 'web_chat',
        status: 'active',
      },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (existing) {
      return existing;
    }

    // Create a new conversation
    const conversation = await (prisma as any).conversation.create({
      data: {
        customerId,
        channel: 'web_chat',
        status: 'active',
      },
      include: {
        messages: true,
      },
    });

    return conversation;
  }

  /**
   * Send a customer message and trigger an AI response.
   */
  async sendMessage(conversationId: string, customerId: string, content: string) {
    // Verify the conversation belongs to this customer
    const conversation = await (prisma as any).conversation.findFirst({
      where: { id: conversationId, customerId },
    });
    if (!conversation) {
      throw new MessagingError('Conversation not found', 404);
    }
    if (conversation.status === 'closed') {
      throw new MessagingError('Conversation is closed', 400);
    }

    // Create the customer message
    const customerMessage = await (prisma as any).message.create({
      data: {
        conversationId,
        role: 'customer',
        content,
        channel: 'web_chat',
      },
    });

    // Update conversation's lastMessageAt
    await (prisma as any).conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // If staff is assigned and conversation is escalated, skip AI response
    if (conversation.assignedStaffId && conversation.status === 'escalated') {
      return { customerMessage, aiMessage: null };
    }

    // Get conversation history for AI context
    const history = await (prisma as any).message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });

    // Generate AI response
    const aiContent = await this.getAIResponse(history);

    const aiMessage = await (prisma as any).message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: aiContent,
        channel: 'web_chat',
        modelUsed: 'haiku',
      },
    });

    // Update lastMessageAt again after AI response
    await (prisma as any).conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    return { customerMessage, aiMessage };
  }

  /**
   * List conversations for a customer with last message preview.
   */
  async getConversations(customerId: string, filter?: ConversationFilter) {
    const where: Record<string, any> = { customerId };
    if (filter?.status) where.status = filter.status;
    if (filter?.channel) where.channel = filter.channel;

    const conversations = await (prisma as any).conversation.findMany({
      where,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return conversations.map((conv: any) => ({
      id: conv.id,
      channel: conv.channel,
      status: conv.status,
      lastMessageAt: conv.lastMessageAt,
      messageCount: conv._count.messages,
      lastMessage: conv.messages[0] ?? null,
      createdAt: conv.createdAt,
    }));
  }

  /**
   * Get paginated messages for a conversation. Verifies customer ownership.
   */
  async getMessages(conversationId: string, customerId: string, params?: MessageListParams) {
    const conversation = await (prisma as any).conversation.findFirst({
      where: { id: conversationId, customerId },
    });
    if (!conversation) {
      throw new MessagingError('Conversation not found', 404);
    }

    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    const [messages, total] = await Promise.all([
      (prisma as any).message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          role: true,
          content: true,
          channel: true,
          createdAt: true,
        },
      }),
      (prisma as any).message.count({ where: { conversationId } }),
    ]);

    return { messages, total, limit, offset };
  }

  /**
   * Close a conversation. Customer can only close their own.
   */
  async closeConversation(conversationId: string, customerId: string) {
    const conversation = await (prisma as any).conversation.findFirst({
      where: { id: conversationId, customerId },
    });
    if (!conversation) {
      throw new MessagingError('Conversation not found', 404);
    }
    if (conversation.status === 'closed') {
      throw new MessagingError('Conversation is already closed', 400);
    }

    return (prisma as any).conversation.update({
      where: { id: conversationId },
      data: { status: 'closed' },
    });
  }

  // ========================
  // Admin / Staff Methods
  // ========================

  /**
   * Get all conversations with customer info and optional filters.
   */
  async getAllConversations(filter?: ConversationFilter) {
    const where: Record<string, any> = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.channel) where.channel = filter.channel;

    const conversations = await (prisma as any).conversation.findMany({
      where,
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        assignedStaff: {
          select: { id: true, firstName: true, lastName: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return conversations.map((conv: any) => ({
      id: conv.id,
      channel: conv.channel,
      status: conv.status,
      phoneNumber: conv.phoneNumber,
      customer: conv.customer,
      assignedStaff: conv.assignedStaff,
      lastMessageAt: conv.lastMessageAt,
      messageCount: conv._count.messages,
      lastMessage: conv.messages[0] ?? null,
      createdAt: conv.createdAt,
    }));
  }

  /**
   * Get all messages in a conversation (admin, no ownership check).
   */
  async getConversationMessages(conversationId: string) {
    const conversation = await (prisma as any).conversation.findUnique({
      where: { id: conversationId },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        assignedStaff: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    if (!conversation) {
      throw new MessagingError('Conversation not found', 404);
    }

    const messages = await (prisma as any).message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    return { conversation, messages };
  }

  /**
   * Assign a staff member to a conversation.
   */
  async assignStaff(conversationId: string, staffUserId: string) {
    const conversation = await (prisma as any).conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new MessagingError('Conversation not found', 404);
    }

    return (prisma as any).conversation.update({
      where: { id: conversationId },
      data: { assignedStaffId: staffUserId },
      include: {
        assignedStaff: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Staff sends a message in a conversation (role='assistant').
   */
  async sendStaffMessage(conversationId: string, staffUserId: string, content: string) {
    const conversation = await (prisma as any).conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new MessagingError('Conversation not found', 404);
    }

    const message = await (prisma as any).message.create({
      data: {
        conversationId,
        role: 'assistant',
        content,
        channel: conversation.channel,
      },
    });

    // Update conversation: assign staff if not already assigned, update lastMessageAt
    const updateData: Record<string, any> = { lastMessageAt: new Date() };
    if (!conversation.assignedStaffId) {
      updateData.assignedStaffId = staffUserId;
    }

    await (prisma as any).conversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    return message;
  }

  /**
   * Escalate a conversation (mark as needing human attention).
   */
  async escalateConversation(conversationId: string) {
    const conversation = await (prisma as any).conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new MessagingError('Conversation not found', 404);
    }

    return (prisma as any).conversation.update({
      where: { id: conversationId },
      data: { status: 'escalated' },
    });
  }

  /**
   * Generate an AI response using Claude Haiku.
   * Falls back to a polite message if API key is missing or call fails.
   */
  private async getAIResponse(
    messages: Array<{ role: string; content: string }>
  ): Promise<string> {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return "Thanks for your message! A team member will be with you shortly.";
      }

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: `You are a friendly assistant for Happy Tail Happy Dog, a premium dog daycare, boarding, and grooming facility in Denver, CO. Services: Daycare $37-47/day, Boarding $69/night, Grooming $95-167. Hours: 7am-7pm weekdays. Address: 4352 Cherokee St. Phone: (720) 654-8384. Be warm, helpful, concise. If unsure, say you'll connect them with a team member.`,
        messages: messages.slice(-10).map((m) => ({
          role: m.role === 'customer' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        })),
      });

      return response.content[0].type === 'text'
        ? response.content[0].text
        : "I'll connect you with a team member.";
    } catch {
      return "Thanks for your message! A team member will be with you shortly.";
    }
  }
}

/**
 * Custom error class for messaging operations with HTTP status codes.
 */
export class MessagingError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'MessagingError';
  }
}
