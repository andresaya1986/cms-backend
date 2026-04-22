import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/config/databases';
import { authenticate } from '../../shared/middleware/authenticate';
import { validate } from '../../shared/middleware/validate';
import { AppError } from '../../shared/errors/AppError';
import { extractMentions, extractHashtags } from '../../shared/utils';
import { notifyUser, notifyPostAuthor, emitCounterUpdate } from '../../shared/services/notifications.service';
import { emitToPost } from '../../shared/config/socket';

export const socialRouter = Router();

// ─────────────────────────────────────────
//  FOLLOW / UNFOLLOW
// ─────────────────────────────────────────
socialRouter.post('/follow/:userId', authenticate, async (req, res) => {
  const followingId = req.params.userId;
  const followerId = req.user!.id;
  const io = res.req.app.get('io');

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

    // Emitir evento de unfollow en tiempo real
    if (io) {
      io.to(`user:${followingId}`).emit('follower:lost', {
        followerId,
        followerUsername: req.user!.username,
        timestamp: new Date(),
      });
    }

    res.json({ following: false, message: `Dejaste de seguir a @${target.username}` });
    return;
  }

  await prisma.follow.create({ data: { followerId, followingId } });

  // Obtener follower count actualizado
  const followerCount = await prisma.follow.count({ where: { followingId } });

  // Notificación en DB + tiempo real
  if (io) {
    notifyUser(io, followingId, {
      type: 'NEW_FOLLOWER',
      title: `Nuevo seguidor`,
      body: `@${req.user!.username} te sigue ahora`,
      data: { followerId, followerUsername: req.user!.username, followerCount },
    }).catch(() => {});

    // Emitir evento de follow en tiempo real
    io.to(`user:${followingId}`).emit('follower:gained', {
      followerId,
      followerUsername: req.user!.username,
      followerCount,
      timestamp: new Date(),
    });
  } else {
    // Fallback a DB only si no hay io
    prisma.notification.create({
      data: {
        userId: followingId,
        type: 'NEW_FOLLOWER',
        title: 'Nuevo seguidor',
        body: `@${req.user!.username} te sigue ahora`,
        data: { followerId },
      },
    }).catch(() => {});
  }

  res.json({ following: true, message: `Ahora sigues a @${target.username}` });
});

// ─────────────────────────────────────────
//  REACCIONES AVANZADAS (LIKE, LOVE, CARE, etc)
// ─────────────────────────────────────────
const reactionSchema = z.object({
  body: z.object({
    targetId: z.string().uuid(),
    targetType: z.enum(['post', 'comment']),
    reactionType: z.enum(['LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY']).default('LIKE'),
  }),
});

socialRouter.post('/react', authenticate, validate(reactionSchema), async (req, res) => {
  const { targetId, targetType, reactionType } = req.body;
  const userId = req.user!.id;

  // Validar que el target existe
  if (targetType === 'post') {
    const post = await prisma.post.findUnique({ where: { id: targetId } });
    if (!post) throw new AppError('Post no encontrado', 404);
  } else {
    const comment = await prisma.comment.findUnique({ where: { id: targetId } });
    if (!comment) throw new AppError('Comentario no encontrado', 404);
  }

  const where = targetType === 'post'
    ? { userId_postId: { userId, postId: targetId } }
    : { userId_commentId: { userId, commentId: targetId } };

  const existing = await prisma.reaction.findUnique({ where: where as any });

  if (existing) {
    // Si existe la misma reacción, removerla (toggle off)
    if (existing.type === reactionType) {
      await prisma.reaction.delete({ where: { id: existing.id } });

      // Decrementar contador
      if (targetType === 'post') {
        await prisma.post.update({ where: { id: targetId }, data: { reactionsCount: { decrement: 1 } } });
      } else {
        await prisma.comment.update({ where: { id: targetId }, data: { reactionsCount: { decrement: 1 } } });
      }

      res.json({ reacted: false, type: null, message: 'Reacción removida' });
      return;
    }

    // Si existe diferente reacción, reemplazarla (cambiar tipo)
    await prisma.reaction.update({
      where: { id: existing.id },
      data: { type: reactionType as any },
    });

    res.json({ 
      reacted: true, 
      type: reactionType, 
      message: `Reacción actualizada a ${reactionType}` 
    });
    return;
  }

  // Crear nueva reacción
  await prisma.reaction.create({
    data: {
      userId,
      type: reactionType as any,
      ...(targetType === 'post' ? { postId: targetId } : { commentId: targetId }),
    },
  });

  // Incrementar contador
  if (targetType === 'post') {
    await prisma.post.update({ where: { id: targetId }, data: { reactionsCount: { increment: 1 } } });
  } else {
    await prisma.comment.update({ where: { id: targetId }, data: { reactionsCount: { increment: 1 } } });
  }

  res.json({ 
    reacted: true, 
    type: reactionType, 
    message: `Reaccionaste con ${reactionType}` 
  });
});

