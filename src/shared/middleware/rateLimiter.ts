import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import RedisStore from 'rate-limit-redis';
import type { RedisReply, SendCommandFn } from 'rate-limit-redis';
import { redis } from '../config/databases';
import { env } from '../config/env';

const sendRedisCommand: SendCommandFn = (...args: string[]) =>
  redis.call(args[0], ...args.slice(1)) as unknown as Promise<RedisReply>;

function createLimiter(options: {
  windowMs: number;
  max: number;
  prefix: string;
  message?: string;
  skip?: (req: Request) => boolean;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    skip: options.skip,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { message: options.message ?? 'Demasiadas solicitudes, intenta más tarde' },
    },
    store: new RedisStore({
      sendCommand: sendRedisCommand,
      prefix: `rl:${options.prefix}:`,
    }),
  });
}

export const rateLimiter = {
  // Global: 100 req / 15 min por IP
  global: createLimiter({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    prefix: 'global',
  }),

  // Auth: 10 intentos / 15 min (anti-brute force)
  auth: createLimiter({
    windowMs: 15 * 60 * 1000,
    max: env.RATE_LIMIT_AUTH_MAX,
    prefix: 'auth',
    message: 'Demasiados intentos de autenticación',
    skip: (req) => {
      if (req.method === 'HEAD' || req.method === 'OPTIONS') return true;
      if (req.method === 'GET' && /\/_next\.?_tree\.txt$/i.test(req.path)) return true;
      return false;
    },
  }),

  // Upload: 20 req / hora
  upload: createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 20,
    prefix: 'upload',
    message: 'Límite de subidas alcanzado',
  }),

  // API pública: 200 req / hora
  public: createLimiter({
    windowMs: 60 * 60 * 1000,
    max: 200,
    prefix: 'public',
  }),
};
