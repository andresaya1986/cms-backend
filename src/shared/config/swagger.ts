import type { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from './env';

// ── Shared schema refs ────────────────────
const $ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const openApiDefinition = {
  openapi: '3.0.3',
  info: {
    title: `${env.APP_NAME} API`,
    version: '1.0.0',
    description:
      'Documentación OpenAPI completa del backend CMS.\n\n' +
      '**Flujo de autenticación:**\n' +
      '1. `POST /auth/register` → recibe OTP por email\n' +
      '2. `POST /auth/verify-email` → activa la cuenta\n' +
      '3. `POST /auth/login` → si 2FA activo, recibe otro OTP\n' +
      '4. `POST /auth/verify-2fa` → devuelve `accessToken` + `refreshToken`\n' +
      '5. Usa el `accessToken` en el header `Authorization: Bearer <token>`',
  },
  servers: [{ url: env.APP_URL, description: 'API base URL' }],
  tags: [
    { name: 'Health', description: 'Estado del servicio' },
    { name: 'Auth', description: 'Registro, login, OTP y sesiones' },
    { name: 'Posts', description: 'Gestión de contenido CMS' },
    { name: 'Social', description: 'Follows, likes y feed' },
    { name: 'Analytics', description: 'Eventos y métricas' },
    { name: 'Notifications', description: 'Notificaciones del usuario' },
    { name: 'Media', description: 'Subida y gestión de archivos' },
    { name: 'Search', description: 'Búsqueda full-text con Elasticsearch' },
    { name: 'Comments', description: 'Comentarios y respuestas en posts' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Pega el `accessToken` obtenido en login o verify-2fa',
      },
    },
    schemas: {
      // ── Genéricos ──────────────────────
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'Datos de entrada inválidos' },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page:       { type: 'integer', example: 1 },
          limit:      { type: 'integer', example: 20 },
          total:      { type: 'integer', example: 100 },
          totalPages: { type: 'integer', example: 5 },
        },
      },
      AuthorPublic: {
        type: 'object',
        properties: {
          id:          { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
          username:    { type: 'string', example: 'johndoe' },
          displayName: { type: 'string', example: 'John Doe' },
          avatarUrl:   { type: 'string', format: 'uri', example: 'https://cdn.example.com/avatars/johndoe.webp' },
        },
      },
      // ── Auth ───────────────────────────
      RegisterBody: {
        type: 'object',
        required: ['email', 'username', 'password'],
        properties: {
          email:       { type: 'string', format: 'email',    example: 'john@example.com' },
          username:    { type: 'string', minLength: 3, maxLength: 30, example: 'johndoe' },
          password:    { type: 'string', minLength: 8, example: 'Secret123!' },
          displayName: { type: 'string', maxLength: 50,      example: 'John Doe' },
        },
      },
      LoginBody: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email', example: 'john@example.com' },
          password: { type: 'string',                  example: 'Secret123!' },
        },
      },
      VerifyOtpBody: {
        type: 'object',
        required: ['email', 'otp', 'type'],
        properties: {
          email: { type: 'string', format: 'email', example: 'john@example.com' },
          otp:   { type: 'string', minLength: 6, maxLength: 6, example: '482910' },
          type:  {
            type: 'string',
            enum: ['EMAIL_VERIFICATION', 'TWO_FACTOR', 'PASSWORD_RESET'],
            example: 'EMAIL_VERIFICATION',
          },
        },
      },
      ResetPasswordBody: {
        type: 'object',
        required: ['email', 'otp', 'newPassword'],
        properties: {
          email:       { type: 'string', format: 'email', example: 'john@example.com' },
          otp:         { type: 'string', minLength: 6, maxLength: 6, example: '291048' },
          newPassword: { type: 'string', minLength: 8, example: 'NewSecret456@' },
        },
      },
      TokenResponse: {
        type: 'object',
        properties: {
          accessToken:  { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: {
            type: 'object',
            properties: {
              id:          { type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
              email:       { type: 'string', format: 'email', example: 'john@example.com' },
              username:    { type: 'string', example: 'johndoe' },
              displayName: { type: 'string', example: 'John Doe' },
              role:        { type: 'string', example: 'USER' },
              createdAt:   { type: 'string', format: 'date-time', example: '2026-03-01T10:00:00.000Z' },
            },
          },
        },
      },
      // ── Posts ──────────────────────────
      PostBody: {
        type: 'object',
        required: ['title', 'content'],
        properties: {
          title:           { type: 'string', minLength: 3, maxLength: 200, example: 'Guía completa de NestJS en 2026' },
          content:         { type: 'string', example: '## Introducción\nEste tutorial cubre...' },
          excerpt:         { type: 'string', maxLength: 500, example: 'Aprende NestJS desde cero con ejemplos reales.' },
          type:            { type: 'string', enum: ['ARTICLE', 'NEWS', 'TUTORIAL', 'REVIEW', 'SHORT', 'GALLERY', 'VIDEO'], example: 'TUTORIAL' },
          status:          { type: 'string', enum: ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'SCHEDULED'], example: 'DRAFT' },
          visibility:      { type: 'string', enum: ['PUBLIC', 'FOLLOWERS_ONLY', 'PRIVATE', 'UNLISTED'], example: 'PUBLIC' },
          featuredImage:   { type: 'string', format: 'uri', example: 'https://cdn.example.com/images/nestjs-banner.webp' },
          categoryIds:     { type: 'array', items: { type: 'string', format: 'uuid' }, example: ['f1e2d3c4-b5a6-7890-fedc-ba9876543210'] },
          tagIds:          { type: 'array', items: { type: 'string', format: 'uuid' }, example: ['c3d4e5f6-a7b8-9012-cdef-012345678901'] },
          metaTitle:       { type: 'string', maxLength: 70, example: 'Guía NestJS 2026 | Mi Blog' },
          metaDescription: { type: 'string', maxLength: 160, example: 'Tutorial paso a paso de NestJS con TypeScript.' },
          metaKeywords:    { type: 'array', items: { type: 'string' }, example: ['nestjs', 'typescript', 'backend'] },
          scheduledAt:     { type: 'string', format: 'date-time', example: '2026-05-01T09:00:00.000Z' },
        },
      },
      PostSummary: {
        type: 'object',
        properties: {
          id:            { type: 'string', format: 'uuid', example: 'b2c3d4e5-f6a7-8901-bcde-f01234567890' },
          title:         { type: 'string', example: 'Guía completa de NestJS en 2026' },
          slug:          { type: 'string', example: 'guia-completa-de-nestjs-en-2026' },
          excerpt:       { type: 'string', example: 'Aprende NestJS desde cero con ejemplos reales.' },
          featuredImage: { type: 'string', format: 'uri', example: 'https://cdn.example.com/images/nestjs-banner.webp' },
          status:        { type: 'string', example: 'PUBLISHED' },
          type:          { type: 'string', example: 'TUTORIAL' },
          viewCount:     { type: 'integer', example: 1240 },
          likesCount:    { type: 'integer', example: 87 },
          commentsCount: { type: 'integer', example: 23 },
          publishedAt:   { type: 'string', format: 'date-time', example: '2026-04-10T14:00:00.000Z' },
          author:        $ref('AuthorPublic'),
        },
      },
      // ── Comments ───────────────────────
      CommentBody: {
        type: 'object',
        required: ['postId', 'content'],
        properties: {
          postId:   { type: 'string', format: 'uuid', example: 'b2c3d4e5-f6a7-8901-bcde-f01234567890' },
          content:  { type: 'string', minLength: 1, maxLength: 2000, example: '¡Excelente artículo! Me ayudó mucho.' },
          parentId: { type: 'string', format: 'uuid', example: 'c3d4e5f6-a7b8-9012-cdef-012345678901', description: 'UUID del comentario padre si es una respuesta' },
        },
      },
      // ── Analytics ──────────────────────
      TrackEventBody: {
        type: 'object',
        required: ['name'],
        properties: {
          sessionId:  { type: 'string', example: 'sess_x7k2m9p1q4r6' },
          name:       { type: 'string', example: 'post_view' },
          category:   { type: 'string', enum: ['pageview', 'engagement', 'conversion', 'social', 'error', 'custom'], example: 'engagement' },
          properties: { type: 'object', example: { postId: 'b2c3d4e5-f6a7-8901-bcde-f01234567890', readTime: 240 } },
          url:        { type: 'string', format: 'uri', example: 'https://example.com/posts/guia-nestjs-2026' },
          referrer:   { type: 'string', format: 'uri', example: 'https://google.com' },
          duration:   { type: 'integer', description: 'Tiempo en página (ms)', example: 35000 },
        },
      },
      // ── Media ──────────────────────────
      PresignBody: {
        type: 'object',
        required: ['filename', 'mimeType'],
        properties: {
          filename: { type: 'string', example: 'banner-post.jpg' },
          mimeType: { type: 'string', example: 'image/jpeg' },
        },
      },
    },
  },
  paths: {
    // ────────────────────────────────────────────────
    //  HEALTH
    // ────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Estado del servicio',
        description: 'Devuelve 200 si la API está operativa.',
        responses: {
          '200': {
            description: 'Servicio activo',
            content: {
              'application/json': {
                example: { status: 'ok', uptime: 86400, timestamp: '2026-04-15T20:00:00.000Z' },
              },
            },
          },
        },
      },
    },

    // ────────────────────────────────────────────────
    //  AUTH
    // ────────────────────────────────────────────────
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registrar usuario',
        description: 'Crea la cuenta y envía un OTP de verificación al email.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: $ref('RegisterBody'),
              example: {
                email: 'john@example.com',
                username: 'johndoe',
                password: 'Secret123!',
                displayName: 'John Doe',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Usuario creado — revisa el email para el OTP',
            content: {
              'application/json': {
                example: { message: 'Registro exitoso. Verifica tu email.', userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' },
              },
            },
          },
          '400': { description: 'Datos inválidos', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
          '409': { description: 'Email o username ya en uso', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/auth/verify-email': {
      post: {
        tags: ['Auth'],
        summary: 'Verificar email con OTP',
        description: 'Activa la cuenta usando el código de 6 dígitos recibido por email.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: $ref('VerifyOtpBody'),
              example: { email: 'john@example.com', otp: '482910', type: 'EMAIL_VERIFICATION' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Email verificado',
            content: { 'application/json': { example: { message: 'Email verificado correctamente' } } },
          },
          '400': { description: 'OTP inválido o expirado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión',
        description: 'Si el usuario tiene 2FA activo, devuelve `requiresTwoFactor: true` y se debe llamar a `/verify-2fa`. De lo contrario devuelve los tokens directamente.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: $ref('LoginBody'),
              example: { email: 'john@example.com', password: 'Secret123!' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Autenticado (tokens) o requiere 2FA',
            content: {
              'application/json': {
                examples: {
                  sin_2fa: {
                    summary: 'Login sin 2FA',
                    value: {
                      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                      user: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', email: 'john@example.com', username: 'johndoe', role: 'USER', createdAt: '2026-03-01T10:00:00.000Z' },
                    },
                  },
                  con_2fa: {
                    summary: 'Login con 2FA activado',
                    value: { requiresTwoFactor: true, message: 'Se envió un OTP a tu email' },
                  },
                },
              },
            },
          },
          '401': { description: 'Credenciales incorrectas', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/auth/verify-2fa': {
      post: {
        tags: ['Auth'],
        summary: 'Verificar OTP de 2FA',
        description: 'Completa el segundo factor de autenticación y devuelve los tokens.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: $ref('VerifyOtpBody'),
              example: { email: 'john@example.com', otp: '715203', type: 'TWO_FACTOR' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Tokens emitidos',
            content: { 'application/json': { schema: $ref('TokenResponse') } },
          },
          '400': { description: 'OTP inválido o expirado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refrescar access token',
        description: 'Usa el `refreshToken` para obtener un nuevo `accessToken`. El token puede enviarse en el body o en la cookie `refreshToken`.',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              example: { refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Token renovado',
            content: {
              'application/json': {
                example: { accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...nuevo' },
              },
            },
          },
          '401': { description: 'Token inválido o expirado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Solicitar recuperación de contraseña',
        description: 'Envía un OTP al email registrado para resetear la contraseña.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: { email: 'john@example.com' },
            },
          },
        },
        responses: {
          '200': {
            description: 'OTP enviado al email',
            content: { 'application/json': { example: { message: 'Si el email existe, recibirás un OTP.' } } },
          },
        },
      },
    },

    '/api/v1/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Resetear contraseña',
        description: 'Cambia la contraseña usando el OTP recibido por email.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: $ref('ResetPasswordBody'),
              example: { email: 'john@example.com', otp: '291048', newPassword: 'NewSecret456@' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Contraseña actualizada',
            content: { 'application/json': { example: { message: 'Contraseña actualizada correctamente' } } },
          },
          '400': { description: 'OTP inválido o expirado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/auth/resend-otp': {
      post: {
        tags: ['Auth'],
        summary: 'Reenviar OTP',
        description: 'Reenvía el código OTP al email para el tipo solicitado.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: { email: 'john@example.com', type: 'EMAIL_VERIFICATION' },
            },
          },
        },
        responses: {
          '200': { description: 'OTP reenviado', content: { 'application/json': { example: { message: 'OTP reenviado' } } } },
          '429': { description: 'Demasiadas solicitudes', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cerrar sesión',
        description: 'Invalida el refresh token actual y cierra la sesión.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Sesión cerrada', content: { 'application/json': { example: { message: 'Sesión cerrada correctamente' } } } },
          '401': { description: 'No autenticado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Perfil del usuario autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Datos del usuario',
            content: {
              'application/json': {
                example: {
                  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  email: 'john@example.com',
                  username: 'johndoe',
                  displayName: 'John Doe',
                  role: 'USER',
                  emailVerified: true,
                  twoFactorEnabled: false,
                  createdAt: '2026-03-01T10:00:00.000Z',
                },
              },
            },
          },
          '401': { description: 'No autenticado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/auth/sessions': {
      get: {
        tags: ['Auth'],
        summary: 'Listar sesiones activas',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Lista de sesiones',
            content: {
              'application/json': {
                example: {
                  data: [
                    { id: 'sess_abc123', ip: '192.168.1.10', userAgent: 'Mozilla/5.0...', createdAt: '2026-04-15T08:00:00.000Z', current: true },
                  ],
                },
              },
            },
          },
        },
      },
    },

    // ────────────────────────────────────────────────
    //  POSTS (CMS)
    // ────────────────────────────────────────────────
    '/api/v1/posts': {
      get: {
        tags: ['Posts'],
        summary: 'Listar posts',
        description: 'Retorna posts paginados. Sin autenticación solo muestra publicados y públicos.',
        parameters: [
          { in: 'query', name: 'page',       schema: { type: 'integer', default: 1 },   example: 1,            description: 'Número de página' },
          { in: 'query', name: 'limit',      schema: { type: 'integer', default: 20 },  example: 20,           description: 'Resultados por página (máx 100)' },
          { in: 'query', name: 'status',     schema: { type: 'string', enum: ['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED'] }, description: 'Filtrar por estado' },
          { in: 'query', name: 'type',       schema: { type: 'string', enum: ['ARTICLE', 'NEWS', 'TUTORIAL', 'REVIEW', 'SHORT', 'GALLERY', 'VIDEO'] }, description: 'Tipo de contenido' },
          { in: 'query', name: 'authorId',   schema: { type: 'string', format: 'uuid' }, example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'Filtrar por autor' },
          { in: 'query', name: 'categoryId', schema: { type: 'string', format: 'uuid' }, description: 'Filtrar por categoría' },
          { in: 'query', name: 'tagId',      schema: { type: 'string', format: 'uuid' }, description: 'Filtrar por tag' },
          { in: 'query', name: 'search',     schema: { type: 'string' }, example: 'nestjs tutorial', description: 'Búsqueda en título y excerpt' },
          { in: 'query', name: 'sort',       schema: { type: 'string', enum: ['latest', 'oldest', 'popular', 'trending'], default: 'latest' }, description: 'Ordenamiento' },
        ],
        responses: {
          '200': {
            description: 'Listado paginado',
            content: {
              'application/json': {
                example: {
                  data: [
                    {
                      id: 'b2c3d4e5-f6a7-8901-bcde-f01234567890',
                      title: 'Guía completa de NestJS en 2026',
                      slug: 'guia-completa-de-nestjs-en-2026',
                      excerpt: 'Aprende NestJS desde cero con ejemplos reales.',
                      status: 'PUBLISHED', type: 'TUTORIAL',
                      viewCount: 1240, likesCount: 87, commentsCount: 23,
                      publishedAt: '2026-04-10T14:00:00.000Z',
                      author: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', username: 'johndoe', displayName: 'John Doe', avatarUrl: null },
                    },
                  ],
                  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Posts'],
        summary: 'Crear post',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: $ref('PostBody'),
              example: {
                title: 'Guía completa de NestJS en 2026',
                content: '## Introducción\nEste tutorial cubre NestJS desde cero...',
                excerpt: 'Aprende NestJS desde cero con ejemplos reales.',
                type: 'TUTORIAL',
                status: 'DRAFT',
                visibility: 'PUBLIC',
                metaTitle: 'Guía NestJS 2026 | Mi Blog',
                metaDescription: 'Tutorial paso a paso de NestJS con TypeScript.',
                metaKeywords: ['nestjs', 'typescript', 'backend'],
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Post creado',
            content: { 'application/json': { schema: $ref('PostSummary') } },
          },
          '400': { description: 'Datos inválidos', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
          '401': { description: 'No autenticado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/posts/{slug}': {
      get: {
        tags: ['Posts'],
        summary: 'Obtener post por slug',
        parameters: [
          { in: 'path', name: 'slug', required: true, schema: { type: 'string' }, example: 'guia-completa-de-nestjs-en-2026', description: 'Slug único del post' },
        ],
        responses: {
          '200': { description: 'Detalle del post', content: { 'application/json': { schema: $ref('PostSummary') } } },
          '404': { description: 'Post no encontrado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/posts/{id}': {
      patch: {
        tags: ['Posts'],
        summary: 'Actualizar post',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, example: 'b2c3d4e5-f6a7-8901-bcde-f01234567890' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                title: 'Guía actualizada de NestJS en 2026',
                status: 'PUBLISHED',
              },
            },
          },
        },
        responses: {
          '200': { description: 'Post actualizado', content: { 'application/json': { schema: $ref('PostSummary') } } },
          '403': { description: 'Sin permisos', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
          '404': { description: 'Post no encontrado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
      delete: {
        tags: ['Posts'],
        summary: 'Eliminar post (soft delete)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, example: 'b2c3d4e5-f6a7-8901-bcde-f01234567890' },
        ],
        responses: {
          '200': { description: 'Post eliminado', content: { 'application/json': { example: { message: 'Post eliminado' } } } },
          '403': { description: 'Sin permisos', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
          '404': { description: 'Post no encontrado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    // ────────────────────────────────────────────────
    //  SOCIAL
    // ────────────────────────────────────────────────
    '/api/v1/social/follow/{userId}': {
      post: {
        tags: ['Social'],
        summary: 'Seguir / dejar de seguir usuario',
        description: 'Toggle: si ya sigue, deja de seguir; si no sigue, sigue.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'userId', required: true, schema: { type: 'string', format: 'uuid' }, example: 'c3d4e5f6-a7b8-9012-cdef-012345678901', description: 'UUID del usuario a seguir' },
        ],
        responses: {
          '200': {
            description: 'Estado de follow actualizado',
            content: {
              'application/json': {
                examples: {
                  siguiendo: { summary: 'Ahora sigue', value: { following: true,  message: 'Ahora sigues a @janedoe' } },
                  dejando:   { summary: 'Dejó de seguir', value: { following: false, message: 'Dejaste de seguir a @janedoe' } },
                },
              },
            },
          },
          '400': { description: 'No puedes seguirte a ti mismo', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
          '404': { description: 'Usuario no encontrado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/social/like': {
      post: {
        tags: ['Social'],
        summary: 'Like / unlike en post o comentario',
        description: 'Toggle: si ya tiene like lo retira, si no lo agrega.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: { targetId: 'b2c3d4e5-f6a7-8901-bcde-f01234567890', targetType: 'post' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Estado de like actualizado',
            content: {
              'application/json': {
                examples: {
                  liked:   { summary: 'Like registrado',  value: { liked: true } },
                  unliked: { summary: 'Like retirado',    value: { liked: false } },
                },
              },
            },
          },
        },
      },
    },

    '/api/v1/social/feed': {
      get: {
        tags: ['Social'],
        summary: 'Feed personalizado',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 },  example: 1 },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 }, example: 20 },
          { in: 'query', name: 'type',  schema: { type: 'string', enum: ['following', 'discover', 'trending'], default: 'following' }, example: 'following', description: 'Tipo de feed' },
        ],
        responses: {
          '200': {
            description: 'Posts del feed',
            content: { 'application/json': { example: { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } } },
          },
        },
      },
    },

    '/api/v1/social/users/{username}': {
      get: {
        tags: ['Social'],
        summary: 'Perfil público de usuario',
        parameters: [
          { in: 'path', name: 'username', required: true, schema: { type: 'string' }, example: 'johndoe' },
        ],
        responses: {
          '200': {
            description: 'Perfil público',
            content: {
              'application/json': {
                example: {
                  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  username: 'johndoe',
                  displayName: 'John Doe',
                  bio: 'Developer & writer',
                  avatarUrl: 'https://cdn.example.com/avatars/johndoe.webp',
                  followersCount: 320,
                  followingCount: 87,
                  postsCount: 14,
                },
              },
            },
          },
          '404': { description: 'Usuario no encontrado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/social/users/{username}/followers': {
      get: {
        tags: ['Social'],
        summary: 'Seguidores de un usuario',
        parameters: [
          { in: 'path', name: 'username', required: true, schema: { type: 'string' }, example: 'johndoe' },
          { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 },  example: 1 },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 }, example: 20 },
        ],
        responses: {
          '200': {
            description: 'Lista de seguidores',
            content: { 'application/json': { example: { data: [{ id: 'c3d4e5f6-a7b8-9012-cdef-012345678901', username: 'janedoe', displayName: 'Jane Doe', avatarUrl: null }], pagination: { page: 1, limit: 20, total: 320, totalPages: 16 } } } },
          },
        },
      },
    },

    // ────────────────────────────────────────────────
    //  ANALYTICS
    // ────────────────────────────────────────────────
    '/api/v1/analytics/track': {
      post: {
        tags: ['Analytics'],
        summary: 'Registrar evento',
        description: 'Registra un evento de analítica desde el cliente (no requiere autenticación).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: $ref('TrackEventBody'),
              example: {
                sessionId: 'sess_x7k2m9p1q4r6',
                name: 'post_view',
                category: 'engagement',
                properties: { postId: 'b2c3d4e5-f6a7-8901-bcde-f01234567890', readTime: 240 },
                url: 'https://example.com/posts/guia-nestjs-2026',
                referrer: 'https://google.com',
                duration: 35000,
              },
            },
          },
        },
        responses: {
          '202': { description: 'Evento aceptado', content: { 'application/json': { example: { ok: true } } } },
          '400': { description: 'Falta el campo name', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/analytics/batch': {
      post: {
        tags: ['Analytics'],
        summary: 'Registrar batch de eventos',
        description: 'Envía varios eventos en una sola llamada.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                events: [
                  { sessionId: 'sess_x7k2m9p1q4r6', name: 'page_view', category: 'pageview', url: 'https://example.com/' },
                  { sessionId: 'sess_x7k2m9p1q4r6', name: 'click_cta', category: 'engagement', properties: { button: 'signup' } },
                ],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Eventos registrados', content: { 'application/json': { example: { inserted: 2 } } } },
        },
      },
    },

    '/api/v1/analytics/dashboard': {
      get: {
        tags: ['Analytics'],
        summary: 'Dashboard de métricas',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'from', schema: { type: 'string', format: 'date' }, example: '2026-04-01', description: 'Fecha inicio (YYYY-MM-DD)' },
          { in: 'query', name: 'to',   schema: { type: 'string', format: 'date' }, example: '2026-04-15', description: 'Fecha fin (YYYY-MM-DD)' },
        ],
        responses: {
          '200': {
            description: 'Datos del dashboard',
            content: {
              'application/json': {
                example: {
                  totalEvents: 15240,
                  uniqueSessions: 3800,
                  topPages: [{ url: '/posts/guia-nestjs-2026', views: 1240 }],
                  eventsByCategory: { pageview: 8000, engagement: 5200, conversion: 2040 },
                },
              },
            },
          },
        },
      },
    },

    '/api/v1/analytics/posts/{postId}': {
      get: {
        tags: ['Analytics'],
        summary: 'Métricas de un post específico',
        parameters: [
          { in: 'path', name: 'postId', required: true, schema: { type: 'string', format: 'uuid' }, example: 'b2c3d4e5-f6a7-8901-bcde-f01234567890' },
        ],
        responses: {
          '200': {
            description: 'Métricas del post',
            content: {
              'application/json': {
                example: {
                  postId: 'b2c3d4e5-f6a7-8901-bcde-f01234567890',
                  totalViews: 1240,
                  uniqueVisitors: 980,
                  avgReadTime: 245,
                  viewsByDay: [{ date: '2026-04-14', views: 120 }, { date: '2026-04-15', views: 98 }],
                },
              },
            },
          },
        },
      },
    },

    // ────────────────────────────────────────────────
    //  NOTIFICATIONS
    // ────────────────────────────────────────────────
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Listar notificaciones',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page',   schema: { type: 'integer', default: 1 },  example: 1 },
          { in: 'query', name: 'limit',  schema: { type: 'integer', default: 20 }, example: 20 },
          { in: 'query', name: 'unread', schema: { type: 'string', enum: ['true', 'false'] }, example: 'true', description: 'Si "true", devuelve solo las no leídas' },
        ],
        responses: {
          '200': {
            description: 'Lista de notificaciones',
            content: {
              'application/json': {
                example: {
                  data: [
                    {
                      id: 'd4e5f6a7-b8c9-0123-defa-bc1234567890',
                      type: 'NEW_FOLLOWER',
                      title: 'Nuevo seguidor',
                      body: '@janedoe te sigue ahora',
                      read: false,
                      createdAt: '2026-04-15T18:30:00.000Z',
                    },
                  ],
                  unreadCount: 5,
                },
              },
            },
          },
        },
      },
    },

    '/api/v1/notifications/read-all': {
      patch: {
        tags: ['Notifications'],
        summary: 'Marcar todas las notificaciones como leídas',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Notificaciones actualizadas', content: { 'application/json': { example: { message: 'Notificaciones marcadas como leídas' } } } },
        },
      },
    },

    '/api/v1/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Marcar una notificación como leída',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, example: 'd4e5f6a7-b8c9-0123-defa-bc1234567890' },
        ],
        responses: {
          '200': { description: 'Notificación leída', content: { 'application/json': { example: { message: 'Notificación leída' } } } },
          '404': { description: 'No encontrada', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    // ────────────────────────────────────────────────
    //  MEDIA
    // ────────────────────────────────────────────────
    '/api/v1/media/upload': {
      post: {
        tags: ['Media'],
        summary: 'Subir archivo (multipart)',
        description: 'Sube imágenes (JPEG, PNG, WebP, GIF), videos (MP4, WebM) o PDFs. Máximo 50 MB. Las imágenes se optimizan con Sharp y se genera un thumbnail.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'Archivo a subir' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Archivo subido',
            content: {
              'application/json': {
                example: {
                  id: 'e5f6a7b8-c9d0-1234-efab-cd1234567890',
                  url: 'https://cdn.example.com/uploads/a1b2c3d4/uuid123.webp',
                  thumbnailUrl: 'https://cdn.example.com/uploads/a1b2c3d4/uuid123_thumb.webp',
                  mimeType: 'image/webp',
                  size: 48320,
                  width: 1200,
                  height: 630,
                },
              },
            },
          },
          '400': { description: 'Tipo de archivo no permitido o sin archivo', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
          '413': { description: 'Archivo demasiado grande (máx 50 MB)', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/media/presign': {
      post: {
        tags: ['Media'],
        summary: 'Generar URL pre-firmada para upload directo',
        description: 'Devuelve una URL S3 pre-firmada para subir el archivo directamente desde el cliente sin pasar por el servidor.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: $ref('PresignBody'),
              example: { filename: 'banner-post.jpg', mimeType: 'image/jpeg' },
            },
          },
        },
        responses: {
          '200': {
            description: 'URL pre-firmada generada',
            content: {
              'application/json': {
                example: {
                  uploadUrl: 'https://minio.example.com/cms-public/uploads/a1b2c3d4/uuid123.jpg?X-Amz-Signature=...',
                  key: 'uploads/a1b2c3d4/uuid123.jpg',
                  expiresIn: 300,
                },
              },
            },
          },
        },
      },
    },

    '/api/v1/media': {
      get: {
        tags: ['Media'],
        summary: 'Listar archivos del usuario',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 },  example: 1 },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 }, example: 20 },
        ],
        responses: {
          '200': {
            description: 'Lista de archivos',
            content: {
              'application/json': {
                example: {
                  data: [
                    { id: 'e5f6a7b8-c9d0-1234-efab-cd1234567890', url: 'https://cdn.example.com/uploads/a1b2c3d4/uuid123.webp', mimeType: 'image/webp', size: 48320, createdAt: '2026-04-15T12:00:00.000Z' },
                  ],
                  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
                },
              },
            },
          },
        },
      },
    },

    '/api/v1/media/{id}': {
      delete: {
        tags: ['Media'],
        summary: 'Eliminar archivo',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, example: 'e5f6a7b8-c9d0-1234-efab-cd1234567890' },
        ],
        responses: {
          '200': { description: 'Archivo eliminado', content: { 'application/json': { example: { message: 'Archivo eliminado' } } } },
          '403': { description: 'Sin permisos', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
          '404': { description: 'Archivo no encontrado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    // ────────────────────────────────────────────────
    //  SEARCH
    // ────────────────────────────────────────────────
    '/api/v1/search': {
      get: {
        tags: ['Search'],
        summary: 'Búsqueda full-text global',
        description: 'Busca en posts y usuarios usando Elasticsearch con fuzzy matching.',
        parameters: [
          { in: 'query', name: 'q',     required: true,  schema: { type: 'string', minLength: 1, maxLength: 200 }, example: 'nestjs tutorial', description: 'Término de búsqueda' },
          { in: 'query', name: 'type',  schema: { type: 'string', enum: ['posts', 'users', 'all'], default: 'all' }, example: 'all', description: 'Tipo de contenido a buscar' },
          { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 },  example: 1 },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 20 }, example: 20 },
        ],
        responses: {
          '200': {
            description: 'Resultados de búsqueda',
            content: {
              'application/json': {
                example: {
                  query: 'nestjs tutorial',
                  total: 3,
                  results: [
                    {
                      _index: 'cms_posts',
                      _id: 'b2c3d4e5-f6a7-8901-bcde-f01234567890',
                      _score: 4.8,
                      _source: { title: 'Guía completa de NestJS en 2026', slug: 'guia-completa-de-nestjs-en-2026', type: 'TUTORIAL' },
                      highlight: { title: ['Guía completa de <em>NestJS</em> en 2026'] },
                    },
                  ],
                },
              },
            },
          },
          '400': { description: 'Parámetro q requerido', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    // ────────────────────────────────────────────────
    //  COMMENTS
    // ────────────────────────────────────────────────
    '/api/v1/comments': {
      get: {
        tags: ['Comments'],
        summary: 'Listar comentarios de un post',
        description: 'Devuelve comentarios raíz con sus respuestas anidadas.',
        parameters: [
          { in: 'query', name: 'postId', required: true, schema: { type: 'string', format: 'uuid' }, example: 'b2c3d4e5-f6a7-8901-bcde-f01234567890', description: 'UUID del post' },
          { in: 'query', name: 'page',  schema: { type: 'integer', default: 1 },  example: 1 },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 50 }, example: 50 },
        ],
        responses: {
          '200': {
            description: 'Comentarios del post',
            content: {
              'application/json': {
                example: {
                  data: [
                    {
                      id: 'f6a7b8c9-d0e1-2345-fabc-de1234567890',
                      content: '¡Excelente artículo!',
                      likesCount: 12,
                      createdAt: '2026-04-12T10:30:00.000Z',
                      author: { id: 'c3d4e5f6-a7b8-9012-cdef-012345678901', username: 'janedoe', displayName: 'Jane Doe', avatarUrl: null },
                      replies: [],
                    },
                  ],
                },
              },
            },
          },
          '400': { description: 'postId requerido', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
      post: {
        tags: ['Comments'],
        summary: 'Crear comentario o respuesta',
        description: 'Crea un comentario en un post. Si se envía `parentId` se trata como respuesta a otro comentario.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: $ref('CommentBody'),
              examples: {
                comentario_raiz: {
                  summary: 'Comentario nuevo',
                  value: { postId: 'b2c3d4e5-f6a7-8901-bcde-f01234567890', content: '¡Excelente artículo! Me ayudó mucho.' },
                },
                respuesta: {
                  summary: 'Respuesta a otro comentario',
                  value: { postId: 'b2c3d4e5-f6a7-8901-bcde-f01234567890', content: 'Totalmente de acuerdo!', parentId: 'f6a7b8c9-d0e1-2345-fabc-de1234567890' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Comentario creado',
            content: {
              'application/json': {
                example: {
                  id: 'a7b8c9d0-e1f2-3456-abcd-ef1234567890',
                  content: '¡Excelente artículo! Me ayudó mucho.',
                  likesCount: 0,
                  createdAt: '2026-04-15T20:00:00.000Z',
                  author: { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', username: 'johndoe', displayName: 'John Doe', avatarUrl: null },
                },
              },
            },
          },
          '404': { description: 'Post no encontrado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },

    '/api/v1/comments/{id}': {
      patch: {
        tags: ['Comments'],
        summary: 'Actualizar comentario',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, example: 'f6a7b8c9-d0e1-2345-fabc-de1234567890' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: { content: 'Contenido actualizado del comentario.' },
            },
          },
        },
        responses: {
          '200': { description: 'Comentario actualizado', content: { 'application/json': { example: { id: 'f6a7b8c9-d0e1-2345-fabc-de1234567890', content: 'Contenido actualizado del comentario.' } } } },
          '403': { description: 'Sin permisos', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
          '404': { description: 'Comentario no encontrado', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
      delete: {
        tags: ['Comments'],
        summary: 'Eliminar comentario',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' }, example: 'f6a7b8c9-d0e1-2345-fabc-de1234567890' },
        ],
        responses: {
          '200': { description: 'Comentario eliminado', content: { 'application/json': { example: { message: 'Comentario eliminado' } } } },
          '403': { description: 'Sin permisos', content: { 'application/json': { schema: $ref('ErrorResponse') } } },
        },
      },
    },
  },
};

// Spec base sin servers (se inyecta dinámicamente por request)
const { servers: _unused, ...baseDefinition } = openApiDefinition as any;
const openApiSpecification = swaggerJsdoc({
  definition: { ...baseDefinition, servers: [] },
  apis: [],
});

export function setupSwagger(app: Express) {
  // Devuelve el spec con el server URL del host que hace la petición,
  // así el "Try it out" de Swagger siempre apunta al mismo origen
  // (funciona tanto en localhost:3000 directo como vía nginx en :80).
  app.get('/openapi.json', (req, res) => {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host  = (req.headers['x-forwarded-host'] as string)  || req.headers.host || 'localhost';
    const dynamicSpec = {
      ...openApiSpecification,
      servers: [{ url: `${proto}://${host}`, description: 'API base URL' }],
    };
    res.json(dynamicSpec);
  });

  app.use('/docs', (_req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    next();
  });

  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      swaggerOptions: { url: '/openapi.json' },
    }),
  );
}
