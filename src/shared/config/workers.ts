import { Worker, Queue, QueueEvents } from 'bullmq';
import { redis } from '../config/databases';
import { logger } from '../config/logger';
import { sendOtpEmail, sendWelcomeEmail } from '../../infrastructure/email/sendgrid';
import { indexPost, indexUser, deletePostIndex } from '../../modules/search/search.routes';
import { prisma } from '../config/databases';

const connection = { host: process.env.REDIS_HOST || 'redis', port: Number(process.env.REDIS_PORT) || 6379, password: process.env.REDIS_PASSWORD };

// ─────────────────────────────────────────
//  QUEUES — definición
// ─────────────────────────────────────────
export const emailQueue = new Queue('email', { connection, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 500 } });
export const notificationQueue = new Queue('notification', { connection, defaultJobOptions: { attempts: 2, backoff: { type: 'fixed', delay: 3000 }, removeOnComplete: 50 } });
export const searchIndexQueue = new Queue('search-index', { connection, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 20 } });
export const analyticsQueue = new Queue('analytics', { connection, defaultJobOptions: { attempts: 2, removeOnComplete: 10 } });

// ─────────────────────────────────────────
//  WORKER — Emails
// ─────────────────────────────────────────
export const emailWorker = new Worker(
  'email',
  async (job) => {
    const { type, to, data } = job.data;
    logger.debug({ jobId: job.id, type, to }, 'Processing email job');

    switch (type) {
      case 'OTP':
        await sendOtpEmail({ to, otp: data.otp, type: data.otpType, username: data.username });
        break;
      case 'WELCOME':
        await sendWelcomeEmail(to, data.username);
        break;
      case 'POST_PUBLISHED':
        // Notificar seguidores sobre nuevo post (batch pequeño)
        // En producción usar SendGrid bulk email
        logger.info({ postId: data.postId }, 'Post published notification queued');
        break;
      default:
        logger.warn({ type }, 'Unknown email job type');
    }
  },
  { connection, concurrency: 5 },
);

// ─────────────────────────────────────────
//  WORKER — Notificaciones en BD + Socket
// ─────────────────────────────────────────
export const notificationWorker = new Worker(
  'notification',
  async (job) => {
    const { userId, type, title, body, data } = job.data;

    // Guardar en PostgreSQL
    await prisma.notification.create({ data: { userId, type, title, body, data } });

    // Emitir por Socket.io si el usuario está conectado
    // (el io instance se pasa como contexto del job en producción)
    logger.debug({ userId, type }, 'Notification saved');
  },
  { connection, concurrency: 10 },
);

// ─────────────────────────────────────────
//  WORKER — Indexación Elasticsearch
// ─────────────────────────────────────────
export const searchIndexWorker = new Worker(
  'search-index',
  async (job) => {
    const { action, entity, data } = job.data;

    switch (`${entity}:${action}`) {
      case 'post:upsert':
        await indexPost(data);
        break;
      case 'post:delete':
        await deletePostIndex(data.id);
        break;
      case 'user:upsert':
        await indexUser(data);
        break;
      default:
        logger.warn({ action, entity }, 'Unknown search index job');
    }
  },
  { connection, concurrency: 3 },
);

// ─────────────────────────────────────────
//  WORKER — Analytics batch flush
// ─────────────────────────────────────────
export const analyticsWorker = new Worker(
  'analytics',
  async (job) => {
    const { events } = job.data;
    // Procesamiento adicional: agregaciones, alertas, etc.
    logger.debug({ count: events?.length }, 'Analytics batch processed');
  },
  { connection, concurrency: 2 },
);

// ─────────────────────────────────────────
//  Event listeners para logging
// ─────────────────────────────────────────
[emailWorker, notificationWorker, searchIndexWorker, analyticsWorker].forEach((worker) => {
  worker.on('completed', (job) => logger.debug({ jobId: job.id, queue: worker.name }, 'Job completed'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, queue: worker.name, err }, 'Job failed'));
});

// ─────────────────────────────────────────
//  Helpers para encolar trabajos
// ─────────────────────────────────────────
export const jobs = {
  sendOtp: (to: string, otpType: string, otp: string, username: string) =>
    emailQueue.add('otp', { type: 'OTP', to, data: { otpType, otp, username } }),

  sendWelcome: (to: string, username: string) =>
    emailQueue.add('welcome', { type: 'WELCOME', to, data: { username } }),

  notify: (userId: string, type: string, title: string, body: string, data?: any) =>
    notificationQueue.add('notify', { userId, type, title, body, data }),

  indexPost: (post: any) =>
    searchIndexQueue.add('index-post', { action: 'upsert', entity: 'post', data: post }),

  deletePost: (postId: string) =>
    searchIndexQueue.add('delete-post', { action: 'delete', entity: 'post', data: { id: postId } }),

  indexUser: (user: any) =>
    searchIndexQueue.add('index-user', { action: 'upsert', entity: 'user', data: user }),
};

export async function closeWorkers() {
  await Promise.all([
    emailWorker.close(),
    notificationWorker.close(),
    searchIndexWorker.close(),
    analyticsWorker.close(),
  ]);
  logger.info('All BullMQ workers closed');
}
