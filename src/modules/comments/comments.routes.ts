// ─────────────────────────────────────────
//  Comments Routes
// ─────────────────────────────────────────
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/config/databases';
import { authenticate } from '../../shared/middleware/authenticate';
import { validate } from '../../shared/middleware/validate';
import { AppError } from '../../shared/errors/AppError';
import { extractMentions, extractHashtags } from '../../shared/utils';

export const commentsRouter = Router();

const createCommentSchema = z.object({
  body: z.object({
    postId: z.string().uuid(),
    content: z.string().min(1).max(2000),
    parentId: z.string().uuid().optional(),
  }),
});

// GET /api/v1/comments?postId=xxx
commentsRouter.get('/', async (req, res) => {
  const { postId, page = 1, limit = 50 } = req.query as any;
  if (!postId) throw new AppError('postId es requerido', 400);

  const comments = await prisma.comment.findMany({
    where: {
      postId,
      parentId: null, // Solo root comments; las respuestas van anidadas
      status: 'VISIBLE',
      deletedAt: null,
    },
    skip: (page - 1) * limit,
    take: Number(limit),
    orderBy: { createdAt: 'desc' },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      reactions: {
        select: { type: true },
      },
      replies: {
        where: { status: 'VISIBLE', deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          reactions: {
            select: { type: true },
          },
        },
      },
    },
  });

  // Calcular conteo de reacciones por tipo
  const formatComment = (comment: any) => {
    const reactionsCounts = {
      LIKE: 0,
      LOVE: 0,
      CARE: 0,
      HAHA: 0,
      WOW: 0,
      SAD: 0,
      ANGRY: 0,
    };

    comment.reactions?.forEach((r: any) => {
      if (r.type in reactionsCounts) {
        reactionsCounts[r.type as keyof typeof reactionsCounts]++;
      }
    });

    return {
      ...comment,
      reactionsCounts,
      reactions: undefined,
      replies: comment.replies?.map(formatComment),
    };
  };

  const formattedComments = comments.map(formatComment);

  res.json({ data: formattedComments });
});

// POST /api/v1/comments
commentsRouter.post('/', authenticate, validate(createCommentSchema), async (req, res) => {
  const { postId, content, parentId } = req.body;
  const userId = req.user!.id;

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
  if (!post) throw new AppError('Post no encontrado', 404);

  const comment = await prisma.comment.create({
    data: { postId, authorId: userId, content, parentId },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  // Incrementar contador en post
  await prisma.post.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });

  // Notificar al autor del post (si no es el mismo)
  if (post.authorId !== userId) {
    prisma.notification.create({
      data: {
        userId: post.authorId,
        type: 'NEW_COMMENT',
        title: 'Nuevo comentario',
        body: `@${req.user!.username || 'usuario'} comentó en tu post`,
        data: { postId, commentId: comment.id },
      },
    }).catch(() => {});
  }

  // Extraer menciones del contenido
  const mentionedUsernames = extractMentions(content);
  
  if (mentionedUsernames.length > 0) {
    // Obtener IDs de usuarios mencionados
    const mentionedUsers = await prisma.user.findMany({
      where: {
        username: { in: mentionedUsernames },
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true, username: true },
    });

    // Crear registros de menciones y notificaciones
    for (const mentionedUser of mentionedUsers) {
      // Evitar mencionarse a sí mismo
      if (mentionedUser.id === userId) continue;

      // Crear mención
      const existingMention = await prisma.mention.findUnique({
        where: {
          mentionedUserId_postId_commentId_mentionedByUserId: {
            mentionedUserId: mentionedUser.id,
            postId: '',
            commentId: comment.id,
            mentionedByUserId: userId,
          },
        },
      }).catch(() => null);

      if (!existingMention) {
        await prisma.mention.create({
          data: {
            mentionedUserId: mentionedUser.id,
            mentionedByUserId: userId,
            commentId: comment.id,
          },
        });

        // Crear notificación
        await prisma.notification.create({
          data: {
            userId: mentionedUser.id,
            type: 'COMMENT_MENTION',
            title: `@${req.user!.username} te mencionó`,
            body: 'Te mencionaron en un comentario',
            data: { commentId: comment.id, postId, mentionedByUserId: userId },
          },
        }).catch(() => {});
      }
    }
  }

  // Extraer hashtags del contenido
  const hashtagNames = extractHashtags(content);

  if (hashtagNames.length > 0) {
    // Crear o actualizar hashtags y asociarlos al comentario
    for (const hashtagName of hashtagNames) {
      // Crear o encontrar hashtag
      let hashtag = await prisma.hashtag.upsert({
        where: { name: hashtagName },
        update: { count: { increment: 1 } },
        create: { name: hashtagName, slug: hashtagName },
      });

      // Asociar hashtag al comentario
      await prisma.hashtagComment.upsert({
        where: { hashtagId_commentId: { hashtagId: hashtag.id, commentId: comment.id } },
        update: {},
        create: { hashtagId: hashtag.id, commentId: comment.id },
      }).catch(() => {});
    }
  }

  res.status(201).json({ data: comment });
});

