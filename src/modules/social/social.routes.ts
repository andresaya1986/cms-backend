import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/config/databases';
import { authenticate } from '../../shared/middleware/authenticate';
import { validate } from '../../shared/middleware/validate';
import { AppError } from '../../shared/errors/AppError';

export const socialRouter = Router();

// ─────────────────────────────────────────
//  FOLLOW / UNFOLLOW
// ─────────────────────────────────────────
socialRouter.post('/follow/:userId', authenticate, async (req, res) => {
  const followingId = req.params.userId;
  const followerId = req.user!.id;

  if (followerId === followingId) throw new AppError('No puedes seguirte a ti mismo', 400);

  const target = await prisma.user.findUnique({
    where: { id: followingId },
    select: { id: true, username: true },
  });
  if (!target) throw new AppError('Usuario no encontrado', 404);

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });

  if (existing) {
    await prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId } },
    });
    res.json({ following: false, message: `Dejaste de seguir a @${target.username}` });
    return;
  }

  await prisma.follow.create({ data: { followerId, followingId } });

  // Notificación async
  prisma.notification.create({
    data: {
      userId: followingId,
      type: 'NEW_FOLLOWER',
      title: 'Nuevo seguidor',
      body: `@${req.user!.id} te sigue ahora`,
      data: { followerId },
    },
  }).catch(() => {});

  res.json({ following: true, message: `Ahora sigues a @${target.username}` });
});

// ─────────────────────────────────────────
//  LIKE / UNLIKE (post o comment)
// ─────────────────────────────────────────
const likeSchema = z.object({
  body: z.object({
    targetId: z.string().uuid(),
    targetType: z.enum(['post', 'comment']),
  }),
});

socialRouter.post('/like', authenticate, validate(likeSchema), async (req, res) => {
  const { targetId, targetType } = req.body;
  const userId = req.user!.id;

  const where = targetType === 'post'
    ? { userId_postId: { userId, postId: targetId } }
    : { userId_commentId: { userId, commentId: targetId } };

  const existing = await prisma.reaction.findUnique({ where: where as any });

  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });

    // Decrementar contador
    if (targetType === 'post') {
      await prisma.post.update({ where: { id: targetId }, data: { reactionsCount: { decrement: 1 } } });
    } else {
      await prisma.comment.update({ where: { id: targetId }, data: { reactionsCount: { decrement: 1 } } });
    }

    res.json({ liked: false });
    return;
  }

  await prisma.reaction.create({
    data: {
      userId,
      type: 'LIKE',
      ...(targetType === 'post' ? { postId: targetId } : { commentId: targetId }),
    },
  });

  // Incrementar contador
  if (targetType === 'post') {
    await prisma.post.update({ where: { id: targetId }, data: { reactionsCount: { increment: 1 } } });
  } else {
    await prisma.comment.update({ where: { id: targetId }, data: { reactionsCount: { increment: 1 } } });
  }

  res.json({ liked: true });
});

// ─────────────────────────────────────────
//  FEED personalizado del usuario
// ─────────────────────────────────────────
const feedSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
    type: z.enum(['following', 'discover', 'trending']).default('following'),
  }),
});

socialRouter.get('/feed', authenticate, validate(feedSchema), async (req, res) => {
  const { page, limit, type } = req.query as any;
  const userId = req.user!.id;
  const skip = (page - 1) * limit;

  let posts;

  if (type === 'following') {
    // Posts de usuarios que sigue
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    posts = await prisma.post.findMany({
      where: {
        authorId: { in: followingIds },
        status: 'PUBLISHED',
        visibility: { in: ['PUBLIC', 'FOLLOWERS_ONLY'] },
        deletedAt: null,
      },
      skip,
      take: limit,
      orderBy: { publishedAt: 'desc' },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
        tags: { select: { tag: { select: { id: true, name: true } } } },
      },
    });
  } else if (type === 'trending') {
    // Posts con más engagement en las últimas 48h
    const cutoff = new Date(Date.now() - 48 * 3600 * 1000);
    posts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        publishedAt: { gte: cutoff },
        deletedAt: null,
      },
      skip,
      take: limit,
      orderBy: [{ reactionsCount: 'desc' }, { commentsCount: 'desc' }, { viewCount: 'desc' }],
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        categories: { select: { category: { select: { id: true, name: true } } } },
        tags: { select: { tag: { select: { id: true, name: true } } } },
      },
    });
  } else {
    // Discover: posts públicos recientes
    posts = await prisma.post.findMany({
      where: { status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null },
      skip,
      take: limit,
      orderBy: { publishedAt: 'desc' },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        categories: { select: { category: { select: { id: true, name: true } } } },
        tags: { select: { tag: { select: { id: true, name: true } } } },
      },
    });
  }

  res.json({ data: posts, page, limit });
});

// ─────────────────────────────────────────
//  PERFIL DE USUARIO
// ─────────────────────────────────────────
socialRouter.get('/users/:username', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { username: req.params.username, status: 'ACTIVE', deletedAt: null },
    select: {
      id: true, username: true, displayName: true,
      bio: true, avatarUrl: true, coverUrl: true, role: true,
      createdAt: true,
      _count: {
        select: { followers: true, following: true, posts: true },
      },
    },
  });
  if (!user) throw new AppError('Usuario no encontrado', 404);
  res.json({ data: user });
});

// GET seguidores de un usuario
socialRouter.get('/users/:username/followers', async (req, res) => {
  const { page = 1, limit = 20 } = req.query as any;
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: { id: true },
  });
  if (!user) throw new AppError('Usuario no encontrado', 404);

  const followers = await prisma.follow.findMany({
    where: { followingId: user.id },
    skip: (page - 1) * limit,
    take: Number(limit),
    orderBy: { createdAt: 'desc' },
    select: {
      follower: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
      createdAt: true,
    },
  });

  res.json({ data: followers.map((f) => ({ ...f.follower, followedAt: f.createdAt })) });
});
