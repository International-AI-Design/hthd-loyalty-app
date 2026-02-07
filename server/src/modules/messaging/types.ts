import { z } from 'zod';

export const SendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const ConversationFilterSchema = z.object({
  status: z.enum(['active', 'closed', 'escalated']).optional(),
  channel: z.enum(['sms', 'web_chat']).optional(),
});

export const MessageListParamsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SendMessage = z.infer<typeof SendMessageSchema>;
export type ConversationFilter = z.infer<typeof ConversationFilterSchema>;
export type MessageListParams = z.infer<typeof MessageListParamsSchema>;
