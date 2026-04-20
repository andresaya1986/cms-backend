// ─────────────────────────────────────────
//  Comments Routes
// ─────────────────────────────────────────
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../shared/config/databases';
import { authenticate } from '../../shared/middleware/authenticate';
import { validate } from '../../shared/middleware/validate';
import { AppError } from '../../shared/errors/AppError';

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

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
  if (!post) throw new AppError('Post no encontrado', 404);

  const comment = await prisma.comment.create({
    data: { postId, authorId: req.user!.id, content, parentId },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  // Incrementar contador en post
  await prisma.post.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });

  // Notificar al autor del post (si no es el mismo)
  if (post.authorId !== req.user!.id) {
    prisma.notification.create({
      data: {
        userId: post.authorId,
        type: 'NEW_COMMENT',
        title: 'Nuevo comentario',
        body: `@${req.user!.id} comentó en tu post`,
        data: { postId, commentId: comment.id },
      },
    }).catch(() => {});
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
