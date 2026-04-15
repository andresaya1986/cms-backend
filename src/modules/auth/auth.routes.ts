// ─────────────────────────────────────────
//  Auth Module — JWT + OTP via SendGrid
// ─────────────────────────────────────────
import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../shared/config/databases';
import { redis } from '../../shared/config/databases';
import { sendOtpEmail } from '../../infrastructure/email/sendgrid';
import { env } from '../../shared/config/env';
import { validate } from '../../shared/middleware/validate';
import { authenticate } from '../../shared/middleware/authenticate';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/config/logger';

export const authRouter = Router();

// Algunos clientes hacen probes con HEAD antes de enviar POST.
// Respondemos 204 para evitar falsos 404 en consola del navegador.
authRouter.head('/login', (_req, res) => res.sendStatus(204));
authRouter.head('/register', (_req, res) => res.sendStatus(204));

// ─────────────────────────────────────────
//  ESQUEMAS DE VALIDACIÓN (Zod)
// ─────────────────────────────────────────
const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Email inválido'),
    username: z
      .string()
      .min(3, 'Mínimo 3 caracteres')
      .max(30, 'Máximo 30 caracteres')
      .regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guion bajo'),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
      .regex(/[0-9]/, 'Debe tener al menos un número')
      .regex(/[^a-zA-Z0-9]/, 'Debe tener al menos un carácter especial'),
    displayName: z.string().max(50).optional(),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

const verifyOtpSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otp: z.string().length(6),
    type: z.enum(['EMAIL_VERIFICATION', 'TWO_FACTOR', 'PASSWORD_RESET']),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});

const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
    otp: z.string().length(6),
    newPassword: z
      .string()
      .min(8)
      .regex(/[A-Z]/)
      .regex(/[0-9]/)
      .regex(/[^a-zA-Z0-9]/),
  }),
});

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────
function generateOtp(length = 6): string {
  const digits = '0123456789';
  let otp = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[bytes[i] % digits.length];
  }
  return otp;
}

async function storeOtp(email: string, type: string, otp: string): Promise<void> {
  const key = `otp:${type}:${email}`;
  const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
  const attempts = 0;
  await redis.setex(
    key,
    env.OTP_EXPIRES_IN_MINUTES * 60,
    JSON.stringify({ hash: hashedOtp, attempts }),
  );
}

async function verifyOtp(email: string, type: string, otp: string): Promise<boolean> {
  const key = `otp:${type}:${email}`;
  const data = await redis.get(key);
  if (!data) return false;

  const { hash, attempts } = JSON.parse(data);
  if (attempts >= 5) throw new AppError('Demasiados intentos. Solicita un nuevo código.', 429);

  const inputHash = crypto.createHash('sha256').update(otp).digest('hex');
  if (inputHash !== hash) {
    // incrementar intentos
    const ttl = await redis.ttl(key);
    await redis.setex(key, ttl, JSON.stringify({ hash, attempts: attempts + 1 }));
    return false;
  }

  await redis.del(key); // OTP de un solo uso
  return true;
}

function generateTokens(userId: string, role: string) {
  const accessToken = jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: env.APP_NAME,
    audience: 'cms-api',
  });

  const refreshToken = jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: env.APP_NAME,
    audience: 'cms-api',
  });

  return { accessToken, refreshToken };
}

async function saveSession(
  userId: string,
  refreshToken: string,
  meta: { userAgent?: string; ipAddress?: string },
) {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

  await prisma.session.create({
    data: {
      userId,
      refreshToken: hash,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    },
  });
}

function setRefreshCookie(res: any, token: string) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    path: '/api/v1/auth',
  });
}

// ─────────────────────────────────────────
//  RUTAS
// ─────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 */
authRouter.post('/register', validate(registerSchema), async (req, res) => {
  const { email, username, password, displayName } = req.body;

  // Verificar duplicados
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (existing?.email === email) throw new AppError('El email ya está registrado', 409);
  if (existing?.username === username) throw new AppError('El username ya está en uso', 409);

  // Hash de contraseña
  const passwordHash = await bcrypt.hash(password, 12);

  // Crear usuario
  const user = await prisma.user.create({
    data: { email, username, displayName, passwordHash },
    select: { id: true, email: true, username: true, displayName: true, role: true },
  });

  // Enviar OTP de verificación
  const otp = generateOtp();
  await storeOtp(email, 'EMAIL_VERIFICATION', otp);
  await sendOtpEmail({ to: email, otp, type: 'EMAIL_VERIFICATION', username });

  logger.info({ userId: user.id }, 'New user registered');

  res.status(201).json({
    message: 'Registro exitoso. Revisa tu email para verificar tu cuenta.',
    user,
  });
});

/**
 * POST /api/v1/auth/verify-email
 */
authRouter.post('/verify-email', validate(verifyOtpSchema), async (req, res) => {
  const { email, otp } = req.body;

  const valid = await verifyOtp(email, 'EMAIL_VERIFICATION', otp);
  if (!valid) throw new AppError('OTP inválido o expirado', 400);

  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: true, status: 'ACTIVE' },
    select: { id: true, email: true, username: true, role: true },
  });

  const { accessToken, refreshToken } = generateTokens(user.id, user.role);
  await saveSession(user.id, refreshToken, {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });
  setRefreshCookie(res, refreshToken);

  logger.info({ userId: user.id }, 'Email verified');

  res.json({ message: 'Email verificado correctamente', accessToken, user });
});

/**
 * POST /api/v1/auth/login
 */
