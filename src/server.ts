import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';

import swaggerSpecs from './config/swagger.js';
import { config } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';

// Routes
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import productRoutes from './routes/products.js';
import inventoryRoutes from './routes/inventory.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import paymentsRoutes from './routes/payments.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';
import customerRoutes from './routes/customers.js';
import profileRoutes from './routes/profile.js';
import uploadRoutes from './routes/upload.js';

const app = express();

/* -------------------------------------------------
   Trust proxy (nginx + rate limit)
-------------------------------------------------- */
app.set('trust proxy', 1);

/* -------------------------------------------------
   CORS (ONLY ONE — FIXED)
-------------------------------------------------- */
if (config.NODE_ENV === 'development') {
  console.log('🔓 CORS: Allow all origins (development)');
  app.use(cors({
    origin: true,
    credentials: true,
  }));
} else {
  console.log('🔒 CORS: Production mode');
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        'https://shop.hiprotech.org',
        'https://adminshop.hiprotech.org',
      ];

      if (allowedOrigins.includes(origin)) {
        return callback(null, origin); // ✅ VERY IMPORTANT
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
}

/* -------------------------------------------------
   Security & Core Middleware
-------------------------------------------------- */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());

// Increase body parser limits for file uploads (especially videos up to 50MB)
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));
app.use(cookieParser());
app.use(mongoSanitize());

/* -------------------------------------------------
   Logging
-------------------------------------------------- */
if (config.NODE_ENV !== 'test') {
  app.use(morgan(config.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

/* -------------------------------------------------
   Rate Limiting
-------------------------------------------------- */
const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

/* -------------------------------------------------
   Health Check
-------------------------------------------------- */
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    env: config.NODE_ENV,
    uptime: process.uptime(),
  });
});

/* -------------------------------------------------
   Swagger
-------------------------------------------------- */
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
app.get('/docs', (_, res) => res.redirect('/api/docs'));

/* -------------------------------------------------
   Static Files
-------------------------------------------------- */
app.use('/uploads', express.static('uploads'));

/* -------------------------------------------------
   API Routes (v1)
-------------------------------------------------- */
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/upload', uploadRoutes);

/* -------------------------------------------------
   Error Handling
-------------------------------------------------- */
app.use(notFound);
app.use(errorHandler);

/* -------------------------------------------------
   Server Bootstrap
-------------------------------------------------- */
const startServer = async () => {
  try {
    await connectDatabase();

    const PORT = config.PORT;

    app.listen(PORT, '127.0.0.1', () => {
      console.log(`🚀 API running on http://127.0.0.1:${PORT}`);
      console.log(`🌍 Environment: ${config.NODE_ENV}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();

export default app;
