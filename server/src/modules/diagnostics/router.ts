import { Router, Request, Response } from 'express';
import { authenticateStaff } from '../../middleware/auth';
import { prisma, pool } from '../../lib/prisma';
import { logger } from '../../middleware/security';

const router = Router();

const startTime = Date.now();

// All diagnostics routes require staff authentication
router.use(authenticateStaff);

// ─── Conversations ────────────────────────────────────────────────────

/**
 * GET /conversations
 * Returns recent messaging conversations with their messages.
 * Query: limit (default 10, max 50), since (ISO date, default last 24h)
 */
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 10, 1), 50);
    const since = req.query.since
      ? new Date(req.query.since as string)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (isNaN(since.getTime())) {
      return res.status(400).json({ error: 'Invalid "since" date format. Use ISO 8601.' });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        customer: {
          select: { firstName: true, lastName: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            role: true,
            content: true,
            createdAt: true,
            modelUsed: true,
          },
        },
      },
    });

    res.json({
      conversations: conversations.map((c) => ({
        id: c.id,
        customerId: c.customerId,
        customerName: c.customer
          ? `${c.customer.firstName} ${c.customer.lastName}`.trim()
          : null,
        status: c.status,
        channel: c.channel,
        updatedAt: c.updatedAt,
        messages: c.messages.map((m) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          modelUsed: m.modelUsed,
        })),
      })),
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Diagnostics conversations error', { error: errMsg });
    res.status(500).json({ error: errMsg });
  }
});

// ─── AI Stats ─────────────────────────────────────────────────────────

/**
 * GET /ai-stats
 * Returns AI performance metrics aggregated from the messages table.
 * Query: since (ISO date, default last 24h)
 */
router.get('/ai-stats', async (req: Request, res: Response) => {
  try {
    const since = req.query.since
      ? new Date(req.query.since as string)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (isNaN(since.getTime())) {
      return res.status(400).json({ error: 'Invalid "since" date format. Use ISO 8601.' });
    }

    const messages = await prisma.message.findMany({
      where: {
        createdAt: { gte: since },
      },
      select: {
        role: true,
        content: true,
        modelUsed: true,
      },
    });

    const totalMessages = messages.length;
    const aiMessages = messages.filter((m) => m.role === 'assistant');
    const aiResponseCount = aiMessages.length;

    const averageResponseLength =
      aiResponseCount > 0
        ? Math.round(
            aiMessages.reduce((sum, m) => sum + m.content.length, 0) / aiResponseCount
          )
        : 0;

    // Model breakdown: count per modelUsed value
    const modelBreakdown: Record<string, number> = {};
    for (const m of aiMessages) {
      const model = m.modelUsed || 'unknown';
      modelBreakdown[model] = (modelBreakdown[model] || 0) + 1;
    }

    const fallbackCount = aiMessages.filter(
      (m) => m.modelUsed === 'fallback' || m.modelUsed === 'system'
    ).length;

    const errorCount = aiMessages.filter((m) => m.modelUsed === 'fallback').length;

    res.json({
      since: since.toISOString(),
      totalMessages,
      aiResponseCount,
      averageResponseLength,
      modelBreakdown,
      fallbackCount,
      errorCount,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Diagnostics ai-stats error', { error: errMsg });
    res.status(500).json({ error: errMsg });
  }
});

// ─── Health ───────────────────────────────────────────────────────────

/**
 * GET /health
 * Returns system health info including DB latency and record counts.
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Measure DB latency
    const dbStart = Date.now();
    await pool.query('SELECT 1');
    const dbLatencyMs = Date.now() - dbStart;

    // Get counts in parallel
    const [totalCustomers, totalConversations, totalMessages] = await Promise.all([
      prisma.customer.count(),
      prisma.conversation.count(),
      prisma.message.count(),
    ]);

    const uptimeMs = Date.now() - startTime;
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const uptimeHours = Math.floor(uptimeSeconds / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeRemainderSeconds = uptimeSeconds % 60;

    res.json({
      status: 'ok',
      dbLatencyMs,
      totalCustomers,
      totalConversations,
      totalMessages,
      uptime: `${uptimeHours}h ${uptimeMinutes}m ${uptimeRemainderSeconds}s`,
      uptimeMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Diagnostics health error', { error: errMsg });
    res.status(500).json({ error: errMsg });
  }
});

// ─── Errors ───────────────────────────────────────────────────────────

/**
 * GET /errors
 * Returns recent AI errors/failures (messages where modelUsed = 'fallback').
 * Query: limit (default 20, max 100), since (ISO date, default last 7 days)
 */
router.get('/errors', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
    const since = req.query.since
      ? new Date(req.query.since as string)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (isNaN(since.getTime())) {
      return res.status(400).json({ error: 'Invalid "since" date format. Use ISO 8601.' });
    }

    // Find fallback messages (AI failures) with context
    const fallbackMessages = await prisma.message.findMany({
      where: {
        modelUsed: 'fallback',
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        conversationId: true,
        content: true,
        createdAt: true,
      },
    });

    // For each fallback message, find the customer message that triggered it
    const errors = await Promise.all(
      fallbackMessages.map(async (fallback) => {
        // Find the most recent customer message before this fallback response
        const triggerMessage = await prisma.message.findFirst({
          where: {
            conversationId: fallback.conversationId,
            role: 'customer',
            createdAt: { lt: fallback.createdAt },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            content: true,
            createdAt: true,
          },
        });

        return {
          conversationId: fallback.conversationId,
          triggerMessage: triggerMessage?.content ?? null,
          triggerTimestamp: triggerMessage?.createdAt ?? null,
          fallbackResponse: fallback.content,
          timestamp: fallback.createdAt,
        };
      })
    );

    res.json({ errors, count: errors.length });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Diagnostics errors endpoint error', { error: errMsg });
    res.status(500).json({ error: errMsg });
  }
});

export default router;