// DELETE /api/v1/comments/:id
commentsRouter.delete('/:id', authenticate, async (req, res) => {
  const comment = await prisma.comment.findUnique({
    where: { id: req.params.id },
    select: { authorId: true, postId: true },
  });
  if (!comment) throw new AppError('Comentario no encontrado', 404);
  if (comment.authorId !== req.user!.id && !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
    throw new AppError('Sin permisos', 403);
  }

  await prisma.comment.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date(), status: 'DELETED' },
  });
  await prisma.post.update({ where: { id: comment.postId }, data: { commentsCount: { decrement: 1 } } });

  res.json({ message: 'Comentario eliminado' });
});

// ─────────────────────────────────────────
//  COMENTARIOS ANIDADOS / RESPUESTAS
// ─────────────────────────────────────────
// GET respuestas de un comentario específico
commentsRouter.get('/:commentId/replies', async (req, res) => {
  const { commentId } = req.params;
  const { page = 1, limit = 20 } = req.query as any;

  // Verificar que el comentario existe y es root (no es respuesta)
  const parentComment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, parentId: true },
  });

  if (!parentComment) {
    throw new AppError('Comentario no encontrado', 404);
  }

  if (parentComment.parentId) {
    throw new AppError('Solo puedes obtener respuestas de comentarios raíz', 400);
  }

  // Obtener respuestas paginadas
  const replies = await prisma.comment.findMany({
    where: {
      parentId: commentId,
      status: 'VISIBLE',
      deletedAt: null,
    },
    skip: (page - 1) * limit,
    take: Number(limit),
    orderBy: { createdAt: 'asc' },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      reactions: {
        select: { userId: true, type: true },
      },
    },
  });

  // Formatear conteo de reacciones
  const formattedReplies = replies.map((reply) => {
    const reactionsCounts = {
      LIKE: 0,
      LOVE: 0,
      CARE: 0,
      HAHA: 0,
      WOW: 0,
      SAD: 0,
      ANGRY: 0,
    };

    reply.reactions?.forEach((r: any) => {
      if (r.type in reactionsCounts) {
        reactionsCounts[r.type as keyof typeof reactionsCounts]++;
      }
    });

    return {
      id: reply.id,
      content: reply.content,
      author: reply.author,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      reactionsCounts,
      reactionsCount: reply.reactionsCount,
    };
  });

  const totalReplies = await prisma.comment.count({
    where: {
      parentId: commentId,
      status: 'VISIBLE',
      deletedAt: null,
    },
  });

  res.json({
    data: formattedReplies,
    pagination: { page: Number(page), limit: Number(limit), total: totalReplies },
  });
});

// GET comentario específico con sus respuestas
commentsRouter.get('/:commentId', async (req, res) => {
  const { commentId } = req.params;

  const comment = await prisma.comment.findUnique({
    where: { id: commentId, deletedAt: null },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      reactions: {
        select: { userId: true, type: true },
      },
      replies: {
        where: { status: 'VISIBLE', deletedAt: null },
        take: 5, // Mostrar solo primeras 5 respuestas por defecto
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          reactions: {
            select: { type: true },
          },
        },
      },
      _count: {
        select: { replies: true },
      },
    },
  });

  if (!comment) {
    throw new AppError('Comentario no encontrado', 404);
  }

  // Formatear reacciones del comentario
  const reactionsCounts = {
    LIKE: 0,
    LOVE: 0,
    CARE: 0,
    HAHA: 0,
    WOW: 0,
    SAD: 0,
    ANGRY: 0,
  };

  comment.reactions?.forEach((r: any) => {
    if (r.type in reactionsCounts) {
      reactionsCounts[r.type as keyof typeof reactionsCounts]++;
    }
  });

  // Formatear respuestas
  const formattedReplies = comment.replies.map((reply: any) => {
    const repliesReactionsCounts = {
      LIKE: 0,
      LOVE: 0,
      CARE: 0,
      HAHA: 0,
      WOW: 0,
      SAD: 0,
      ANGRY: 0,
    };

    reply.reactions?.forEach((r: any) => {
      if (r.type in repliesReactionsCounts) {
        repliesReactionsCounts[r.type as keyof typeof repliesReactionsCounts]++;
      }
    });

    return {
      id: reply.id,
      content: reply.content,
      author: reply.author,
      createdAt: reply.createdAt,
      updatedAt: reply.updatedAt,
      reactionsCounts: repliesReactionsCounts,
      reactionsCount: reply.reactionsCount,
    };
  });

  res.json({
    data: {
      id: comment.id,
      content: comment.content,
      author: comment.author,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      reactionsCounts,
      reactionsCount: comment.reactionsCount,
      totalReplies: comment._count.replies,
      replies: formattedReplies,
      showMoreReplies: comment._count.replies > 5,
    },
  });
});

// PATCH /api/v1/comments/:id (editar comentario)
const updateCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(2000),
  }),
});

commentsRouter.patch('/:id', authenticate, validate(updateCommentSchema), async (req, res) => {
  const { content } = req.body;
  const { id } = req.params;

  const comment = await prisma.comment.findUnique({
    where: { id },
    select: { authorId: true },
  });

  if (!comment) {
    throw new AppError('Comentario no encontrado', 404);
  }

  if (comment.authorId !== req.user!.id && !['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role)) {
    throw new AppError('Sin permisos para editar este comentario', 403);
  }

  const updatedComment = await prisma.comment.update({
    where: { id },
    data: { content, updatedAt: new Date() },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  res.json({ 
    data: updatedComment,
    message: 'Comentario actualizado exitosamente',
  });
});
