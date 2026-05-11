# CMS Backend — Contexto Completo del Proyecto

> Documento de referencia técnica: estado actual, gaps, y roadmap de mejoras.
> Generado: 2026-05-11

---

## 1. ¿Qué es este proyecto?

Un **backend modular de CMS + Red Social** construido con Node.js 20, Express y TypeScript. Combina gestión de contenido editorial con funcionalidades sociales (seguidores, reacciones, hashtags, menciones), comunicación en tiempo real vía WebSockets, búsqueda full-text y analítica de eventos. Está pensado para ser el API que consuma un frontend Next.js.

### Stack principal

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20 LTS |
| Framework | Express 4.18 + TypeScript 5.3 |
| ORM | Prisma 5 → PostgreSQL 16 |
| Real-time | Socket.io 4.7 |
| Colas | BullMQ 5 + Redis 7.2 |
| Caché | Redis (ioredis 5.3) |
| Búsqueda | Elasticsearch 8.12 |
| Analytics | MongoDB 7 + Mongoose 8.2 |
| Almacenamiento | MinIO (S3-compatible) + Sharp |
| Email | SendGrid 8.1 |
| Auth | JWT (access 15 min / refresh 7 días) + OTP + 2FA |
| Validación | Zod 3.22 |
| Logs | Pino 8.19 |
| Métricas | Prometheus (prom-client) + Grafana |
| Docs API | Swagger UI (`/api/docs`) |
| Tests | Vitest 1.3 |
| CI/Deploy | Docker Compose (dev + prod profiles) |

---

## 2. Arquitectura general

```
┌─────────────────────────────────────────────────────────┐
│                        nginx (80/443)                    │
│              reverse proxy + rate-limit L4               │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                  cms_api  (port 3000)                    │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │   auth   │ │   cms    │ │  social  │ │ comments  │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │reactions │ │  media   │ │  search  │ │ analytics │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │         notifications  (DB + Socket.io)           │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Shared: middleware · services · workers · config        │
└──────┬──────────┬───────────┬──────────┬────────────────┘
       │          │           │          │
   PostgreSQL   Redis      MongoDB  Elasticsearch
   (Prisma)  (cache/BullMQ) (events)  (search)
       │
    MinIO (S3)
```

---

## 3. Módulos implementados

### 3.1 Auth (`/api/v1/auth`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /register | Registro + OTP por email |
| POST | /verify-email | Verificación con código 6 dígitos |
| POST | /login | Login → JWT access + refresh cookie |
| POST | /verify-2fa | Verificación TOTP |
| POST | /refresh | Rotación de refresh token |
| POST | /forgot-password | Solicitar reset OTP |
| POST | /reset-password | Aplicar reset |
| POST | /resend-otp | Reenviar OTP (rate-limited) |
| POST | /logout | Cierre de sesión |
| GET | /me | Perfil del usuario autenticado |
| GET | /sessions | Sesiones activas |

**Características:** bcrypt cost 12, OTP en Redis TTL 10 min, rotación de refresh token con SHA256, 2FA opcional (TOTP), upload de avatar vía Multer → MinIO.

---

### 3.2 CMS — Posts (`/api/v1/posts`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | / | Listado con filtros (status, type, category, tag, author, search, sort) |
| GET | /:slug | Post individual con metadata completa |
| POST | / | Crear post (auth) |
| PATCH | /:id | Actualizar parcialmente |
| DELETE | /:id | Soft-delete |

**Tipos de post:** ARTICLE, NEWS, TUTORIAL, REVIEW, SHORT, GALLERY, VIDEO  
**Flujo de estados:** DRAFT → IN_REVIEW → PUBLISHED / SCHEDULED → ARCHIVED  
**Visibilidad:** PUBLIC, FOLLOWERS_ONLY, PRIVATE, UNLISTED  
**Extras:** slugs únicos, SEO metadata, imágenes optimizadas (WebP + Sharp), contadores en tiempo real, indexación en ES vía BullMQ.

