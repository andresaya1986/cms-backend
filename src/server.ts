import 'express-async-errors';
import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';

import { env } from './shared/config/env';
import { logger } from './shared/config/logger';
import { connectDatabases, closeDatabases } from './shared/config/databases';
import { metricsMiddleware, metricsRouter } from './shared/config/metrics';
import { setupSwagger } from './shared/config/swagger';
import { errorHandler } from './shared/middleware/errorHandler';
import { notFoundHandler } from './shared/middleware/notFoundHandler';
import { rateLimiter } from './shared/middleware/rateLimiter';
import { initSocketHandlers } from './shared/config/socket';

// Módulos
import { authRouter } from './modules/auth/auth.routes';
import { cmsRouter } from './modules/cms/cms.routes';
import { socialRouter } from './modules/social/social.routes';
import { analyticsRouter } from './modules/analytics/analytics.routes';
import { notificationsRouter } from './modules/notifications/notifications.routes';
import { mediaRouter } from './modules/media/media.routes';
import { searchRouter } from './modules/search/search.routes';
import { commentsRouter } from './modules/comments/comments.routes';

async function bootstrap() {
  // ── App Express ──────────────────────────
  const app = express();
  const server = http.createServer(app);

  // ── Socket.io ────────────────────────────
  const io = new SocketServer(server, {
    cors: {
      origin: env.CORS_ORIGINS.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
  initSocketHandlers(io);
  app.set('io', io);

  // ── Seguridad ─────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        const allowed = env.CORS_ORIGINS.split(',').map((o) => o.trim());
        if (!origin || allowed.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      },
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    }),
  );

  // ── Parsing & utilidades ──────────────────
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // ── Logging HTTP ──────────────────────────
  app.use(pinoHttp({ logger }));

  // ── Métricas Prometheus ───────────────────
  app.use(metricsMiddleware);
  app.use('/metrics', metricsRouter);

  // ── Rate limiting global ──────────────────
  app.use('/api', rateLimiter.global);

  // ── Health check ──────────────────────────
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version,
    });
  });

  // ── OpenAPI / Swagger ───────────────────
  setupSwagger(app);

  // Compatibilidad para probes de navegación Next.js mal dirigidos al backend.
  // Evita 404 en consola cuando se solicita /auth/*/_next_tree.txt con header rsc.
  app.get(
    [
      '/auth/:page/_next_tree.txt',
      '/auth/:page/_next._tree.txt',
      '/api/v1/auth/:page/_next_tree.txt',
      '/api/v1/auth/:page/_next._tree.txt',
    ],
    (_req, res) => {
      res.type('text/plain').status(200).send('');
    },
  );

  // ── Rutas ─────────────────────────────────
  // Compatibilidad: algunas integraciones consumen /auth/* sin prefijo de versión.
  // Se mantiene /api/v1/auth como ruta principal y soportamos /auth temporalmente.
  app.use('/api/v1/auth', rateLimiter.auth, authRouter);
  app.use('/auth', rateLimiter.auth, authRouter);
  app.use('/api/v1/posts', cmsRouter);
  app.use('/api/v1/social', socialRouter);
  app.use('/api/v1/analytics', analyticsRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/media', mediaRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/comments', commentsRouter);

  // ── Manejo de errores ─────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  // ── Bases de datos ────────────────────────
  await connectDatabases();

  // ── Inicio del servidor ───────────────────
  server.listen(env.API_PORT, () => {
    logger.info(`🚀 Server running on port ${env.API_PORT} [${env.NODE_ENV}]`);
  });

  // ── Graceful shutdown ─────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await closeDatabases();
      logger.info('Server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 30_000); // forzar en 30s
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'Uncaught exception');
    shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
  });
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
