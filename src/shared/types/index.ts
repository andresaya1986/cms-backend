// ─────────────────────────────────────────
//  Tipos compartidos del dominio
// ─────────────────────────────────────────

// ── Roles ─────────────────────────────────
export type UserRole = 'USER' | 'AUTHOR' | 'EDITOR' | 'ADMIN' | 'SUPER_ADMIN';
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'BANNED';

// ── Posts ─────────────────────────────────
export type PostStatus = 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED' | 'DELETED';
export type PostType = 'ARTICLE' | 'NEWS' | 'TUTORIAL' | 'REVIEW' | 'SHORT' | 'GALLERY' | 'VIDEO';
export type Visibility = 'PUBLIC' | 'FOLLOWERS_ONLY' | 'PRIVATE' | 'UNLISTED';

// ── Notificaciones ────────────────────────
export type NotificationType =
  | 'NEW_FOLLOWER'
  | 'POST_LIKE'
  | 'COMMENT_LIKE'
  | 'NEW_COMMENT'
  | 'COMMENT_REPLY'
  | 'POST_MENTION'
  | 'COMMENT_MENTION'
  | 'SYSTEM'
  | 'WELCOME';

// ── Auth ──────────────────────────────────
export interface JwtPayload {
  sub: string;
  role: UserRole;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface AuthUser {
  id: string;
  role: UserRole;
}

// ── Paginación ────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

// ── Respuesta API estándar ─────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { message: string; details?: unknown };
}

export function ok<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, data, message };
}

export function fail(message: string, details?: unknown): ApiResponse {
  return { success: false, error: { message, details } };
}

// ── Eventos Analytics ─────────────────────
export type AnalyticsCategory = 'pageview' | 'engagement' | 'conversion' | 'social' | 'error' | 'custom';
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface AnalyticsEvent {
  sessionId?: string;
  userId?: string;
  name: string;
  category: AnalyticsCategory;
  properties?: Record<string, unknown>;
  url?: string;
  referrer?: string;
  duration?: number;
  device?: DeviceType;
}

// ── Media ─────────────────────────────────
export interface UploadedFile {
  id: string;
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

// ── Feed item ─────────────────────────────
export interface FeedItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  featuredImage?: string;
  type: PostType;
  author: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  likesCount: number;
  commentsCount: number;
  viewCount: number;
  publishedAt?: Date;
  createdAt: Date;
}
