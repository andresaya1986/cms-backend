import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import mongoose from 'mongoose';
import { Client } from '@elastic/elasticsearch';
import { env } from './env';
import { logger } from './logger';

// ─── Prisma (PostgreSQL) ──────────────────
export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development'
    ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
    : ['warn', 'error'],
});

if (env.NODE_ENV === 'development') {
  (prisma as any).$on('query', (e: any) => {
    logger.debug({ query: e.query, duration: `${e.duration}ms` }, 'SQL Query');
  });
}

// ─── Redis ────────────────────────────────
export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 10) return null;
    return Math.min(times * 500, 5000);
  },
});

redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('connect', () => logger.info('Redis connected'));

// ─── MongoDB (analytics) ─────────────────
export async function connectMongoDB() {
  await mongoose.connect(env.MONGODB_URL, {
    serverSelectionTimeoutMS: 5000,
  });
  logger.info('MongoDB connected');
}

// ─── Elasticsearch (full-text search) ────
export async function initializeElasticsearch() {
  const esClient = new Client({
    node: env.ELASTIC_HOST,
    auth: { username: env.ELASTIC_USERNAME, password: env.ELASTIC_PASSWORD },
  });

  const indices = [
    {
      name: 'cms_posts',
      mappings: {
        properties: {
          title: { type: 'text', analyzer: 'standard' },
          slug: { type: 'keyword' },
          excerpt: { type: 'text' },
          content: { type: 'text' },
          authorId: { type: 'keyword' },
          authorUsername: { type: 'keyword' },
          categories: { type: 'keyword' },
          tags: { type: 'keyword' },
          publishedAt: { type: 'date' },
          viewCount: { type: 'integer' },
          likesCount: { type: 'integer' },
        },
      } as any,
    },
    {
      name: 'cms_users',
      mappings: {
        properties: {
          username: { type: 'keyword' },
          displayName: { type: 'text' },
          bio: { type: 'text' },
        },
      } as any,
    },
  ];

  try {
    for (const index of indices) {
      try {
        const exists = await esClient.indices.exists({ index: index.name });
        if (!exists) {
          await esClient.indices.create({
            index: index.name,
            mappings: index.mappings,
          });
          logger.info(`Elasticsearch index '${index.name}' created`);
        }
      } catch (err: any) {
        // Si el índice ya existe, no hay problema
        if (err.name !== 'ResourceAlreadyExistsException') {
          throw err;
        }
      }
    }
    logger.info('Elasticsearch indices initialized');
  } catch (err: any) {
    logger.warn({ err }, 'Elasticsearch initialization warning (search may not work)');
  }
}

// ─── Bootstrap ────────────────────────────
export async function connectDatabases() {
  await prisma.$connect();
  logger.info('PostgreSQL connected (Prisma)');

  // Evitar reconectar a Redis si ya está conectado
  if (!redis.status || redis.status === 'close') {
    await redis.connect();
  }

  await connectMongoDB();
  await initializeElasticsearch();
}

export async function closeDatabases() {
  await prisma.$disconnect();
  await redis.quit();
  await mongoose.disconnect();
  logger.info('All database connections closed');
}
