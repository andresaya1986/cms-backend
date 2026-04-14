import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { logger } from './logger';
import { activeConnections } from './metrics';

// Map userId → Set<socketId> para enviar a múltiples dispositivos
const userSockets = new Map<string, Set<string>>();

export function initSocketHandlers(io: Server) {
  // ── Middleware de autenticación ───────────
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) return next(new Error('Token requerido'));

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as any;
      (socket as any).userId = payload.sub;
      (socket as any).role = payload.role;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId as string;
    logger.debug({ userId, socketId: socket.id }, 'WebSocket connected');
    activeConnections.inc();

    // Registrar socket del usuario
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId)!.add(socket.id);

    // Unirse a sala personal
    socket.join(`user:${userId}`);

    // ── Eventos del cliente ───────────────────
    socket.on('join:post', (postId: string) => {
      socket.join(`post:${postId}`);
    });

    socket.on('leave:post', (postId: string) => {
      socket.leave(`post:${postId}`);
    });

    socket.on('typing:start', ({ postId }: { postId: string }) => {
      socket.to(`post:${postId}`).emit('typing:start', { userId });
    });

    socket.on('typing:stop', ({ postId }: { postId: string }) => {
      socket.to(`post:${postId}`).emit('typing:stop', { userId });
    });

    socket.on('disconnect', () => {
      activeConnections.dec();
      userSockets.get(userId)?.delete(socket.id);
      if (userSockets.get(userId)?.size === 0) userSockets.delete(userId);
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
  io.emit(event, data);
}