// DEPRECATED: Mantener /like para compatibilidad hacia atrás, pero usar /react
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
//  OBTENER REACCIONES (desglose por tipo)
// ─────────────────────────────────────────
socialRouter.get('/reactions/:targetId', async (req, res) => {
  const { targetId } = req.params;
  const { targetType = 'post' } = req.query;

  if (!['post', 'comment'].includes(targetType as string)) {
    throw new AppError('targetType debe ser "post" o "comment"', 400);
  }

  const where = targetType === 'post'
    ? { postId: targetId }
    : { commentId: targetId };

  // Obtener reacciones agrupadas por tipo
  const reactions = await prisma.reaction.groupBy({
    by: ['type'],
    where: where as any,
    _count: true,
  });

  // Convertir a objeto con conteos por tipo
  const reactionCounts = {
    LIKE: 0,
    LOVE: 0,
    CARE: 0,
    HAHA: 0,
    WOW: 0,
    SAD: 0,
    ANGRY: 0,
  };

  reactions.forEach((r) => {
    reactionCounts[r.type as keyof typeof reactionCounts] = r._count;
  });

  // Obtener usuarios que reaccionaron (últimos 10 por tipo)
  const reactionDetails = await prisma.reaction.findMany({
    where: where as any,
    select: {
      type: true,
      user: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50, // límite para no traer todo
  });

  const groupedByType = Object.values(reactionCounts).reduce(
    (acc, _) => {
      acc[_] = [];
      return acc;
    },
    {} as Record<string, any[]>
  );

  reactionDetails.forEach((r) => {
    if (groupedByType[r.type]) {
      groupedByType[r.type].push({
        user: r.user,
        reactedAt: r.createdAt,
      });
    }
  });

  res.json({
    targetId,
    targetType,
    counts: reactionCounts,
    total: Object.values(reactionCounts).reduce((a, b) => a + b, 0),
    recent: groupedByType,
  });
});

// GET mi reacción actual en un post/comentario
socialRouter.get('/my-reaction/:targetId', authenticate, async (req, res) => {
  const { targetId } = req.params;
  const { targetType = 'post' } = req.query;
  const userId = req.user!.id;

  if (!['post', 'comment'].includes(targetType as string)) {
    throw new AppError('targetType debe ser "post" o "comment"', 400);
  }

  const where = targetType === 'post'
    ? { userId_postId: { userId, postId: targetId } }
    : { userId_commentId: { userId, commentId: targetId } };

  const myReaction = await prisma.reaction.findUnique({ where: where as any });

  res.json({
    targetId,
    targetType,
    hasReacted: !!myReaction,
    type: myReaction?.type || null,
  });
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

// GET usuarios que sigue (following)
socialRouter.get('/users/:username/following', async (req, res) => {
  const { page = 1, limit = 20 } = req.query as any;
  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: { id: true },
  });
  if (!user) throw new AppError('Usuario no encontrado', 404);

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    skip: (page - 1) * limit,
    take: Number(limit),
    orderBy: { createdAt: 'desc' },
    select: {
      following: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true },
      },
      createdAt: true,
    },
  });

  res.json({ 
    data: following.map((f) => ({ 
      ...f.following, 
      followedAt: f.createdAt 
    })),
    page,
    limit,
    total: following.length,
  });
});

// ─────────────────────────────────────────
//  ESTADO DE FOLLOW
// ─────────────────────────────────────────
// GET estado del follow entre usuarios
socialRouter.get('/follow-status/:userId', authenticate, async (req, res) => {
  const { userId: targetUserId } = req.params;
  const userId = req.user!.id;

  if (userId === targetUserId) {
    res.json({ following: false, follower: false, message: 'Es tu propio perfil' });
    return;
  }

  // Verificar si el usuario actual sigue al target
  const following = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: userId, followingId: targetUserId } },
  });

  // Verificar si el target sigue al usuario actual (para mostrar "se siguen mutuamente")
  const follower = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: targetUserId, followingId: userId } },
  });

  res.json({ 
    following: !!following,
    follower: !!follower,
    mutualFollowers: following && follower,
  });
});

