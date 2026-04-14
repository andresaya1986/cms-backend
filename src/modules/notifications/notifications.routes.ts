// ─── Notifications ────────────────────────
import { Router } from 'express';
import { prisma } from '../../shared/config/databases';
import { authenticate } from '../../shared/middleware/authenticate';

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

notificationsRouter.patch('/read-all', authenticate, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true, readAt: new Date() },
  });
  res.json({ message: 'Notificaciones marcadas como leídas' });
});

notificationsRouter.patch('/:id/read', authenticate, async (req, res) => {
  await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.user!.id },
    data: { read: true, readAt: new Date() },
  });
  res.json({ message: 'Notificación leída' });
});
