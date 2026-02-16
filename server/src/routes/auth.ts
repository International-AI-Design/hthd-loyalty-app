import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { WELCOME_BONUS_POINTS, REFERRAL_BONUS_POINTS, capPoints } from '../lib/points';
import { sendNewSignupWelcomeEmail, sendPasswordResetEmail } from '../services/email';
import { JWT_SECRET } from '../middleware/auth';

const router = Router();
const SALT_ROUNDS = 10;

// Zod schema for registration validation
const registerSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  referral_code: z.string().regex(/^HT-[A-Z0-9]{6}$/i, 'Invalid referral code format').optional().or(z.literal('')),
});

// Generate unique referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoiding confusing characters
  let code = 'HT-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    const { phone, email, password, first_name, last_name, referral_code } = validationResult.data;

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Look up referring customer if referral code provided
    let referrer: { id: string; email: string } | null = null;
    if (referral_code && referral_code.trim() !== '') {
      referrer = await prisma.customer.findUnique({
        where: { referralCode: referral_code.toUpperCase() },
        select: { id: true, email: true },
      });
      // If referral code doesn't exist, we silently ignore it
      // (validation endpoint already handles showing errors to users)
    }

    // Prevent self-referral: check if referrer email matches new customer email
    if (referrer && referrer.email.toLowerCase() === email.toLowerCase()) {
      res.status(400).json({
        error: 'You cannot use your own referral code',
        field: 'referral_code',
      });
      return;
    }

    // Generate unique referral code (with retry logic for uniqueness)
    let referralCode = generateReferralCode();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const existing = await prisma.customer.findUnique({
        where: { referralCode },
      });
      if (!existing) break;
      referralCode = generateReferralCode();
      attempts++;
    }

    // Create customer and award bonuses in a transaction
    const customer = await prisma.$transaction(async (tx) => {
      // Create new customer with welcome bonus (25 pts, well under 500 cap)
      const newCustomer = await tx.customer.create({
        data: {
          phone,
          email: email.toLowerCase(),
          passwordHash,
          firstName: first_name,
          lastName: last_name,
          referralCode,
          referredById: referrer?.id ?? null,
          pointsBalance: WELCOME_BONUS_POINTS,
        },
      });

      // Create welcome bonus points transaction
      await tx.pointsTransaction.create({
        data: {
          customerId: newCustomer.id,
          type: 'bonus',
          amount: WELCOME_BONUS_POINTS,
          description: 'Welcome bonus for joining the rewards program',
        },
      });

      // Award referral bonus to referrer if applicable (with cap enforcement)
      if (referrer) {
        const referrerData = await tx.customer.findUnique({
          where: { id: referrer.id },
          select: { pointsBalance: true },
        });

        if (referrerData) {
          const { pointsAwarded } = capPoints(referrerData.pointsBalance, REFERRAL_BONUS_POINTS);

          if (pointsAwarded > 0) {
            await tx.pointsTransaction.create({
              data: {
                customerId: referrer.id,
                type: 'referral',
                amount: pointsAwarded,
                description: `Referral bonus for ${first_name} ${last_name.charAt(0)}.${pointsAwarded < REFERRAL_BONUS_POINTS ? ' (capped at max)' : ''}`,
              },
            });

            await tx.customer.update({
              where: { id: referrer.id },
              data: {
                pointsBalance: { increment: pointsAwarded },
              },
            });
          }
        }
      }

      return newCustomer;
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: customer.id,
        email: customer.email,
        type: 'customer',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Send welcome email (non-blocking - don't fail registration if email fails)
    sendNewSignupWelcomeEmail({
      to: customer.email,
      customerName: customer.firstName,
      referralCode: customer.referralCode,
    }).catch((err) => console.error('Failed to send welcome email:', err));

    res.status(201).json({
      message: 'Registration successful',
      token,
      customer: {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        first_name: customer.firstName,
        last_name: customer.lastName,
        points_balance: customer.pointsBalance,
        referral_code: customer.referralCode,
      },
    });
  } catch (error) {
    // Handle Prisma unique constraint violations
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Prisma target can be array ['email'] or constraint name 'customers_email_key'
        const target = error.meta?.target;
        const targetStr = Array.isArray(target) ? target.join(' ') : String(target || '');

        if (targetStr.toLowerCase().includes('email')) {
          res.status(409).json({
            error: 'Email already registered',
            field: 'email',
          });
          return;
        }
        if (targetStr.toLowerCase().includes('phone')) {
          res.status(409).json({
            error: 'Phone number already registered',
            field: 'phone',
          });
          return;
        }
        // Fallback for any other unique constraint
        res.status(409).json({
          error: 'Account already exists with this information',
        });
        return;
      }
    }

    console.error('Registration error:', error);
    res.status(500).json({ error: 'Account creation failed. Please try again.' });
  }
});