// ─────────────────────────────────────────
//  BÚSQUEDA DE USUARIOS
// ─────────────────────────────────────────
const searchUsersSchema = z.object({
  query: z.object({
    q: z.string().min(2).max(50),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
    role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  }),
});

socialRouter.get('/search/users', validate(searchUsersSchema), async (req, res) => {
  const { q, page, limit, role } = req.query as any;
  const skip = (page - 1) * limit;
  const userId = req.user?.id; // Puede no estar autenticado

  // Búsqueda con nombre, displayName o username
  const where: any = {
    status: 'ACTIVE',
    deletedAt: null,
    OR: [
      { username: { contains: q, mode: 'insensitive' } },
      { displayName: { contains: q, mode: 'insensitive' } },
      { bio: { contains: q, mode: 'insensitive' } },
    ],
  };

  // Filtro opcional por rol
  if (role) {
    where.role = role;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: Number(limit),
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        role: true,
        _count: {
          select: { followers: true, following: true, posts: true },
        },
      },
      orderBy: { displayName: 'asc' },
    }),
    prisma.user.count({ where }),
  ]);

  // Si el usuario está autenticado, obtener estado de follow
  let usersWithFollowStatus = users;

  if (userId) {
    const follows = await prisma.follow.findMany({
      where: {
        followerId: userId,
        followingId: { in: users.map((u) => u.id) },
      },
      select: { followingId: true },
    });

    const followingIds = new Set(follows.map((f) => f.followingId));

    usersWithFollowStatus = users.map((user) => ({
      ...user,
      isFollowing: followingIds.has(user.id),
      isOwnProfile: user.id === userId,
    }));
  } else {
    usersWithFollowStatus = users.map((user) => ({
      ...user,
      isFollowing: false,
      isOwnProfile: false,
    }));
  }

  res.json({
    data: usersWithFollowStatus,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
    query: q,
  });
});

// GET sugerencias de usuarios a seguir (basado en quién sigue la gente que sigues)
const suggestionsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().min(1).max(50).default(10),
  }),
});

socialRouter.get('/suggestions/users', authenticate, validate(suggestionsSchema), async (req, res) => {
  const { limit } = req.query as any;
  const userId = req.user!.id;

  // Obtener usuarios que sigues
  const userFollowing = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  const followingIds = userFollowing.map((f) => f.followingId);
  followingIds.push(userId); // No sugerir el usuario a sí mismo

  // Obtener usuarios que sigue la gente que tú sigues
  const suggestions = await prisma.user.findMany({
    where: {
      id: {
        notIn: followingIds,
      },
      status: 'ACTIVE',
      deletedAt: null,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      _count: {
        select: { followers: true, posts: true },
      },
    },
    take: Number(limit),
    orderBy: { createdAt: 'desc' },
  });

  const suggestionsWithMutual = await Promise.all(
    suggestions.map(async (user) => {
      // Contar seguidores en común (usuarios que tanto yo como el sugerido seguimos)
      const mutualFollowers = await prisma.follow.count({
        where: {
          followerId: { in: followingIds },
          followingId: user.id,
        },
      });

      return {
        ...user,
        mutualFollowers,
      };
    })
  );

  // Ordenar por cantidad de seguidores en común
  suggestionsWithMutual.sort((a, b) => b.mutualFollowers - a.mutualFollowers);

  res.json({
    data: suggestionsWithMutual.slice(0, limit),
    message: 'Usuarios sugeridos basados en tu red',
  });
});

// ─────────────────────────────────────────
//  ACTIVIDAD / TIMELINE DE USUARIO
// ─────────────────────────────────────────
const userActivitySchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
    type: z.enum(['all', 'posts', 'comments', 'interactions']).default('all'),
  }),
});

