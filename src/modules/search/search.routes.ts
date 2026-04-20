import { Router } from 'express';
import { Client } from '@elastic/elasticsearch';
import { z } from 'zod';
import { validate } from '../../shared/middleware/validate';
import { env } from '../../shared/config/env';
import { AppError } from '../../shared/errors/AppError';
import { authenticate, authorize } from '../../shared/middleware/authenticate';
import { prisma } from '../../shared/config/databases';
import { logger } from '../../shared/config/logger';

export const searchRouter = Router();

const esClient = new Client({
  node: env.ELASTIC_HOST,
  auth: { username: env.ELASTIC_USERNAME, password: env.ELASTIC_PASSWORD },
});

const searchSchema = z.object({
  query: z.object({
    q: z.string().min(1).max(200),
    type: z.enum(['posts', 'users', 'all']).default('all'),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
  }),
});

// ─────────────────────────────────────────
//  GET /api/v1/search?q=...
// ─────────────────────────────────────────
searchRouter.get('/', validate(searchSchema), async (req, res) => {
  const { q, type, page, limit } = req.query as any;
  const from = (page - 1) * limit;

  const indices: string[] = [];
  if (type === 'all' || type === 'posts') indices.push('cms_posts');
  if (type === 'all' || type === 'users') indices.push('cms_users');

  try {
    const { hits } = await esClient.search({
      index: indices,
      from,
      size: limit,
      query: {
        multi_match: {
          query: q,
          fields: ['title^3', 'excerpt^2', 'content', 'username^2', 'displayName', 'bio'],
          fuzziness: 'AUTO',
          operator: 'or',
        },
      },
      highlight: {
        fields: {
          title: {},
          excerpt: {},
          content: { fragment_size: 200, number_of_fragments: 1 },
        },
      },
    });

    res.json({
      query: q,
      total: (hits.total as any)?.value ?? 0,
      results: hits.hits.map((h) => ({
        id: h._id,
        index: h._index,
        score: h._score,
        ...(h._source as Record<string, any>),
        highlight: h.highlight,
      })),
      page,
      limit,
    });
    return;
  } catch (err: any) {
    // Si los índices no existen, retornar búsqueda vacía
    if (err.name === 'ResponseError' && err.meta?.body?.error?.type === 'index_not_found_exception') {
      return res.json({
        query: q,
        total: 0,
        results: [],
        page,
        limit,
        warning: 'Los índices de búsqueda aún no están inicializados',
      });
    }
    // Si Elasticsearch no está disponible, degradar gracefully
    if (err.name === 'ConnectionError') {
      throw new AppError('Servicio de búsqueda temporalmente no disponible', 503);
    }
    throw err;
  }
});

// ─────────────────────────────────────────
//  POST /api/v1/search/index/post
//  Indexar o reindexar un post
// ─────────────────────────────────────────
export async function indexPost(post: any) {
  try {
    await esClient.index({
      index: 'cms_posts',
      id: post.id,
      document: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content?.substring(0, 5000), // Limitar tamaño
        authorId: post.authorId,
        authorUsername: post.author?.username,
        categories: post.categories?.map((c: any) => c.category.name),
        tags: post.tags?.map((t: any) => t.tag.name),
        publishedAt: post.publishedAt,
        viewCount: post.viewCount,
        likesCount: post.likesCount,
      },
    });
  } catch {
    // No bloquear el flujo si Elasticsearch falla
  }
}

export async function indexUser(user: any) {
  try {
    await esClient.index({
      index: 'cms_users',
      id: user.id,
      document: {
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
      },
    });
  } catch {}
}

export async function deletePostIndex(postId: string) {
  try {
    await esClient.delete({ index: 'cms_posts', id: postId });
  } catch {}
}

// ─────────────────────────────────────────
//  POST /api/v1/search/reindex
//  Reindexar todos los posts en Elasticsearch
//  (En desarrollo: sin autenticación requerida)
// ─────────────────────────────────────────
searchRouter.post('/reindex', async (req, res) => {
  try {
    logger.info('Starting full reindex of posts');

    // Obtener todos los posts publicados
    const posts = await prisma.post.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      include: {
        author: { select: { id: true, username: true, displayName: true } },
        categories: { include: { category: true } },
        tags: { include: { tag: true } },
      },
    });

    logger.info({ count: posts.length }, 'Found posts to index');

    // Indexar cada post
    let indexed = 0;
    let failed = 0;

    for (const post of posts) {
      try {
        await indexPost(post);
        indexed++;
      } catch (err) {
        logger.warn({ postId: post.id, err }, 'Failed to index post');
        failed++;
      }
    }

    logger.info({ indexed, failed }, 'Reindex complete');

    res.json({
      message: 'Reindex completado',
      stats: {
        total: posts.length,
        indexed,
        failed,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Reindex failed');
    throw err;
  }
});
