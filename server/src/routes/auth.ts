import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
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

    // Referral bonus points
    const REFERRAL_BONUS_POINTS = 100;

    // Create customer and award referral bonus in a transaction
    const customer = await prisma.$transaction(async (tx) => {
      // Create new customer
      const newCustomer = await tx.customer.create({
        data: {
          phone,
          email: email.toLowerCase(),
          passwordHash,
          firstName: first_name,
          lastName: last_name,
          referralCode,
          referredById: referrer?.id ?? null,
        },
      });

      // Award referral bonus to referrer if applicable
      if (referrer) {
        // Create points transaction for referrer
        await tx.pointsTransaction.create({
          data: {
            customerId: referrer.id,
            type: 'referral',
            amount: REFERRAL_BONUS_POINTS,
            description: `Referral bonus for ${first_name} ${last_name.charAt(0)}.`,
          },
        });

        // Update referrer's points balance
        await tx.customer.update({
          where: { id: referrer.id },
          data: {
            pointsBalance: { increment: REFERRAL_BONUS_POINTS },
          },
        });
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
        const target = error.meta?.target as string[] | undefined;
        if (target?.includes('email')) {
          res.status(409).json({
            error: 'Email already registered',
            field: 'email',
          });
          return;
        }
        if (target?.includes('phone')) {
          res.status(409).json({
            error: 'Phone number already registered',
            field: 'phone',
          });
          return;
        }
      }
    }

    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
