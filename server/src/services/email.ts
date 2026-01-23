import { logger } from '../middleware/security';

interface SendVerificationEmailParams {
  to: string;
  customerName: string;
  code: string;
}

/**
 * Send verification code email
 * MVP: Logs to console. Replace with SendGrid/Nodemailer for production.
 */
export async function sendVerificationEmail({
  to,
  customerName,
  code,
}: SendVerificationEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    // MVP: Console log the code for demo purposes
    logger.info('========================================');
    logger.info('📧 VERIFICATION EMAIL (MVP - Console Only)');
    logger.info('========================================');
    logger.info(`To: ${to}`);
    logger.info(`Customer: ${customerName}`);
    logger.info(`Verification Code: ${code}`);
    logger.info('----------------------------------------');
    logger.info('Email Content:');
    logger.info(`Subject: Claim your Happy Tail Happy Dog account`);
    logger.info('');
    logger.info(`Hi ${customerName}!`);
    logger.info('');
    logger.info('Your verification code is:');
    logger.info(`    ${code}`);
    logger.info('');
    logger.info('This code expires in 10 minutes.');
    logger.info('');
    logger.info('Welcome to Happy Tail Happy Dog rewards!');
    logger.info('========================================');

    return { success: true };
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
 * MVP: Logs to console
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
  try {
    logger.info('========================================');
    logger.info('📧 WELCOME EMAIL (MVP - Console Only)');
    logger.info('========================================');
    logger.info(`To: ${to}`);
    logger.info(`Customer: ${customerName}`);
    logger.info('----------------------------------------');
    logger.info(`Subject: Welcome to Happy Tail Happy Dog Rewards!`);
    logger.info('');
    logger.info(`Hi ${customerName}!`);
    logger.info('');
    logger.info('Your account is now active!');
    logger.info(`You have ${pointsBalance} points ready to redeem.`);
    logger.info('');
    logger.info('Earn points on every visit:');
    logger.info('  • 1 point per dollar spent');
    logger.info('  • 1.5x points on grooming services!');
    logger.info('');
    logger.info('Redeem your points:');
    logger.info('  • 100 points = $10 off');
    logger.info('  • 250 points = $25 off');
    logger.info('  • 500 points = $50 off');
    logger.info('');
    logger.info('See you soon!');
    logger.info('- The Happy Tail Happy Dog Team');
    logger.info('========================================');

    return { success: true };
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}
