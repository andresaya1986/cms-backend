import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  ...(env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
  base: {
    env: env.NODE_ENV,
    app: env.APP_NAME,
  },
  redact: {
    paths: [
      'password', 'passwordHash', 'token', 'refreshToken',
      'authorization', 'cookie', 'req.headers.authorization',
      'req.headers.cookie', 'body.password', 'body.otp',
    ],
    censor: '[REDACTED]',
  },
});
