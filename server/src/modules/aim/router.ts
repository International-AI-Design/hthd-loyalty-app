import { Router, Request, Response } from 'express';
import { authenticateStaff } from '../../middleware/auth';
import { processAimMessage } from './service';
import {
  getAlerts,
  markAlertRead,
  resolveAlert,
  generateAlerts,
} from './alerts';
import { prisma } from '../../lib/prisma';
import { logger } from '../../middleware/security';

const router = Router();

// All AIM routes require staff authentication
router.use(authenticateStaff);

// ─── Chat ──────────────────────────────────────────────────────────────

/**
 * POST /aim/chat
 * Send a message to AIM and get an AI response.
 * Body: { message: string, conversationId?: string }
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const staffUser = (req as any).staffUser;
    const { message, conversationId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await processAimMessage({
      staffUserId: staffUser.id,
      message: message.trim(),
      conversationId: conversationId || undefined,
    });

    res.json(result);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('AIM chat error', { error: errMsg });
    res.status(500).json({ error: errMsg });
  }
});

// ─── Conversations ─────────────────────────────────────────────────────

/**
 * GET /aim/conversations
 * List the current staff member's AIM conversations.
 */
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const staffUser = (req as any).staffUser;

    const conversations = await (prisma as any).aimConversation.findMany({
      where: { staffUserId: staffUser.id, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, role: true, createdAt: true },
        },
      },
    });

    res.json({
      conversations: conversations.map((c: any) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        lastMessage: c.messages[0] ?? null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('AIM list conversations error', { error: errMsg });
    res.status(500).json({ error: errMsg });
  }
});

/**
 * GET /aim/conversations/:id
 * Get a conversation with all its messages.
 */
router.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const staffUser = (req as any).staffUser;
    const { id } = req.params;

    const conversation = await (prisma as any).aimConversation.findFirst({
      where: { id, staffUserId: staffUser.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('AIM get conversation error', { error: errMsg });
    res.status(500).json({ error: errMsg });
  }
});

/**
 * DELETE /aim/conversations/:id
 * Archive a conversation (soft delete).
 */
router.delete('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const staffUser = (req as any).staffUser;
    const { id } = req.params;

    const conversation = await (prisma as any).aimConversation.findFirst({
      where: { id, staffUserId: staffUser.id },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await (prisma as any).aimConversation.update({
      where: { id },
      data: { status: 'archived' },
    });

    res.json({ success: true });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('AIM archive conversation error', { error: errMsg });
    res.status(500).json({ error: errMsg });
  }
});

// ─── Alerts ────────────────────────────────────────────────────────────

/**
 * GET /aim/alerts
 * Get alerts. Query ?unread=true for unread only.
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const unreadOnly = req.query.unread === 'true';

    // Generate fresh alerts on fetch
    const today = new Date()
      .toLocaleDateString('en-CA', { timeZone: 'America/Denver' });
    await generateAlerts(today);

    const alerts = await getAlerts(unreadOnly);
    res.json({ alerts });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('AIM get alerts error', { error: errMsg });
    res.status(500).json({ error: errMsg });
  }
});

/**
 * PATCH /aim/alerts/:id/read
 * Mark an alert as read.
 */
router.patch('/alerts/:id/read', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const alert = await markAlertRead(id);
    res.json(alert);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('AIM mark alert read error', { error: errMsg });
    res.status(500).json({ error: errMsg });
  }
});

/**
 * PATCH /aim/alerts/:id/resolve
 * Mark an alert as resolved.
 */
router.patch('/alerts/:id/resolve', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const alert = await resolveAlert(id);
    res.json(alert);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('AIM resolve alert error', { error: errMsg });
    res.status(500).json({ error: errMsg });
  }
});

export default router;