// GET actividad/timeline de un usuario
socialRouter.get('/users/:username/activity', validate(userActivitySchema), async (req, res) => {
  const { username } = req.params;
  const { page, limit, type } = req.query as any;
  const skip = (page - 1) * limit;

  // Obtener usuario
  const user = await prisma.user.findUnique({
    where: { username, status: 'ACTIVE', deletedAt: null },
    select: { id: true, username: true },
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }

  const activity: any[] = [];

  // Posts del usuario
  if (type === 'all' || type === 'posts') {
    const posts = await prisma.post.findMany({
      where: {
        authorId: user.id,
        status: 'PUBLISHED',
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        reactionsCount: true,
        commentsCount: true,
        viewCount: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: type === 'posts' ? limit : Math.ceil(limit / 3),
    });

    activity.push(
      ...posts.map((post) => ({
        type: 'POST',
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        timestamp: post.publishedAt,
        stats: {
          reactions: post.reactionsCount,
          comments: post.commentsCount,
          views: post.viewCount,
        },
      }))
    );
  }

  // Comentarios del usuario
  if (type === 'all' || type === 'comments') {
    const comments = await prisma.comment.findMany({
      where: {
        authorId: user.id,
        status: 'VISIBLE',
        deletedAt: null,
      },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: type === 'comments' ? limit : Math.ceil(limit / 3),
    });

    activity.push(
      ...comments.map((comment) => ({
        type: 'COMMENT',
        id: comment.id,
        content: comment.content.substring(0, 100),
        postTitle: comment.post.title,
        postSlug: comment.post.slug,
        postId: comment.post.id,
        timestamp: comment.createdAt,
        reactionsCount: comment.reactionsCount,
      }))
    );
  }

  // Interacciones (follows, reacciones recientes)
  if (type === 'all' || type === 'interactions') {
    const recentFollows = await prisma.follow.findMany({
      where: {
        followingId: user.id,
      },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    activity.push(
      ...recentFollows.map((follow) => ({
        type: 'NEW_FOLLOWER',
        id: follow.id,
        follower: follow.follower,
        timestamp: follow.createdAt,
      }))
    );

    // Reacciones recientes
    const recentReactions = await prisma.reaction.findMany({
      where: {
        userId: user.id,
      },
      include: {
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    activity.push(
      ...recentReactions.map((reaction) => ({
        type: 'REACTION',
        id: reaction.id,
        reactionType: reaction.type,
        postTitle: reaction.post?.title,
        postSlug: reaction.post?.slug,
        timestamp: reaction.createdAt,
      }))
    );
  }

  // Ordenar por timestamp descendente
  activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Paginar
  const paginatedActivity = activity.slice(skip, skip + limit);

  res.json({
    data: paginatedActivity,
    user: {
      id: user.id,
      username: user.username,
    },
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: activity.length,
    },
    type,
  });
});

// GET estadísticas de actividad de usuario
socialRouter.get('/users/:username/stats', async (req, res) => {
  const { username } = req.params;

  const user = await prisma.user.findUnique({
    where: { username, status: 'ACTIVE', deletedAt: null },
    select: {
      id: true,
      username: true,
      createdAt: true,
      _count: {
        select: {
          posts: true,
          comments: true,
          followers: true,
          following: true,
          reactions: true,
        },
      },
    },
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }

  // Calcular estadísticas de engagement
  const userPosts = await prisma.post.findMany({
    where: {
      authorId: user.id,
      status: 'PUBLISHED',
      deletedAt: null,
    },
    select: {
      reactionsCount: true,
      commentsCount: true,
      viewCount: true,
    },
  });

  const totalReactions = userPosts.reduce((sum, p) => sum + p.reactionsCount, 0);
  const totalComments = userPosts.reduce((sum, p) => sum + p.commentsCount, 0);
  const totalViews = userPosts.reduce((sum, p) => sum + p.viewCount, 0);
  const avgEngagementPerPost = userPosts.length > 0 
    ? Math.round((totalReactions + totalComments) / userPosts.length)
    : 0;

  // Posts en últimos 30 días
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentPosts = await prisma.post.count({
    where: {
      authorId: user.id,
      status: 'PUBLISHED',
      publishedAt: { gte: thirtyDaysAgo },
      deletedAt: null,
    },
  });

  // Miembro desde hace
  const memberSince = Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24));

  res.json({
    user: {
      id: user.id,
      username: user.username,
    },
    memberStats: {
      memberSinceDays: memberSince,
      joinedAt: user.createdAt,
    },
    contentStats: {
      totalPosts: user._count.posts,
      totalComments: user._count.comments,
      postsLast30Days: recentPosts,
      avgEngagementPerPost,
    },
    engagementStats: {
      receivedReactions: totalReactions,
      receivedComments: totalComments,
      totalViews,
      totalReactionsGiven: user._count.reactions,
    },
    socialStats: {
      followers: user._count.followers,
      following: user._count.following,
    },
  });
});

// ─────────────────────────────────────────
//  BOOKMARKS / GUARDAR POSTS
// ─────────────────────────────────────────
// POST guardar/desguardar un post
socialRouter.post('/bookmarks/:postId', authenticate, async (req, res) => {
  const { postId } = req.params;
  const userId = req.user!.id;

  // Verificar que el post existe
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, title: true },
  });

  if (!post) {
    throw new AppError('Post no encontrado', 404);
  }

  // Verificar si ya está guardado
  const existing = await prisma.bookmark.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    // Desguardar
    await prisma.bookmark.delete({
      where: { userId_postId: { userId, postId } },
    });

    // Decrementar contador
    await prisma.post.update({
      where: { id: postId },
      data: { bookmarksCount: { decrement: 1 } },
    });

    res.json({ bookmarked: false, message: `Quitaste ${post.title} de tus guardados` });
    return;
  }

  // Guardar
  await prisma.bookmark.create({
    data: { userId, postId },
  });

  // Incrementar contador
  await prisma.post.update({
    where: { id: postId },
    data: { bookmarksCount: { increment: 1 } },
  });

  res.json({ bookmarked: true, message: `Guardaste ${post.title}` });
});

// GET mis posts guardados
const myBookmarksSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
    sortBy: z.enum(['recent', 'oldest']).default('recent'),
  }),
});

