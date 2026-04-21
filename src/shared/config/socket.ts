import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { logger } from './logger';
import { activeConnections } from './metrics';
import { prisma } from './databases';

// Map userId → Set<socketId> para enviar a múltiples dispositivos
const userSockets = new Map<string, Set<string>>();
const userPresence = new Map<string, { socketId: string; lastSeen: Date }>();

export function initSocketHandlers(io: Server) {
  // ── Middleware de autenticación ───────────
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Token requerido'));

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as any;
      (socket as any).userId = payload.sub;
      (socket as any).role = payload.role;
      (socket as any).username = payload.username;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId as string;
    const username = (socket as any).username as string;

    logger.debug({ userId, socketId: socket.id, username }, 'WebSocket connected');
    activeConnections.inc();

    // Registrar socket del usuario
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);

    // Registrar presencia
    userPresence.set(userId, { socketId: socket.id, lastSeen: new Date() });

    // Unirse a sala personal
    socket.join(`user:${userId}`);
    socket.join('global');

    // ── Notificación de online ──────────────
    io.emit('user:online', {
      userId,
      username,
      timestamp: new Date(),
    });

    // ── Eventos del cliente ───────────────────
    socket.on('join:post', (postId: string) => {
      socket.join(`post:${postId}`);
      logger.debug({ userId, postId }, 'Joined post room');

      // Notificar que el usuario está viendo este post (opcional)
      socket.to(`post:${postId}`).emit('post:viewer:joined', {
        userId,
        username,
        postId,
        timestamp: new Date(),
      });
    });

    socket.on('leave:post', (postId: string) => {
      socket.leave(`post:${postId}`);
      logger.debug({ userId, postId }, 'Left post room');

      socket.to(`post:${postId}`).emit('post:viewer:left', {
        userId,
        postId,
        timestamp: new Date(),
      });
    });

    socket.on('typing:start', ({ postId }: { postId: string }) => {
      socket.to(`post:${postId}`).emit('typing:start', { userId, username, postId });
    });

    socket.on('typing:stop', ({ postId }: { postId: string }) => {
      socket.to(`post:${postId}`).emit('typing:stop', { userId, postId });
    });

    // ── Actualización de notificaciones ──────
    socket.on('notification:mark-read', async (notificationId: string) => {
      try {
        await prisma.notification.update({
          where: { id: notificationId },
          data: { read: true, readAt: new Date() },
        });
        socket.emit('notification:marked-read', { notificationId });
      } catch (error) {
        logger.error({ notificationId, error }, 'Error marking notification as read');
      }
    });

    socket.on('notification:mark-all-read', async () => {
      try {
        const result = await prisma.notification.updateMany({
          where: { userId, read: false },
          data: { read: true, readAt: new Date() },
        });
        socket.emit('notification:all-marked-read', { count: result.count });
      } catch (error) {
        logger.error({ userId, error }, 'Error marking all notifications as read');
      }
    });

    // ── Ping/Pong para keep-alive ───────────
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });

    // ── Reacciones en tiempo real ────────────
    socket.on('reaction:add', ({ postId, type }: { postId: string; type: string }) => {
      socket.to(`post:${postId}`).emit('reaction:added', {
        userId,
        username,
        postId,
        type,
        timestamp: new Date(),
      });
    });

    socket.on('reaction:remove', ({ postId, type }: { postId: string; type: string }) => {
      socket.to(`post:${postId}`).emit('reaction:removed', {
        userId,
        postId,
        type,
        timestamp: new Date(),
      });
    });

    // ── Comentarios en tiempo real ───────────
    socket.on('comment:added', ({ postId, commentId }: { postId: string; commentId: string }) => {
      socket.to(`post:${postId}`).emit('comment:added', {
        userId,
        username,
        postId,
        commentId,
        timestamp: new Date(),
      });
    });

    socket.on('comment:deleted', ({ postId, commentId }: { postId: string; commentId: string }) => {
      socket.to(`post:${postId}`).emit('comment:deleted', {
        userId,
        postId,
        commentId,
        timestamp: new Date(),
      });
    });

    // ── Followers/Following en tiempo real ────
    socket.on('user:followed', ({ followedUserId, followerCount }: { followedUserId: string; followerCount: number }) => {
      io.to(`user:${followedUserId}`).emit('follower:gained', {
        follower: { id: userId, username },
        followerCount,
        timestamp: new Date(),
      });
    });

    socket.on('user:unfollowed', ({ unfollowedUserId }: { unfollowedUserId: string }) => {
      io.to(`user:${unfollowedUserId}`).emit('follower:lost', {
        followerId: userId,
        timestamp: new Date(),
      });
    });

    socket.on('disconnect', () => {
      activeConnections.dec();
      userSockets.get(userId)?.delete(socket.id);
      if (userSockets.get(userId)?.size === 0) {
        userSockets.delete(userId);
        userPresence.delete(userId);

        // Notificar que el usuario está offline
        io.emit('user:offline', {
          userId,
          timestamp: new Date(),
        });
      }
      logger.debug({ userId, socketId: socket.id }, 'WebSocket disconnected');
    });
  });
}

// ── Helpers para emitir desde otros módulos ──
export function emitToUser(io: Server, userId: string, event: string, data: unknown) {
  io.to(`user:${userId}`).emit(event, data);
}

export function emitToPost(io: Server, postId: string, event: string, data: unknown) {
  io.to(`post:${postId}`).emit(event, data);
}

export function broadcastToAll(io: Server, event: string, data: unknown) {
  io.to('global').emit(event, data);
}

/**
 * Obtener usuarios activos viendo un post
 */
export function getPostViewers(io: Server, postId: string): string[] {
  const room = io.sockets.adapter.rooms.get(`post:${postId}`);
  return room ? Array.from(room) : [];
}

/**
 * Verificar si un usuario está online
 */
export function isUserOnline(userId: string): boolean {
  return userSockets.has(userId) && userSockets.get(userId)!.size > 0;
}

/**
 * Obtener todos los usuarios online
 */
export function getOnlineUsers(): string[] {
  return Array.from(userSockets.keys());
}