// Zod schema for login validation
const loginSchema = z.object({
  // Either email or phone must be provided
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').optional(),
  password: z.string().min(1, 'Password is required'),
}).refine((data) => data.email || data.phone, {
  message: 'Either email or phone is required',
  path: ['email'],
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    const { email, phone, password } = validationResult.data;

    // Find customer by email or phone
    let customer;
    if (email) {
      customer = await prisma.customer.findUnique({
        where: { email: email.toLowerCase() },
      });
    } else if (phone) {
      customer = await prisma.customer.findUnique({
        where: { phone },
      });
    }

    // Check if customer exists
    if (!customer) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if account is unclaimed (no password set)
    if (!customer.passwordHash || customer.accountStatus === 'unclaimed') {
      res.status(403).json({
        error: 'Account not yet claimed',
        message: 'Your account is waiting to be set up. Please claim your account to get started.',
        redirect: '/claim',
        unclaimed: true,
      });
      return;
    }

    // Compare password hash
    const isPasswordValid = await bcrypt.compare(password, customer.passwordHash)
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token (7 day expiry)
    const token = jwt.sign(
      {
        id: customer.id,
        email: customer.email,
        type: 'customer',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      customer: {
        id: customer.id,
        email: customer.email,
        phone: customer.phone,
        first_name: customer.firstName,
        last_name: customer.lastName,
        points_balance: customer.pointsBalance,
        referral_code: customer.referralCode,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Constants for password reset
const RESET_CODE_EXPIRY_MINUTES = 10;
const RESET_TOKEN_EXPIRY_MINUTES = 15;

// Generate a random 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Zod schema for forgot password
const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = forgotPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    const { identifier } = validationResult.data;
    const isEmail = identifier.includes('@');

    // Find customer by email or phone
    const customer = await prisma.customer.findFirst({
      where: isEmail
        ? { email: identifier.toLowerCase() }
        : { phone: { contains: identifier.replace(/\D/g, '').slice(-10) } },
      select: {
        id: true,
        email: true,
        firstName: true,
        accountStatus: true,
        passwordHash: true,
      },
    });

    // Always return success to prevent user enumeration
    // But only send email if account exists and is active
    if (customer && customer.accountStatus === 'active' && customer.passwordHash) {
      // Invalidate any existing unused reset codes for this customer
      await prisma.verificationCode.updateMany({
        where: {
          customerId: customer.id,
          type: 'reset',
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      // Generate new code
      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + RESET_CODE_EXPIRY_MINUTES * 60 * 1000);

      // Save code to database
      await prisma.verificationCode.create({
        data: {
          customerId: customer.id,
          code,
          type: 'reset',
          expiresAt,
        },
      });

      // Send reset email (non-blocking)
      sendPasswordResetEmail({
        to: customer.email,
        customerName: customer.firstName,
        code,
      }).catch((err) => console.error('Failed to send password reset email:', err));
    }

    // Always return success message to prevent user enumeration
    res.status(200).json({
      message: 'If an account exists with that email or phone, a reset code has been sent.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Password reset request failed. Please try again.' });
  }
});

// Zod schema for verify reset code
const verifyResetCodeSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
  code: z.string().length(6, 'Code must be 6 digits'),
});

// POST /api/auth/verify-reset-code
router.post('/verify-reset-code', async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = verifyResetCodeSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    const { identifier, code } = validationResult.data;
    const isEmail = identifier.includes('@');

    // Find customer by email or phone
    const customer = await prisma.customer.findFirst({
      where: isEmail
        ? { email: identifier.toLowerCase() }
        : { phone: { contains: identifier.replace(/\D/g, '').slice(-10) } },
      select: { id: true, email: true },
    });

    if (!customer) {
      res.status(400).json({ error: 'Invalid or expired code. Please try again.' });
      return;
    }

    // Find valid verification code
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        customerId: customer.id,
        code,
        type: 'reset',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!verificationCode) {
      res.status(400).json({ error: 'Invalid or expired code. Please try again.' });
      return;
    }

    // Generate a short-lived reset token (15 min)
    const resetToken = jwt.sign(
      {
        customerId: customer.id,
        codeId: verificationCode.id,
        purpose: 'password-reset',
      },
      JWT_SECRET,
      { expiresIn: `${RESET_TOKEN_EXPIRY_MINUTES}m` }
    );

    res.status(200).json({
      valid: true,
      resetToken,
    });
  } catch (error) {
    console.error('Verify reset code error:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// Zod schema for reset password
const resetPasswordSchema = z.object({
  resetToken: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = resetPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    const { resetToken, password } = validationResult.data;

    // Verify reset token
    let decoded: { customerId: string; codeId: string; purpose: string };
    try {
      decoded = jwt.verify(resetToken, JWT_SECRET) as typeof decoded;
    } catch {
      res.status(400).json({ error: 'Invalid or expired reset link. Please start over.' });
      return;
    }

    if (decoded.purpose !== 'password-reset') {
      res.status(400).json({ error: 'Invalid reset token.' });
      return;
    }

    // Check that the verification code hasn't been used
    const verificationCode = await prisma.verificationCode.findUnique({
      where: { id: decoded.codeId },
    });

    if (!verificationCode || verificationCode.usedAt) {
      res.status(400).json({ error: 'This reset link has already been used. Please request a new one.' });
      return;
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Update password and mark code as used in a transaction
    await prisma.$transaction(async (tx) => {
      // Mark the code as used
      await tx.verificationCode.update({
        where: { id: decoded.codeId },
        data: { usedAt: new Date() },
      });

      // Update customer password
      await tx.customer.update({
        where: { id: decoded.customerId },
        data: { passwordHash },
      });
    });

    res.status(200).json({
      message: 'Password updated successfully!',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
});

export default router;
