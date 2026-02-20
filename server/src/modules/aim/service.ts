import Anthropic from '@anthropic-ai/sdk';
import { AimChatInput, AimChatOutput } from './types';
import { buildAimSystemPrompt } from './prompts';
import { AIM_TOOL_DEFINITIONS, executeAimTool } from './tools';
import { DashboardService } from '../dashboard/service';
import { prisma } from '../../lib/prisma';
import { logger } from '../../middleware/security';

const MAX_TOOL_ROUNDS = 5;
const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 2048;

const FALLBACK_RESPONSE =
  'AIM is currently offline — the ANTHROPIC_API_KEY is not configured. ' +
  'Please contact your system administrator.';

const MAX_ROUNDS_RESPONSE =
  "I'm working on that but it's taking longer than expected. " +
  'Could you try rephrasing your request or breaking it into smaller questions?';

const ERROR_RESPONSE =
  "Sorry, I ran into an issue processing your request. Please try again in a moment.";

const dashboardService = new DashboardService();

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn('ANTHROPIC_API_KEY not set — AIM disabled');
    return null;
  }
  return new Anthropic({
    apiKey,
    ...(process.env.DATASOV_ADAPTER_URL && {
      baseURL: process.env.DATASOV_ADAPTER_URL,
    }),
  });
}

/**
 * Main entry point for processing an AIM chat message from staff.
 */
