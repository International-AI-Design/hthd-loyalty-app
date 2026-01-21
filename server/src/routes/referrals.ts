import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const router = Router();

// Zod schema for referral code validation
const validateCodeSchema = z.object({
  code: z.string().regex(/^HT-[A-Z0-9]{6}$/, 'Invalid referral code format'),
});

// GET /api/referrals/validate/:code
// Validates that a referral code exists and is active
router.get('/validate/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const code = (req.params.code as string).toUpperCase();

    // Validate code format
    const validationResult = validateCodeSchema.safeParse({ code });
    if (!validationResult.success) {
      res.status(400).json({
        valid: false,
        error: 'Invalid referral code format',
      });
      return;
    }

    // Check if referral code exists in database
    const customer = await prisma.customer.findUnique({
      where: { referralCode: code },
      select: {
        id: true,
        firstName: true,
      },
    });

    if (!customer) {
      res.status(404).json({
        valid: false,
        error: 'Referral code not found',
      });
      return;
    }

    // Return success with referrer's first name for friendly feedback
    res.status(200).json({
      valid: true,
      referrer_first_name: customer.firstName,
    });
  } catch (error) {
    console.error('Referral code validation error:', error);
    res.status(500).json({
      valid: false,
      error: 'Internal server error'
    });
  }
});

export default router;
