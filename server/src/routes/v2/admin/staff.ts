import { Router, Request, Response } from 'express';
import { prisma } from '../../../lib/prisma';
import { authenticateStaff, AuthenticatedStaffRequest } from '../../../middleware/auth';
import { requireRole } from '../../../middleware/rbac';
import bcrypt from 'bcrypt';

const router = Router();

// All staff management routes require owner role
router.use(authenticateStaff);

// GET / — list all staff users (owner only)
router.get('/', requireRole('owner', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const staff = await prisma.staffUser.findMany({
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      staff: staff.map((s) => ({
        id: s.id,
        username: s.username,
        first_name: s.firstName,
        last_name: s.lastName,
        role: s.role,
        is_active: s.isActive,
        created_at: s.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('List staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/role — update a staff user's role (owner only)
router.put('/:id/role', requireRole('owner', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const staffReq = req as AuthenticatedStaffRequest;
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['owner', 'manager', 'staff'];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${validRoles.join(', ')}` });
      return;
    }

    // Cannot demote yourself from owner
    if (id === staffReq.staff.id && role !== 'owner') {
      res.status(400).json({ error: 'Cannot change your own role' });
      return;
    }

    const target = await prisma.staffUser.findUnique({ where: { id } });
    if (!target) {
      res.status(404).json({ error: 'Staff user not found' });
      return;
    }

    const updated = await prisma.staffUser.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    res.json({
      id: updated.id,
      username: updated.username,
      first_name: updated.firstName,
      last_name: updated.lastName,
      role: updated.role,
      is_active: updated.isActive,
    });
  } catch (error) {
    console.error('Update staff role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / — create a new staff user (owner only)
router.post('/', requireRole('owner', 'admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, firstName, lastName, role } = req.body;

    if (!username || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'username, password, firstName, and lastName are required' });
      return;
    }

    const validRoles = ['owner', 'manager', 'staff'];
    const staffRole = role && validRoles.includes(role) ? role : 'staff';

    // Check username uniqueness
    const existing = await prisma.staffUser.findUnique({ where: { username } });
    if (existing) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newStaff = await prisma.staffUser.create({
      data: {
        username,
        passwordHash,
        firstName,
        lastName,
        role: staffRole,
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      id: newStaff.id,
      username: newStaff.username,
      first_name: newStaff.firstName,
      last_name: newStaff.lastName,
      role: newStaff.role,
      is_active: newStaff.isActive,
      created_at: newStaff.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
