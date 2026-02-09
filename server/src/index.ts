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
// v2 routes
import v2BookingsRoutes from './routes/v2/bookings';
import v2WalletRoutes from './routes/v2/wallet';
import v2PaymentsRoutes from './routes/v2/payments';
import v2MembershipsRoutes from './routes/v2/memberships';
import v2WebhooksRoutes from './routes/v2/webhooks';
import v2SmsRoutes from './routes/v2/sms';
import v2AdminBookingsRoutes from './routes/v2/admin/bookings';
import v2AdminReportCardsRoutes from './routes/v2/admin/report-cards';
import v2AdminIntakesRoutes from './routes/v2/admin/intakes';
import v2GroomingRoutes from './routes/v2/grooming';
import v2BundlesRoutes from './routes/v2/bundles';
import v2AdminStaffRoutes from './routes/v2/admin/staff';
import v2ReportCardsRoutes from './routes/v2/report-cards';
import v2AdminDashboardRoutes from './routes/v2/admin/dashboard';
import { checkoutRouter, adminCheckoutRouter } from './modules/checkout';
import v2DogProfileRoutes from './modules/dog-profile/router';
import v2AdminDogProfileRoutes from './modules/dog-profile/admin-router';
import v2MessagingRoutes from './modules/messaging/router';
import v2AdminMessagingRoutes from './modules/messaging/admin-router';
import v2AdminSchedulesRoutes from './modules/staff-schedule/admin-router';
import v2NotificationsRoutes from './modules/notifications/router';
import v2ActivitiesRoutes from './modules/activities/router';
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

// Trust Railway's reverse proxy so rate limiter uses real client IP
app.set('trust proxy', true);

// Security middleware
app.use(helmetMiddleware);
app.use(rateLimiter);
app.use(requestLogger);
app.use(cors(getCorsOptions()));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Happy Tail Happy Dog API is running', version: '3.1.0' });
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

// v2 API routes (new platform)
app.use('/api/v2/bookings', v2BookingsRoutes);
app.use('/api/v2/wallet', v2WalletRoutes);
app.use('/api/v2/payments', v2PaymentsRoutes);
app.use('/api/v2/memberships', v2MembershipsRoutes);
app.use('/api/v2/webhooks', v2WebhooksRoutes);
app.use('/api/v2/sms', v2SmsRoutes);
app.use('/api/v2/admin/bookings', v2AdminBookingsRoutes);
app.use('/api/v2/admin/report-cards', v2AdminReportCardsRoutes);
app.use('/api/v2/admin/intakes', v2AdminIntakesRoutes);
app.use('/api/v2/grooming', v2GroomingRoutes);
app.use('/api/v2/bundles', v2BundlesRoutes);
app.use('/api/v2/admin/staff', v2AdminStaffRoutes);
app.use('/api/v2/report-cards', v2ReportCardsRoutes);
app.use('/api/v2/admin/dashboard', v2AdminDashboardRoutes);
app.use('/api/v2/dogs', v2DogProfileRoutes);
app.use('/api/v2/messaging', v2MessagingRoutes);
app.use('/api/v2/checkout', checkoutRouter);
app.use('/api/v2/admin/dogs', v2AdminDogProfileRoutes);
app.use('/api/v2/admin/messaging', v2AdminMessagingRoutes);
app.use('/api/v2/admin/schedules', v2AdminSchedulesRoutes);
app.use('/api/v2/admin/checkout', adminCheckoutRouter);
app.use('/api/v2/notifications', v2NotificationsRoutes);
app.use('/api/v2/activities', v2ActivitiesRoutes);

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
