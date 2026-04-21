import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().default(3000),
  APP_NAME: z.string().default('CMS Backend'),
  APP_URL: z.string().url(),
  FRONTEND_URL: z.string().url(),
  CORS_ORIGINS: z.string(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // OTP
  OTP_LENGTH: z.coerce.number().default(6),
  OTP_EXPIRES_IN_MINUTES: z.coerce.number().default(10),

  // SendGrid
  SENDGRID_API_KEY: z.string().startsWith('SG.'),
  SENDGRID_FROM_EMAIL: z.string().email(),
  SENDGRID_FROM_NAME: z.string().default('CMS App'),
  SENDGRID_TEMPLATE_OTP: z.string().optional(),
  SENDGRID_TEMPLATE_WELCOME: z.string().optional(),
  SENDGRID_TEMPLATE_RESET_PASSWORD: z.string().optional(),

  // PostgreSQL
  DATABASE_URL: z.string().startsWith('postgresql://'),

  // Redis
  REDIS_HOST: z.string().default('redis'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string(),

  // MongoDB
  MONGODB_URL: z.string().startsWith('mongodb://'),

  // MinIO / S3
  MINIO_ENDPOINT: z.string().default('minio'),
  MINIO_PUBLIC_ENDPOINT: z.string().default('localhost'),
  MINIO_USER: z.string(),
  MINIO_PASSWORD: z.string(),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.string().transform((v) => v === 'true').default('false'),
  S3_BUCKET_PUBLIC: z.string().default('cms-public'),
  S3_BUCKET_PRIVATE: z.string().default('cms-private'),

  // Elasticsearch
  ELASTIC_HOST: z.string().url(),
  ELASTIC_USERNAME: z.string().default('elastic'),
  ELASTIC_PASSWORD: z.string(),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().default(10),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ Variables de entorno inválidas:');
    result.error.errors.forEach((e) => {
      console.error(`  ${e.path.join('.')}: ${e.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
export type Env = typeof env;