---

### 3.3 Social (`/api/v1/social`)

| Método | Ruta | Estado |
|--------|------|--------|
| POST | /follow/:userId | ✅ Implementado (toggle + real-time) |
| POST | /react | ✅ Implementado (7 tipos) |
| GET | /feed | ⚠️ Parcial (endpoint existe, lógica de feed personalizado incompleta) |
| GET | /users/:username | ⚠️ Stub (estructura sin datos) |
| GET | /users/:username/followers | ❌ Pendiente |
| GET | /users/:username/following | ❌ Pendiente |

**Reacciones:** LIKE, LOVE, CARE, HAHA, WOW, SAD, ANGRY — toggle (mismo tipo = eliminar, diferente = actualizar).

---

### 3.4 Comments (`/api/v1/comments`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /?postId=&page=&limit= | Comentarios anidados (raíz + replies) |
| POST | / | Crear comentario o reply (con parentId) |

**Extras:** detección de @menciones, notificaciones al autor del post, soft-delete, estados VISIBLE / HIDDEN / FLAGGED.

---

### 3.5 Reactions (`/api/v1/reactions`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | / | Toggle reacción (post o comment) |
| GET | /count | Conteos por tipo |
| GET | /my-reaction | Reacción del usuario autenticado |

**Real-time:** emite `reaction:added`, `reaction:removed`, `reaction:updated` a la sala del post.

---

### 3.6 Media (`/api/v1/media`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /upload | Upload multipart (50 MB, imágenes/video/PDF) |
| GET | / | Listado del usuario |
| DELETE | /:id | Eliminar archivo |
| POST | /presign | URL firmada para upload directo al bucket |

**Procesamiento:** Sharp → WebP (quality 85), thumbnail 400 px, extracción de metadatos (dimensiones, duración).

---

### 3.7 Search (`/api/v1/search`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /?q=&type=all|posts|users&page=&limit= | Búsqueda multi-índice con fuzzy |

**Índices ES:** `cms_posts` (title^3, excerpt^2, content) + `cms_users` (username^2, displayName, bio)  
**Degradación elegante:** si ES no responde → 503; si el índice no existe → resultados vacíos.

---

### 3.8 Analytics (`/api/v1/analytics`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /track | Track de un evento (202 async) |
| POST | /batch | Batch de hasta 50 eventos |
| GET | /dashboard | Métricas agregadas (auth) |
| GET | /posts/:postId | Métricas por post — **stub** |

**Storage:** MongoDB con TTL index 2 años. **Categorías:** pageview, engagement, conversion, social, error, custom.

---

### 3.9 Notifications (`/api/v1/notifications`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /?unreadOnly=&page=&limit= | Listado con paginación |
| GET | /unread/count | Conteo rápido de no leídas |
| GET | /type/:type | Filtrar por tipo |
| PATCH | /read-all | Marcar todas como leídas |
| PATCH | /:id/read | Marcar una como leída |

**Tipos:** NEW_FOLLOWER, POST_LIKE, COMMENT_LIKE, NEW_COMMENT, COMMENT_REPLY, POST_MENTION, COMMENT_MENTION, SYSTEM, WELCOME  
**Real-time:** Socket.io emite `notification:new` y `notification:all-read` al room del usuario.

---

## 4. Infraestructura y servicios compartidos

### Middleware
- **authenticate** — JWT Bearer validation
- **authorize(...roles)** — RBAC factory
- **validate(schema)** — Zod middleware (body / query / params / cookies)
- **errorHandler** — Manejo global con distinción AppError vs. unexpected
- **rateLimiter** — Redis-backed: global (100/15 min), auth (10/15 min), uploads (20/hora), public (200/hora)

