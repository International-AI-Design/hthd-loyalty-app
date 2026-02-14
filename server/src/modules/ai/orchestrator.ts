import Anthropic from '@anthropic-ai/sdk';
import { OrchestratorInput, OrchestratorOutput } from './types';
import { buildContext, findOrCreateConversation, storeMessage } from './context';
import { buildSystemPrompt } from './prompts';
import { TOOL_DEFINITIONS, executeTool } from './tools';
import { logger } from '../../middleware/security';

const MAX_TOOL_ROUNDS = 5;
const MODEL = 'claude-sonnet-4-5-20250929';
const MAX_TOKENS = 1024;

const FALLBACK_RESPONSE =
  'Thanks for texting Happy Tail Happy Dog! Our AI assistant is currently offline. ' +
  'Please call us or visit https://hthd.internationalaidesign.com to manage your bookings.';

const MAX_ROUNDS_RESPONSE =
  "I'm working on that but it's taking longer than expected. " +
  'Let me connect you with our team for help. You can also manage bookings at ' +
  'https://hthd.internationalaidesign.com';

const ERROR_RESPONSE =
  "Sorry, I'm having trouble right now. Please try again in a moment or call us directly. " +
  'You can also visit https://hthd.internationalaidesign.com';

/**
 * Creates the Anthropic client. Returns null if the API key is missing so the
 * orchestrator can fall back to a static reply.
 */
function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn('ANTHROPIC_API_KEY not set — AI orchestrator disabled');
    return null;
  }
  return new Anthropic({
    apiKey,
    ...(process.env.DATASOV_ADAPTER_URL && { baseURL: process.env.DATASOV_ADAPTER_URL }),
  });
}

/**
 * Main entry point for processing an inbound SMS message.
 *
 * 1. Loads customer context (dogs, bookings, wallet, history).
 * 2. Finds or creates a conversation record.
 * 3. Stores the inbound message.
 * 4. Calls Claude in a tool-use loop (max 5 rounds).
 * 5. Stores the AI response and returns it.
 */
