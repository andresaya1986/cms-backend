# 📱 CMS Backend - Guía de Integración Frontend

## 🚀 Información Base del API

| Propiedad | Valor |
|-----------|-------|
| **Base URL** | `http://localhost:3000` (desarrollo) |
| **Versión API** | `v1` |
| **Protocolo** | HTTP/REST + WebSocket |
| **Content-Type** | `application/json` |
| **Autenticación** | Bearer Token (JWT) |

---

## 🔐 AUTENTICACIÓN - Flujo Completo

### 1️⃣ **REGISTRO** - Crear nueva cuenta

```
POST /api/v1/auth/register
```

**Request:**
```json
{
  "email": "usuario@example.com",
  "username": "usuario123",
  "password": "SecurePass123!",
  "displayName": "Nombre del Usuario"
}
```

**Validaciones de Contraseña:**
- Mínimo 8 caracteres
- Al menos 1 mayúscula
- Al menos 1 número
- Al menos 1 carácter especial

**Response (201):**
```json
{
  "message": "Registro exitoso. Revisa tu email para verificar tu cuenta.",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "usuario@example.com",
    "username": "usuario123",
    "displayName": "Nombre del Usuario",
    "role": "USER"
  }
}
```

⚠️ **ACCIÓN**: Se envía OTP (6 dígitos) al email

---

### 2️⃣ **VERIFICAR EMAIL** - Confirmar con OTP

```
POST /api/v1/auth/verify-email
```

**Request:**
```json
{
  "email": "usuario@example.com",
  "otp": "123456",
  "type": "EMAIL_VERIFICATION"
}
```

**Response (200):**
```json
{
  "message": "Email verificado correctamente",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "usuario@example.com",
    "username": "usuario123",
    "role": "USER"
  }
}
```

💾 **GUARDAR**: `accessToken` en localStorage/sessionStorage

---

### 3️⃣ **LOGIN** - Iniciar sesión

```
POST /api/v1/auth/login
```

**Request:**
```json
{
  "email": "usuario@example.com",
  "password": "SecurePass123!"
}
```

**Response SIN 2FA (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "usuario@example.com",
    "username": "usuario123",
    "displayName": "Nombre del Usuario",
    "role": "USER",
    "status": "ACTIVE",
    "emailVerified": true,
    "twoFactorEnabled": false
  }
}
```

**Response CON 2FA (200):**
```json
{
  "requires2FA": true,
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Código enviado a tu email"
}
```

⚠️ **ACCIÓN**: Se envía OTP al email si tiene 2FA activo

---

### 4️⃣ **VERIFICAR 2FA** - Confirmar segundo factor

```
POST /api/v1/auth/verify-2fa
```

**Request:**
```json
{
  "email": "usuario@example.com",
  "otp": "654321",
  "type": "TWO_FACTOR"
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "usuario@example.com",
    "username": "usuario123"
  }
}
```

---

### 5️⃣ **OBTENER PERFIL** - Datos del usuario autenticado

```
GET /api/v1/auth/me
Authorization: Bearer <ACCESS_TOKEN>
```

**Response (200):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "usuario@example.com",
    "username": "usuario123",
    "displayName": "Nombre del Usuario",
    "avatarUrl": null,
    "coverUrl": null,
    "bio": null,
    "role": "USER",
    "emailVerified": true,
    "twoFactorEnabled": false,
    "createdAt": "2025-04-13T10:30:00Z",
    "_count": {
      "followers": 0,
      "following": 0,
      "posts": 0
    }
  }
}
```

---

### 6️⃣ **RENOVAR TOKEN** - Refreshar Access Token

```
POST /api/v1/auth/refresh
Content-Type: application/json
```

**Request (2 opciones):**

Opción A - Body:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Opción B - Cookie: El refresh_token se envía automáticamente

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 7️⃣ **LOGOUT** - Cerrar sesión

```
POST /api/v1/auth/logout
Authorization: Bearer <ACCESS_TOKEN>
```

