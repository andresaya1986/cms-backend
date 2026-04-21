// ─────────────────────────────────────────
//  Reactions Routes
// ─────────────────────────────────────────
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../shared/middleware/authenticate';
import { validate } from '../../shared/middleware/validate';
import { AppError } from '../../shared/errors/AppError';
import { ReactionsService } from './reactions.service';
import { notifyPostAuthor, emitCounterUpdate } from '../../shared/services/notifications.service';
import { emitToPost } from '../../shared/config/socket';
import type { ReactionType } from '@prisma/client';

export const reactionsRouter = Router();

const reactionTypeSchema = z.enum(['LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY']);

const toggleReactionSchema = z.object({
  body: z.object({
    type: reactionTypeSchema,
    postId: z.string().uuid().optional(),
    commentId: z.string().uuid().optional(),
  }).refine(
    data => data.postId || data.commentId,
    { message: 'Either postId or commentId is required' }
  ).refine(
    data => !(data.postId && data.commentId),
    { message: 'Cannot provide both postId and commentId' }
  ),
});

const getReactionsSchema = z.object({
  query: z.object({
    postId: z.string().uuid().optional(),
    commentId: z.string().uuid().optional(),
    type: reactionTypeSchema.optional(),
  }).refine(
    data => data.postId || data.commentId,
    { message: 'Either postId or commentId is required' }
  ),
});

// POST /api/v1/reactions - Toggle reaction
reactionsRouter.post(
  '/',
  authenticate,
  validate(toggleReactionSchema),
  async (req, res) => {
    const { type, postId, commentId } = req.body;
    const userId = req.user!.id;
    const io = res.req.app.get('io');

    const { action, reaction } = await ReactionsService.toggleReaction(
      userId,
      type as ReactionType,
      postId,
      commentId
    );

    // Emitir eventos en tiempo real
    if (io) {
      if (postId) {
        // Obtener contadores actualizados
        const post = await reactionsRouter.locals?.prisma?.post?.findUnique?.({
          where: { id: postId },
          select: { reactionsCount: true },
        });

        if (action === 'created') {
          // Nueva reacción
          emitToPost(io, postId, 'reaction:added', {
            userId,
            username: req.user!.username,
            type,
            postId,
            timestamp: new Date(),
          });

          // Notificar al autor
          notifyPostAuthor(io, postId, 'REACTION', {
            userId,
            username: req.user!.username,
            type,
          }).catch(() => {});
        } else if (action === 'deleted') {
          // Reacción removida
          emitToPost(io, postId, 'reaction:removed', {
            userId,
            postId,
            type,
            timestamp: new Date(),
          });
        } else if (action === 'updated') {
          // Reacción actualizada
          emitToPost(io, postId, 'reaction:updated', {
            userId,
            postId,
            oldType: reaction.type,
            newType: type,
            timestamp: new Date(),
          });
        }
      } else if (commentId) {
        // Similar para comentarios
        if (action === 'created') {
          emitToPost(io, 'comment', 'reaction:added', {
            userId,
            commentId,
            type,
            timestamp: new Date(),
          });
        } else if (action === 'deleted') {
          emitToPost(io, 'comment', 'reaction:removed', {
            userId,
            commentId,
            type,
            timestamp: new Date(),
          });
        }
      }
    }

    res.status(action === 'created' ? 201 : 200).json({
      data: reaction,
      action,
    });
  }
);

// GET /api/v1/reactions/count - Get reactions count
reactionsRouter.get(
  '/count',
  validate(getReactionsSchema),
  async (req, res) => {
    const { postId, commentId } = req.query as any;
    const counts = await ReactionsService.getReactionsCounts(postId, commentId);

    res.json({ data: counts });
  }
);

// GET /api/v1/reactions/my-reaction - Get user's reaction
reactionsRouter.get(
  '/my-reaction',
  authenticate,
  validate(getReactionsSchema),
  async (req, res) => {
    const { postId, commentId } = req.query as any;
    const userReaction = await ReactionsService.getUserReaction(
      req.user!.id,
      postId,
      commentId
    );

    res.json({ data: { type: userReaction } });
  }
);

// GET /api/v1/reactions - Get reactions list
reactionsRouter.get(
  '/',
  validate(getReactionsSchema),
  async (req, res) => {
    const { postId, commentId, type } = req.query as any;
    const reactions = await ReactionsService.getReactions(
      postId,
      commentId,
      type as ReactionType | undefined
    );

    res.json({ data: reactions });
  }
);

// DELETE /api/v1/reactions/:id - Delete reaction
reactionsRouter.delete(
  '/:id',
  authenticate,
  async (req, res) => {
    await ReactionsService.deleteReaction(req.params.id, req.user!.id);
    res.json({ message: 'Reaction deleted' });
  }
);
