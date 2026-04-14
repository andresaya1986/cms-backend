import { Router } from 'express';
import mongoose, { Schema, model } from 'mongoose';
import { authenticate } from '../../shared/middleware/authenticate';
import { AppError } from '../../shared/errors/AppError';

export const analyticsRouter = Router();

// ─────────────────────────────────────────
//  Modelo MongoDB — Eventos de analítica
// ─────────────────────────────────────────
const eventSchema = new Schema(
  {
    // Identificación
    sessionId: { type: String, index: true },
    userId: { type: String, index: true, sparse: true },

    // Evento
    name: { type: String, required: true, index: true },
    category: {
      type: String,
      enum: ['pageview', 'engagement', 'conversion', 'social', 'error', 'custom'],
      index: true,
    },
    properties: { type: Schema.Types.Mixed },

    // Contexto
    url: String,
    referrer: String,
    userAgent: String,
    ip: String,
    country: String,
    device: { type: String, enum: ['desktop', 'mobile', 'tablet', 'unknown'] },

    // Timing
    duration: Number,     // ms en página
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    collection: 'events',
    timestamps: false,
  },
);

// TTL: conservar eventos por 2 años
eventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 63_072_000 });

const Event = mongoose.models.Event || model('Event', eventSchema);

// ─────────────────────────────────────────
//  POST /api/v1/analytics/track
//  Recibe eventos desde el cliente
// ─────────────────────────────────────────
analyticsRouter.post('/track', async (req, res) => {
  const {
    sessionId, name, category = 'custom',
    properties, url, referrer, duration,
  } = req.body;

  if (!name) throw new AppError('El nombre del evento es requerido', 400);

  const userAgent = req.headers['user-agent'] || '';
  const device = detectDevice(userAgent);

  await Event.create({
    sessionId,
    userId: (req as any).user?.id,
    name,
    category,
    properties,
    url,
    referrer,
    userAgent,
    ip: req.ip,
    device,
    duration,
  });

  res.status(202).json({ ok: true });
});

/**
 * POST /api/v1/analytics/batch
 * Recibe múltiples eventos de una vez (para reducir requests)
 */
analyticsRouter.post('/batch', async (req, res) => {
  const { events } = req.body;
  if (!Array.isArray(events) || events.length === 0) {
    throw new AppError('Se esperaba un array de eventos', 400);
  }
  if (events.length > 50) throw new AppError('Máximo 50 eventos por batch', 400);

  const userAgent = req.headers['user-agent'] || '';
  const device = detectDevice(userAgent);
  const userId = (req as any).user?.id;

  const docs = events.map((e: any) => ({
    sessionId: e.sessionId,
    userId,
    name: e.name,
    category: e.category || 'custom',
    properties: e.properties,
    url: e.url,
    referrer: e.referrer,
    userAgent,
    ip: req.ip,
    device,
    duration: e.duration,
  }));

  await Event.insertMany(docs, { ordered: false });
  res.status(202).json({ ok: true, count: docs.length });
});

/**
 * GET /api/v1/analytics/dashboard
 * Métricas del dashboard (protegido, solo admins)
 */
analyticsRouter.get('/dashboard', authenticate, async (req, res) => {
  const { from, to } = req.query;
  const start = from ? new Date(from as string) : new Date(Date.now() - 30 * 86400000);
  const end = to ? new Date(to as string) : new Date();

  const [pageviews, topPages, deviceBreakdown, eventsByDay] = await Promise.all([
    // Total pageviews
    Event.countDocuments({ category: 'pageview', timestamp: { $gte: start, $lte: end } }),

    // Top páginas
    Event.aggregate([
      { $match: { category: 'pageview', timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: '$url', count: { $sum: 1 }, avgDuration: { $avg: '$duration' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),

    // Dispositivos
    Event.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      { $group: { _id: '$device', count: { $sum: 1 } } },
    ]),

    // Eventos por día
    Event.aggregate([
      { $match: { timestamp: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 },
          uniqueSessions: { $addToSet: '$sessionId' },
        },
      },
      { $addFields: { uniqueSessions: { $size: '$uniqueSessions' } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    period: { from: start, to: end },
    summary: { pageviews },
    topPages,
    deviceBreakdown,
    eventsByDay,
  });
});

/**
 * GET /api/v1/analytics/posts/:postId
 * Analytics de un post específico
 */
analyticsRouter.get('/posts/:postId', authenticate, async (req, res) => {
  const { postId } = req.params;
  const { days = '30' } = req.query;
  const start = new Date(Date.now() - Number(days) * 86400000);

  const stats = await Event.aggregate([
    {
      $match: {
        'properties.postId': postId,
        timestamp: { $gte: start },
      },
    },
    {
      $group: {
        _id: '$name',
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' },
      },
    },
  ]);

  res.json({ postId, days: Number(days), stats });
});

// ─────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────
function detectDevice(userAgent: string): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
  if (!userAgent) return 'unknown';
  if (/tablet|ipad|playbook|silk/i.test(userAgent)) return 'tablet';
  if (/mobile|android|iphone|ipod|windows phone/i.test(userAgent)) return 'mobile';
  if (/mozilla|chrome|safari|firefox|msie|trident/i.test(userAgent)) return 'desktop';
  return 'unknown';
}