**Response (200):**
```json
{
  "message": "Sesión cerrada correctamente"
}
```

---

### 8️⃣ **RECUPERAR CONTRASEÑA** - Solicitar reset

```
POST /api/v1/auth/forgot-password
Content-Type: application/json
```

**Request:**
```json
{
  "email": "usuario@example.com"
}
```

**Response (200):**
```json
{
  "message": "Si el email existe, recibirás un código de recuperación"
}
```

⚠️ **ACCIÓN**: Se envía OTP al email

---

### 9️⃣ **RESET CONTRASEÑA** - Establecer nueva contraseña

```
POST /api/v1/auth/reset-password
Content-Type: application/json
```

**Request:**
```json
{
  "email": "usuario@example.com",
  "otp": "789456",
  "newPassword": "NewSecurePass123!"
}
```

**Response (200):**
```json
{
  "message": "Contraseña actualizada correctamente"
}
```

---

### 🔟 **REENVIAR OTP** - Solicitar nuevo código

```
POST /api/v1/auth/resend-otp
Content-Type: application/json
```

**Request:**
```json
{
  "email": "usuario@example.com",
  "type": "EMAIL_VERIFICATION"
}
```

Tipos válidos: `EMAIL_VERIFICATION`, `TWO_FACTOR`, `PASSWORD_RESET`

**Response (200):**
```json
{
  "message": "Código reenviado"
}
```

---

## 📝 CMS - GESTIÓN DE CONTENIDO

### 1️⃣ **LISTAR POSTS** - Con filtros y paginación

```
GET /api/v1/posts?page=1&limit=20&status=PUBLISHED&search=tutorial
```

**Parámetros Query:**
- `page` (default: 1)
- `limit` (default: 20, máx: 100)
- `status` (DRAFT, IN_REVIEW, PUBLISHED, SCHEDULED, ARCHIVED)
- `type` (ARTICLE, NEWS, TUTORIAL, REVIEW, SHORT, GALLERY, VIDEO)
- `authorId` (UUID del autor)
- `categoryId` (UUID de la categoría)
- `tagId` (UUID del tag)
- `search` (búsqueda en title/excerpt)
- `sort` (latest, oldest, popular, trending)

**Response (200):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Introducción a TypeScript",
      "slug": "introduccion-a-typescript",
      "excerpt": "Aprende TypeScript desde cero...",
      "featuredImage": "https://...",
      "status": "PUBLISHED",
      "type": "TUTORIAL",
      "viewCount": 1250,
      "likesCount": 45,
      "commentsCount": 12,
      "publishedAt": "2025-04-10T10:30:00Z",
      "createdAt": "2025-04-10T10:30:00Z",
      "author": {
        "id": "...",
        "username": "demo_author",
        "displayName": "Demo Author",
        "avatarUrl": null
      },
      "categories": [
        {
          "category": {
            "id": "...",
            "name": "Tutoriales",
            "slug": "tutorials"
          }
        }
      ],
      "tags": [
        {
          "tag": {
            "id": "...",
            "name": "TypeScript",
            "slug": "typescript"
          }
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true
  }
}
```

---

### 2️⃣ **OBTENER POST POR SLUG**

```
GET /api/v1/posts/:slug
```

**Ejemplo:**
```
GET /api/v1/posts/introduccion-a-typescript
```

**Response (200):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Introducción a TypeScript",
    "slug": "introduccion-a-typescript",
    "content": "<h1>Introducción</h1><p>TypeScript es...</p>",
    "excerpt": "Aprende TypeScript desde cero...",
    "status": "PUBLISHED",
    "type": "TUTORIAL",
    "visibility": "PUBLIC",
    "featuredImage": "https://...",
    "viewCount": 1251,
    "likesCount": 45,
    "commentsCount": 12,
    "publishedAt": "2025-04-10T10:30:00Z",
    "createdAt": "2025-04-10T10:30:00Z",
    "metaTitle": "TypeScript Tutorial",
    "metaDescription": "Aprende TypeScript...",
    "metaKeywords": ["typescript", "javascript", "tutorial"],
    "author": {
      "id": "...",
      "username": "demo_author",
      "displayName": "Demo Author",
      "avatarUrl": null,
      "bio": "Escritor de contenido de ejemplo"
    },
    "categories": [],
    "tags": [],
    "media": []
  }
}
```

