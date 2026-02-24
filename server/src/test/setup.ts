/**
 * Test app factory for contract tests.
 *
 * IMPORTANT: Every test file must `import './env'` (or `import '../../test/env'`)
 * BEFORE importing this file, so DATABASE_URL is set before prisma evaluates.
 */
import express, { Express } from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import {
  helmetMiddleware,
  requestLogger,
  getCorsOptions,
} from '../middleware/security';
import { JWT_SECRET } from '../middleware/auth';

// Route imports — mirrors index.ts for the modules under test
import v2AdminBookingsRoutes from '../modules/booking/admin-router';
import v2AdminMessagingRoutes from '../modules/messaging/admin-router';
import v2AdminDashboardRoutes from '../modules/dashboard/admin-router';
import v2AdminAimRoutes from '../modules/aim/router';
import v2MessagingRoutes from '../modules/messaging/router';
import v2BookingsRoutes from '../routes/v2/bookings';
import { pool } from '../lib/prisma';

/**
 * Shared test staff identity used by generateTestToken when no override given.
 */
export const TEST_STAFF = { id: 'test-staff-1', username: 'teststaff', role: 'admin' };

/**
 * Build an Express app identical to production (same middleware + routes)
 * but WITHOUT calling .listen(). Supertest drives it directly.
 */
export function createTestApp(): Express {
  const app = express();

  // Same middleware chain as production index.ts
  app.set('trust proxy', 1);
  app.use(helmetMiddleware);
  // Skip rate limiter in tests — it would interfere with rapid requests
  app.use(requestLogger);
  app.use(cors(getCorsOptions()));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Health endpoints (inline, same as index.ts)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Happy Tail Happy Dog API is running', version: '3.1.0' });
  });

  app.get('/api/health/deep', async (_req, res) => {
    const start = Date.now();
    try {
      await pool.query('SELECT 1');
      const dbLatencyMs = Date.now() - start;
      res.json({
        status: 'ok',
        version: '3.1.0',
        db: { connected: true, latencyMs: dbLatencyMs },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      const dbLatencyMs = Date.now() - start;
      res.status(503).json({
        status: 'degraded',
        version: '3.1.0',
        db: { connected: false, latencyMs: dbLatencyMs, error: err.message },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Module routes under test (admin)
  app.use('/api/v2/admin/bookings', v2AdminBookingsRoutes);
  app.use('/api/v2/admin/messaging', v2AdminMessagingRoutes);
  app.use('/api/v2/admin/dashboard', v2AdminDashboardRoutes);
  app.use('/api/v2/admin/aim', v2AdminAimRoutes);

  // Customer-facing routes under test
  app.use('/api/v2/messaging', v2MessagingRoutes);
  app.use('/api/v2/bookings', v2BookingsRoutes);

  // Global error handler (same as production)
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

/**
 * Generate a valid staff JWT for test requests.
 */
export function generateTestToken(staffUser: { id: string; username: string; role: string }): string {
  return jwt.sign(
    { id: staffUser.id, username: staffUser.username, role: staffUser.role, type: 'staff' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Generate a valid customer JWT for test requests.
 * The authenticateCustomer middleware expects { id, email, type: 'customer' }.
 */
export function generateCustomerTestToken(customer: { id: string; email: string }): string {
  return jwt.sign(
    { id: customer.id, email: customer.email, type: 'customer' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Returns true when a real database URL was available at env bootstrap time.
 * Checks the marker set by env.ts.
 */
export function hasTestDatabase(): boolean {
  return process.env.__TEST_HAS_REAL_DB === '1';
}
