import { Router, Request, Response } from 'express';
import { validateTwilioSignature } from '../../modules/sms/service';
import { prisma } from '../../lib/prisma';
import { logger } from '../../middleware/security';

const router = Router();

// Stripe webhook — Placeholder for Sprint 2
router.post('/stripe', (req: Request, res: Response) => {
  res.status(501).json({ message: 'Stripe webhook not yet implemented', version: 'v2' });
});

// Twilio delivery status webhook
router.post('/twilio', async (req: Request, res: Response) => {
  try {
    // Validate signature in production
    const signature = req.headers['x-twilio-signature'] as string || '';
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;

    if (process.env.NODE_ENV === 'production' && !validateTwilioSignature(url, req.body, signature)) {
      logger.warn('Invalid Twilio signature on status webhook');
      res.status(403).send('Forbidden');
      return;
    }

    const messageSid = req.body.MessageSid as string;
    const messageStatus = req.body.MessageStatus as string;
    const errorCode = req.body.ErrorCode as string | undefined;

    logger.info(`Twilio status callback: ${messageSid} → ${messageStatus}`, { errorCode });

    // Update message delivery status if we have the SID
    if (messageSid && messageStatus) {
      // Log delivery failures for monitoring
      if (messageStatus === 'failed' || messageStatus === 'undelivered') {
        logger.error(`SMS delivery failed: ${messageSid}`, {
          status: messageStatus,
          errorCode,
          to: req.body.To,
        });
      }
    }

    res.status(200).send('OK');
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Twilio webhook error', { error: errMsg });
    res.status(200).send('OK'); // Always 200 to Twilio to prevent retries
  }
});

export default router;