### Workers (BullMQ)
| Cola | Reintentos | Destino |
|------|-----------|---------|
| email | 3 (backoff exp.) | SendGrid |
| notification | 2 (backoff fijo) | DB + Socket.io |
| search-index | 3 | Elasticsearch |
| analytics | 2 | MongoDB batch |

### Socket.io — Rooms y eventos
| Room | Eventos emitidos |
|------|-----------------|
| `user:{userId}` | notification:new, follower:gained, notification:all-read |
| `post:{postId}` | reaction:added/removed/updated, comment:new, counter:update |
| global | broadcast general |

### Métricas Prometheus
- `http_requests_total` — counter por método/ruta/status
- `http_request_duration_seconds` — histograma
- `auth_attempts_total` — counter por tipo/resultado
- `posts_created_total` — counter por tipo
- `active_websocket_connections` — gauge

---

## 5. Base de datos — Esquema Prisma

```
User ──< Session
     ──< Post ──< Comment ──< Reaction
               ──< Reaction
               ──< Bookmark
               ──< Share
               ──< Mention
               ──< MediaPost
               ──< CategoryPost
               ──< TagPost
               ──< HashtagPost
     ──< Follow (seguidor / seguido)
     ──< Notification
     ──< Media
     ──< UserTag
```

**Roles:** USER, AUTHOR, EDITOR, ADMIN, SUPER_ADMIN  
**Estados de usuario:** PENDING_VERIFICATION, ACTIVE, SUSPENDED, BANNED  
**Soft-delete** en todas las entidades críticas (`deletedAt`).

---

## 6. Variables de entorno requeridas (resumen)

```env
# App
NODE_ENV=development
PORT=3000
API_VERSION=v1
CORS_ORIGINS=http://localhost:3001

# JWT
JWT_ACCESS_SECRET=           # min 32 chars
JWT_REFRESH_SECRET=          # min 32 chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# PostgreSQL
DATABASE_URL=postgresql://...

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

# MongoDB
MONGODB_URL=mongodb://...

# Elasticsearch
ELASTICSEARCH_URL=http://elasticsearch:9200
ELASTIC_PASSWORD=

# MinIO / S3
MINIO_ENDPOINT=http://minio:9000
MINIO_USER=
MINIO_PASSWORD=
MINIO_PUBLIC_BUCKET=cms-public
MINIO_PRIVATE_BUCKET=cms-private

# SendGrid
SENDGRID_API_KEY=SG.*
SENDGRID_FROM_EMAIL=
SENDGRID_FROM_NAME=

# Rate limiting, pagination, image sizes, ...
```

> Ver `.env.example` para la lista completa de 40+ variables.

---

## 7. Lo que falta implementar

### 7.1 Endpoints pendientes (alta prioridad)

| Módulo | Endpoint | Descripción |
|--------|---------|-------------|
| Social | `GET /social/users/:username` | Perfil público completo (followers/following counts, posts recientes) |
| Social | `GET /social/users/:username/followers` | Lista de seguidores con paginación e `isFollowing` flag |
| Social | `GET /social/users/:username/following` | Lista de seguidos con paginación |
| Social | `GET /social/feed` | Feed personalizado (posts de usuarios seguidos, ordenado por relevancia/fecha) |
| Analytics | `GET /analytics/posts/:postId` | Métricas reales por post (pageviews, avg_duration, top referrers) |

### 7.2 Features incompletas

