// ─────────────────────────────────────────
//  Reactions Types
// ─────────────────────────────────────────
import { ReactionType } from '@prisma/client';

export interface CreateReactionDTO {
  type: ReactionType;
  postId?: string;
  commentId?: string;
}

export interface ReactionResponse {
  id: string;
  userId: string;
  postId?: string;
  commentId?: string;
  type: ReactionType;
  createdAt: Date;
}

export interface ReactionsCountResponse {
  LIKE: number;
  LOVE: number;
  CARE: number;
  HAHA: number;
  WOW: number;
  SAD: number;
  ANGRY: number;
  total: number;
}

export interface UserReactionResponse {
  userId: string;
  type: ReactionType;
  user: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}