export async function processAimMessage(
  input: AimChatInput
): Promise<AimChatOutput> {
  const { staffUserId, message, conversationId: existingConversationId } = input;
  const startTime = Date.now();

  // ── 1. Load staff user ──────────────────────────────────────────────
  const staffUser = await prisma.staffUser.findUnique({
    where: { id: staffUserId },
    select: { id: true, firstName: true, lastName: true, role: true },
  });

  if (!staffUser) {
    throw new Error('Staff user not found');
  }

  // ── 2. Find or create conversation ─────────────────────────────────
  let conversationId: string;
  if (existingConversationId) {
    // Verify ownership
    const existing = await (prisma as any).aimConversation.findFirst({
      where: { id: existingConversationId, staffUserId },
    });
    if (!existing) {
      throw new Error('Conversation not found');
    }
    conversationId = existingConversationId;
  } else {
    const conversation = await (prisma as any).aimConversation.create({
      data: {
        staffUserId,
        title: message.slice(0, 100),
      },
    });
    conversationId = conversation.id;
  }

  // ── 3. Store inbound message ────────────────────────────────────────
  await (prisma as any).aimMessage.create({
    data: {
      conversationId,
      role: 'user',
      content: message,
    },
  });

  // ── 4. Ensure we have an API client ─────────────────────────────────
  const client = getClient();
  if (!client) {
    await storeAimResponse(conversationId, FALLBACK_RESPONSE, 'none');
    return {
      responseText: FALLBACK_RESPONSE,
      conversationId,
      toolsUsed: [],
      modelUsed: 'none',
    };
  }

  // ── 5. Build context for system prompt ──────────────────────────────
  const today = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Denver' });

  const [facility, staffOnDuty, compliance] = await Promise.all([
    dashboardService.getFacilityStatus(today),
    dashboardService.getStaffOnDuty(today),
    dashboardService.getComplianceFlags(),
  ]);

  const systemPrompt = buildAimSystemPrompt({
    staffName: `${staffUser.firstName} ${staffUser.lastName}`,
    staffRole: staffUser.role,
    facility,
    staffOnDuty,
    compliance,
  });

  // ── 6. Build message history ────────────────────────────────────────
  const recentMessages = await (prisma as any).aimMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    take: 40,
  });

  const messages: Anthropic.MessageParam[] = [];
  for (const msg of recentMessages) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      messages.push({ role: 'assistant', content: msg.content });
    }
  }

  const cleanedMessages = enforceAlternation(messages);

  // ── 7. Call Claude in a tool-use loop ───────────────────────────────
  const toolsUsed: string[] = [];
  let rounds = 0;

  try {
    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++;

      logger.info('AIM: calling Claude', {
        conversationId,
        round: rounds,
        messageCount: cleanedMessages.length,
      });

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: AIM_TOOL_DEFINITIONS,
        messages: cleanedMessages,
      });

      logger.info('AIM: Claude responded', {
        conversationId,
        round: rounds,
        stopReason: response.stop_reason,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      });

      // ── Final response (no more tools) ────────────────────────────
      if (
        response.stop_reason === 'end_turn' ||
        response.stop_reason === 'max_tokens'
      ) {
        const responseText = extractText(response.content);
        await storeAimResponse(conversationId, responseText, MODEL, toolsUsed);

        const elapsed = Date.now() - startTime;
        logger.info('AIM: complete', {
          conversationId,
          rounds,
          toolsUsed,
          responseLength: responseText.length,
          elapsedMs: elapsed,
        });

        return {
          responseText,
          conversationId,
          toolsUsed,
          modelUsed: MODEL,
        };
      }

      // ── Tool use — execute tools and loop ─────────────────────────
      if (response.stop_reason === 'tool_use') {
        cleanedMessages.push({
          role: 'assistant',
          content: response.content,
        });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          toolsUsed.push(block.name);

          logger.info('AIM: executing tool', {
            conversationId,
            tool: block.name,
            input: block.input,
          });

          try {
            const result = await executeAimTool(
              block.name,
              block.input as Record<string, unknown>
            );
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          } catch (error: unknown) {
            const errMsg =
              error instanceof Error
                ? error.message
                : 'Tool execution failed';
            logger.error('AIM: tool execution error', {
              conversationId,
              tool: block.name,
              error: errMsg,
            });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify({ error: errMsg }),
              is_error: true,
            });
          }
        }

        cleanedMessages.push({ role: 'user', content: toolResults });
      }
    }

    // ── Exceeded max tool rounds ────────────────────────────────────
    logger.warn('AIM: max tool rounds exceeded', {
      conversationId,
      rounds,
      toolsUsed,
    });

    await storeAimResponse(conversationId, MAX_ROUNDS_RESPONSE, MODEL);

    return {
      responseText: MAX_ROUNDS_RESPONSE,
      conversationId,
      toolsUsed,
      modelUsed: MODEL,
    };
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('AIM: unhandled error', {
      conversationId,
      staffUserId,
      rounds,
      toolsUsed,
      error: errMsg,
    });

    await storeAimResponse(conversationId, ERROR_RESPONSE, 'error');

    return {
      responseText: ERROR_RESPONSE,
      conversationId,
      toolsUsed,
      modelUsed: 'error',
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

async function storeAimResponse(
  conversationId: string,
  content: string,
  modelUsed: string,
  toolsUsed?: string[]
): Promise<void> {
  await (prisma as any).aimMessage.create({
    data: {
      conversationId,
      role: 'assistant',
      content,
      modelUsed,
      ...(toolsUsed && toolsUsed.length > 0
        ? { toolCalls: toolsUsed }
        : {}),
    },
  });

  // Touch conversation updatedAt
  await (prisma as any).aimConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

function extractText(content: Anthropic.ContentBlock[]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text' && block.text.length > 0) {
      parts.push(block.text);
    }
  }
  return (
    parts.join('\n') ||
    "I couldn't generate a response. Please try again."
  );
}

function enforceAlternation(
  messages: Anthropic.MessageParam[]
): Anthropic.MessageParam[] {
  if (messages.length === 0) return [];

  const cleaned: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    const last = cleaned[cleaned.length - 1];

    if (
      last &&
      last.role === msg.role &&
      typeof last.content === 'string' &&
      typeof msg.content === 'string'
    ) {
      last.content = last.content + '\n' + msg.content;
      continue;
    }

    cleaned.push({ role: msg.role, content: msg.content });
  }

  while (cleaned.length > 0 && cleaned[0].role !== 'user') {
    cleaned.shift();
  }

  return cleaned;
}