| Área | Gap |
|------|-----|
| **Feed algorithm** | No hay lógica de ranking. Necesita: posts de seguidos + boost por interacciones recientes + paginación por cursor |
| **Scheduled posts** | El campo `scheduledAt` existe pero no hay worker/cron que publique automáticamente posts programados |
| **Bulk ES indexing** | No hay script de reindexación inicial. Si ES se resetea, los posts existentes no se indexan |
| **2FA full flow** | `verify-2fa` existe pero no hay endpoint para activar/desactivar 2FA ni para generar el QR/secret inicial |
| **Admin panel endpoints** | No hay rutas para gestión administrativa: banear usuarios, moderar posts/comentarios, estadísticas globales |
| **Delete account** | No hay endpoint para que el usuario elimine su propia cuenta |
| **Update profile** | No hay `PATCH /auth/profile` para editar nombre, bio, avatar sin subir nueva imagen |
| **Bookmark endpoints** | El modelo `Bookmark` existe pero no hay rutas para crear/listar/eliminar bookmarks |
| **Share endpoints** | El modelo `Share` existe pero no hay rutas dedicadas |
| **Post revision history** | No hay versionado de posts (útil para EDITOR/ADMIN) |
| **Comment update/delete** | Solo existe crear comentarios; falta `PATCH /comments/:id` y `DELETE /comments/:id` |
| **Reaction delete standalone** | Reactions usa toggle, pero no hay `DELETE /reactions/:id` explícito |
| **Hashtag endpoints** | El modelo de Hashtag y la extracción existen, pero faltan rutas: `GET /hashtags/trending`, `GET /hashtags/:tag/posts` |
| **Media soft-delete** | Al eliminar media, ¿se elimina también el objeto en MinIO? — revisar si hay cleanup |

### 7.3 Tests — cobertura muy baja

| Estado actual | Lo que falta |
|--------------|-------------|
| `auth.test.ts` existe (alcance desconocido) | Tests de integración para cada módulo |
| `utils/index.test.ts` existe | Tests de servicios compartidos (notificationsService, workers) |
| Sin tests E2E | Suite E2E con base de datos de test (Postgres test container) |
| Sin tests de Socket.io | Pruebas de eventos en tiempo real |
| Sin tests de workers BullMQ | Verificar que los jobs procesan correctamente |

---

## 8. Mejoras técnicas recomendadas

### 8.1 Performance

| Mejora | Impacto | Esfuerzo |
|--------|---------|---------|
| **Cursor-based pagination** en feed y listas de posts | Alto — scroll infinito más eficiente | Medio |
| **Redis cache** para posts publicados populares | Alto — evita hits a Postgres en reads frecuentes | Medio |
| **CDN para media** | Alto — aliviar MinIO en producción | Bajo (configuración) |
| **Connection pooling** con PgBouncer | Medio — reduce conexiones abiertas a Postgres | Bajo |
| **Compresión Brotli** en nginx | Medio — respuestas más pequeñas | Bajo |
| **HTTP/2** en nginx | Medio — multiplexing de requests | Bajo |
| **Query optimization** — revisar N+1 en Prisma includes | Medio — queries con muchos `include` anidados pueden ser costosas | Medio |

### 8.2 Seguridad

| Mejora | Detalle |
|--------|---------|
| **CSRF protection** | Faltan tokens CSRF para rutas mutables (aunque SameSite=Strict mitiga parcialmente) |
| **Input sanitization** | El contenido de posts (MDX/richtext) debe sanitizarse antes de guardar para prevenir XSS almacenado |
| **File type validation profunda** | Actualmente se valida por MIME type del header; añadir validación por magic bytes (número mágico del archivo) |
| **Audit log** | No hay tabla de auditoría para acciones sensibles (ban, role change, delete) |
| **API key auth** | Para integraciones server-to-server (webhooks de terceros) conviene tener API keys además de JWT |
| **Password history** | Prevenir reutilización de contraseñas recientes al hacer reset |
| **Account lockout** | Tras N intentos fallidos, bloquear cuenta temporalmente (no solo rate limit por IP) |
| **Secrets rotation** | Documentar y probar el procedimiento de rotación de JWT secrets sin downtime |

### 8.3 Observabilidad

