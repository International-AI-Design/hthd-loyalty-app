import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';

// Configure Winston logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'happy-tail-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// In production, also log to files
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
  logger.add(new winston.transports.File({ filename: 'logs/combined.log' }));
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request processed', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent')
    });
  });

  next();
}

// Helmet configuration for secure HTTP headers
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  crossOriginEmbedderPolicy: false, // Allow embedding from apps
});

// Rate limiting: 600 requests per 15 minutes per IP
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // Limit each IP to 600 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip || req.socket.remoteAddress,
      url: req.originalUrl
    });
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.'
    });
  }
});

// CORS configuration for customer-app and admin-app origins
export function getCorsOptions() {
  const allowedOrigins = [
    'http://localhost:5173', // Vite dev server default
    'http://localhost:5174', // Vite dev server alt
    'http://localhost:5175', // Vite dev server alt
    'http://localhost:5176', // Vite dev server alt
    'http://localhost:3000', // Production customer-app
    'http://localhost:3001', // Production admin-app
    process.env.CUSTOMER_APP_URL,
    process.env.ADMIN_APP_URL
  ].filter(Boolean) as string[];

  return {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps, Postman, or server-to-server)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked request', { origin });
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };
}
