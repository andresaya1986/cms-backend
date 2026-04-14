import { Request, Response, NextFunction, Router } from 'express';
import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

collectDefaultMetrics({ prefix: 'cms_' });

// ── Contadores ────────────────────────────
export const httpRequestsTotal = new Counter({
  name: 'cms_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

export const authAttemptsTotal = new Counter({
  name: 'cms_auth_attempts_total',
  help: 'Total auth attempts',
  labelNames: ['type', 'result'],
});

export const postsCreatedTotal = new Counter({
  name: 'cms_posts_created_total',
  help: 'Total posts created',
  labelNames: ['type'],
});

// ── Histogramas ───────────────────────────
export const httpDuration = new Histogram({
  name: 'cms_http_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const dbQueryDuration = new Histogram({
  name: 'cms_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

// ── Gauges ────────────────────────────────
export const activeConnections = new Gauge({
  name: 'cms_active_websocket_connections',
  help: 'Active WebSocket connections',
});

// ── Middleware ────────────────────────────
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    httpRequestsTotal.inc({ method: req.method, route, status: res.statusCode });
    httpDuration.observe({ method: req.method, route, status: res.statusCode }, duration);
  });
  next();
}

export const metricsRouter = Router();
metricsRouter.get('/', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
