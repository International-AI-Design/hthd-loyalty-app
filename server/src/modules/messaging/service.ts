import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../../lib/prisma';
import { ConversationFilter, MessageListParams } from './types';
import { TOOL_DEFINITIONS, executeTool } from '../ai/tools';
import { buildContextForCustomerId } from '../ai/context';
import { buildWebChatSystemPrompt } from '../ai/prompts';

export class MessagingService {
  /**
   * Find an active web_chat conversation for a customer, or create a new one.
   */
  async getOrCreateConversation(customerId: string) {
    // Look for an existing active or escalated web_chat conversation
    const existing = await (prisma as any).conversation.findFirst({
      where: {
        customerId,
        channel: 'web_chat',
        status: { in: ['active', 'escalated'] },
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

    // Generate AI response with tool access
    const aiContent = await this.getAIResponse(conversationId, customerId);

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
   * Generate an AI response using Claude Haiku with tool access.
   * Builds full customer context, uses the web chat system prompt,
   * and loops on tool_use responses (max 3 rounds).
   * Falls back to a polite message if API key is missing or call fails.
   */
  private async getAIResponse(
    conversationId: string,
    customerId: string
  ): Promise<string> {
    const MAX_TOOL_ROUNDS = 3;

    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return "Thanks for your message! A team member will be with you shortly.";
      }

      // Build full customer context and system prompt
      const context = await buildContextForCustomerId(customerId);
      const systemPrompt = buildWebChatSystemPrompt(context);

      // Load conversation history from DB
      const history = await (prisma as any).message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true },
      });

      // Build messages array with user/assistant alternation
      const messages: Anthropic.MessageParam[] = [];
      for (const msg of history) {
        const role = msg.role === 'customer' ? 'user' as const : 'assistant' as const;
        const last = messages[messages.length - 1];
        if (last && last.role === role && typeof last.content === 'string' && typeof msg.content === 'string') {
          last.content = last.content + '\n' + msg.content;
        } else {
          messages.push({ role, content: msg.content });
        }
      }

      // Ensure first message is from user
      while (messages.length > 0 && messages[0].role !== 'user') {
        messages.shift();
      }

      if (messages.length === 0) {
        return "Hi there! How can I help you today?";
      }

      const client = new Anthropic({
        apiKey,
        ...(process.env.DATASOV_ADAPTER_URL && { baseURL: process.env.DATASOV_ADAPTER_URL }),
      });
      let rounds = 0;

      while (rounds < MAX_TOOL_ROUNDS) {
        rounds++;

        const response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system: systemPrompt,
          tools: TOOL_DEFINITIONS,
          messages,
        });

        // Final text response
        if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
          const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text');
          return textBlocks.map(b => b.text).join('\n') || "I'll connect you with a team member.";
        }

        // Tool use — execute and loop
        if (response.stop_reason === 'tool_use') {
          messages.push({ role: 'assistant', content: response.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const block of response.content) {
            if (block.type !== 'tool_use') continue;

            try {
              const result = await executeTool(
                block.name,
                block.input as Record<string, unknown>,
                customerId,
                conversationId
              );
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify(result),
              });
            } catch (error: unknown) {
              const errMsg = error instanceof Error ? error.message : 'Tool execution failed';
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: JSON.stringify({ error: errMsg }),
                is_error: true,
              });
            }
          }

          messages.push({ role: 'user', content: toolResults });
        }
      }

      // Exceeded max rounds
      return "I'm working on that but it's taking a bit longer than expected. Let me connect you with our team for help.";
    } catch (err) {
      console.error('[WebChat AI Error]', err instanceof Error ? err.message : err);
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
