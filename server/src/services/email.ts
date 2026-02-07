import { Resend } from 'resend';
import { logger } from '../middleware/security';

export { sendPasswordResetEmail };

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
        <p style="color: #62A2C3; margin: 5px 0 0;">Rewards Program</p>
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
 * Send welcome email after account claim (for imported customers claiming their account)
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
        <p style="color: #62A2C3; margin: 5px 0 0;">Rewards Program</p>
      </div>

      <p style="color: #1B365D; font-size: 16px;">Hi ${customerName}!</p>

      <p style="color: #444; font-size: 16px;">
        Your account is now active! 🎉
      </p>

      <div style="background: linear-gradient(135deg, #62A2C3 0%, #4F8BA8 100%); border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0; color: white;">
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

/**
 * Send welcome email for new organic signups (includes 25-point bonus mention)
 */
export async function sendNewSignupWelcomeEmail({
  to,
  customerName,
  referralCode,
}: {
  to: string;
  customerName: string;
  referralCode: string;
}): Promise<{ success: boolean; error?: string }> {
  const subject = 'Welcome to Happy Tail Happy Dog Rewards - 25 Bonus Points!';
  const html = `
    <div style="font-family: 'Open Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1B365D; font-family: 'Playfair Display', Georgia, serif; margin: 0;">
          Happy Tail Happy Dog
        </h1>
        <p style="color: #62A2C3; margin: 5px 0 0;">Rewards Program</p>
      </div>

      <p style="color: #1B365D; font-size: 16px;">Hi ${customerName}!</p>

      <p style="color: #444; font-size: 16px;">
        Welcome to our rewards family! We're thrilled to have you.
      </p>

      <div style="background: linear-gradient(135deg, #62A2C3 0%, #4F8BA8 100%); border-radius: 12px; padding: 25px; text-align: center; margin: 20px 0; color: white;">
        <p style="margin: 0 0 5px; font-size: 14px; opacity: 0.9;">Your welcome bonus</p>
        <span style="font-size: 48px; font-weight: bold;">
          25
        </span>
        <p style="margin: 5px 0 0; font-size: 16px;">points added to your account!</p>
      </div>

      <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #1B365D; margin: 0 0 15px; font-size: 16px;">How to earn more points:</h3>
        <ul style="color: #444; margin: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">1 point per dollar spent</li>
          <li style="margin-bottom: 8px;"><strong>1.5x points on grooming services!</strong></li>
          <li style="margin-bottom: 8px;">100 bonus points for each friend you refer</li>
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

      <div style="background: #1B365D; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="color: #fff; margin: 0 0 10px; font-size: 14px;">Share your referral code with friends:</p>
        <span style="background: #fff; color: #1B365D; padding: 10px 20px; border-radius: 4px; font-size: 20px; font-weight: bold; letter-spacing: 2px;">
          ${referralCode}
        </span>
        <p style="color: #62A2C3; margin: 10px 0 0; font-size: 12px;">They'll get started, and you'll get 100 bonus points!</p>
      </div>

      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

      <p style="color: #888; font-size: 12px; text-align: center;">
        We can't wait to see you and your pup!<br>
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

      logger.info(`New signup welcome email sent to ${to}`);
      return { success: true };
    } else {
      // Development: Log to console
      logger.info('========================================');
      logger.info('📧 NEW SIGNUP WELCOME EMAIL (Dev Mode)');
      logger.info('========================================');
      logger.info(`To: ${to}`);
      logger.info(`Customer: ${customerName}`);
      logger.info(`Referral Code: ${referralCode}`);
      logger.info(`Welcome Bonus: 25 points`);
      logger.info('========================================');
      return { success: true };
    }
  } catch (error) {
    logger.error('Failed to send new signup welcome email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

interface SendPasswordResetEmailParams {
  to: string;
  customerName: string;
  code: string;
}

/**
 * Send password reset code email
 * Uses Resend in production, console logging in development
 */
async function sendPasswordResetEmail({
  to,
  customerName,
  code,
}: SendPasswordResetEmailParams): Promise<{ success: boolean; error?: string }> {
  const subject = 'Reset your Happy Tail Happy Dog password';
  const html = `
    <div style="font-family: 'Open Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1B365D; font-family: 'Playfair Display', Georgia, serif; margin: 0;">
          Happy Tail Happy Dog
        </h1>
        <p style="color: #62A2C3; margin: 5px 0 0;">Rewards Program</p>
      </div>

      <p style="color: #1B365D; font-size: 16px;">Hi ${customerName}!</p>

      <p style="color: #444; font-size: 16px;">
        Your password reset code is:
      </p>

      <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1B365D;">
          ${code}
        </span>
      </div>

      <p style="color: #666; font-size: 14px;">
        This code expires in 10 minutes.
      </p>

      <p style="color: #666; font-size: 14px;">
        If you didn't request a password reset, you can safely ignore this email.
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

      <p style="color: #888; font-size: 12px; text-align: center;">
        Questions? Visit us at the shop.<br>
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

      logger.info(`Password reset email sent to ${to}`);
      return { success: true };
    } else {
      // Development: Log to console
      logger.info('========================================');
      logger.info('📧 PASSWORD RESET EMAIL (Dev Mode)');
      logger.info('========================================');
      logger.info(`To: ${to}`);
      logger.info(`Customer: ${customerName}`);
      logger.info(`Reset Code: ${code}`);
      logger.info('========================================');
      return { success: true };
    }
  } catch (error) {
    logger.error('Failed to send password reset email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}
