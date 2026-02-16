import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

// Centralized JWT secret — all routes should import from here
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET environment variable must be set in production');
  }
  console.warn('WARNING: JWT_SECRET not set — using development fallback. Never use this in production.');
}
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-do-not-use-in-prod';

// Decoded JWT payload types
export interface CustomerJwtPayload {
  id: string;
  email: string;
  type: 'customer';
  iat: number;
  exp: number;
}

export type StaffRole = 'owner' | 'manager' | 'admin' | 'staff' | 'groomer';

export interface StaffJwtPayload {
  id: string;
  username: string;
  role: StaffRole;
  type: 'staff';
  iat: number;
  exp: number;
}

// Extended request types with authenticated user
export interface AuthenticatedCustomerRequest extends Request {
  customer: {
    id: string;
    email: string;
  };
}

export interface AuthenticatedStaffRequest extends Request {
  staff: {
    id: string;
    username: string;
    role: StaffRole;
  };
}

/**
 * Extract and verify JWT token from Authorization header
 * Returns decoded payload or null if invalid
 */
function extractAndVerifyToken(req: Request): CustomerJwtPayload | StaffJwtPayload | null {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  // Expect format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as CustomerJwtPayload | StaffJwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Middleware to authenticate customer routes
 * Extracts JWT from Authorization header and verifies it's a customer token
 * Attaches decoded customer info to req.customer
 */
export async function authenticateCustomer(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const decoded = extractAndVerifyToken(req);

  if (!decoded) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (decoded.type !== 'customer') {
    res.status(401).json({ error: 'Invalid token type' });
    return;
  }

  // Verify customer still exists in database
  const customer = await prisma.customer.findUnique({
    where: { id: decoded.id },
    select: { id: true, email: true },
  });

  if (!customer) {
    res.status(401).json({ error: 'Customer not found' });
    return;
  }

  // Attach customer to request
  (req as AuthenticatedCustomerRequest).customer = {
    id: customer.id,
    email: customer.email,
  };

  next();
}

/**
 * Middleware to authenticate staff routes
 * Extracts JWT from Authorization header and verifies it's a staff token
 * Attaches decoded staff info to req.staff
 */
export async function authenticateStaff(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const decoded = extractAndVerifyToken(req);

  if (!decoded) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (decoded.type !== 'staff') {
    res.status(401).json({ error: 'Invalid token type' });
    return;
  }

  // Verify staff user still exists and is active
  const staffUser = await prisma.staffUser.findUnique({
    where: { id: decoded.id },
    select: { id: true, username: true, role: true, isActive: true },
  });

  if (!staffUser) {
    res.status(401).json({ error: 'Staff user not found' });
    return;
  }

  if (!staffUser.isActive) {
    res.status(401).json({ error: 'Account deactivated' });
    return;
  }

  // Attach staff to request
  (req as AuthenticatedStaffRequest).staff = {
    id: staffUser.id,
    username: staffUser.username,
    role: staffUser.role as StaffRole,
  };

  next();
}

/**
 * Factory function to create role-based authorization middleware
 * Must be used after authenticateStaff middleware
 * Checks if the authenticated staff user has one of the allowed roles
 */
export function requireRoles(...allowedRoles: StaffRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const staffReq = req as AuthenticatedStaffRequest;

    if (!staffReq.staff) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(staffReq.staff.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Convenience middleware for admin-level routes (owner + legacy admin)
 * Must be used after authenticateStaff middleware
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  return requireRoles('owner', 'admin')(req, res, next);
}
