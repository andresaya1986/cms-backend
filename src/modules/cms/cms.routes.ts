import { Router } from 'express';
import { z } from 'zod';
import slugify from 'slugify';
import multer from 'multer';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';
import { prisma } from '../../shared/config/databases';
import { authenticate, authorize } from '../../shared/middleware/authenticate';
import { validate } from '../../shared/middleware/validate';
import { AppError } from '../../shared/errors/AppError';
import { postsCreatedTotal } from '../../shared/config/metrics';
import { jobs } from '../../shared/config/workers';
import { env } from '../../shared/config/env';

export const cmsRouter = Router();

// ── S3 / MinIO Client ─────────────────────
const s3 = new S3Client({
  endpoint: `http${env.MINIO_USE_SSL ? 's' : ''}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`,
  region: 'us-east-1',
  credentials: { accessKeyId: env.MINIO_USER, secretAccessKey: env.MINIO_PASSWORD },
  forcePathStyle: true,
});

// ── Multer — upload de imágenes ──────────
const uploadPostImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(`Tipo de archivo no permitido: ${file.mimetype}`, 400) as any);
    }
  },
});

// ── Esquemas ──────────────────────────────
const createPostSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(200),
    content: z.string().min(1),
    excerpt: z.string().max(500).optional(),
    type: z.enum(['ARTICLE', 'NEWS', 'TUTORIAL', 'REVIEW', 'SHORT', 'GALLERY', 'VIDEO']).default('ARTICLE'),
    status: z.enum(['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'SCHEDULED']).default('DRAFT'),
    visibility: z.enum(['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE', 'UNLISTED']).default('PUBLIC'),
    featuredImage: z.string().url().optional(),
    categoryIds: z.array(z.string().uuid()).optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    metaTitle: z.string().max(70).optional(),
    metaDescription: z.string().max(160).optional(),
    metaKeywords: z.array(z.string()).optional(),
    scheduledAt: z.string().datetime().optional(),
  }),
});

const updatePostSchema = z.object({
  body: createPostSchema.shape.body.partial(),
  params: z.object({ id: z.string().uuid() }),
});

const listPostsSchema = z.object({
  query: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.enum(['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED']).optional(),
    type: z.enum(['ARTICLE', 'NEWS', 'TUTORIAL', 'REVIEW', 'SHORT', 'GALLERY', 'VIDEO']).optional(),
    authorId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    tagId: z.string().uuid().optional(),
    search: z.string().max(100).optional(),
    sort: z.enum(['latest', 'oldest', 'popular', 'trending']).default('latest'),
  }),
});

// ─────────────────────────────────────────
//  GET /api/v1/posts — Listar posts
// ─────────────────────────────────────────
cmsRouter.get('/', validate(listPostsSchema), async (req, res) => {
  const { page, limit, status, type, authorId, categoryId, tagId, search, sort } = req.query as any;
  const skip = (page - 1) * limit;

  const where: any = {
    deletedAt: null,
    ...(status ? { status } : { status: 'PUBLISHED', visibility: 'PUBLIC' }),
    ...(type && { type }),
    ...(authorId && { authorId }),
    ...(categoryId && { categories: { some: { categoryId } } }),
    ...(tagId && { tags: { some: { tagId } } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const sortMap = {
    latest: { createdAt: 'desc' },
    oldest: { createdAt: 'asc' },
    popular: { viewCount: 'desc' },
    trending: { reactionsCount: 'desc' },
  } as const;
  const orderBy = sortMap[sort as keyof typeof sortMap] || { createdAt: 'desc' };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true, title: true, slug: true, excerpt: true,
        featuredImage: true, status: true, type: true,
        viewCount: true, reactionsCount: true, commentsCount: true,
        publishedAt: true, createdAt: true,
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
        tags: { select: { tag: { select: { id: true, name: true, slug: true } } } },
        media: { include: { media: true }, orderBy: { order: 'asc' } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  res.json({
    data: posts,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
    },
  });
});

// ─────────────────────────────────────────
//  GET /api/v1/posts/:slug — Post por slug
// ─────────────────────────────────────────
cmsRouter.get('/:slug', async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { slug: req.params.slug, deletedAt: null },
    include: {
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true } },
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
      media: { include: { media: true }, orderBy: { order: 'asc' } },
    },
  });

  if (!post) throw new AppError('Post no encontrado', 404);
  if (post.status !== 'PUBLISHED' && post.visibility !== 'PUBLIC') {
    throw new AppError('Post no disponible', 403);
  }

  // Incrementar vistas de forma async (fire and forget)
  prisma.post.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  res.json({ data: post });
});