socialRouter.get('/bookmarks', authenticate, validate(myBookmarksSchema), async (req, res) => {
  const { page, limit, sortBy } = req.query as any;
  const userId = req.user!.id;
  const skip = (page - 1) * limit;

  const orderBy = sortBy === 'recent' ? { createdAt: 'desc' as const } : { createdAt: 'asc' as const };

  const [bookmarks, total] = await Promise.all([
    prisma.bookmark.findMany({
      where: { userId },
      skip,
      take: Number(limit),
      orderBy,
      select: {
        createdAt: true,
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            featuredImage: true,
            publishedAt: true,
            viewCount: true,
            reactionsCount: true,
            commentsCount: true,
            author: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
            categories: {
              select: { category: { select: { id: true, name: true, slug: true } } },
            },
          },
        },
      },
    }),
    prisma.bookmark.count({ where: { userId } }),
  ]);

  const formattedBookmarks = bookmarks.map((b) => ({
    ...b.post,
    bookmarkedAt: b.createdAt,
  }));

  res.json({
    data: formattedBookmarks,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// GET verificar si tengo un post guardado
socialRouter.get('/bookmark-status/:postId', authenticate, async (req, res) => {
  const { postId } = req.params;
  const userId = req.user!.id;

  const bookmark = await prisma.bookmark.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  res.json({
    postId,
    bookmarked: !!bookmark,
    bookmarkedAt: bookmark?.createdAt || null,
  });
});

// GET posts guardados de otro usuario (si son públicos)
const userBookmarksSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(10),
  }),
});

socialRouter.get('/users/:username/bookmarks', validate(userBookmarksSchema), async (req, res) => {
  const { username } = req.params;
  const { page, limit } = req.query as any;
  const skip = (page - 1) * limit;

  // Obtener usuario
  const user = await prisma.user.findUnique({
    where: { username, status: 'ACTIVE', deletedAt: null },
    select: { id: true, username: true },
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }

  // Obtener bookmarks (solo posts públicos publicados)
  const [bookmarks, total] = await Promise.all([
    prisma.bookmark.findMany({
      where: {
        userId: user.id,
        post: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          deletedAt: null,
        },
      },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            featuredImage: true,
            publishedAt: true,
            author: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    }),
    prisma.bookmark.count({
      where: {
        userId: user.id,
        post: {
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          deletedAt: null,
        },
      },
    }),
  ]);

  const formattedBookmarks = bookmarks.map((b) => ({
    ...b.post,
    bookmarkedAt: b.createdAt,
  }));

  res.json({
    user: { username: user.username },
    data: formattedBookmarks,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
    },
  });
});

// ─────────────────────────────────────────
//  SHARES / COMPARTIR POSTS
// ─────────────────────────────────────────
const sharePostSchema = z.object({
  body: z.object({
    postId: z.string().uuid(),
    message: z.string().max(500).optional(),
  }),
});

// POST compartir un post
socialRouter.post('/share', authenticate, validate(sharePostSchema), async (req, res) => {
  const { postId, message } = req.body;
  const userId = req.user!.id;

  // Verificar que el post existe y está publicado
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, title: true, status: true, visibility: true },
  });

  if (!post) {
    throw new AppError('Post no encontrado', 404);
  }

  if (post.status !== 'PUBLISHED') {
    throw new AppError('No puedes compartir borradores', 400);
  }

  // Verificar si ya fue compartido
  const existing = await prisma.share.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  if (existing) {
    // Dejar de compartir
    await prisma.share.delete({
      where: { userId_postId: { userId, postId } },
    });

    // Decrementar contador
    await prisma.post.update({
      where: { id: postId },
      data: { sharesCount: { decrement: 1 } },
    });

    res.json({ shared: false, message: `Dejaste de compartir "${post.title}"` });
    return;
  }

  // Compartir
  await prisma.share.create({
    data: { userId, postId, message },
  });

  // Incrementar contador
  await prisma.post.update({
    where: { id: postId },
    data: { sharesCount: { increment: 1 } },
  });

  res.json({ shared: true, message: `Compartiste "${post.title}"` });
});

