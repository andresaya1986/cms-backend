import type { Express } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from './env';

const openApiDefinition = {
  openapi: '3.0.3',
  info: {
    title: `${env.APP_NAME} API`,
    version: '1.0.0',
    description: 'Documentacion OpenAPI del backend CMS',
  },
  servers: [
    {
      url: env.APP_URL,
      description: 'API base URL',
    },
  ],
  tags: [
    { name: 'Auth' },
    { name: 'Posts' },
    { name: 'Social' },
    { name: 'Analytics' },
    { name: 'Notifications' },
    { name: 'Media' },
    { name: 'Search' },
    { name: 'Comments' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'Datos de entrada invalidos' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: {
          '200': { description: 'Servicio activo' },
        },
      },
    },

    '/api/v1/auth/register': {
      post: { tags: ['Auth'], summary: 'Registrar usuario', responses: { '201': { description: 'Creado' } } },
    },
    '/api/v1/auth/verify-email': {
      post: { tags: ['Auth'], summary: 'Verificar email con OTP', responses: { '200': { description: 'Verificado' } } },
    },
    '/api/v1/auth/login': {
      post: { tags: ['Auth'], summary: 'Iniciar sesion', responses: { '200': { description: 'Autenticado' } } },
    },
    '/api/v1/auth/verify-2fa': {
      post: { tags: ['Auth'], summary: 'Verificar OTP de 2FA', responses: { '200': { description: '2FA OK' } } },
    },
    '/api/v1/auth/refresh': {
      post: { tags: ['Auth'], summary: 'Refrescar access token', responses: { '200': { description: 'Token renovado' } } },
    },
    '/api/v1/auth/forgot-password': {
      post: { tags: ['Auth'], summary: 'Solicitar recuperacion', responses: { '200': { description: 'OTP enviado' } } },
    },
    '/api/v1/auth/reset-password': {
      post: { tags: ['Auth'], summary: 'Resetear password', responses: { '200': { description: 'Password actualizada' } } },
    },
    '/api/v1/auth/resend-otp': {
      post: { tags: ['Auth'], summary: 'Reenviar OTP', responses: { '200': { description: 'OTP reenviado' } } },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cerrar sesion',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Sesion cerrada' } },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Perfil del usuario',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Perfil' } },
      },
    },
    '/api/v1/auth/sessions': {
      get: {
        tags: ['Auth'],
        summary: 'Listar sesiones activas',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Sesiones' } },
      },
    },

    '/api/v1/posts': {
      get: { tags: ['Posts'], summary: 'Listar posts', responses: { '200': { description: 'Listado' } } },
      post: {
        tags: ['Posts'],
        summary: 'Crear post',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Post creado' } },
      },
    },
    '/api/v1/posts/{slug}': {
      get: {
        tags: ['Posts'],
        summary: 'Obtener post por slug',
        parameters: [{ in: 'path', name: 'slug', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Post' } },
      },
    },
    '/api/v1/posts/{id}': {
      patch: {
        tags: ['Posts'],
        summary: 'Actualizar post',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Actualizado' } },
      },
      delete: {
        tags: ['Posts'],
        summary: 'Eliminar post',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Eliminado' } },
      },
    },

    '/api/v1/social/follow/{userId}': {
      post: {
        tags: ['Social'],
        summary: 'Seguir o dejar de seguir usuario',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'userId', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Operacion completada' } },
      },
    },
    '/api/v1/social/like': {
      post: {
        tags: ['Social'],
        summary: 'Like o unlike',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Operacion completada' } },
      },
    },
    '/api/v1/social/feed': {
      get: {
        tags: ['Social'],
        summary: 'Feed personalizado',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Feed' } },
      },
    },
    '/api/v1/social/users/{username}': {
      get: {
        tags: ['Social'],
        summary: 'Perfil publico',
        parameters: [{ in: 'path', name: 'username', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Perfil' } },
      },
    },
    '/api/v1/social/users/{username}/followers': {
      get: {
        tags: ['Social'],
        summary: 'Seguidores de usuario',
        parameters: [{ in: 'path', name: 'username', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Seguidores' } },
      },
    },

    '/api/v1/analytics/track': {
      post: { tags: ['Analytics'], summary: 'Registrar evento', responses: { '201': { description: 'Evento registrado' } } },
    },
    '/api/v1/analytics/batch': {
      post: { tags: ['Analytics'], summary: 'Registrar batch de eventos', responses: { '201': { description: 'Eventos registrados' } } },
    },
    '/api/v1/analytics/dashboard': {
      get: {
        tags: ['Analytics'],
        summary: 'Dashboard de metricas',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Dashboard' } },
      },
    },
    '/api/v1/analytics/posts/{postId}': {
      get: {
        tags: ['Analytics'],
        summary: 'Metricas de un post',
        parameters: [{ in: 'path', name: 'postId', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Metricas' } },
      },
    },

    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'Listar notificaciones',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Notificaciones' } },
      },
    },
    '/api/v1/notifications/read/{id}': {
      patch: {
        tags: ['Notifications'],
        summary: 'Marcar notificacion leida',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Actualizada' } },
      },
    },

    '/api/v1/media/upload': {
      post: {
        tags: ['Media'],
        summary: 'Subir archivo',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Archivo subido' } },
      },
    },
    '/api/v1/media': {
      get: {
        tags: ['Media'],
        summary: 'Listar archivos del usuario',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Archivos' } },
      },
    },
    '/api/v1/media/{id}': {
      delete: {
        tags: ['Media'],
        summary: 'Eliminar archivo',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Eliminado' } },
      },
    },
    '/api/v1/media/presign': {
      post: {
        tags: ['Media'],
        summary: 'Generar URL firmada para upload',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'URL generada' } },
      },
    },

    '/api/v1/search': {
      get: { tags: ['Search'], summary: 'Busqueda global', responses: { '200': { description: 'Resultados' } } },
    },

    '/api/v1/comments': {
      post: {
        tags: ['Comments'],
        summary: 'Crear comentario',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Comentario creado' } },
      },
    },
    '/api/v1/comments/post/{postId}': {
      get: {
        tags: ['Comments'],
        summary: 'Listar comentarios por post',
        parameters: [{ in: 'path', name: 'postId', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Comentarios' } },
      },
    },
    '/api/v1/comments/{id}': {
      patch: {
        tags: ['Comments'],
        summary: 'Actualizar comentario',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Actualizado' } },
      },
      delete: {
        tags: ['Comments'],
        summary: 'Eliminar comentario',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Eliminado' } },
      },
    },
  },
};

const openApiSpecification = swaggerJsdoc({
  definition: openApiDefinition,
  apis: [],
});

export function setupSwagger(app: Express) {
  app.get('/openapi.json', (_req, res) => {
    res.json(openApiSpecification);
  });

  app.use('/docs', (_req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    next();
  });

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpecification));
}
