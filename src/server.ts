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

const app = express();

/* -------------------------------------------------
   Trust proxy (important for rate limit + nginx)
-------------------------------------------------- */
app.set('trust proxy', 1);

/* -------------------------------------------------
   Debug Middleware (Development Only)
-------------------------------------------------- */
if (config.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`🔄 ${req.method} ${req.url} from origin: ${req.headers.origin || 'unknown'}`);
    next();
  });
}

/* -------------------------------------------------
   CORS (ONLY ONE – PRODUCTION SAFE)
-------------------------------------------------- */
if (config.NODE_ENV === 'development') {
  // Very permissive CORS for development
  app.use(cors({
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    optionsSuccessStatus: 204,
  }));
  console.log('🔓 CORS: Allowing ALL origins in development mode');
} else {
  // Strict CORS for production
  app.use(cors({
    origin: (origin, callback) => {
      console.log('🔍 CORS Check - Origin:', origin, 'Environment:', config.NODE_ENV);
      
      // Allow non-browser tools (curl, server-to-server)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        'https://shop.hiprotech.org',
        'https://adminshop.hiprotech.org',
      ];

      if (allowedOrigins.includes(origin)) {
        console.log('✅ CORS Allow - Production origin:', origin);
        return callback(null, true);
      }

      console.log('❌ CORS Block - Origin not allowed:', origin);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    optionsSuccessStatus: 204,
  }));
}

/* -------------------------------------------------
   Security & Core Middleware
-------------------------------------------------- */
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cookieParser());
app.use(mongoSanitize());

/* -------------------------------------------------
   Logging
   ------------------------------------------------- */
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
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
});
app.use(limiter);

/* -------------------------------------------------
   Health Check
-------------------------------------------------- */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    environment: config.NODE_ENV,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customSiteTitle: 'HiproTech Commerce API Docs',
}));

app.get('/docs', (_, res) => res.redirect('/api/docs'));

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

    const server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`🚀 API running on http://127.0.0.1:${PORT}`);
      console.log(`📚 Docs: http://127.0.0.1:${PORT}/api/docs`);
      console.log(`🌍 Environment: ${config.NODE_ENV}`);
    });

    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.log(`💡 To free up port ${PORT}, disable AirPlay Receiver in System Preferences > Sharing`);
        console.log(`💡 Or use: sudo lsof -ti:${PORT} | xargs kill -9`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', error);
        process.exit(1);
      }
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
