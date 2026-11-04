import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import config from './config/index.js';
import logger from './utils/logger.js';
import { errorHandler, AppError } from './middlewares/errorHandler.js';
import { prisma } from './utils/prisma.js';
import authRoutes from './modules/auth/auth.routes.js';
import registrationRoutes from './modules/registration/registration.routes.js';
import documentRoutes from './modules/documents/document.routes.js';
import validationRoutes from './modules/validation/validation.routes.js';
import badgeRoutes from './modules/badges/badge.routes.js';
import licenceRoutes from './modules/licences/licence.routes.js';
import transportLinesRoutes from './modules/transport-lines/transport-lines.routes.js';
import ticketingRoutes from './modules/ticketing/ticketing.routes.js';
import syncRoutes from './modules/sync/sync.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';

const app = express();

// 1. Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Will configure specific CSP when static assets are served
  crossOriginEmbedderPolicy: false,
}));

// 2. Strict Cross-Origin Resource Sharing (CORS)
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman) or matching origin
    if (!origin || origin === config.CORS_ORIGIN || config.NODE_ENV === 'development') {
      return callback(null, true);
    }
    return callback(new AppError('Accès refusé par la politique CORS.', 403, 'CORS_ERROR'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Correlation-Id'],
}));

// 3. Body Parsing with strict limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Request Logging
const morganFormat = config.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.http(message.trim()),
  },
}));

// 5. Health Check Endpoint (System & Database status)
app.get('/api/v1/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let postgisStatus = 'unknown';

  try {
    // Probe database connection and PostGIS extension
    const result = await prisma.$queryRaw`SELECT PostGIS_Version() as postgis, NOW() as current_time;`;
    if (result && result.length > 0) {
      dbStatus = 'connected';
      postgisStatus = result[0].postgis || 'available';
    }
  } catch (err) {
    dbStatus = 'error';
    logger.warn('Health check database probe failed', { error: err.message });
  }

  const isHealthy = dbStatus === 'connected';

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'AOTUC-TRANSPORT-API',
    version: '2.0.0',
    environment: config.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    components: {
      database: dbStatus,
      postgis: postgisStatus,
    },
  });
});

// 6. API Route Modules
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/registration', registrationRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/validation', validationRoutes);
app.use('/api/v1/badges', badgeRoutes);
app.use('/api/v1/licences', licenceRoutes);
app.use('/api/v1/transport-lines', transportLinesRoutes);
app.use('/api/v1/ticketing', ticketingRoutes);
app.use('/api/v1/sync', syncRoutes);
app.use('/api/v1/notifications', notificationsRoutes);

// 7. 404 Route Not Found Handler
app.use((req, res, next) => {
  next(new AppError(`Ressource non trouvée : ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
});

// 7. Centralized Error Handler
app.use(errorHandler);

export default app;
