import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import mongoose from 'mongoose';
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

// ─── Bootstrap ────────────────────────────
export async function connectDatabases() {
  await prisma.$connect();
  logger.info('PostgreSQL connected (Prisma)');

  // Evitar reconectar a Redis si ya está conectado
  if (!redis.status || redis.status === 'close') {
    await redis.connect();
  }

  await connectMongoDB();
}

export async function closeDatabases() {
  await prisma.$disconnect();
  await redis.quit();
  await mongoose.disconnect();
  logger.info('All database connections closed');
}
