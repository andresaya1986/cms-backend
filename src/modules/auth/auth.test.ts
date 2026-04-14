import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

// ─────────────────────────────────────────
//  Mocks — antes de importar cualquier módulo
// ─────────────────────────────────────────
vi.mock('../shared/config/databases', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    notification: { create: vi.fn() },
  },
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    ttl: vi.fn().mockResolvedValue(600),
    call: vi.fn(),
  },
}));

vi.mock('../infrastructure/email/sendgrid', () => ({
  sendOtpEmail: vi.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../shared/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    APP_NAME: 'CMS Test',
    JWT_ACCESS_SECRET: 'test-access-secret-min-32-chars-xxxxxxxxxxxxx',
    JWT_REFRESH_SECRET: 'test-refresh-secret-min-32-chars-xxxxxxxxxxx',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    OTP_EXPIRES_IN_MINUTES: 10,
    SENDGRID_API_KEY: 'SG.test',
    SENDGRID_FROM_EMAIL: 'test@example.com',
    SENDGRID_FROM_NAME: 'Test',
  },
}));

import express from 'express';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import 'express-async-errors';
import { authRouter } from '../modules/auth/auth.routes';
import { errorHandler } from '../shared/middleware/errorHandler';
import { prisma, redis } from '../shared/config/databases';
import { sendOtpEmail } from '../infrastructure/email/sendgrid';
import bcrypt from 'bcryptjs';

// ─────────────────────────────────────────
//  Setup app de test
// ─────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/v1/auth', authRouter);
app.use(errorHandler);

const mockPrisma = prisma as any;
const mockRedis = redis as any;
const mockSendOtp = sendOtpEmail as any;

describe('POST /api/v1/auth/register', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registra un usuario nuevo correctamente', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'new@example.com',
      username: 'newuser',
      displayName: null,
      role: 'USER',
    });
    mockRedis.setex.mockResolvedValue('OK');
    mockSendOtp.mockResolvedValue(undefined);

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'new@example.com',
      username: 'newuser',
      password: 'Password1!',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'new@example.com', username: 'newuser' });
    expect(sendOtpEmail).toHaveBeenCalledOnce();
  });

  it('rechaza email duplicado con 409', async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ email: 'existing@example.com', username: 'other' });

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'existing@example.com',
      username: 'newuser2',
      password: 'Password1!',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/email/i);
  });

  it('valida la contraseña débil con 422', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'test@example.com',
      username: 'testuser',
      password: '1234',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.details).toBeDefined();
  });

  it('valida el username con caracteres inválidos', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'test2@example.com',
      username: 'invalid user!',
      password: 'Password1!',
    });

    expect(res.status).toBe(422);
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => vi.clearAllMocks());

  const mockUser = {
    id: 'user-1',
    email: 'user@example.com',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: null,
    role: 'USER' as const,
    status: 'ACTIVE' as const,
    passwordHash: '',
    emailVerified: true,
    twoFactorEnabled: false,
  };

  it('hace login con credenciales correctas', async () => {
    mockUser.passwordHash = await bcrypt.hash('Password1!', 10);
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
    mockPrisma.user.update.mockResolvedValue(mockUser);
    mockPrisma.session.create.mockResolvedValue({ id: 'session-1' });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'Password1!',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('rechaza credenciales incorrectas con 401', async () => {
    mockUser.passwordHash = await bcrypt.hash('Password1!', 10);
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'WrongPassword1!',
    });

    expect(res.status).toBe(401);
  });

  it('rechaza usuario con email no verificado con 403', async () => {
    mockUser.passwordHash = await bcrypt.hash('Password1!', 10);
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, emailVerified: false });

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'Password1!',
    });

    expect(res.status).toBe(403);
    expect(res.body.error.message).toMatch(/verifica/i);
  });

  it('requiere OTP para usuarios con 2FA', async () => {
    mockUser.passwordHash = await bcrypt.hash('Password1!', 10);
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, twoFactorEnabled: true });
    mockRedis.setex.mockResolvedValue('OK');
    mockSendOtp.mockResolvedValue(undefined);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'user@example.com',
      password: 'Password1!',
    });

    expect(res.status).toBe(200);
    expect(res.body.requires2FA).toBe(true);
    expect(res.body).toHaveProperty('tempToken');
    expect(sendOtpEmail).toHaveBeenCalledOnce();
  });
});

describe('POST /api/v1/auth/forgot-password', () => {
  beforeEach(() => vi.clearAllMocks());

  it('responde igual si el email existe o no (evita user enumeration)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res1 = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'notexist@x.com' });

    mockPrisma.user.findUnique.mockResolvedValue({ username: 'user' });
    mockRedis.setex.mockResolvedValue('OK');
    mockSendOtp.mockResolvedValue(undefined);
    const res2 = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'real@x.com' });

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.message).toBe(res2.body.message);
  });
});
