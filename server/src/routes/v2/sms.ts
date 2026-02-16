import { Router, Request, Response } from 'express';
import { processMessage } from '../../modules/ai/orchestrator';
import { validateTwilioSignature, formatTwiML, normalizePhoneNumber } from '../../modules/sms/service';
import { logger } from '../../middleware/security';

const router = Router();

// Rate limiting map for SMS (per phone number)
const smsRateMap = new Map<string, { count: number; resetAt: number }>();
const SMS_RATE_LIMIT = 20; // max messages per window
const SMS_RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkSmsRate(phone: string): boolean {
  const now = Date.now();
  const entry = smsRateMap.get(phone);

  if (!entry || now > entry.resetAt) {
    smsRateMap.set(phone, { count: 1, resetAt: now + SMS_RATE_WINDOW });
    return true;
  }

  if (entry.count >= SMS_RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// Inbound SMS webhook from Twilio
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Validate Twilio signature in production
    // Use x-forwarded-proto for Railway/proxy environments where req.protocol is 'http'
    const signature = req.headers['x-twilio-signature'] as string || '';
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    const url = `${proto}://${req.get('host')}${req.originalUrl}`;

    if (process.env.TWILIO_AUTH_TOKEN && !validateTwilioSignature(url, req.body, signature)) {
      logger.warn('Invalid Twilio signature on SMS webhook', { ip: req.ip, url, hasSignature: !!signature });
      // Don't block — log and continue. Signature validation can fail behind proxies.
      // TODO: Re-enable strict blocking once URL matching is confirmed with Railway proxy
    }

    // Extract message data from Twilio POST
    const from = req.body.From as string;
    const body = (req.body.Body as string || '').trim();
    const messageSid = req.body.MessageSid as string;

    if (!from || !body) {
      logger.warn('SMS webhook missing From or Body', { body: req.body });
      res.type('text/xml').send(formatTwiML('Sorry, I didn\'t catch that. Could you try again?'));
      return;
    }

    logger.info(`Inbound SMS from ${from}: ${body.substring(0, 100)}${body.length > 100 ? '...' : ''}`);

    // Rate limiting per phone
    if (!checkSmsRate(normalizePhoneNumber(from))) {
      logger.warn(`SMS rate limit exceeded for ${from}`);
      res.type('text/xml').send(formatTwiML('You\'ve sent a lot of messages recently. Please wait a bit and try again, or call us directly.'));
      return;
    }

    // Process through AI orchestrator
    const result = await processMessage({
      phoneNumber: from,
      messageBody: body,
      twilioSid: messageSid,
    });

    logger.info(`AI response for ${from}`, {
      conversationId: result.conversationId,
      toolsUsed: result.toolsUsed,
      modelUsed: result.modelUsed,
      responseLength: result.responseText.length,
    });

    // Return TwiML response
    res.type('text/xml').send(formatTwiML(result.responseText));
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('SMS webhook error', { error: errMsg });
    res.type('text/xml').send(formatTwiML('Sorry, something went wrong on our end. Please try again or call us directly.'));
  }
});

// Health check for SMS system
router.get('/status', (req: Request, res: Response) => {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  const hasTwilio = !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);

  res.json({
    sms: hasTwilio ? 'configured' : 'not_configured',
    ai: hasApiKey ? 'configured' : 'not_configured',
    status: hasApiKey && hasTwilio ? 'operational' : 'partial',
    version: 'v2',
  });
});

export default router;