| Mejora | Detalle |
|--------|---------|
| **Distributed tracing** | Añadir OpenTelemetry (Jaeger/Tempo) para trazar requests a través de servicios |
| **Error tracking** | Integrar Sentry o similar para alertas en tiempo real de errores en producción |
| **Dashboards Grafana** | Los contenedores están configurados pero sin dashboards predefinidos exportables |
| **Alertas Prometheus** | No hay alertas configuradas (Alertmanager) para SLOs: latencia p99, error rate, disco lleno |
| **Structured logging** | Los logs de Pino están bien pero falta correlacionar `requestId` entre todos los servicios |
| **Health checks granulares** | El endpoint `/health` devuelve uptime pero no el estado real de cada dependencia (ES, Redis, MongoDB) |

### 8.4 Developer Experience

| Mejora | Detalle |
|--------|---------|
| **CLAUDE.md** | No existe — añadir contexto del proyecto para IA-assisted development |
| **Swagger completo** | Muchos endpoints carecen de decoradores JSDoc para Swagger; la doc está incompleta |
| **Postman collection actualizada** | La colección existente puede estar desincronizada con los últimos endpoints |
| **Makefile / scripts** | Crear `make dev`, `make seed`, `make migrate`, `make test` para estandarizar comandos |
| **docker compose watch** | Reemplazar el volumen bind-mount actual por `docker compose watch` (Compose 2.22+) para hot-reload más limpio |
| **Pre-commit hooks** | Añadir husky + lint-staged para verificar lint/format antes de cada commit |
| **CI/CD pipeline** | No hay GitHub Actions / pipeline configurado para test + build + push de imagen |

### 8.5 Arquitectura / Escalabilidad

| Mejora | Detalle |
|--------|---------|
| **Event sourcing para notifications** | Actualmente mezcla DB write + Socket.io emit en el mismo ciclo request; mover al worker de notificaciones para desacoplar |
| **Redis Pub/Sub para multi-instancia** | Si se escala a más de 1 réplica de la API, Socket.io necesita el adapter de Redis para compartir rooms |
| **Rate limiting centralizado** | El rate limit actual es por instancia; con múltiples réplicas se multiplica el límite accidentalmente |
| **Separar read/write models** | Los endpoints de feed y búsqueda mezclan lógica de negocio con queries; extraer a servicios dedicados facilita optimización |
| **Mensajes de error i18n** | Todos los mensajes de error están en inglés; si la audiencia es hispana, considerar i18n |

---

## 9. Prioridades sugeridas (roadmap)

### Sprint 1 — Completar core social (1-2 semanas)
1. `GET /social/users/:username` — perfil público completo
2. `GET /social/users/:username/followers` + `/following`
3. `GET /social/feed` — feed simple (posts de seguidos, orden cronológico)
4. `PATCH /comments/:id` + `DELETE /comments/:id`
5. Bookmarks CRUD (`POST/GET/DELETE /bookmarks`)

### Sprint 2 — Robustez y seguridad (1 semana)
1. Activar/desactivar 2FA con QR (endpoint de setup)
2. `DELETE /auth/account` — baja de usuario
3. `PATCH /auth/profile` — edición de perfil
4. Sanitización de contenido richtext (DOMPurify server-side o similar)
5. Worker cron para posts programados (`scheduledAt`)

### Sprint 3 — Hashtags y Shares (1 semana)
1. `GET /hashtags/trending` — top hashtags por score
2. `GET /hashtags/:tag/posts` — posts con ese hashtag
3. `POST/GET /shares` — compartir posts con mensaje
4. Script de reindexación bulk en Elasticsearch

### Sprint 4 — Tests y CI (1-2 semanas)
1. Tests de integración para auth (registro, login, refresh, 2FA)
2. Tests de integración para cms (crear/editar/publicar post)
3. Tests de social (follow, react, feed)
4. GitHub Actions: lint + test + build en cada PR

### Sprint 5 — Observabilidad (1 semana)
1. Health check granular en `/health` (estado de cada dependencia)
2. Dashboards Grafana exportables
3. Alertas Prometheus básicas (error rate, latencia p99)
4. Redis adapter para Socket.io (preparar multi-instancia)

