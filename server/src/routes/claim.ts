import { Router, Request, Response } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import {
  findUnclaimedCustomer,
  sendVerificationCode,
  verifyCode,
  completeClaim,
} from '../services/claim';
import { JWT_SECRET } from '../middleware/auth';

const router = Router();

// Schema for lookup request
const lookupSchema = z.object({
  identifier: z.string().min(1, 'Email or phone is required'),
});

// Schema for send-code request
const sendCodeSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
});

// Schema for verify request
const verifySchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  code: z.string().length(6, 'Code must be 6 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * POST /api/claim/lookup
 * Find an unclaimed account by phone or email
 */
router.post('/lookup', async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = lookupSchema.safeParse(req.body);
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
    const { customer, error } = await findUnclaimedCustomer(identifier);

    if (error) {
      res.status(500).json({ error });
      return;
    }

    if (!customer) {
      res.status(404).json({
        error: 'No unclaimed account found',
        message: 'We couldn\'t find an account waiting to be claimed with that email or phone. You may need to register a new account.',
      });
      return;
    }

    // Return customer info (for display) but not sensitive data
    res.status(200).json({
      found: true,
      customer: {
        id: customer.id,
        first_name: customer.firstName,
        last_name: customer.lastName,
        email_masked: maskEmail(customer.email),
        points_balance: customer.pointsBalance,
        dogs: customer.dogs || [],
        recent_visits: (customer.recentVisits || []).map((visit) => ({
          id: visit.id,
          visit_date: visit.visitDate,
          service_type: visit.serviceType,
          description: visit.description,
          amount: visit.amount,
        })),
      },
    });
  } catch (error) {
    console.error('Claim lookup error:', error);
    res.status(500).json({ error: 'Account lookup failed. Please try again.' });
  }
});

/**
 * POST /api/claim/send-code
 * Send verification code to customer's email
 */
router.post('/send-code', async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = sendCodeSchema.safeParse(req.body);
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

    const { customer_id } = validationResult.data;
    const result = await sendVerificationCode(customer_id);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (error) {
    console.error('Send code error:', error);
    res.status(500).json({ error: 'Failed to send code. Please try again.' });
  }
});

/**
 * POST /api/claim/verify
 * Verify code and set password to complete claim
 */
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = verifySchema.safeParse(req.body);
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

    const { customer_id, code, password } = validationResult.data;
    const result = await completeClaim(customer_id, code, password);

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    // Generate JWT token for the newly claimed account
    const token = jwt.sign(
      {
        id: result.customer!.id,
        email: result.customer!.email,
        type: 'customer',
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Account claimed successfully!',
      token,
      customer: {
        id: result.customer!.id,
        email: result.customer!.email,
        phone: result.customer!.phone,
        first_name: result.customer!.firstName,
        last_name: result.customer!.lastName,
        points_balance: result.customer!.pointsBalance,
      },
    });
  } catch (error) {
    console.error('Verify claim error:', error);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

/**
 * Mask an email for display (e.g., j***@example.com)
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export default router;
