# CMS Backend — Monolito Modular

Backend dockerizado para CMS + Red Social construido con Node.js + Express + TypeScript.

## Stack

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20 LTS |
| Framework | Express.js + TypeScript |
| ORM | Prisma (PostgreSQL) |
| Cache / Queues | Redis + BullMQ |
| Analytics | MongoDB |
| Storage | MinIO (S3-compatible) |
| Búsqueda | Elasticsearch |
| Auth | JWT (access + refresh) + OTP SendGrid |
| Tiempo real | Socket.io |
| Métricas | Prometheus + Grafana |
| Logs | Pino |
| Infra | Docker + Docker Compose |

## Inicio rápido

### 1. Clonar y configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus valores reales
```

Variables **obligatorias** a configurar:
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `MONGO_PASSWORD`
- `MINIO_PASSWORD`
- `ELASTIC_PASSWORD`
- `JWT_ACCESS_SECRET` (mínimo 32 chars)
- `JWT_REFRESH_SECRET` (mínimo 32 chars)
- `SENDGRID_API_KEY` (formato: SG.xxx)
- `SENDGRID_FROM_EMAIL`

### 2. Levantar servicios

```bash
# Desarrollo (con hot reload)
docker compose up -d

# Ver logs de la API
docker compose logs -f api

# Con herramientas de dev (Bull Board UI)
docker compose --profile dev-tools up -d

# Con monitoring (Prometheus + Grafana)
docker compose --profile monitoring up -d
```

### 3. Inicializar base de datos

```bash
# Ejecutar migraciones
docker compose exec api npx prisma migrate dev --name init

# Seed con datos de ejemplo
docker compose exec api npm run prisma:seed
```

### 4. Verificar que todo funciona

```bash
curl http://localhost/health
# → {"status":"ok","timestamp":"...","uptime":...}
```

## Estructura del proyecto

```
src/
├── server.ts                    # Entry point
├── modules/
│   ├── auth/                    # JWT + OTP + sesiones
│   ├── cms/                     # Posts CRUD + SEO
│   ├── social/                  # Feed, follows, likes
│   ├── analytics/               # Tracking de eventos
│   ├── notifications/           # Notificaciones
│   ├── media/                   # Upload + MinIO
│   ├── search/                  # Elasticsearch
│   └── comments/                # Comentarios + hilos
└── shared/
    ├── config/                  # env, logger, databases, socket, metrics
    ├── middleware/              # authenticate, validate, rateLimiter, errorHandler
    └── errors/                  # AppError
```

## API — Endpoints principales

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Registro con email |
| POST | `/api/v1/auth/verify-email` | Verificar email con OTP |
| POST | `/api/v1/auth/login` | Login con email + password |
| POST | `/api/v1/auth/verify-2fa` | Verificar OTP de 2FA |
| POST | `/api/v1/auth/refresh` | Renovar access token |
| POST | `/api/v1/auth/forgot-password` | Solicitar OTP de reset |
| POST | `/api/v1/auth/reset-password` | Resetear contraseña |
| POST | `/api/v1/auth/logout` | Cerrar sesión |
| GET  | `/api/v1/auth/me` | Perfil del usuario autenticado |
| GET  | `/api/v1/auth/sessions` | Listar sesiones activas |

### CMS / Posts
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/posts` | Listar posts (con filtros y paginación) |
| GET | `/api/v1/posts/:slug` | Obtener post por slug |
| POST | `/api/v1/posts` | Crear post (auth requerida) |
| PATCH | `/api/v1/posts/:id` | Actualizar post |
| DELETE | `/api/v1/posts/:id` | Eliminar post (soft delete) |

### Social
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/social/follow/:userId` | Seguir / dejar de seguir |
| POST | `/api/v1/social/like` | Like / unlike post o comentario |
| GET | `/api/v1/social/feed` | Feed personalizado |
| GET | `/api/v1/social/users/:username` | Perfil público |
| GET | `/api/v1/social/users/:username/followers` | Seguidores |

### Analytics
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/analytics/track` | Registrar evento |
| POST | `/api/v1/analytics/batch` | Batch de hasta 50 eventos |
| GET | `/api/v1/analytics/dashboard` | Métricas del dashboard |
| GET | `/api/v1/analytics/posts/:postId` | Stats de un post |

### Media
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/media/upload` | Subir archivo (multipart) |
| GET | `/api/v1/media` | Mis archivos |
| DELETE | `/api/v1/media/:id` | Eliminar archivo |
| POST | `/api/v1/media/presign` | URL firmada para subida directa |

## Roles de usuario

| Rol | Capacidades |
|-----|-------------|
| `USER` | Leer, comentar, dar like, seguir |
| `AUTHOR` | + Crear y editar sus propios posts |
| `EDITOR` | + Editar posts de otros |
| `ADMIN` | + Gestionar usuarios y contenido |
| `SUPER_ADMIN` | Acceso completo |

## WebSockets (Socket.io)

```javascript
const socket = io('http://localhost', {
  auth: { token: 'Bearer <access_token>' }
});

// Unirse a sala de un post (para comentarios en tiempo real)
socket.emit('join:post', postId);

// Escuchar nuevos comentarios
socket.on('new:comment', (comment) => { ... });

// Notificaciones personales
socket.on('notification', (notification) => { ... });
```

## Herramientas de desarrollo

| Herramienta | URL |
|-------------|-----|
| API | http://localhost:3000 |
| Nginx Gateway | http://localhost |
| MinIO Console | http://localhost:9001 |
| Bull Board (queues) | http://localhost:3001 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3002 |
| Prisma Studio | `npm run prisma:studio` |

## Seguridad implementada

- JWT con access token (15 min) + refresh token rotativo (7 días)
- OTP de 6 dígitos via SendGrid con TTL en Redis
- Rate limiting por IP con Redis (global + auth + uploads)
- Helmet.js con CSP, HSTS, X-Frame-Options
- CORS estricto con lista blanca de origins
- Validación de entrada con Zod en todas las rutas
- Soft delete (los datos nunca se borran permanentemente)
- Contraseñas con bcrypt (cost factor 12)
- Usuario no-root en Docker
- Redacción de datos sensibles en logs (passwords, tokens, OTPs)
- Nginx como reverse proxy con rate limiting adicional

## Próximos pasos sugeridos

1. Configurar HTTPS con Let's Encrypt (Certbot)
2. Implementar TOTP (Google Authenticator) como 2FA alternativo
3. Agregar workers de BullMQ para emails en background
4. Configurar dashboards de Grafana para métricas del negocio
5. Implementar webhooks salientes
6. Construir el frontend en Next.js 14 conectado a esta API