// ─────────────────────────────────────────
//  POST /api/v1/posts — Crear post
// ─────────────────────────────────────────
cmsRouter.post('/', authenticate, authorize('USER', 'AUTHOR', 'EDITOR', 'ADMIN', 'SUPER_ADMIN'), validate(createPostSchema), async (req, res) => {
  const { title, content, excerpt, type, status, visibility, featuredImage,
    categoryIds, tagIds, metaTitle, metaDescription, metaKeywords, scheduledAt } = req.body;

  // Generar slug único
  let slug = slugify(title, { lower: true, strict: true });
  const existing = await prisma.post.count({ where: { slug } });
  if (existing > 0) slug = `${slug}-${Date.now()}`;

  const post = await prisma.post.create({
    data: {
      authorId: req.user!.id,
      title, slug, content, excerpt, type, status, visibility,
      featuredImage, metaTitle, metaDescription,
      metaKeywords: metaKeywords || [],
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      categories: categoryIds?.length
        ? { create: categoryIds.map((id: string) => ({ categoryId: id })) }
        : undefined,
      tags: tagIds?.length
        ? { create: tagIds.map((id: string) => ({ tagId: id })) }
        : undefined,
    },
    include: {
      author: { select: { id: true, username: true, displayName: true } },
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
    },
  });

  postsCreatedTotal.inc({ type: post.type });

  // Indexar en Elasticsearch si está publicado
  if (status === 'PUBLISHED') {
    jobs.indexPost(post).catch((err) => console.error('Error indexing post:', err));
  }

  res.status(201).json({ data: post });
});

// ─────────────────────────────────────────
//  PATCH /api/v1/posts/:id — Actualizar
// ─────────────────────────────────────────
cmsRouter.patch('/:id', authenticate, validate(updatePostSchema), async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.params.id, deletedAt: null },
    select: { authorId: true },
  });
  if (!post) throw new AppError('Post no encontrado', 404);

  const isOwner = post.authorId === req.user!.id;
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'EDITOR'].includes(req.user!.role);
  if (!isOwner && !isAdmin) throw new AppError('No tienes permisos para editar este post', 403);

  const { categoryIds, tagIds, title, status, ...rest } = req.body;

  const updated = await prisma.post.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(title && { title, slug: slugify(title, { lower: true, strict: true }) }),
      ...(status === 'PUBLISHED' && { publishedAt: new Date() }),
      ...(categoryIds && {
        categories: {
          deleteMany: {},
          create: categoryIds.map((id: string) => ({ categoryId: id })),
        },
      }),
      ...(tagIds && {
        tags: {
          deleteMany: {},
          create: tagIds.map((id: string) => ({ tagId: id })),
        },
      }),
    },
    include: {
      author: { select: { id: true, username: true } },
      categories: { include: { category: true } },
      tags: { include: { tag: true } },
      media: { include: { media: true }, orderBy: { order: 'asc' } },
    },
  });

  // Reindexar si está publicado
  if (updated.status === 'PUBLISHED') {
    jobs.indexPost(updated).catch((err) => console.error('Error indexing post:', err));
  }

  res.json({ data: updated });
});

// ─────────────────────────────────────────
//  DELETE /api/v1/posts/:id — Soft delete
// ─────────────────────────────────────────
cmsRouter.delete('/:id', authenticate, async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.params.id, deletedAt: null },
    select: { authorId: true },
  });
  if (!post) throw new AppError('Post no encontrado', 404);

  const isOwner = post.authorId === req.user!.id;
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'EDITOR'].includes(req.user!.role);
  if (!isOwner && !isAdmin) throw new AppError('Sin permisos', 403);

  await prisma.post.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date(), status: 'DELETED' },
  });

  res.json({ message: 'Post eliminado' });
});