---

## 10. Setup rápido del ambiente

```bash
# 1. Copiar y configurar variables
cp .env.example .env
# Editar .env con tus valores reales

# 2. Levantar servicios
docker compose up -d

# Con herramientas de dev (Bull Board UI)
docker compose --profile dev-tools up -d

# Con monitoreo (Prometheus + Grafana)
docker compose --profile monitoring up -d

# 3. Verificar salud
curl http://localhost/health

# 4. Explorar API
open http://localhost/api/docs

# 5. Prisma Studio (GUI de base de datos)
npm run prisma:studio

# 6. Datos de prueba (admin@example.com / Admin1234!)
npx prisma db seed
```

### Puertos expuestos

| Servicio | Puerto |
|---------|--------|
| API (vía nginx) | 80 / 443 |
| API directo | 3000 |
| Bull Board UI | 3001 |
| Grafana | 3002 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| MongoDB | 27017 |
| MinIO API | 9000 |
| MinIO Console | 9001 |
| Elasticsearch | 9200 |
| Prometheus | 9090 |

---

## 11. Endpoints completos por módulo (referencia rápida)

```
AUTH
  POST   /api/v1/auth/register
  POST   /api/v1/auth/verify-email
  POST   /api/v1/auth/login
  POST   /api/v1/auth/verify-2fa
  POST   /api/v1/auth/refresh
  POST   /api/v1/auth/forgot-password
  POST   /api/v1/auth/reset-password
  POST   /api/v1/auth/resend-otp
  POST   /api/v1/auth/logout
  GET    /api/v1/auth/me
  GET    /api/v1/auth/sessions

CMS (POSTS)
  GET    /api/v1/posts
  GET    /api/v1/posts/:slug
  POST   /api/v1/posts
  PATCH  /api/v1/posts/:id
  DELETE /api/v1/posts/:id

SOCIAL
  POST   /api/v1/social/follow/:userId       ✅
  POST   /api/v1/social/react                ✅
  GET    /api/v1/social/feed                 ⚠️ parcial
  GET    /api/v1/social/users/:username      ⚠️ stub
  GET    /api/v1/social/users/:username/followers   ❌
  GET    /api/v1/social/users/:username/following   ❌

COMMENTS
  GET    /api/v1/comments
  POST   /api/v1/comments
  PATCH  /api/v1/comments/:id               ❌ pendiente
  DELETE /api/v1/comments/:id               ❌ pendiente

REACTIONS
  POST   /api/v1/reactions
  GET    /api/v1/reactions/count
  GET    /api/v1/reactions/my-reaction

MEDIA
  POST   /api/v1/media/upload
  GET    /api/v1/media
  DELETE /api/v1/media/:id
  POST   /api/v1/media/presign

SEARCH
  GET    /api/v1/search

ANALYTICS
  POST   /api/v1/analytics/track
  POST   /api/v1/analytics/batch
  GET    /api/v1/analytics/dashboard
  GET    /api/v1/analytics/posts/:postId    ⚠️ stub

NOTIFICATIONS
  GET    /api/v1/notifications
  GET    /api/v1/notifications/unread/count
  GET    /api/v1/notifications/type/:type
  PATCH  /api/v1/notifications/read-all
  PATCH  /api/v1/notifications/:id/read

PENDIENTES (sin módulo aún)
  GET    /api/v1/hashtags/trending           ❌
  GET    /api/v1/hashtags/:tag/posts         ❌
  POST   /api/v1/bookmarks                   ❌
  GET    /api/v1/bookmarks                   ❌
  DELETE /api/v1/bookmarks/:postId           ❌
  POST   /api/v1/shares                      ❌
  GET    /api/v1/shares                      ❌
```

---

*Este documento debe actualizarse cada vez que se implementen nuevas features o se resuelvan los gaps identificados.*