⚠️ **Nota**: `viewCount` se incrementa automáticamente

---

### 3️⃣ **CREAR POST** - Requiere autenticación

```
POST /api/v1/posts
Authorization: Bearer <ACCESS_TOKEN>
```

**Request:**
```json
{
  "title": "Mi Primer Post",
  "content": "<h1>Hola</h1><p>Este es mi primer post...</p>",
  "excerpt": "Resumen corto del post",
  "type": "ARTICLE",
  "status": "DRAFT",
  "visibility": "PUBLIC",
  "featuredImage": "https://example.com/image.jpg",
  "categoryIds": ["550e8400-e29b-41d4-a716-446655440001"],
  "tagIds": ["550e8400-e29b-41d4-a716-446655440002"],
  "metaTitle": "Mi Primer Post - SEO Title",
  "metaDescription": "Descripción SEO del post",
  "metaKeywords": ["keyword1", "keyword2"],
  "scheduledAt": "2025-04-20T15:00:00Z"
}
```

**Roles requeridos**: AUTHOR, EDITOR, ADMIN, SUPER_ADMIN

**Response (201):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440050",
    "title": "Mi Primer Post",
    "slug": "mi-primer-post-1713010800",
    "status": "DRAFT",
    "type": "ARTICLE",
    "createdAt": "2025-04-10T10:30:00Z",
    "author": {
      "id": "...",
      "username": "usuario123",
      "displayName": "Nombre del Usuario"
    }
  }
}
```

---

### 4️⃣ **ACTUALIZAR POST**

```
PATCH /api/v1/posts/:id
Authorization: Bearer <ACCESS_TOKEN>
```

**Request** (todos los campos son opcionales):
```json
{
  "title": "Título Actualizado",
  "content": "Nuevo contenido...",
  "status": "PUBLISHED",
  "visibility": "FOLLOWERS_ONLY"
}
```

**Response (200):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440050",
    "title": "Título Actualizado",
    "status": "PUBLISHED"
  }
}
```

---

### 5️⃣ **ELIMINAR POST**

```
DELETE /api/v1/posts/:id
Authorization: Bearer <ACCESS_TOKEN>
```

**Response (200):**
```json
{
  "message": "Post eliminado"
}
```

---

## 👥 SOCIAL NETWORK

### 1️⃣ **SEGUIR USUARIO**

```
POST /api/v1/social/follow/:userId
Authorization: Bearer <ACCESS_TOKEN>
```

**Response (200):**
```json
{
  "following": true,
  "message": "Ahora sigues a este usuario"
}
```

---

### 2️⃣ **DAR LIKE A POST**

```
POST /api/v1/social/like
Authorization: Bearer <ACCESS_TOKEN>
```

**Request:**
```json
{
  "postId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "POST"
}
```

Tipos: `POST`, `COMMENT`

**Response (200):**
```json
{
  "liked": true,
  "likesCount": 46
}
```

---

### 3️⃣ **OBTENER FEED PERSONALIZADO**

```
GET /api/v1/social/feed?page=1&limit=20
Authorization: Bearer <ACCESS_TOKEN>
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "...",
      "title": "Post de autor que sigues",
      "author": {
        "username": "demo_author"
      },
      "viewCount": 500,
      "likesCount": 25,
      "createdAt": "2025-04-12T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "hasNext": true
  }
}
```

---

### 4️⃣ **PERFIL PÚBLICO DE USUARIO**

```
GET /api/v1/social/users/:username
```