// GET mis posts compartidos
const mySharesSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
  }),
});

socialRouter.get('/shares', authenticate, validate(mySharesSchema), async (req, res) => {
  const { page, limit } = req.query as any;
  const userId = req.user!.id;
  const skip = (page - 1) * limit;

  const [shares, total] = await Promise.all([
    prisma.share.findMany({
      where: { userId },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        message: true,
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            featuredImage: true,
            publishedAt: true,
            author: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    }),
    prisma.share.count({ where: { userId } }),
  ]);

  const formattedShares = shares.map((s) => ({
    ...s.post,
    sharedAt: s.createdAt,
    shareMessage: s.message,
  }));

  res.json({
    data: formattedShares,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// GET personas que compartieron un post
socialRouter.get('/shares/:postId', async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 20 } = req.query as any;
  const skip = (page - 1) * limit;

  // Verificar que el post existe
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true },
  });

  if (!post) {
    throw new AppError('Post no encontrado', 404);
  }

  const [shares, total] = await Promise.all([
    prisma.share.findMany({
      where: { postId },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        message: true,
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
    }),
    prisma.share.count({ where: { postId } }),
  ]);

  const formattedShares = shares.map((s) => ({
    user: s.user,
    sharedAt: s.createdAt,
    message: s.message,
  }));

  res.json({
    postId,
    data: formattedShares,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
    },
  });
});

// GET verificar si compartí un post
socialRouter.get('/share-status/:postId', authenticate, async (req, res) => {
  const { postId } = req.params;
  const userId = req.user!.id;

  const share = await prisma.share.findUnique({
    where: { userId_postId: { userId, postId } },
    select: { createdAt: true, message: true },
  });

  res.json({
    postId,
    shared: !!share,
    sharedAt: share?.createdAt || null,
    message: share?.message || null,
  });
});

// ─────────────────────────────────────────
//  MENTIONS / MENCIONES (@usuario)
// ─────────────────────────────────────────

// GET mis menciones (notifications que recibí)
const myMentionsSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
    read: z.enum(['all', 'unread', 'read']).default('all'),
  }),
});

socialRouter.get('/mentions', authenticate, validate(myMentionsSchema), async (req, res) => {
  const { page, limit, read } = req.query as any;
  const userId = req.user!.id;
  const skip = (page - 1) * limit;

  // Obtener mis menciones activas en posts y comentarios
  const [mentions, total] = await Promise.all([
    prisma.mention.findMany({
      where: { mentionedUserId: userId },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        mentionedByUser: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        post: {
          select: { id: true, title: true, slug: true, excerpt: true },
        },
        comment: {
          select: {
            id: true,
            content: true,
            post: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    }),
    prisma.mention.count({ where: { mentionedUserId: userId } }),
  ]);

  const formattedMentions = mentions.map((m) => ({
    id: m.id,
    by: m.mentionedByUser,
    context: m.post ?? m.comment,
    contextType: m.post ? 'POST' : 'COMMENT',
    mentionedAt: m.createdAt,
  }));

  res.json({
    data: formattedMentions,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
    },
  });
});

// GET menciones en un post específico
socialRouter.get('/post/:postId/mentions', async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 20 } = req.query as any;
  const skip = (page - 1) * limit;

  // Verificar que el post existe
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, title: true },
  });

  if (!post) {
    throw new AppError('Post no encontrado', 404);
  }

  const [mentions, total] = await Promise.all([
    prisma.mention.findMany({
      where: { postId },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        mentionedByUser: {
          select: { id: true, username: true, displayName: true },
        },
        mentionedUser: {
          select: { id: true, username: true, displayName: true },
        },
      },
    }),
    prisma.mention.count({ where: { postId } }),
  ]);

  res.json({
    postId,
    postTitle: post.title,
    data: mentions,
    pagination: { page: Number(page), limit: Number(limit), total },
  });
});

// POST crear mención manual (admin/internal only)
// Normalmente las menciones se crean automáticamente al comentar/postear
// Este endpoint es para control administrativo
const createMentionSchema = z.object({
  body: z.object({
    mentionedUserId: z.string().uuid(),
    postId: z.string().uuid().optional(),
    commentId: z.string().uuid().optional(),
  }),
});

