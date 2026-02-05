import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import claimRoutes from './routes/claim';
import customersRoutes from './routes/customers';
import redemptionsRoutes from './routes/redemptions';
import referralsRoutes from './routes/referrals';
import adminAuthRoutes from './routes/admin/auth';
import adminCustomersRoutes from './routes/admin/customers';
import adminPointsRoutes from './routes/admin/points';
import adminRedemptionsRoutes from './routes/admin/redemptions';
import adminGingrRoutes from './routes/admin/gingr';
import adminDemoRoutes from './routes/admin/demo';
import {
  helmetMiddleware,
  rateLimiter,
  requestLogger,
  getCorsOptions,
  logger
} from './middleware/security';
import { startGingrAutoSync } from './jobs/gingrSync';
import { prisma, pool } from './lib/prisma';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmetMiddleware);
app.use(rateLimiter);
app.use(requestLogger);
app.use(cors(getCorsOptions()));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Happy Tail Happy Dog API is running' });
});

// Auth routes
app.use('/api/auth', authRoutes);

// Claim routes (for pre-imported customers)
app.use('/api/claim', claimRoutes);

// Customer routes
app.use('/api/customers', customersRoutes);

// Redemption routes
app.use('/api/redemptions', redemptionsRoutes);

// Referral routes
app.use('/api/referrals', referralsRoutes);

// Admin routes
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/customers', adminCustomersRoutes);
app.use('/api/admin/points', adminPointsRoutes);
app.use('/api/admin/redemptions', adminRedemptionsRoutes);
app.use('/api/admin/gingr', adminGingrRoutes);
app.use('/api/admin/demo', adminDemoRoutes);

// Global error handler - catches unhandled errors to prevent crashes
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', { error: err.message, stack: err.stack, path: req.path });
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);

  // Start the Gingr auto-sync job
  startGingrAutoSync();
});

// Graceful shutdown — clean up connections on Railway redeploy / container stop
function shutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(async () => {
    await prisma.$disconnect();
    await pool.end();
    logger.info('Connections closed, exiting');
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown stalls
  setTimeout(() => {
    logger.warn('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
