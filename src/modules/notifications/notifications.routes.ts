// ─── Notifications ────────────────────────
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/config/databases';
import { authenticate } from '../../shared/middleware/authenticate';
import { validate } from '../../shared/middleware/validate';

export const notificationsRouter = Router();

notificationsRouter.get('/', authenticate, async (req, res) => {
  const { page = 1, limit = 20, unread } = req.query as any;
  const where: any = { userId: req.user!.id };
  if (unread === 'true') where.read = false;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where: { userId: req.user!.id, read: false } }),
  ]);

  res.json({ data: notifications, unreadCount });
});

// GET notificaciones no leídas (lightweight para actualizaciones frecuentes)
notificationsRouter.get('/unread/count', authenticate, async (req, res) => {
  const unreadCount = await prisma.notification.count({
    where: { userId: req.user!.id, read: false },
  });

  res.json({ unreadCount });
});

// GET notificaciones por tipo
const notificationsByTypeSchema = z.object({
  query: z.object({
    type: z.string(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
  }),
});

notificationsRouter.get('/type/:type', authenticate, validate(notificationsByTypeSchema), async (req, res) => {
  const { type } = req.params;
  const { page, limit } = req.query as any;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: req.user!.id,
        type,
      },
      skip: (page - 1) * limit,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({
      where: { userId: req.user!.id, type },
    }),
  ]);

  res.json({
    data: notifications,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
    type,
  });
});

notificationsRouter.patch('/read-all', authenticate, async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true, readAt: new Date() },
  });

  // Emitir evento en tiempo real
  const io = res.req.app.get('io');
  if (io) {
    io.to(`user:${req.user!.id}`).emit('notification:all-read', {
      count: result.count,
      timestamp: new Date(),
    });
  }

  res.json({ message: `${result.count} notificaciones marcadas como leídas`, count: result.count });
});

notificationsRouter.patch('/:id/read', authenticate, async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { read: true, readAt: new Date() },
  });

  if (result.count === 0) {
    return res.status(404).json({ message: 'Notificación no encontrada' });
  }

  // Emitir evento en tiempo real
  const io = res.req.app.get('io');
  if (io) {
    io.to(`user:${req.user!.id}`).emit('notification:read', {
      notificationId: req.params.id,
      timestamp: new Date(),
    });
  }

  res.json({ message: 'Notificación leída' });
});

// DELETE notificación
notificationsRouter.delete('/:id', authenticate, async (req, res) => {
  const result = await prisma.notification.deleteMany({
    where: { id: req.params.id, userId: req.user!.id },
  });

  if (result.count === 0) {
    return res.status(404).json({ message: 'Notificación no encontrada' });
  }

  // Emitir evento en tiempo real
  const io = res.req.app.get('io');
  if (io) {
    io.to(`user:${req.user!.id}`).emit('notification:deleted', {
      notificationId: req.params.id,
      timestamp: new Date(),
    });
  }

  res.json({ message: 'Notificación eliminada' });
});

// DELETE todas las notificaciones leídas
notificationsRouter.delete('/all/read', authenticate, async (req, res) => {
  const result = await prisma.notification.deleteMany({
    where: { userId: req.user!.id, read: true },
  });

  // Emitir evento en tiempo real
  const io = res.req.app.get('io');
  if (io) {
    io.to(`user:${req.user!.id}`).emit('notification:cleared', {
      count: result.count,
      timestamp: new Date(),
    });
  }

  res.json({ message: `${result.count} notificaciones eliminadas`, count: result.count });
});
