import { Resend } from 'resend';
import { logger } from '../middleware/security';

// Initialize Resend if API key is available
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const EMAIL_FROM = process.env.EMAIL_FROM || 'Happy Tail Happy Dog <noreply@happytailhappydog.com>';

interface SendVerificationEmailParams {
  to: string;
  customerName: string;
  code: string;
}

/**
 * Send verification code email
 * Uses Resend in production, console logging in development
 */
export async function sendVerificationEmail({
  to,
  customerName,
  code,
}: SendVerificationEmailParams): Promise<{ success: boolean; error?: string }> {
  const subject = 'Claim your Happy Tail Happy Dog account';
  const html = `
    <div style="font-family: 'Open Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1B365D; font-family: 'Playfair Display', Georgia, serif; margin: 0;">
          Happy Tail Happy Dog
        </h1>
        <p style="color: #5BBFBA; margin: 5px 0 0;">Rewards Program</p>
      </div>

      <p style="color: #1B365D; font-size: 16px;">Hi ${customerName}!</p>

      <p style="color: #444; font-size: 16px;">
        Your verification code is:
      </p>

      <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1B365D;">
          ${code}
        </span>
      </div>

      <p style="color: #666; font-size: 14px;">
        This code expires in 15 minutes.
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

      <p style="color: #888; font-size: 12px; text-align: center;">
        Welcome to Happy Tail Happy Dog rewards!<br>
        Questions? Visit us at the shop.
      </p>
    </div>
  `;

  try {
    if (resend) {
      // Production: Send via Resend
      const { error } = await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject,
        html,
      });

      if (error) {
        logger.error('Resend error:', error);
        return { success: false, error: error.message };
      }

      logger.info(`Verification email sent to ${to}`);
      return { success: true };
    } else {
      // Development: Log to console
      logger.info('========================================');
      logger.info('📧 VERIFICATION EMAIL (Dev Mode)');
      logger.info('========================================');
      logger.info(`To: ${to}`);
      logger.info(`Customer: ${customerName}`);
      logger.info(`Verification Code: ${code}`);
      logger.info('========================================');
      return { success: true };
    }
  } catch (error) {
    logger.error('Failed to send verification email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

/**
 * Send welcome email after account claim
 */
export async function sendWelcomeEmail({
  to,
  customerName,
  pointsBalance,
}: {
  to: string;
  customerName: string;
  pointsBalance: number;
}): Promise<{ success: boolean; error?: string }> {
  const subject = 'Welcome to Happy Tail Happy Dog Rewards!';
  const html = `
    <div style="font-family: 'Open Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1B365D; font-family: 'Playfair Display', Georgia, serif; margin: 0;">
          Happy Tail Happy Dog
        </h1>
        <p style="color: #5BBFBA; margin: 5px 0 0;">Rewards Program</p>
      </div>

      <p style="color: #1B365D; font-size: 16px;">Hi ${customerName}!</p>

      <p style="color: #444; font-size: 16px;">
        Your account is now active! 🎉
      </p>

      <div style="background: linear-gradient(135deg, #5BBFBA 0%, #4a9e99 100%); border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0; color: white;">
        <p style="margin: 0 0 5px; font-size: 14px; opacity: 0.9;">Your current balance</p>
        <span style="font-size: 48px; font-weight: bold;">
          ${pointsBalance}
        </span>
        <p style="margin: 5px 0 0; font-size: 16px;">points</p>
      </div>

      <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1B365D; margin: 0 0 15px; font-size: 16px;">How to earn points:</h3>
        <ul style="color: #444; margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">1 point per dollar spent</li>
          <li style="margin-bottom: 8px;"><strong>1.5x points on grooming services!</strong></li>
        </ul>
      </div>

      <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1B365D; margin: 0 0 15px; font-size: 16px;">Redeem your points:</h3>
        <ul style="color: #444; margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">100 points = $10 off</li>
          <li style="margin-bottom: 8px;">250 points = $25 off</li>
          <li style="margin-bottom: 8px;">500 points = $50 off</li>
        </ul>
      </div>

      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

      <p style="color: #888; font-size: 12px; text-align: center;">
        See you soon!<br>
        - The Happy Tail Happy Dog Team
      </p>
    </div>
  `;

  try {
    if (resend) {
      // Production: Send via Resend
      const { error } = await resend.emails.send({
        from: EMAIL_FROM,
        to,
        subject,
        html,
      });

      if (error) {
        logger.error('Resend error:', error);
        return { success: false, error: error.message };
      }

      logger.info(`Welcome email sent to ${to}`);
      return { success: true };
    } else {
      // Development: Log to console
      logger.info('========================================');
      logger.info('📧 WELCOME EMAIL (Dev Mode)');
      logger.info('========================================');
      logger.info(`To: ${to}`);
      logger.info(`Customer: ${customerName}`);
      logger.info(`Points Balance: ${pointsBalance}`);
      logger.info('========================================');
      return { success: true };
    }
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}
