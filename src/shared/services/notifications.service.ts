import { Server as SocketServer } from 'socket.io';
import { prisma } from '../config/databases';
import { logger } from '../config/logger';

export interface RealtimeNotification {
  id?: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  createdAt?: Date;
}

/**
 * Crear notificación en DB y emitir en tiempo real vía Socket.io
 */
export async function notifyUser(
  io: SocketServer,
  userId: string,
  notification: RealtimeNotification,
) {
  try {
    // Guardar en DB
    const saved = await prisma.notification.create({
      data: {
        userId,
        type: notification.type as any,
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
      },
    });

    // Emitir en tiempo real al usuario
    io.to(`user:${userId}`).emit('notification:new', {
      id: saved.id,
      type: saved.type,
      title: saved.title,
      body: saved.body,
      data: saved.data,
      createdAt: saved.createdAt,
    });

    logger.debug({ userId, notificationId: saved.id }, 'Real-time notification sent');
    return saved;
  } catch (error) {
    logger.error({ userId, notification, error }, 'Error notifying user');
    throw error;
  }
}

/**
 * Notificar múltiples usuarios (batch)
 */
export async function notifyUsers(
  io: SocketServer,
  userIds: string[],
  notification: RealtimeNotification,
) {
  try {
    const notifications = userIds.map((userId) => ({
      userId,
      type: notification.type as any,
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
    }));

    // Batch insert en DB
    const created = await prisma.notification.createMany({
      data: notifications,
    });

    // Emitir a cada usuario
    userIds.forEach((userId) => {
      io.to(`user:${userId}`).emit('notification:new', {
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        createdAt: new Date(),
      });
    });

    logger.debug({ userIds, count: created.count }, 'Batch notifications sent');
    return created;
  } catch (error) {
    logger.error({ userIds, notification, error }, 'Error batch notifying');
    throw error;
  }
}

/**
 * Emitir evento en tiempo real a usuarios viendo un post
 */
export function emitPostEvent(
  io: SocketServer,
  postId: string,
  event: string,
  data: Record<string, any>,
) {
  io.to(`post:${postId}`).emit(event, {
    postId,
    ...data,
    timestamp: new Date(),
  });

  logger.debug({ postId, event }, 'Post event emitted');
}

/**
 * Notificar followers de un usuario sobre su actividad
 */
export async function notifyFollowers(
  io: SocketServer,
  userId: string,
  event: 'NEW_POST' | 'NEW_COMMENT',
  data: Record<string, any>,
) {
  try {
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      select: { followerId: true },
    });

    const followerIds = followers.map((f) => f.followerId);

    if (followerIds.length === 0) return;

    // Emitir a cada seguidor en tiempo real
    followerIds.forEach((followerId) => {
      io.to(`user:${followerId}`).emit(`follower:${event.toLowerCase()}`, {
        userId,
        ...data,
        timestamp: new Date(),
      });
    });

    logger.debug({ userId, followerCount: followerIds.length, event }, 'Followers notified');
  } catch (error) {
    logger.error({ userId, event, error }, 'Error notifying followers');
  }
}

/**
 * Notificar al autor cuando algo sucede en su post (reacción, comentario, compartición)
 */
export async function notifyPostAuthor(
  io: SocketServer,
  postId: string,
  event: 'REACTION' | 'COMMENT' | 'SHARE' | 'MENTION',
  data: Record<string, any>,
) {
  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (!post) return;

    // No notificar si el que actúa es el autor
    if (data.userId === post.authorId) return;

    io.to(`user:${post.authorId}`).emit(`post:${event.toLowerCase()}`, {
      postId,
      ...data,
      timestamp: new Date(),
    });

    logger.debug({ postId, authorId: post.authorId, event }, 'Post author notified');
  } catch (error) {
    logger.error({ postId, event, error }, 'Error notifying post author');
  }
}

/**
 * Emitir actualización de contadores (reacciones, comentarios, etc.) en tiempo real
 */
export function emitCounterUpdate(
  io: SocketServer,
  postId: string,
  counters: {
    reactionsCount?: number;
    commentsCount?: number;
    sharesCount?: number;
    bookmarksCount?: number;
    viewCount?: number;
  },
) {
  io.to(`post:${postId}`).emit('post:counters', {
    postId,
    ...counters,
    timestamp: new Date(),
  });
}

/**
 * Notificar a usuarios mencionados
 */
export async function notifyMentionedUsers(
  io: SocketServer,
  mentionedUserIds: string[],
  mentioningUserId: string,
  contextType: 'POST' | 'COMMENT',
  data: Record<string, any>,
) {
  try {
    // Get mentioning user info
    const mentioningUser = await prisma.user.findUnique({
      where: { id: mentioningUserId },
      select: { username: true, displayName: true },
    });

    if (!mentioningUser) return;

    mentionedUserIds.forEach((mentionedUserId) => {
      // No auto-mencionar
      if (mentionedUserId === mentioningUserId) return;

      io.to(`user:${mentionedUserId}`).emit('mention:new', {
        type: contextType === 'POST' ? 'POST_MENTION' : 'COMMENT_MENTION',
        title: `@${mentioningUser.username} te mencionó`,
        body: contextType === 'POST' ? 'Te mencionaron en un post' : 'Te mencionaron en un comentario',
        mentioningUser: {
          id: mentioningUserId,
          username: mentioningUser.username,
          displayName: mentioningUser.displayName,
        },
        ...data,
        timestamp: new Date(),
      });
    });

    logger.debug({ mentionedUserIds, mentioningUserId, contextType }, 'Mentioned users notified');
  } catch (error) {
    logger.error({ mentionedUserIds, mentioningUserId, error }, 'Error notifying mentioned users');
  }
}

/**
 * Emitir evento de typing/digitación
 */
export function emitTyping(io: SocketServer, postId: string, userId: string, isTyping: boolean) {
  io.to(`post:${postId}`).emit(isTyping ? 'typing:start' : 'typing:stop', {
    userId,
    postId,
    timestamp: new Date(),
  });
}

/**
 * Emitir actividad de usuario (online/offline)
 */
export function emitUserPresence(io: SocketServer, userId: string, status: 'online' | 'offline') {
  // Emitir a todos excepto el usuario mismo
  io.to('global').emit('user:presence', {
    userId,
    status,
    timestamp: new Date(),
  });
}
