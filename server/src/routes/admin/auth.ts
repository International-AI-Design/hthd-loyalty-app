import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Zod schema for staff login validation
const staffLoginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// POST /api/admin/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validationResult = staffLoginSchema.safeParse(req.body);
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

    const { username, password } = validationResult.data;

    // Find staff user by username
    const staffUser = await prisma.staffUser.findUnique({
      where: { username },
    });

    // Check if staff user exists
    if (!staffUser) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if account is active
    if (!staffUser.isActive) {
      res.status(401).json({ error: 'Account deactivated' });
      return;
    }

    // Compare password hash
    const isPasswordValid = await bcrypt.compare(password, staffUser.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token (8 hour expiry for staff)
    const token = jwt.sign(
      {
        id: staffUser.id,
        username: staffUser.username,
        role: staffUser.role,
        type: 'staff',
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      staff: {
        id: staffUser.id,
        username: staffUser.username,
        role: staffUser.role,
        first_name: staffUser.firstName,
        last_name: staffUser.lastName,
      },
    });
  } catch (error) {
    console.error('Staff login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