authRouter.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true, email: true, username: true, displayName: true,
      avatarUrl: true, role: true, status: true,
      passwordHash: true, emailVerified: true, twoFactorEnabled: true,
      createdAt: true,
    },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AppError('Credenciales incorrectas', 401);
  }

  if (!user.emailVerified) throw new AppError('Verifica tu email antes de iniciar sesión', 403);
  if (user.status === 'SUSPENDED') throw new AppError('Cuenta suspendida', 403);
  if (user.status === 'BANNED') throw new AppError('Cuenta bloqueada', 403);

  // Si tiene 2FA activo, enviar OTP y retornar token temporal
  if (user.twoFactorEnabled) {
    const otp = generateOtp();
    await storeOtp(email, 'TWO_FACTOR', otp);
    await sendOtpEmail({ to: email, otp, type: 'TWO_FACTOR', username: user.username });

    // Token temporal de 10 minutos para completar 2FA
    const tempToken = jwt.sign(
      { sub: user.id, step: '2fa' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '10m' },
    );

    return res.json({
      requires2FA: true,
      tempToken,
      message: 'Código enviado a tu email',
    });
  }

  // Login sin 2FA
  const { accessToken, refreshToken } = generateTokens(user.id, user.role);
  await saveSession(user.id, refreshToken, {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: req.ip },
  });

  setRefreshCookie(res, refreshToken);

  const { passwordHash, ...safeUser } = user;

  logger.info({ userId: user.id }, 'User logged in');
  res.json({ accessToken, user: safeUser });
});

/**
 * POST /api/v1/auth/verify-2fa
 */
authRouter.post('/verify-2fa', validate(verifyOtpSchema), async (req, res) => {
  const { email, otp } = req.body;

  const valid = await verifyOtp(email, 'TWO_FACTOR', otp);
  if (!valid) throw new AppError('OTP inválido o expirado', 400);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, username: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError('Usuario no encontrado', 404);

  const { accessToken, refreshToken } = generateTokens(user.id, user.role);
  await saveSession(user.id, refreshToken, {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  });
  setRefreshCookie(res, refreshToken);

  res.json({ accessToken, user });
});

/**
 * POST /api/v1/auth/refresh
 */
authRouter.post('/refresh', validate(refreshSchema), async (req, res) => {
  const token = req.cookies?.refresh_token || req.body?.refreshToken;
  if (!token) throw new AppError('Token de refresco requerido', 401);

  let payload: any;
  try {
    payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Token inválido o expirado', 401);
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = await prisma.session.findUnique({ where: { refreshToken: tokenHash } });
  if (!session || session.expiresAt < new Date()) {
    throw new AppError('Sesión expirada', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, role: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') throw new AppError('Usuario inactivo', 401);

  // Rotar refresh token
  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role);
  const newHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshToken: newHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  setRefreshCookie(res, newRefreshToken);
  res.json({ accessToken });
});

/**
 * POST /api/v1/auth/forgot-password
 */
authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email }, select: { username: true } });

  // Siempre responder igual para no revelar si el email existe
  if (user) {
    const otp = generateOtp();
    await storeOtp(email, 'PASSWORD_RESET', otp);
    await sendOtpEmail({ to: email, otp, type: 'PASSWORD_RESET', username: user.username });
  }

  res.json({ message: 'Si el email existe, recibirás un código de recuperación' });
});

/**
 * POST /api/v1/auth/reset-password
 */
authRouter.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const valid = await verifyOtp(email, 'PASSWORD_RESET', otp);
  if (!valid) throw new AppError('OTP inválido o expirado', 400);

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { email }, data: { passwordHash } });

  // Invalidar todas las sesiones
  await prisma.session.deleteMany({
    where: { user: { email } },
  });

  logger.info({ email }, 'Password reset completed');
  res.json({ message: 'Contraseña actualizada correctamente' });
});

/**
 * POST /api/v1/auth/resend-otp
 */
authRouter.post('/resend-otp', async (req, res) => {
  const { email, type } = req.body;
  const user = await prisma.user.findUnique({
    where: { email },
    select: { username: true },
  });
  if (!user) throw new AppError('Email no registrado', 404);

  // Rate limit: máximo 1 OTP por minuto
  const cooldownKey = `otp:cooldown:${type}:${email}`;
  const onCooldown = await redis.get(cooldownKey);
  if (onCooldown) throw new AppError('Espera 1 minuto antes de solicitar otro código', 429);

  const otp = generateOtp();
  await storeOtp(email, type, otp);
  await sendOtpEmail({ to: email, otp, type, username: user.username });
  await redis.setex(cooldownKey, 60, '1');

  res.json({ message: 'Código reenviado' });
});

/**
 * POST /api/v1/auth/logout
 */
authRouter.post('/logout', authenticate, async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (token) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.session.deleteMany({ where: { refreshToken: hash } });
  }
  res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  res.json({ message: 'Sesión cerrada correctamente' });
});

/**
 * GET /api/v1/auth/me
 */
authRouter.get('/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: {
      id: true, email: true, username: true, displayName: true,
      avatarUrl: true, coverUrl: true, bio: true, role: true,
      emailVerified: true, twoFactorEnabled: true,
      createdAt: true,
      _count: {
        select: { followers: true, following: true, posts: true },
      },
    },
  });
  if (!user) throw new AppError('Usuario no encontrado', 404);
  res.json({ user });
});

/**
 * GET /api/v1/auth/sessions
 * Listar sesiones activas del usuario
 */
authRouter.get('/sessions', authenticate, async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.user!.id, expiresAt: { gt: new Date() } },
    select: { id: true, userAgent: true, ipAddress: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ sessions });
});

/**
 * DELETE /api/v1/auth/sessions/:id
 */
authRouter.delete('/sessions/:id', authenticate, async (req, res) => {
  await prisma.session.deleteMany({
    where: { id: req.params.id, userId: req.user!.id },
  });
  res.json({ message: 'Sesión eliminada' });
});
