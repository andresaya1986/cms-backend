// ─────────────────────────────────────────
//  Reactions Service
// ─────────────────────────────────────────
import { prisma } from '../../shared/config/databases';
import { AppError } from '../../shared/errors/AppError';
import type { ReactionType } from '@prisma/client';
import type { ReactionsCountResponse, UserReactionResponse } from './reactions.types';

export class ReactionsService {
  /**
   * Add or update a reaction on a post or comment
   */
  static async toggleReaction(
    userId: string,
    type: ReactionType,
    postId?: string,
    commentId?: string,
  ): Promise<{ action: 'created' | 'updated' | 'deleted'; reaction: any }> {
    if (!postId && !commentId) {
      throw new AppError('postId or commentId is required', 400);
    }

    if (postId && commentId) {
      throw new AppError('Cannot react to both post and comment', 400);
    }

    // Check if post/comment exists
    if (postId) {
      const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
      if (!post) throw new AppError('Post not found', 404);
    }

    if (commentId) {
      const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } });
      if (!comment) throw new AppError('Comment not found', 404);
    }

    // Check if reaction already exists
    const existingReaction = await prisma.reaction.findFirst({
      where: {
        userId,
        ...(postId ? { postId } : { commentId }),
      },
    });

    if (existingReaction) {
      // If same type, delete (unlike)
      if (existingReaction.type === type) {
        await prisma.reaction.delete({ where: { id: existingReaction.id } });

        // Decrement counter
        if (postId) {
          await prisma.post.update({
            where: { id: postId },
            data: { reactionsCount: { decrement: 1 } },
          });
        } else {
          await prisma.comment.update({
            where: { id: commentId },
            data: { reactionsCount: { decrement: 1 } },
          });
        }

        return { action: 'deleted', reaction: existingReaction };
      }

      // If different type, update
      const updated = await prisma.reaction.update({
        where: { id: existingReaction.id },
        data: { type },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      return { action: 'updated', reaction: updated };
    }

    // Create new reaction
    const reaction = await prisma.reaction.create({
      data: {
        userId,
        type,
        ...(postId ? { postId } : { commentId }),
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    // Increment counter
    if (postId) {
      await prisma.post.update({
        where: { id: postId },
        data: { reactionsCount: { increment: 1 } },
      });
    } else {
      await prisma.comment.update({
        where: { id: commentId },
        data: { reactionsCount: { increment: 1 } },
      });
    }

    return { action: 'created', reaction };
  }

  /**
   * Get reaction count by type for a post or comment
   */
  static async getReactionsCounts(postId?: string, commentId?: string): Promise<ReactionsCountResponse> {
    if (!postId && !commentId) {
      throw new AppError('postId or commentId is required', 400);
    }

    const reactions = await prisma.reaction.findMany({
      where: {
        ...(postId ? { postId } : { commentId }),
      },
      select: { type: true },
    });

    const counts: Record<ReactionType, number> = {
      LIKE: 0,
      LOVE: 0,
      CARE: 0,
      HAHA: 0,
      WOW: 0,
      SAD: 0,
      ANGRY: 0,
    };

    reactions.forEach(r => {
      counts[r.type]++;
    });

    return {
      ...counts,
      total: reactions.length,
    };
  }

  /**
   * Get users who reacted with specific type or all reactions
   */
  static async getReactions(postId?: string, commentId?: string, type?: ReactionType): Promise<UserReactionResponse[]> {
    if (!postId && !commentId) {
      throw new AppError('postId or commentId is required', 400);
    }

    const reactions = await prisma.reaction.findMany({
      where: {
        ...(postId ? { postId } : { commentId }),
        ...(type && { type }),
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return reactions.map(r => ({
      userId: r.userId,
      type: r.type,
      user: r.user,
    }));
  }

  /**
   * Get user's reaction on a post or comment
   */
  static async getUserReaction(userId: string, postId?: string, commentId?: string): Promise<ReactionType | null> {
    if (!postId && !commentId) {
      throw new AppError('postId or commentId is required', 400);
    }

    const reaction = await prisma.reaction.findFirst({
      where: {
        userId,
        ...(postId ? { postId } : { commentId }),
      },
      select: { type: true },
    });

    return reaction?.type || null;
  }

  /**
   * Delete a reaction
   */
  static async deleteReaction(reactionId: string, userId: string): Promise<void> {
    const reaction = await prisma.reaction.findUnique({
      where: { id: reactionId },
      include: { post: { select: { id: true } }, comment: { select: { id: true } } },
    });

    if (!reaction) throw new AppError('Reaction not found', 404);
    if (reaction.userId !== userId) throw new AppError('Unauthorized', 403);

    await prisma.reaction.delete({ where: { id: reactionId } });

    // Decrement counter
    if (reaction.postId) {
      await prisma.post.update({
        where: { id: reaction.postId },
        data: { reactionsCount: { decrement: 1 } },
      });
    } else if (reaction.commentId) {
      await prisma.comment.update({
        where: { id: reaction.commentId },
        data: { reactionsCount: { decrement: 1 } },
      });
    }
  }
}
