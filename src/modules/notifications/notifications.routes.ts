// ─── Notifications ────────────────────────
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/config/databases';
import { authenticate } from '../../shared/middleware/authenticate';
import { validate } from '../../shared/middleware/validate';
import { AppError } from '../../shared/errors/AppError';

export const notificationsRouter = Router();

// GET todas las notificaciones del usuario autenticado
const notificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
    unreadOnly: z.enum(['true', 'false']).transform(v => v === 'true').default('false'),
  }),
});

notificationsRouter.get('/', authenticate, validate(notificationsSchema), async (req, res) => {
  const { page, limit, unreadOnly } = req.query as any;
  const userId = req.user!.id;
  
  const where: any = { userId };
  if (unreadOnly) where.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  // Procesar notificaciones para obtener datos del actor si está disponible
  const processedNotifications = notifications.map((n) => {
    // Si la notificación tiene data con información del usuario, la incluimos
    const actorData = (n.data as any)?.actor;
    
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      actor: actorData || null,
      isRead: n.read,
      createdAt: n.createdAt,
    };
  });

  res.json({
    data: processedNotifications,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    },
    unreadCount,
  });
});

// GET notificaciones no leídas (lightweight para actualizaciones frecuentes)
notificationsRouter.get('/unread/count', authenticate, async (req, res) => {
  const [unreadCount, total] = await Promise.all([
    prisma.notification.count({
      where: { userId: req.user!.id, read: false },
    }),
    prisma.notification.count({
      where: { userId: req.user!.id },
    }),
  ]);

  res.json({ unreadCount, total });
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
        type: type as any,
      },
      skip: (page - 1) * limit,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({
      where: { userId: req.user!.id, type: type as any },
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
  const { id } = req.params;
  const userId = req.user!.id;

  // Verificar que la notificación existe y pertenece al usuario
  const notification = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notification) {
    throw new AppError('Notificación no encontrada', 404);
  }

  if (notification.userId !== userId) {
    throw new AppError('No tienes permiso para actualizar esta notificación', 403);
  }

  // Actualizar notificación
  const updated = await prisma.notification.update({
    where: { id },
    data: { read: true, readAt: new Date() },
  });

  // Emitir evento en tiempo real
  const io = res.req.app.get('io');
  if (io) {
    io.to(`user:${userId}`).emit('notification:read', {
      notificationId: id,
      timestamp: new Date(),
    });
  }

  res.json({
    id: updated.id,
    isRead: updated.read,
  });
});

// DELETE notificación
notificationsRouter.delete('/:id', authenticate, async (req, res) => {
  const result = await prisma.notification.deleteMany({
    where: { id: req.params.id, userId: req.user!.id },
  });

  if (result.count === 0) {
    throw new AppError('Notificación no encontrada', 404);
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
