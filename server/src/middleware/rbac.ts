import { Request, Response, NextFunction } from 'express';
import { AuthenticatedStaffRequest } from './auth';

// Permission map per role
const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: ['*'], // all permissions
  admin: ['*'], // legacy admin role = same as owner
  manager: [
    'bookings.*', 'customers.*', 'schedule.*', 'checkin.*',
    'grooming.rate', 'pricing.view', 'bundles.view',
  ],
  staff: [
    'schedule.view', 'checkin.*', 'grooming.rate',
    'report-cards.create', 'customers.view',
  ],
  groomer: [
    'schedule.view', 'grooming.rate',
    'report-cards.create', 'customers.view',
  ],
};

/**
 * Check if a role has a specific permission.
 * Supports wildcard matching: '*' matches everything,
 * 'bookings.*' matches 'bookings.create', 'bookings.view', etc.
 */
function roleHasPermission(role: string, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  return permissions.some((p) => {
    if (p === '*') return true;
    if (p === permission) return true;
    // Wildcard: 'bookings.*' matches 'bookings.create'
    if (p.endsWith('.*')) {
      const prefix = p.slice(0, -2);
      return permission.startsWith(prefix + '.');
    }
    return false;
  });
}

/**
 * Middleware factory: require the staff user to have one of the specified roles.
 * Must be used after authenticateStaff middleware.
 */
export function requireRole(...allowedRoles: string[]) {
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
 * Middleware factory: require the staff user's role to have a specific permission.
 * Must be used after authenticateStaff middleware.
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const staffReq = req as AuthenticatedStaffRequest;

    if (!staffReq.staff) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roleHasPermission(staffReq.staff.role, permission)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}
