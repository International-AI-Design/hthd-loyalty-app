import OpenAI from 'openai';
import { OrchestratorInput, OrchestratorOutput } from './types';
import { buildContext, findOrCreateConversation, storeMessage } from './context';
import { buildSystemPrompt } from './prompts';
import { TOOL_DEFINITIONS, executeTool } from './tools';
import { logger } from '../../middleware/security';

const MAX_TOOL_ROUNDS = 5;
const MODEL = 'gpt-4o';
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
 * Creates the OpenAI client. Returns null if the API key is missing so the
 * orchestrator can fall back to a static reply.
 */
function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY not set — AI orchestrator disabled');
    return null;
  }
  return new OpenAI({ apiKey });
}

/**
 * Main entry point for processing an inbound SMS message.
 *
 * 1. Loads customer context (dogs, bookings, wallet, history).
 * 2. Finds or creates a conversation record.
 * 3. Stores the inbound message.
 * 4. Calls GPT-4o in a tool-use loop (max 5 rounds).
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
  const historyMessages: OpenAI.ChatCompletionMessageParam[] = [];

  for (const msg of context.recentMessages) {
    if (msg.role === 'customer') {
      historyMessages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      historyMessages.push({ role: 'assistant', content: msg.content });
    }
    // Skip system/tool messages — they aren't part of the
    // conversational history sent to the model.
  }

  // Append the new inbound message
  historyMessages.push({ role: 'user', content: messageBody });

  // Clean up consecutive same-role messages for best results.
  const cleanedHistory = enforceAlternation(historyMessages);

  // Prepend the system message
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...cleanedHistory,
  ];

  // ── 7. Call GPT-4o in a tool-use loop ─────────────────────────────────
  const toolsUsed: string[] = [];
  let rounds = 0;

  try {
    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++;

      logger.info('AI orchestrator: calling GPT-4o', {
        conversationId,
        round: rounds,
        messageCount: messages.length,
      });

      const response = await client.chat.completions.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        tools: TOOL_DEFINITIONS,
        messages,
      });

      const choice = response.choices[0];
      const assistantMessage = choice.message;

      logger.info('AI orchestrator: GPT-4o responded', {
        conversationId,
        round: rounds,
        finishReason: choice.finish_reason,
        toolCallCount: assistantMessage.tool_calls?.length ?? 0,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      });

      // ── Final response (no more tools) ──────────────────────────────
      if (
        choice.finish_reason === 'stop' ||
        choice.finish_reason === 'length'
      ) {
        const responseText =
          assistantMessage.content ||
          "I'm sorry, I couldn't process that. Please try again or call us directly.";
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
      if (choice.finish_reason === 'tool_calls' && assistantMessage.tool_calls) {
        // Push the assistant's full response (with tool_calls)
        // into the conversation so the model sees it on the next round.
        messages.push(assistantMessage);

        // Execute every tool call and collect results
        const toolCallNames: string[] = [];

        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type !== 'function') continue;

          const toolName = toolCall.function.name;
          toolsUsed.push(toolName);
          toolCallNames.push(toolName);

          let toolInput: Record<string, unknown> = {};
          try {
            toolInput = JSON.parse(toolCall.function.arguments);
          } catch {
            // If argument parsing fails, pass empty object
          }

          logger.info('AI orchestrator: executing tool', {
            conversationId,
            tool: toolName,
            input: toolInput,
          });

          try {
            const result = await executeTool(
              toolName,
              toolInput,
              customerId,
              conversationId
            );
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
            logger.error('AI orchestrator: tool execution error', {
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

        // Store tool calls for the audit trail
        await storeMessage(
          conversationId,
          'system',
          `Tool calls: ${toolCallNames.join(', ')}`,
          { modelUsed: MODEL }
        );
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
 * Enforce message history constraints:
 * - The first message must be from the `user` role.
 * - Consecutive same-role text messages are merged with a newline.
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

    // Merge consecutive same-role messages (only when both are plain strings)
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
