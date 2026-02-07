import { Router, Request, Response } from 'express';
import { authenticateStaff, AuthenticatedStaffRequest } from '../../middleware/auth';
import { MessagingService, MessagingError } from './service';
import { SendMessageSchema, ConversationFilterSchema } from './types';

const router = Router();
const messagingService = new MessagingService();

// All admin messaging routes require staff authentication
router.use(authenticateStaff);

// GET /conversations — list all conversations with customer info
router.get('/conversations', async (req: Request, res: Response): Promise<void> => {
  try {
    const filterValidation = ConversationFilterSchema.safeParse(req.query);
    const filter = filterValidation.success ? filterValidation.data : undefined;

    const conversations = await messagingService.getAllConversations(filter);
    res.json({ conversations });
  } catch (error) {
    console.error('Admin list conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /conversations/:conversationId — get conversation with all messages
router.get('/conversations/:conversationId', async (req: Request, res: Response): Promise<void> => {
  try {
    const conversationId = req.params.conversationId as string;
    const result = await messagingService.getConversationMessages(conversationId);
    res.json(result);
  } catch (error) {
    if (error instanceof MessagingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Admin get conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /conversations/:conversationId/assign — assign staff to conversation
router.post('/conversations/:conversationId/assign', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const conversationId = req.params.conversationId as string;
    const staffUserId = req.body.staffUserId || staffReq.staff.id;

    const conversation = await messagingService.assignStaff(
      conversationId,
      staffUserId
    );
    res.json({ conversation });
  } catch (error) {
    if (error instanceof MessagingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Assign staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /conversations/:conversationId/messages — staff sends a message
router.post('/conversations/:conversationId/messages', async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const conversationId = req.params.conversationId as string;
    const validation = SendMessageSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Validation error', details: validation.error.issues });
      return;
    }

    const message = await messagingService.sendStaffMessage(
      conversationId,
      staffReq.staff.id,
      validation.data.content
    );
    res.status(201).json({ message });
  } catch (error) {
    if (error instanceof MessagingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Staff send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /conversations/:conversationId/escalate — escalate conversation
router.post('/conversations/:conversationId/escalate', async (req: Request, res: Response): Promise<void> => {
  try {
    const conversationId = req.params.conversationId as string;
    const conversation = await messagingService.escalateConversation(conversationId);
    res.json({ conversation });
  } catch (error) {
    if (error instanceof MessagingError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('Escalate conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