**Response (200):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "demo_author",
    "displayName": "Demo Author",
    "bio": "Escritor de contenido de ejemplo",
    "avatarUrl": null,
    "coverUrl": null,
    "role": "AUTHOR",
    "createdAt": "2025-04-01T10:30:00Z",
    "_count": {
      "followers": 150,
      "following": 45,
      "posts": 12
    }
  }
}
```

---

### 5️⃣ **LISTAR SEGUIDORES**

```
GET /api/v1/social/users/:username/followers
```

**Response (200):**
```json
{
  "followers": [
    {
      "id": "...",
      "username": "usuario123",
      "displayName": "Nombre del Usuario",
      "avatarUrl": null
    }
  ]
}
```

---

## 💬 COMENTARIOS

### 1️⃣ **LISTAR COMENTARIOS**

```
GET /api/v1/comments/:postId?page=1&limit=50
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440100",
      "content": "Excelente post, muy útil!",
      "likesCount": 5,
      "createdAt": "2025-04-12T14:30:00Z",
      "author": {
        "id": "...",
        "username": "usuario123",
        "displayName": "Nombre del Usuario",
        "avatarUrl": null
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 12,
    "hasNext": false
  }
}
```

---

### 2️⃣ **CREAR COMENTARIO**

```
POST /api/v1/comments/:postId
Authorization: Bearer <ACCESS_TOKEN>
```

**Request:**
```json
{
  "content": "Excelente post, muy útil!",
  "parentId": null
}
```

**Response (201):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440100",
    "content": "Excelente post, muy útil!",
    "createdAt": "2025-04-13T14:30:00Z",
    "author": {
      "id": "...",
      "username": "usuario123"
    }
  }
}
```

---

### 3️⃣ **EDITAR COMENTARIO**

```
PATCH /api/v1/comments/:commentId
Authorization: Bearer <ACCESS_TOKEN>
```

**Request:**
```json
{
  "content": "Contenido actualizado"
}
```

**Response (200):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440100",
    "content": "Contenido actualizado"
  }
}
```

---

### 4️⃣ **ELIMINAR COMENTARIO**

```
DELETE /api/v1/comments/:commentId
Authorization: Bearer <ACCESS_TOKEN>
```

**Response (200):**
```json
{
  "message": "Comentario eliminado"
}
```

---

## 🔍 BÚSQUEDA

### **BUSCAR POSTS**

```
GET /api/v1/search/posts?q=typescript&limit=10
```

**Response (200):**
```json
{
  "results": [
    {
      "id": "...",
      "title": "Introducción a TypeScript",
      "slug": "introduccion-a-typescript",
      "excerpt": "..."
    }
  ],
  "total": 5
}
```

---

### **BUSCAR USUARIOS**

```
GET /api/v1/search/users?q=john&limit=10
```

**Response (200):**
```json
{
  "results": [
    {
      "id": "...",
      "username": "john_dev",
      "displayName": "John Developer",
      "avatarUrl": null
    }
  ],
  "total": 3
}
```

---

## 📊 ANALYTICS

### **ESTADÍSTICAS DE POST**

```
GET /api/v1/analytics/posts/:postId
```

**Response (200):**
```json
{
  "postId": "550e8400-e29b-41d4-a716-446655440000",
  "views": 1251,
  "likes": 45,
  "comments": 12,
  "shares": 8,
  "engagementRate": 4.8,
  "viewsLastDay": 150,
  "viewsLastWeek": 800,
  "topCountries": [
    {
      "country": "MX",
      "views": 600
    }
  ]
}
```

---

## 📁 MEDIA / ARCHIVOS

### **SUBIR ARCHIVO**

```
POST /api/v1/media/upload
Authorization: Bearer <ACCESS_TOKEN>
Content-Type: multipart/form-data
```

**Request Body:**
```
file: (archivo binario)
type: "image" | "video" | "document"
```

**Response (200):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440200",
    "url": "https://minio.example.com/uploads/image.jpg",
    "type": "image",
    "size": 25600,
    "uploadedAt": "2025-04-13T14:30:00Z"
  }
}
```

---

## 🔔 NOTIFICACIONES

### **LISTAR NOTIFICACIONES**