socialRouter.post('/mentions', authenticate, validate(createMentionSchema), async (req, res) => {
  const { mentionedUserId, postId, commentId } = req.body;
  const mentionedByUserId = req.user!.id;

  // Validar que una de las dos opciones está presente
  if (!postId && !commentId) {
    throw new AppError('Debe proporcionar postId o commentId', 400);
  }

  if (postId && commentId) {
    throw new AppError('Solo puede ser postId o commentId, no ambos', 400);
  }

  // Verificar que el usuario mencionado existe
  const mentionedUser = await prisma.user.findUnique({
    where: { id: mentionedUserId },
    select: { id: true, username: true },
  });

  if (!mentionedUser) {
    throw new AppError('Usuario mencionado no encontrado', 404);
  }

  // No mencionarse a sí mismo
  if (mentionedUserId === mentionedByUserId) {
    throw new AppError('No puedes mencionarte a ti mismo', 400);
  }

  // Verificar que el post/comentario existe
  if (postId) {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) {
      throw new AppError('Post no encontrado', 404);
    }
  }

  if (commentId) {
    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } });
    if (!comment) {
      throw new AppError('Comentario no encontrado', 404);
    }
  }

  // Verificar si ya existe esta mención
  const existing = await prisma.mention.findUnique({
    where: {
      mentionedUserId_postId_commentId_mentionedByUserId: {
        mentionedUserId,
        postId: postId || '',
        commentId: commentId || '',
        mentionedByUserId,
      },
    },
  });

  if (existing) {
    res.json({ mentioned: true, message: 'Esta mención ya existe' });
    return;
  }

  // Crear mención
  const mention = await prisma.mention.create({
    data: {
      mentionedUserId,
      mentionedByUserId,
      postId: postId || null,
      commentId: commentId || null,
    },
  });

  // Crear notificación
  await prisma.notification.create({
    data: {
      userId: mentionedUserId,
      type: postId ? 'POST_MENTION' : 'COMMENT_MENTION',
      title: `@${req.user!.username} te mencionó`,
      body: postId ? 'Te mencionaron en un post' : 'Te mencionaron en un comentario',
      data: { mentionId: mention.id, postId, commentId, mentionedByUserId },
    },
  }).catch(() => {});

  res.json({
    mentioned: true,
    message: `@${mentionedUser.username} fue mencionado`,
    mention,
  });
});

// GET menciones que hizo un usuario
socialRouter.get('/users/:username/mentions', async (req, res) => {
  const { username } = req.params;
  const { page = 1, limit = 20 } = req.query as any;
  const skip = (page - 1) * limit;

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404);
  }

  const [mentions, total] = await Promise.all([
    prisma.mention.findMany({
      where: { mentionedByUserId: user.id },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        mentionedUser: {
          select: { id: true, username: true, displayName: true },
        },
        post: {
          select: { id: true, title: true, slug: true },
        },
        comment: {
          select: {
            id: true,
            post: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    }),
    prisma.mention.count({ where: { mentionedByUserId: user.id } }),
  ]);

  res.json({
    user: { username },
    data: mentions.map((m) => ({
      ...m,
      context: m.post || m.comment?.post,
    })),
    pagination: { page: Number(page), limit: Number(limit), total },
  });
});

// ─────────────────────────────────────────
//  HASHTAGS / ETIQUETAS (#tema)
// ─────────────────────────────────────────

// GET búsqueda de hashtags
const searchHashtagsSchema = z.object({
  query: z.object({
    q: z.string().min(1).max(50),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
  }),
});

socialRouter.get('/hashtags/search', validate(searchHashtagsSchema), async (req, res) => {
  const { q, page, limit } = req.query as any;
  const skip = (page - 1) * limit;
  const query = q.toLowerCase();

  const [hashtags, total] = await Promise.all([
    prisma.hashtag.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
      },
      skip,
      take: Number(limit),
      orderBy: [{ count: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        count: true,
        trendingScore: true,
        createdAt: true,
      },
    }),
    prisma.hashtag.count({
      where: {
        name: { contains: query, mode: 'insensitive' },
      },
    }),
  ]);

  res.json({
    data: hashtags.map((h) => ({ ...h, hashtag: `#${h.name}` })),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
    query: q,
  });
});

// GET trending hashtags (últimas 24h)
const trendingHashtagsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().min(1).max(50).default(20),
    period: z.enum(['1h', '24h', '7d']).default('24h'),
  }),
});

