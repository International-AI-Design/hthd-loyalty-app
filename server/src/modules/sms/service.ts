import twilio from 'twilio';
import { logger } from '../../middleware/security';

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
const fromNumber = process.env.TWILIO_PHONE_NUMBER || '';

function getClient(): twilio.Twilio | null {
  if (!accountSid || !authToken) {
    logger.warn('Twilio credentials not configured — SMS disabled');
    return null;
  }
  return twilio(accountSid, authToken);
}

export async function sendSMS(to: string, body: string): Promise<string | null> {
  const client = getClient();
  if (!client) {
    logger.info(`[SMS DEV] To: ${to} | Body: ${body}`);
    return null;
  }

  try {
    const message = await client.messages.create({
      to,
      from: fromNumber,
      body,
    });
    logger.info(`SMS sent to ${to} — SID: ${message.sid}`);
    return message.sid;
  } catch (error) {
    logger.error('Failed to send SMS', { to, error });
    throw error;
  }
}

export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  if (!authToken) {
    logger.warn('Twilio auth token not set — skipping signature validation');
    return process.env.NODE_ENV !== 'production';
  }
  return twilio.validateRequest(authToken, signature, url, params);
}

export function formatTwiML(body: string): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}