// ─────────────────────────────────────────
//  POST /api/v1/posts/:id/images — Subir imágenes
// ─────────────────────────────────────────
cmsRouter.post('/:id/images', authenticate, uploadPostImages.array('images', 10), async (req, res) => {
  // Verificar que el post existe y pertenece al usuario
  const post = await prisma.post.findUnique({
    where: { id: req.params.id, deletedAt: null },
    select: { authorId: true },
  });
  if (!post) throw new AppError('Post no encontrado', 404);

  const isOwner = post.authorId === req.user!.id;
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'EDITOR'].includes(req.user!.role);
  if (!isOwner && !isAdmin) throw new AppError('Sin permisos', 403);

  if (!req.files || req.files.length === 0) {
    throw new AppError('No se recibieron archivos', 400);
  }

  const uploadedMedia: any[] = [];
  const files = req.files as Express.Multer.File[];

  for (const file of files) {
    const { mimetype, buffer } = file;
    const isImage = mimetype.startsWith('image/');
    const fileId = uuid();
    const ext = file.originalname.split('.').pop() || 'bin';
    const key = `posts/${req.user!.id}/${fileId}.${ext}`;
    const thumbKey = isImage ? `posts/${req.user!.id}/${fileId}_thumb.webp` : null;

    let uploadBuffer = buffer;
    let width: number | undefined;
    let height: number | undefined;
    let thumbnailUrl: string | undefined;

    // Procesar imagen
    if (isImage) {
      const meta = await sharp(buffer).metadata();
      width = meta.width;
      height = meta.height;

      // Optimizar: convertir a webp
      if (mimetype !== 'image/gif') {
        uploadBuffer = await sharp(buffer)
          .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();
      }

      // Thumbnail
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

      thumbnailUrl = `http://${env.MINIO_PUBLIC_ENDPOINT}:${env.MINIO_PORT}/${env.S3_BUCKET_PUBLIC}/${thumbKey}`;
    }

    // Subir archivo
    await s3.send(new PutObjectCommand({
      Bucket: env.S3_BUCKET_PUBLIC,
      Key: key,
      Body: uploadBuffer,
      ContentType: mimetype,
      CacheControl: 'public, max-age=31536000',
    }));

    const url = `http://${env.MINIO_PUBLIC_ENDPOINT}:${env.MINIO_PORT}/${env.S3_BUCKET_PUBLIC}/${key}`;

    // Guardar en BD
    const media = await prisma.media.create({
      data: {
        uploaderId: req.user!.id,
        filename: `${fileId}.${ext}`,
        originalName: file.originalname,
        mimeType: mimetype,
        size: file.size,
        url,
        thumbnailUrl,
        bucket: env.S3_BUCKET_PUBLIC,
        key,
        width,
        height,
      },
    });

    // Asociar con post
    await prisma.mediaPost.create({
      data: {
        mediaId: media.id,
        postId: req.params.id,
        order: uploadedMedia.length,
      },
    });

    uploadedMedia.push(media);
  }

  res.status(201).json({ data: uploadedMedia });
});

// ─────────────────────────────────────────
//  GET /api/v1/posts/:id/images — Listar imágenes del post
// ─────────────────────────────────────────
cmsRouter.get('/:id/images', async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.params.id, deletedAt: null },
  });
  if (!post) throw new AppError('Post no encontrado', 404);

  const mediaPost = await prisma.mediaPost.findMany({
    where: { postId: req.params.id },
    include: { media: true },
    orderBy: { order: 'asc' },
  });

  res.json({ data: mediaPost.map(mp => mp.media) });
});

// ─────────────────────────────────────────
//  DELETE /api/v1/posts/:id/images/:mediaId — Remover imagen
// ─────────────────────────────────────────
cmsRouter.delete('/:id/images/:mediaId', authenticate, async (req, res) => {
  const post = await prisma.post.findUnique({
    where: { id: req.params.id, deletedAt: null },
    select: { authorId: true },
  });
  if (!post) throw new AppError('Post no encontrado', 404);

  const isOwner = post.authorId === req.user!.id;
  const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'EDITOR'].includes(req.user!.role);
  if (!isOwner && !isAdmin) throw new AppError('Sin permisos', 403);

  const mediaPost = await prisma.mediaPost.findUnique({
    where: { mediaId_postId: { mediaId: req.params.mediaId, postId: req.params.id } },
    include: { media: true },
  });
  if (!mediaPost) throw new AppError('Imagen no encontrada', 404);

  // Eliminar de MinIO
  if (mediaPost.media.key) {
    await s3.send(new DeleteObjectCommand({
      Bucket: env.S3_BUCKET_PUBLIC,
      Key: mediaPost.media.key,
    })).catch(() => {});

    // Eliminar thumbnail si existe
    if (mediaPost.media.key.includes('.')) {
      const thumbKey = mediaPost.media.key.replace(/\.[^.]+$/, '_thumb.webp');
      await s3.send(new DeleteObjectCommand({
        Bucket: env.S3_BUCKET_PUBLIC,
        Key: thumbKey,
      })).catch(() => {});
    }
  }

  // Eliminar referencias en BD
  await Promise.all([
    prisma.mediaPost.delete({
      where: { mediaId_postId: { mediaId: req.params.mediaId, postId: req.params.id } },
    }),
    prisma.media.delete({
      where: { id: req.params.mediaId },
    }),
  ]);

  res.json({ message: 'Imagen eliminada' });
});
