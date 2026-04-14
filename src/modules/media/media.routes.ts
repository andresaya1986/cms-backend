import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuid } from 'uuid';
import { prisma } from '../../shared/config/databases';
import { authenticate } from '../../shared/middleware/authenticate';
import { AppError } from '../../shared/errors/AppError';
import { env } from '../../shared/config/env';
import { rateLimiter } from '../../shared/middleware/rateLimiter';

export const mediaRouter = Router();

// ── S3 / MinIO Client ─────────────────────
const s3 = new S3Client({
  endpoint: `http${env.MINIO_USE_SSL ? 's' : ''}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`,
  region: 'us-east-1',
  credentials: { accessKeyId: env.MINIO_USER, secretAccessKey: env.MINIO_PASSWORD },
  forcePathStyle: true, // Requerido para MinIO
});

// ── Multer — memoria temporal ─────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
      'application/pdf',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(`Tipo de archivo no permitido: ${file.mimetype}`, 400) as any);
    }
  },
});

// ─────────────────────────────────────────
//  POST /api/v1/media/upload
// ─────────────────────────────────────────
mediaRouter.post(
  '/upload',
  authenticate,
  rateLimiter.upload,
  upload.single('file'),
  async (req, res) => {
    if (!req.file) throw new AppError('No se recibió ningún archivo', 400);

    const { originalname, mimetype, buffer, size } = req.file;
    const isImage = mimetype.startsWith('image/');
    const fileId = uuid();
    const ext = originalname.split('.').pop() || 'bin';
    const key = `uploads/${req.user!.id}/${fileId}.${ext}`;
    const thumbKey = isImage ? `uploads/${req.user!.id}/${fileId}_thumb.webp` : null;

    let uploadBuffer = buffer;
    let width: number | undefined;
    let height: number | undefined;
    let thumbnailUrl: string | undefined;

    // Procesar imagen con Sharp
    if (isImage) {
      const meta = await sharp(buffer).metadata();
      width = meta.width;
      height = meta.height;

      // Optimizar: convertir a webp si es jpg/png
      if (mimetype !== 'image/gif') {
        uploadBuffer = await sharp(buffer)
          .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
      }

      // Thumbnail 400px
      const thumbBuffer = await sharp(buffer)
        .resize(400, 400, { fit: 'cover' })
        .webp({ quality: 75 })
        .toBuffer();

      await s3.send(new PutObjectCommand({
        Bucket: env.S3_BUCKET_PUBLIC,
        Key: thumbKey!,
        Body: thumbBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000',
      }));

      thumbnailUrl = `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}/${env.S3_BUCKET_PUBLIC}/${thumbKey}`;
    }

    // Subir archivo principal
    await s3.send(new PutObjectCommand({
      Bucket: env.S3_BUCKET_PUBLIC,
      Key: key,
      Body: uploadBuffer,
      ContentType: mimetype,
      CacheControl: 'public, max-age=31536000',
      Metadata: {
        uploaderId: req.user!.id,
        originalName: encodeURIComponent(originalname),
      },
    }));

    const url = `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}/${env.S3_BUCKET_PUBLIC}/${key}`;

    // Guardar en base de datos
    const media = await prisma.media.create({
      data: {
        uploaderId: req.user!.id,
        filename: `${fileId}.${ext}`,
        originalName: originalname,
        mimeType: mimetype,
        size,
        url,
        thumbnailUrl,
        bucket: env.S3_BUCKET_PUBLIC,
        key,
        width,
        height,
      },
    });

    res.status(201).json({ data: media });
  },
);

// ─────────────────────────────────────────
//  GET /api/v1/media — Mis archivos
// ─────────────────────────────────────────
mediaRouter.get('/', authenticate, async (req, res) => {
  const { page = 1, limit = 20 } = req.query as any;
  const media = await prisma.media.findMany({
    where: { uploaderId: req.user!.id },
    skip: (page - 1) * limit,
    take: Number(limit),
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: media });
});

// ─────────────────────────────────────────
//  DELETE /api/v1/media/:id
// ─────────────────────────────────────────
mediaRouter.delete('/:id', authenticate, async (req, res) => {
  const media = await prisma.media.findUnique({ where: { id: req.params.id } });
  if (!media) throw new AppError('Archivo no encontrado', 404);
  if (media.uploaderId !== req.user!.id) throw new AppError('Sin permisos', 403);

  // Eliminar de MinIO
  await s3.send(new DeleteObjectCommand({ Bucket: media.bucket, Key: media.key })).catch(() => {});

  await prisma.media.delete({ where: { id: req.params.id } });
  res.json({ message: 'Archivo eliminado' });
});

// ─────────────────────────────────────────
//  POST /api/v1/media/presign — URL firmada
// ─────────────────────────────────────────
mediaRouter.post('/presign', authenticate, async (req, res) => {
  const { filename, contentType } = req.body;
  if (!filename || !contentType) throw new AppError('filename y contentType son requeridos', 400);

  const key = `uploads/${req.user!.id}/${uuid()}-${filename}`;
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_PUBLIC,
    Key: key,
    ContentType: contentType,
  });

  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
  res.json({ uploadUrl: signedUrl, key });
});