socialRouter.get('/hashtags/trending', validate(trendingHashtagsSchema), async (req, res) => {
  const { limit, period } = req.query as any;

  // Calcular fecha de corte según el período
  let hoursAgo: number;
  if (period === '1h') hoursAgo = 1;
  else if (period === '7d') hoursAgo = 7 * 24;
  else hoursAgo = 24;

  const cutoffDate = new Date(Date.now() - hoursAgo * 3600 * 1000);

  // Obtener hashtags con más usos en el período
  const trendingHashtags = await prisma.hashtagPost.groupBy({
    by: ['hashtagId'],
    where: {
      createdAt: { gte: cutoffDate },
    },
    _count: true,
    orderBy: {
      _count: {
        hashtagId: 'desc',
      },
    },
    take: Number(limit),
  });

  // Obtener detalles de cada hashtag
  const hashtagIds = trendingHashtags.map((h) => h.hashtagId);
  const hashtags = await prisma.hashtag.findMany({
    where: { id: { in: hashtagIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      count: true,
      trendingScore: true,
    },
  });

  // Enriquecer con datos de agrupación
  const enriched = hashtags
    .map((h) => ({
      ...h,
      hashtag: `#${h.name}`,
      recentCount: trendingHashtags.find((t) => t.hashtagId === h.id)?._count || 0,
    }))
    .sort((a, b) => b.recentCount - a.recentCount);

  res.json({
    data: enriched,
    period,
    generatedAt: new Date(),
  });
});

// GET posts con un hashtag específico
const hashtagPostsSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
  }),
});

socialRouter.get('/hashtags/:name/posts', validate(hashtagPostsSchema), async (req, res) => {
  const { name } = req.params;
  const { page, limit } = req.query as any;
  const skip = (page - 1) * limit;

  // Obtener hashtag
  const hashtag = await prisma.hashtag.findUnique({
    where: { name: name.toLowerCase() },
  });

  if (!hashtag) {
    res.json({
      hashtag: `#${name}`,
      data: [],
      pagination: { page: Number(page), limit: Number(limit), total: 0 },
      message: 'No hay posts con este hashtag',
    });
    return;
  }

  // Obtener posts
  const [posts, total] = await Promise.all([
    prisma.hashtagPost.findMany({
      where: { hashtagId: hashtag.id },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            featuredImage: true,
            publishedAt: true,
            reactionsCount: true,
            commentsCount: true,
            viewCount: true,
            author: {
              select: { id: true, username: true, displayName: true, avatarUrl: true },
            },
          },
        },
      },
    }),
    prisma.hashtagPost.count({ where: { hashtagId: hashtag.id } }),
  ]);

  res.json({
    hashtag: `#${hashtag.name}`,
    hashtagId: hashtag.id,
    data: posts.map((p) => p.post),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// GET detalles de un hashtag
socialRouter.get('/hashtags/:name', async (req, res) => {
  const { name } = req.params;

  const hashtag = await prisma.hashtag.findUnique({
    where: { name: name.toLowerCase() },
    select: {
      id: true,
      name: true,
      slug: true,
      count: true,
      trendingScore: true,
      createdAt: true,
      _count: {
        select: { posts: true, comments: true },
      },
    },
  });

  if (!hashtag) {
    throw new AppError('Hashtag no encontrado', 404);
  }

  // Obtener últimos posts con este hashtag
  const recentPosts = await prisma.hashtagPost.findMany({
    where: { hashtagId: hashtag.id },
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: {
      post: {
        select: { id: true, title: true, slug: true },
      },
    },
  });

  res.json({
    data: {
      ...hashtag,
      hashtag: `#${hashtag.name}`,
      recentPosts: recentPosts.map((p) => p.post),
    },
  });
});

// GET menciones del usuario
socialRouter.get('/mentions/:username', authenticate, async (req, res) => {
  const { username } = req.params;
  const user = req.user!;
  const page = req.query.page || 1;
  const limit = req.query.limit || 10;
  const skip = (Number(page) - 1) * Number(limit);

  const [mentions, total] = await Promise.all([
    prisma.mention.findMany({
      where: { mentionedByUserId: user.id },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        mentionedUser: {
          select: { id: true, username: true, displayName: true },
        },
        post: {
          select: { id: true, title: true, slug: true },
        },
        comment: {
          select: {
            id: true,
            post: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    }),
    prisma.mention.count({ where: { mentionedByUserId: user.id } }),
  ]);

  res.json({
    user: { username },
    data: mentions.map((m) => ({
      ...m,
      context: m.post || m.comment?.post,
    })),
    pagination: { page: Number(page), limit: Number(limit), total },
  });
});
