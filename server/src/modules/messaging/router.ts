import { Router, Request, Response } from 'express';
import { authenticateCustomer, AuthenticatedCustomerRequest } from '../../middleware/auth';
import { MessagingService, MessagingError } from './service';
import {
  SendMessageSchema,
  ConversationFilterSchema,
  MessageListParamsSchema,
} from './types';

const router = Router();
const messagingService = new MessagingService();

// All customer messaging routes require authentication
router.use(authenticateCustomer);

// GET /conversations — list customer's conversations
router.get('/conversations', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const filterValidation = ConversationFilterSchema.safeParse(req.query);
    const filter = filterValidation.success ? filterValidation.data : undefined;

    const conversations = await messagingService.getConversations(
      customerReq.customer.id,
      filter
    );
    res.json({ conversations });
  } catch (error) {
    console.error('List conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /conversations — get or create an active conversation
router.post('/conversations', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const conversation = await messagingService.getOrCreateConversation(
      customerReq.customer.id
    );
    res.json({ conversation });
  } catch (error) {
    console.error('Get/create conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /conversations/:conversationId/messages — get messages with pagination
router.get('/conversations/:conversationId/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const conversationId = req.params.conversationId as string;
    const paramsValidation = MessageListParamsSchema.safeParse(req.query);
    const params = paramsValidation.success ? paramsValidation.data : undefined;

    const result = await messagingService.getMessages(
      conversationId,
      customerReq.customer.id,
      params
    );
    res.json(result);
  } catch (error) {
    if (error instanceof MessagingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /conversations/:conversationId/messages — send a message
router.post('/conversations/:conversationId/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const conversationId = req.params.conversationId as string;
    const validation = SendMessageSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const result = await messagingService.sendMessage(
      conversationId,
      customerReq.customer.id,
      validation.data.content
    );
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof MessagingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /conversations/:conversationId/close — close a conversation
router.post('/conversations/:conversationId/close', async (req: Request, res: Response): Promise<void> => {
  try {
    const customerReq = req as AuthenticatedCustomerRequest;
    const conversationId = req.params.conversationId as string;
    const conversation = await messagingService.closeConversation(
      conversationId,
      customerReq.customer.id
    );
    res.json({ conversation });
  } catch (error) {
    if (error instanceof MessagingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Close conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
