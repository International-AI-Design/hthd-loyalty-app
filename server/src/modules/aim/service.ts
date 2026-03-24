import OpenAI from 'openai';
import { AimChatInput, AimChatOutput } from './types';
import { buildAimSystemPrompt } from './prompts';
import { AIM_TOOL_DEFINITIONS, executeAimTool } from './tools';
import { DashboardService } from '../dashboard/service';
import { prisma } from '../../lib/prisma';
import { logger } from '../../middleware/security';

const MAX_TOOL_ROUNDS = 5;
const MODEL = 'gpt-4o';
const MAX_TOKENS = 2048;

const FALLBACK_RESPONSE =
  'AIM is currently offline — the OPENAI_API_KEY is not configured. ' +
  'Please contact your system administrator.';

const MAX_ROUNDS_RESPONSE =
  "I'm working on that but it's taking longer than expected. " +
  'Could you try rephrasing your request or breaking it into smaller questions?';

const ERROR_RESPONSE =
  "Sorry, I ran into an issue processing your request. Please try again in a moment.";

const dashboardService = new DashboardService();

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set — AIM disabled');
    return null;
  }
  return new OpenAI({ apiKey });
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

  const historyMessages: OpenAI.ChatCompletionMessageParam[] = [];
  for (const msg of recentMessages) {
    if (msg.role === 'user') {
      historyMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      historyMessages.push({ role: 'assistant', content: msg.content });
    }
  }

  const cleanedHistory = enforceAlternation(historyMessages);

  // Prepend the system message
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...cleanedHistory,
  ];

  // ── 7. Call GPT-4o in a tool-use loop ─────────────────────────────
  const toolsUsed: string[] = [];
  let rounds = 0;

  try {
    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++;

      logger.info('AIM: calling GPT-4o', {
        conversationId,
        round: rounds,
        messageCount: messages.length,
      });

      const response = await client.chat.completions.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        tools: AIM_TOOL_DEFINITIONS,
        messages,
      });

      const choice = response.choices[0];
      const assistantMessage = choice.message;

      logger.info('AIM: GPT-4o responded', {
        conversationId,
        round: rounds,
        finishReason: choice.finish_reason,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      });

      // ── Final response (no more tools) ────────────────────────────
      if (
        choice.finish_reason === 'stop' ||
        choice.finish_reason === 'length'
      ) {
        const responseText =
          assistantMessage.content ||
          "I couldn't generate a response. Please try again.";
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
      if (choice.finish_reason === 'tool_calls' && assistantMessage.tool_calls) {
        // Push the assistant message (with tool_calls) into conversation
        messages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type !== 'function') continue;
          const toolName = toolCall.function.name;
          toolsUsed.push(toolName);

          let toolInput: Record<string, unknown> = {};
          try {
            toolInput = JSON.parse(toolCall.function.arguments);
          } catch {
            // If argument parsing fails, pass empty object
          }

          logger.info('AIM: executing tool', {
            conversationId,
            tool: toolName,
            input: toolInput,
          });

          try {
            const result = await executeAimTool(toolName, toolInput);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } catch (error: unknown) {
            const errMsg =
              error instanceof Error
                ? error.message
                : 'Tool execution failed';
            logger.error('AIM: tool execution error', {
              conversationId,
              tool: toolName,
              error: errMsg,
            });
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: errMsg }),
            });
          }
        }
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

/**
 * Enforce message history constraints for OpenAI:
 * - Messages must start with a user message.
 * - Consecutive same-role text messages are merged.
 *
 * NOTE: The system message is added separately before this list.
 */
function enforceAlternation(
  messages: OpenAI.ChatCompletionMessageParam[]
): OpenAI.ChatCompletionMessageParam[] {
  if (messages.length === 0) return [];

  const cleaned: OpenAI.ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    const last = cleaned[cleaned.length - 1];

    if (
      last &&
      last.role === msg.role &&
      typeof last.content === 'string' &&
      typeof msg.content === 'string'
    ) {
      (last as { role: string; content: string }).content =
        last.content + '\n' + msg.content;
      continue;
    }

    cleaned.push({ ...msg });
  }

  // Drop any leading assistant messages
  while (cleaned.length > 0 && cleaned[0].role !== 'user') {
    cleaned.shift();
  }

  return cleaned;
}