export async function processMessage(
  input: OrchestratorInput
): Promise<OrchestratorOutput> {
  const { phoneNumber, messageBody, twilioSid } = input;
  const startTime = Date.now();

  // ── 1. Build context ──────────────────────────────────────────────────
  const context = await buildContext(phoneNumber);
  const customerId = context.customer?.id ?? null;

  logger.info('AI orchestrator: processing message', {
    phoneNumber,
    customerId,
    isKnownCustomer: customerId !== null,
    messageLength: messageBody.length,
  });

  // ── 2. Find or create conversation ────────────────────────────────────
  const conversationId = await findOrCreateConversation(
    phoneNumber,
    customerId
  );

  // ── 3. Store inbound message ──────────────────────────────────────────
  await storeMessage(conversationId, 'customer', messageBody, { twilioSid });

  // ── 4. Ensure we have an API client ───────────────────────────────────
  const client = getClient();
  if (!client) {
    await storeMessage(conversationId, 'assistant', FALLBACK_RESPONSE);
    return {
      responseText: FALLBACK_RESPONSE,
      conversationId,
      toolsUsed: [],
      modelUsed: 'none',
    };
  }

  // ── 5. Build the system prompt with full customer context ─────────────
  const systemPrompt = buildSystemPrompt(context);

  // ── 6. Build message history ──────────────────────────────────────────
  //   Recent messages from DB (already in chronological order) +
  //   the new inbound message at the end.
  const messages: Anthropic.MessageParam[] = [];

  for (const msg of context.recentMessages) {
    if (msg.role === 'customer') {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      messages.push({ role: 'assistant', content: msg.content });
    }
    // Skip system/tool messages — they aren't part of the
    // conversational history sent to Claude.
  }

  // Append the new inbound message
  messages.push({ role: 'user', content: messageBody });

  // Claude requires strict user/assistant alternation and the first
  // message must be from the user role.
  const cleanedMessages = enforceAlternation(messages);

  // ── 7. Call Claude in a tool-use loop ─────────────────────────────────
  const toolsUsed: string[] = [];
  let rounds = 0;

  try {
    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++;

      logger.info('AI orchestrator: calling Claude', {
        conversationId,
        round: rounds,
        messageCount: cleanedMessages.length,
      });

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: TOOL_DEFINITIONS,
        messages: cleanedMessages,
      });

      logger.info('AI orchestrator: Claude responded', {
        conversationId,
        round: rounds,
        stopReason: response.stop_reason,
        contentBlocks: response.content.length,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
      });

      // ── Final response (no more tools) ──────────────────────────────
      if (
        response.stop_reason === 'end_turn' ||
        response.stop_reason === 'max_tokens'
      ) {
        const responseText = extractText(response.content);
        await storeMessage(conversationId, 'assistant', responseText, {
          modelUsed: MODEL,
          intent:
            toolsUsed.length > 0 ? toolsUsed.join(',') : 'conversation',
        });

        const elapsed = Date.now() - startTime;
        logger.info('AI orchestrator: complete', {
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

      // ── Tool use — execute tools and loop ───────────────────────────
      if (response.stop_reason === 'tool_use') {
        // Push the assistant's full response (text + tool_use blocks)
        // into the conversation so Claude sees it on the next round.
        cleanedMessages.push({
          role: 'assistant',
          content: response.content,
        });

        // Execute every tool_use block and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          toolsUsed.push(block.name);

          logger.info('AI orchestrator: executing tool', {
            conversationId,
            tool: block.name,
            input: block.input,
          });

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
            const errMsg =
              error instanceof Error
                ? error.message
                : 'Tool execution failed';
            logger.error('AI orchestrator: tool execution error', {
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

        // Store tool calls for the audit trail
        await storeMessage(
          conversationId,
          'system',
          `Tool calls: ${toolsUsed.join(', ')}`,
          { toolCalls: toolResults, modelUsed: MODEL }
        );

        // Feed tool results back so Claude can continue
        cleanedMessages.push({ role: 'user', content: toolResults });
      }
    }

    // ── Exceeded max tool rounds ──────────────────────────────────────
    logger.warn('AI orchestrator: max tool rounds exceeded', {
      conversationId,
      rounds,
      toolsUsed,
    });

    await storeMessage(conversationId, 'assistant', MAX_ROUNDS_RESPONSE, {
      modelUsed: MODEL,
    });

    return {
      responseText: MAX_ROUNDS_RESPONSE,
      conversationId,
      toolsUsed,
      modelUsed: MODEL,
    };
  } catch (error: unknown) {
    const errMsg =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('AI orchestrator: unhandled error', {
      conversationId,
      phoneNumber,
      rounds,
      toolsUsed,
      error: errMsg,
    });

    await storeMessage(conversationId, 'assistant', ERROR_RESPONSE);

    return {
      responseText: ERROR_RESPONSE,
      conversationId,
      toolsUsed,
      modelUsed: 'error',
    };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the final text from Claude's response content blocks.
 * If no text block is found, returns a graceful default.
 */
function extractText(content: Anthropic.ContentBlock[]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text' && block.text.length > 0) {
      parts.push(block.text);
    }
  }
  return (
    parts.join('\n') ||
    "I'm sorry, I couldn't process that. Please try again or call us directly."
  );
}

/**
 * Enforce Claude's message history constraints:
 * - The first message must be from the `user` role.
 * - Messages must strictly alternate between `user` and `assistant`.
 * - Consecutive same-role text messages are merged with a newline.
 *
 * NOTE: This only applies to the initial history we build from the DB.
 * During the tool-use loop the messages will contain content block arrays
 * (tool_use / tool_result) that naturally satisfy the alternation rule.
 */
function enforceAlternation(
  messages: Anthropic.MessageParam[]
): Anthropic.MessageParam[] {
  if (messages.length === 0) return [];

  const cleaned: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    const last = cleaned[cleaned.length - 1];

    // Merge consecutive same-role messages (only when both are plain strings)
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

  // Drop any leading assistant messages
  while (cleaned.length > 0 && cleaned[0].role !== 'user') {
    cleaned.shift();
  }

  return cleaned;
}
