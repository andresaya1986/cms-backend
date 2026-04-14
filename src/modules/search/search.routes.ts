import { Router } from 'express';
import { Client } from '@elastic/elasticsearch';
import { z } from 'zod';
import { validate } from '../../shared/middleware/validate';
import { env } from '../../shared/config/env';
import { AppError } from '../../shared/errors/AppError';

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
        ...h._source,
        highlight: h.highlight,
      })),
      page,
      limit,
    });
  } catch (err: any) {
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