```
GET /api/v1/notifications?page=1&limit=20
Authorization: Bearer <ACCESS_TOKEN>
```

**Response (200):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440300",
      "type": "POST_LIKED",
      "message": "Tu post fue likeado",
      "read": false,
      "createdAt": "2025-04-13T14:30:00Z",
      "relatedId": "550e8400-e29b-41d4-a716-446655440000"
    }
  ]
}
```

---

### **MARCAR COMO LEÍDO**

```
PATCH /api/v1/notifications/:notificationId/read
Authorization: Bearer <ACCESS_TOKEN>
```

**Response (200):**
```json
{
  "read": true
}
```

---

### **MARCAR TODAS COMO LEÍDAS**

```
PATCH /api/v1/notifications/read-all
Authorization: Bearer <ACCESS_TOKEN>
```

**Response (200):**
```json
{
  "message": "Todas las notificaciones marcadas como leídas"
}
```

---

## ✅ HEALTH CHECK

### **VERIFICAR ESTADO DEL SERVIDOR**

```
GET /api/v1/health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2025-04-13T14:30:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

---

## 📊 MÉTRICAS (Prometheus)

```
GET /api/v1/metrics
```

Retorna métricas en formato Prometheus

---

## 🔑 INFORMACIÓN DE PRUEBAS

### **URLs de Servicios Internos**

```
API:           http://localhost:3000
PostgreSQL:    localhost:5432
Redis:         localhost:6379
MongoDB:       localhost:27017
Elasticsearch: localhost:9200
MinIO:         localhost:9000
pgAdmin:       http://localhost:5050
```

### **Credenciales de Prueba**

```
Usuarios preexistentes:
├─ Admin
│  ├─ Email:    admin@example.com
│  ├─ Password: Admin1234!
│  └─ Role:     SUPER_ADMIN
│
└─ Author
   ├─ Email:    author@example.com
   ├─ Password: Author1234!
   └─ Role:     AUTHOR

Base de datos:
├─ PostgreSQL
│  ├─ User:     cms_user
│  ├─ Password: AdminPass123
│  └─ Database: cms_db
│
├─ MongoDB
│  ├─ User:     cms_mongo
│  └─ Password: mongo_secure_pass_2024
│
├─ Redis
│  └─ Password: redis_secure_pass_2024
│
├─ MinIO
│  ├─ User:     cms_minio
│  └─ Password: minio_secure_pass_2024
│
└─ Elasticsearch
   ├─ User:     elastic
   └─ Password: elastic_secure_pass_2024
```

---

## 🛡️ HEADERS REQUERIDOS

Todas las requests deben incluir:

```
GET /api/v1/auth/me
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-Request-ID: opcional-para-tracking
```

---

## ⚠️ CÓDIGOS DE ERROR

| Código | Significado | Cuerpo |
|--------|-------------|--------|
| 200 | OK | ✅ Éxito |
| 201 | Created | ✅ Recurso creado |
| 400 | Bad Request | ❌ Parámetros inválidos |
| 401 | Unauthorized | ❌ Token inválido/expirado |
| 403 | Forbidden | ❌ Sin permisos suficientes |
| 404 | Not Found | ❌ Recurso no encontrado |
| 409 | Conflict | ❌ Recurso ya existe |
| 429 | Too Many Requests | ❌ Rate limit excedido |
| 500 | Internal Server Error | ❌ Error del servidor |

**Formato de error:**
```json
{
  "success": false,
  "error": {
    "message": "Descripción del error",
    "code": "ERROR_CODE",
    "statusCode": 400
  }
}
```

---

## 🔜 PRÓXIMAS IMPLEMENTACIONES

- [ ] WebSocket for real-time notifications
- [ ] GraphQL alternative endpoint
- [ ] Webhook integrations
- [ ] API Key authentication
- [ ] OAuth2/Google login
- [ ] Rate limiting per user tier
- [ ] Analytics dashboard API

---

## 📧 Contacto

Para questions o issues: **backend-team@example.com**

