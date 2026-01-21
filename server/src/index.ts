import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import customersRoutes from './routes/customers';
import redemptionsRoutes from './routes/redemptions';
import referralsRoutes from './routes/referrals';
import adminAuthRoutes from './routes/admin/auth';
import adminCustomersRoutes from './routes/admin/customers';
import adminPointsRoutes from './routes/admin/points';
import adminRedemptionsRoutes from './routes/admin/redemptions';
import adminGingrRoutes from './routes/admin/gingr';
import {
  helmetMiddleware,
  rateLimiter,
  requestLogger,
  getCorsOptions,
  logger
} from './middleware/security';

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

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
