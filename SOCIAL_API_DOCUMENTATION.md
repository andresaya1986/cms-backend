# 🌐 Social API - Documentación Completa para Frontend

**Versión:** v2.0  
**Última actualización:** 22 Abril 2026  
**Estado:** ✅ Producción  
**Desarrollador Backend:** Sistema Integrado  
**Stack:** Express.js + TypeScript + PostgreSQL + Socket.io + Redis  

---

## 📑 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Autenticación y Seguridad](#autenticación-y-seguridad)
3. [Sistema de Following](#sistema-de-following)
4. [Sistema de Reacciones](#sistema-de-reacciones)
5. [Sistema de Comentarios](#sistema-de-comentarios)
6. [Búsqueda y Descubrimiento](#búsqueda-y-descubrimiento)
7. [Bookmarks (Guardar Posts)](#bookmarks)
8. [Compartir Posts](#compartir-posts)
9. [Menciones (@username)](#menciones)
10. [Hashtags (#tema)](#hashtags)
11. [Notificaciones](#notificaciones)
12. [WebSocket Real-time](#websocket-real-time)
13. [Tipos de Datos](#tipos-de-datos)
14. [Ejemplos Prácticos](#ejemplos-prácticos)
15. [Guía de Integración](#guía-de-integración)

---

## Visión General

### ¿Qué es la Social API?

Sistema completo de red social integrado al CMS, permitiendo:
- ✅ Seguimiento de usuarios (follow/unfollow)
- ✅ Reacciones avanzadas (LIKE, LOVE, CARE, HAHA, WOW, SAD, ANGRY)
- ✅ Comentarios anidados con replies
- ✅ Búsqueda y sugerencias de usuarios
- ✅ Guardar posts para leer después
- ✅ Compartir posts con mensajes personales
- ✅ Menciones automáticas (@usuario)
- ✅ Hashtags con trending
- ✅ Notificaciones en tiempo real
- ✅ Presencia online/offline de usuarios

### URLs Base

```
HTTP API:  http://localhost:3000/api/v1
WebSocket: ws://localhost:3000 (socket.io)
Nginx:     http://localhost (puerto 80)
```

### Headers Requeridos

Todos los endpoints requieren autenticación (excepto donde se especifique):

```bash
Authorization: Bearer {accessToken}
Content-Type: application/json
```

### Códigos de Error Estándar

```json
{
  "error": "Mensaje descriptivo del error",
  "statusCode": 400,
  "timestamp": "2026-04-22T14:00:00Z"
}
```

| Código | Significado |
|--------|------------|
| 200 | ✅ Éxito |
| 201 | ✅ Recurso creado |
| 400 | ❌ Solicitud inválida |
| 401 | ❌ No autenticado |
| 403 | ❌ No autorizado |
| 404 | ❌ Recurso no encontrado |
| 500 | ❌ Error interno del servidor |

---

## Autenticación y Seguridad

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "usuario@example.com",
  "password": "contraseña123",
  "otp": "123456"  // Opcional si tiene 2FA
}
```

**Response 200:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "usuario@example.com",
    "username": "usuario_demo",
    "displayName": "Usuario Demo",
    "role": "USER",
    "emailVerified": true,
    "twoFactorEnabled": false
  }
}
```

### Tokens

- **Access Token**: Válido por **15 minutos**
- **Refresh Token**: Válido por **7 días**
- Almacenar tokens en **localStorage** o **sessionStorage**
- Incluir `Authorization: Bearer {token}` en todos los requests

### Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer {accessToken}

Response 200:
{
  "message": "Sesión cerrada correctamente"
}
```

---

## Sistema de Following

### Seguir a un Usuario

```http
POST /api/v1/social/follow/:userId
Authorization: Bearer {accessToken}
```

**Path Parameters:**
- `userId`: UUID del usuario a seguir

**Response 200:**
```json
{
  "following": true,
  "followerCount": 43,
  "message": "Ahora sigues a @juan_dev"
}
```

**Response 200 (Si ya lo seguías - toggle):**
```json
{
  "following": false,
  "followerCount": 42,
  "message": "Dejaste de seguir a @juan_dev"
}
```

### Obtener Seguidores

```http
GET /api/v1/social/users/:username/followers?page=1&limit=20
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `page`: Número de página (default: 1)
- `limit`: Items por página, máximo 50 (default: 20)

**Response 200:**
```json
{
  "data": [
    {
      "id": "follower-uuid",
      "username": "follower_user",
      "displayName": "Follower Name",
      "avatarUrl": "https://cdn.example.com/avatar.jpg",
      "bio": "Descripción corta",
      "followedAt": "2026-04-21T10:00:00Z",
      "isFollowing": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

### Obtener Usuarios Seguidos (Following)

```http
GET /api/v1/social/users/:username/following?page=1&limit=20
Authorization: Bearer {accessToken}
```

**Response:** Estructura idéntica a seguidores

### Verificar Estado de Follow

```http
GET /api/v1/social/follow-status/:userId
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "userId": "target-user-id",
  "isFollowing": true,
  "isFollowedBy": false,
  "followerCount": 43
}
```

---

## Sistema de Reacciones

### Crear/Actualizar/Eliminar Reacción

```http
POST /api/v1/social/react
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "targetId": "post-uuid-or-comment-uuid",
  "targetType": "POST",  // POST | COMMENT
  "type": "LIKE"         // LIKE | LOVE | CARE | HAHA | WOW | SAD | ANGRY
}
```

**Response 201 (Nueva reacción):**
```json
{
  "id": "reaction-uuid",
  "userId": "user-uuid",
  "username": "usuario_demo",
  "type": "LIKE",
  "targetId": "post-uuid",
  "targetType": "POST",
  "createdAt": "2026-04-22T14:00:00Z"
}
```

**Response 200 (Actualizar reacción):**
```json
{
  "action": "updated",
  "oldType": "LIKE",
  "newType": "LOVE",
  "targetId": "post-uuid"
}
```

**Response 200 (Eliminar reacción):**
```json
{
  "action": "removed",
  "type": "LIKE",
  "targetId": "post-uuid"
}
```

### Obtener Reacciones de un Post/Comentario

```http
GET /api/v1/social/reactions/:targetId?targetType=POST&limit=20&offset=0
```

**Query Parameters:**
- `targetType`: POST | COMMENT (default: POST)
- `limit`: Máximo 50 (default: 20)
- `offset`: Para paginación

**Response 200:**
```json
{
  "data": [
    {
      "userId": "user-uuid",
      "username": "usuario1",
      "displayName": "Usuario Uno",
      "avatarUrl": "https://...",
      "type": "LIKE",
      "createdAt": "2026-04-22T14:00:00Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0
  }
}
```

### Mi Reacción en un Post

```http
GET /api/v1/social/my-reaction/:targetId?targetType=POST
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "hasReacted": true,
  "type": "LOVE"  // null si no tienes reacción
}
```

### Estadísticas de Reacciones

```http
GET /api/v1/social/reactions/:targetId?action=stats&targetType=POST
```

**Response 200:**
```json
{
  "LIKE": 25,
  "LOVE": 12,
  "CARE": 5,
  "HAHA": 2,
  "WOW": 1,
  "SAD": 0,
  "ANGRY": 0,
  "total": 45,
  "userReaction": "LOVE"  // null si no reaccionaste
}
```

---

## Sistema de Comentarios

### Crear Comentario

```http
POST /api/v1/comments
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "postId": "post-uuid",
  "content": "Excelente artículo @juan_dev! #genial",
  "parentId": "parent-comment-uuid"  // Opcional para replies
}
```

**Response 201:**
```json
{
  "id": "comment-uuid",
  "postId": "post-uuid",
  "userId": "current-user-id",
  "username": "usuario_demo",
  "displayName": "Usuario Demo",
  "avatarUrl": "https://...",
  "content": "Excelente artículo @juan_dev! #genial",
  "parentId": null,
  "isDeleted": false,
  "reactionsCount": 0,
  "repliesCount": 0,
  "mentions": ["juan_dev"],
  "hashtags": ["genial"],
  "createdAt": "2026-04-22T14:00:00Z",
  "updatedAt": null
}
```

### Obtener Comentarios de un Post

```http
GET /api/v1/comments?postId=post-uuid&page=1&limit=50
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `postId`: UUID del post (requerido)
- `page`: Número de página (default: 1)
- `limit`: Items por página, máximo 100 (default: 50)

**Response 200:**
```json
{
  "data": [
    {
      "id": "comment-uuid",
      "postId": "post-uuid",
      "userId": "user-uuid",
      "username": "usuario_demo",
      "content": "Gran contenido!",
      "createdAt": "2026-04-22T14:00:00Z",
      "repliesCount": 2,
      "reactionsCount": 5,
      "replies": []  // Expandable
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

### Actualizar Comentario

```http
PUT /api/v1/comments/:commentId
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "content": "Contenido actualizado"
}
```

**Response 200:**
```json
{
  "id": "comment-uuid",
  "content": "Contenido actualizado",
  "updatedAt": "2026-04-22T14:05:00Z"
}
```

### Eliminar Comentario

```http
DELETE /api/v1/comments/:commentId
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "deleted": true,
  "repliesDeleted": 3,
  "message": "Comentario eliminado junto con 3 replies"
}
```

---

## Búsqueda y Descubrimiento

### Buscar Usuarios

```http
GET /api/v1/social/search/users?q=juan&page=1&limit=20&role=USER
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `q`: Término de búsqueda (busca en username, displayName, bio)
- `page`: Número de página
- `limit`: Máximo 50
- `role`: Filtro opcional (USER, ADMIN, SUPER_ADMIN)

**Response 200:**
```json
{
  "data": [
    {
      "id": "user-uuid",
      "username": "juan_dev",
      "displayName": "Juan Developer",
      "avatarUrl": "https://...",
      "bio": "Desarrollador fullstack",
      "createdAt": "2026-01-15T00:00:00Z",
      "isFollowing": false,
      "isFollowedBy": true,
      "_count": {
        "followers": 150,
        "following": 45,
        "posts": 23
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "query": "juan"
  }
}
```

### Sugerencias de Usuarios

```http
GET /api/v1/social/suggestions/users?limit=10
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `limit`: Máximo 50 (default: 10)

**Response 200:**
```json
{
  "data": [
    {
      "id": "user-uuid",
      "username": "suggested_user",
      "displayName": "Suggested User",
      "avatarUrl": "https://...",
      "bio": "Bio corta",
      "isFollowing": false,
      "mutualFollowers": 5,
      "mutualFollowerNames": ["user1", "user2", "user3"]
    }
  ],
  "limit": 10
}
```

### Perfil Público de Usuario

```http
GET /api/v1/social/users/:username
```

**Response 200:**
```json
{
  "data": {
    "id": "user-uuid",
    "username": "juan_dev",
    "displayName": "Juan Developer",
    "avatarUrl": "https://...",
    "bio": "Desarrollador fullstack",
    "websiteUrl": "https://juandev.com",
    "role": "USER",
    "createdAt": "2026-01-15T00:00:00Z",
    "isFollowing": true,
    "isFollowedBy": false,
    "_count": {
      "followers": 150,
      "following": 45,
      "posts": 23
    }
  }
}
```

### Actividad del Usuario

```http
GET /api/v1/social/users/:username/activity?page=1&limit=20&type=all
```

**Query Parameters:**
- `type`: all | posts | comments | interactions (default: all)
- `page`: Número de página
- `limit`: Máximo 50

**Response 200:**
```json
{
  "data": {
    "username": "juan_dev",
    "posts": [
      {
        "id": "post-uuid",
        "title": "Post Title",
        "createdAt": "2026-04-20T10:00:00Z"
      }
    ],
    "comments": [
      {
        "id": "comment-uuid",
        "content": "Comentario...",
        "createdAt": "2026-04-21T15:00:00Z"
      }
    ],
    "likes": [
      {
        "id": "reaction-uuid",
        "type": "LIKE",
        "targetId": "post-uuid"
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 120
  }
}
```

### Estadísticas del Usuario

```http
GET /api/v1/social/users/:username/stats
```

**Response 200:**
```json
{
  "username": "juan_dev",
  "stats": {
    "followersCount": 150,
    "followingCount": 45,
    "postsCount": 23,
    "commentsCount": 87,
    "totalReactionsReceived": 340,
    "totalReactionsGiven": 215,
    "bookmarksCount": 12,
    "sharesCount": 8
  },
  "engagement": {
    "avgReactionsPerPost": 14.8,
    "avgCommentsPerPost": 3.8,
    "lastPostDate": "2026-04-21T10:00:00Z"
  }
}
```

---

## Bookmarks

### Guardar/Unsave Post

```http
POST /api/v1/social/bookmarks/:postId
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "postId": "post-uuid",
  "isBookmarked": true,
  "message": "Post guardado"
}
```

**Response 200 (Si ya estaba guardado - toggle):**
```json
{
  "postId": "post-uuid",
  "isBookmarked": false,
  "message": "Post removido de guardados"
}
```

### Obtener Posts Guardados

```http
GET /api/v1/social/bookmarks?page=1&limit=10
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `page`: Número de página
- `limit`: Máximo 50

**Response 200:**
```json
{
  "data": [
    {
      "id": "post-uuid",
      "title": "Post Title",
      "content": "Post content preview...",
      "author": {
        "id": "author-uuid",
        "username": "author_name",
        "displayName": "Author Name",
        "avatarUrl": "https://..."
      },
      "publishedAt": "2026-04-20T10:00:00Z",
      "bookmarkedAt": "2026-04-21T14:00:00Z",
      "reactionsCount": 25,
      "commentsCount": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "pages": 5
  }
}
```

### Verificar si Post está Guardado

```http
GET /api/v1/social/bookmark-status/:postId
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "postId": "post-uuid",
  "isBookmarked": true,
  "bookmarkedAt": "2026-04-21T14:00:00Z"
}
```

### Posts Guardados de Otro Usuario

```http
GET /api/v1/social/users/:username/bookmarks?page=1&limit=10
Authorization: Bearer {accessToken}
```

**Response:** Similar a "Obtener Posts Guardados"

---

## Compartir Posts

### Compartir Post

```http
POST /api/v1/social/share
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "postId": "post-uuid",
  "message": "¡Esto es increíble! 🚀"  // Opcional
}
```

**Response 201:**
```json
{
  "shared": true,
  "message": "Compartiste 'Post Title'",
  "shareId": "share-uuid",
  "sharesCount": 8
}
```

### Obtener Posts Compartidos por Mí

```http
GET /api/v1/social/shares?page=1&limit=20
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "post-uuid",
      "title": "Post Title",
      "content": "Post content...",
      "author": {
        "id": "author-uuid",
        "username": "author_name",
        "displayName": "Author Name"
      },
      "publishedAt": "2026-04-20T10:00:00Z",
      "sharedAt": "2026-04-21T14:00:00Z",
      "shareMessage": "¡Esto es increíble! 🚀"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12
  }
}
```

### Obtener Personas que Compartieron un Post

```http
GET /api/v1/social/shares/:postId?page=1&limit=20
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "postId": "post-uuid",
  "data": [
    {
      "user": {
        "id": "user-uuid",
        "username": "user_name",
        "displayName": "User Name",
        "avatarUrl": "https://..."
      },
      "message": "¡Esto es increíble! 🚀",
      "sharedAt": "2026-04-21T14:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 8
  }
}
```

### Verificar si Compartí un Post

```http
GET /api/v1/social/share-status/:postId
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "postId": "post-uuid",
  "isShared": true,
  "sharedAt": "2026-04-21T14:00:00Z",
  "message": "¡Esto es increíble! 🚀"
}
```

---

## Menciones

### Mis Menciones Recibidas

```http
GET /api/v1/social/mentions?page=1&limit=20&read=all
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `page`: Número de página
- `limit`: Máximo 50
- `read`: all | unread | read (default: all)

**Response 200:**
```json
{
  "data": [
    {
      "id": "mention-uuid",
      "createdAt": "2026-04-22T14:00:00Z",
      "mentionedUser": {
        "id": "my-user-id",
        "username": "mi_usuario",
        "displayName": "Mi Usuario"
      },
      "mentionedByUser": {
        "id": "mentioner-uuid",
        "username": "juan_dev",
        "displayName": "Juan Developer"
      },
      "post": {
        "id": "post-uuid",
        "title": "Post Title",
        "slug": "post-title"
      },
      "comment": null,
      "context": {
        "id": "post-uuid",
        "title": "Post Title"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15
  }
}
```

### Menciones en un Post Específico

```http
GET /api/v1/social/post/:postId/mentions?page=1&limit=20
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "postId": "post-uuid",
  "postTitle": "Post Title",
  "data": [
    {
      "id": "mention-uuid",
      "createdAt": "2026-04-22T14:00:00Z",
      "mentionedByUser": {
        "id": "mentioner-uuid",
        "username": "juan_dev",
        "displayName": "Juan Developer"
      },
      "mentionedUser": {
        "id": "mentioned-uuid",
        "username": "mentioned_user",
        "displayName": "Mentioned User"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5
  }
}
```

### Menciones que Hice en Posts de Otro Usuario

```http
GET /api/v1/social/mentions/:username?page=1&limit=10
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "user": { "username": "juan_dev" },
  "data": [
    {
      "id": "mention-uuid",
      "createdAt": "2026-04-22T14:00:00Z",
      "mentionedUser": {
        "id": "user-uuid",
        "username": "mentioned_user",
        "displayName": "Mentioned User"
      },
      "post": {
        "id": "post-uuid",
        "title": "Post Title",
        "slug": "post-title"
      },
      "comment": null,
      "context": { /* contexto del post */ }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25
  }
}
```

---

## Hashtags

### Buscar Hashtags

```http
GET /api/v1/social/hashtags/search?q=nodejs&limit=20
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `q`: Término de búsqueda
- `limit`: Máximo 50

**Response 200:**
```json
{
  "data": [
    {
      "name": "nodejs",
      "slug": "nodejs",
      "count": 450,
      "trendingScore": 85.5,
      "createdAt": "2025-06-15T00:00:00Z"
    }
  ],
  "total": 3
}
```

### Hashtags Trending

```http
GET /api/v1/social/hashtags/trending?limit=20
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "hashtag-uuid",
      "name": "javascript",
      "slug": "javascript",
      "count": 1200,
      "trendingScore": 950.0,
      "createdAt": "2025-01-01T00:00:00Z",
      "_count": {
        "posts": 1200,
        "comments": 450
      }
    }
  ],
  "pagination": {
    "limit": 20,
    "total": 8
  }
}
```

### Posts con Hashtag Específico

```http
GET /api/v1/social/hashtags/:tagName?page=1&limit=20
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "data": {
    "hashtag": {
      "name": "javascript",
      "slug": "javascript",
      "count": 1200,
      "trendingScore": 950.0,
      "createdAt": "2025-01-01T00:00:00Z"
    },
    "recentPosts": [
      {
        "id": "post-uuid",
        "title": "JS Best Practices",
        "slug": "js-best-practices"
      }
    ]
  }
}
```

---

## Notificaciones

### Obtener Notificaciones

```http
GET /api/v1/notifications?page=1&limit=20&unreadOnly=false
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `page`: Número de página
- `limit`: Máximo 50
- `unreadOnly`: true para solo no leídas

**Response 200:**
```json
{
  "data": [
    {
      "id": "notification-uuid",
      "type": "NEW_FOLLOWER",
      "title": "Nuevo seguidor",
      "body": "@juan_dev ahora te sigue",
      "data": {
        "followerId": "user-uuid",
        "followerUsername": "juan_dev",
        "followerCount": 150
      },
      "read": false,
      "createdAt": "2026-04-22T14:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "unreadCount": 5
  }
}
```

### Contar No Leídas

```http
GET /api/v1/notifications/unread/count
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "unreadCount": 5,
  "total": 47
}
```

### Marcar como Leída

```http
PATCH /api/v1/notifications/:notificationId/read
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "id": "notification-uuid",
  "read": true,
  "readAt": "2026-04-22T14:05:00Z"
}
```

### Marcar Todas como Leídas

```http
PATCH /api/v1/notifications/read-all
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "markedAsRead": 5,
  "timestamp": "2026-04-22T14:05:00Z"
}
```

### Eliminar Notificación

```http
DELETE /api/v1/notifications/:notificationId
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "deleted": true,
  "id": "notification-uuid"
}
```

### Eliminar Todas las Leídas

```http
DELETE /api/v1/notifications/all/read
Authorization: Bearer {accessToken}
```

**Response 200:**
```json
{
  "deleted": 10,
  "timestamp": "2026-04-22T14:05:00Z"
}
```

---

## WebSocket Real-time

### Conexión Inicial

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: localStorage.getItem('accessToken')
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Eventos de conexión
socket.on('connect', () => {
  console.log('✅ Conectado al servidor');
});

socket.on('disconnect', () => {
  console.log('⚠️ Desconectado');
});

socket.on('connect_error', (error) => {
  console.error('❌ Error de conexión:', error);
});
```

### Eventos Recibidos (Servidor → Cliente)

#### 📬 Notificaciones

```javascript
// Nueva notificación
socket.on('notification:new', (notification) => {
  console.log('Nueva notificación:', notification);
  // {
  //   id, type, title, body, data, createdAt
  // }
});

// Notificación leída
socket.on('notification:read', ({ notificationId, readAt }) => {});

// Todas leídas
socket.on('notification:all-read', ({ count, timestamp }) => {});

// Eliminada
socket.on('notification:deleted', ({ notificationId }) => {});

// Todas las leídas eliminadas
socket.on('notification:cleared', ({ count, timestamp }) => {});
```

#### 👥 Seguidores y Presencia

```javascript
// Nuevo seguidor
socket.on('follower:gained', (data) => {
  // { follower: {id, username}, followerCount, timestamp }
  updateFollowerCount(data.followerCount);
  showNotification(`${data.follower.username} te sigue!`);
});

// Seguidor perdido
socket.on('follower:lost', ({ followerId, followerCount, timestamp }) => {
  updateFollowerCount(followerCount);
});

// Usuario online
socket.on('user:online', (data) => {
  // { userId, username, timestamp }
  markUserAsOnline(data.userId);
});

// Usuario offline
socket.on('user:offline', ({ userId, timestamp }) => {
  markUserAsOffline(userId);
});
```

#### ❤️ Reacciones

```javascript
// Reacción agregada
socket.on('reaction:added', (data) => {
  // { userId, username, targetId, type, timestamp }
  updateReactionUI(data.targetId, data.type, 'add');
});

// Reacción removida
socket.on('reaction:removed', (data) => {
  // { userId, targetId, oldType, timestamp }
  updateReactionUI(data.targetId, data.oldType, 'remove');
});

// Reacción actualizada
socket.on('reaction:updated', (data) => {
  // { userId, targetId, oldType, newType, timestamp }
  updateReactionUI(data.targetId, data.oldType, data.newType);
});

// Contadores del post actualizados
socket.on('post:counters', (data) => {
  // { postId, reactionsCount, commentsCount, sharesCount, bookmarksCount }
  updatePostCounters(data.postId, data);
});
```

#### 💬 Comentarios

```javascript
// Nuevo comentario
socket.on('comment:added', (data) => {
  // { userId, username, postId, commentId, content, timestamp }
  addCommentToUI(data);
});

// Comentario eliminado
socket.on('comment:deleted', (data) => {
  // { postId, commentId, repliesDeleted }
  removeCommentFromUI(data.commentId);
});

// Usuario escribiendo
socket.on('typing:start', (data) => {
  // { userId, username, postId }
  showTypingIndicator(data.username, data.postId);
});

socket.on('typing:stop', ({ userId, postId }) => {
  hideTypingIndicator(userId, postId);
});
```

#### @ Menciones

```javascript
// Fuiste mencionado
socket.on('mention:new', (data) => {
  // { type, title, body, mentioningUser, postId, commentId, timestamp }
  showNotification(`${data.mentioningUser.username} te mencionó`);
});
```

#### 📍 Posts

```javascript
// Usuario viendo el post
socket.on('post:viewer:joined', (data) => {
  // { userId, username, postId, viewerCount }
  updateViewerCount(data.postId, data.viewerCount);
});

// Usuario dejó el post
socket.on('post:viewer:left', (data) => {
  // { userId, postId, viewerCount }
  updateViewerCount(data.postId, data.viewerCount);
});
```

### Eventos Emitidos (Cliente → Servidor)

```javascript
// Unirse a un post
socket.emit('join:post', postId);

// Salir de un post
socket.emit('leave:post', postId);

// Escribiendo comentario
socket.emit('typing:start', { postId });
socket.emit('typing:stop', { postId });

// Marcar notificación leída
socket.emit('notification:mark-read', notificationId);

// Marcar todas leídas
socket.emit('notification:mark-all-read');

// Keep-alive
socket.emit('ping');
socket.on('pong', () => {
  console.log('Pong!');
});
```

---

## Tipos de Datos

### User

```typescript
interface User {
  id: string;                    // UUID
  email: string;
  username: string;              // Único, lowercase
  displayName: string;           // Nombre visible
  avatarUrl?: string;            // URL de avatar
  bio?: string;                  // Biografía (máx 500 chars)
  websiteUrl?: string;           // Website personal
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: Date;
  updatedAt: Date;
  
  // Campos agregados dinámicamente
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  mutualFollowers?: number;
  _count?: {
    followers: number;
    following: number;
    posts: number;
    comments: number;
  };
}
```

### Post

```typescript
interface Post {
  id: string;                    // UUID
  userId: string;
  title: string;
  content: string;
  slug: string;
  excerpt?: string;
  featuredImage?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  visibility: 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
  viewCount: number;
  reactionsCount: number;
  commentsCount: number;
  sharesCount: number;
  bookmarksCount: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Campos agregados
  author?: User;
  userReaction?: ReactionType;
  isBookmarked?: boolean;
  isShared?: boolean;
  categories?: Category[];
  tags?: Tag[];
}
```

### Comment

```typescript
interface Comment {
  id: string;                    // UUID
  postId: string;
  userId: string;
  content: string;
  parentId?: string;             // Para replies
  isDeleted: boolean;
  createdAt: Date;
  updatedAt?: Date;
  
  // Agregados
  author: User;
  reactionsCount: number;
  repliesCount: number;
  mentions: string[];            // usernames sin @
  hashtags: string[];            // tags sin #
  userReaction?: ReactionType;
  replies?: Comment[];
}
```

### Reaction

```typescript
type ReactionType = 'LIKE' | 'LOVE' | 'CARE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY';

interface Reaction {
  id: string;
  userId: string;
  username: string;
  targetId: string;              // postId o commentId
  targetType: 'POST' | 'COMMENT';
  type: ReactionType;
  createdAt: Date;
}
```

### Notification

```typescript
type NotificationType = 
  | 'NEW_FOLLOWER'
  | 'POST_LIKE'
  | 'POST_COMMENT'
  | 'COMMENT_LIKE'
  | 'COMMENT_REPLY'
  | 'POST_SHARE'
  | 'POST_MENTION'
  | 'COMMENT_MENTION';

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: {
    followerId?: string;
    postId?: string;
    commentId?: string;
    mentioningUser?: { id, username };
    [key: string]: any;
  };
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}
```

### Hashtag

```typescript
interface Hashtag {
  id: string;
  name: string;                  // sin #
  slug: string;
  count: number;                 // posts con este tag
  trendingScore: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Agregados
  _count?: {
    posts: number;
    comments: number;
  };
}
```

### Mention

```typescript
interface Mention {
  id: string;
  mentionedUserId: string;
  mentionedByUserId: string;
  postId?: string;
  commentId?: string;
  createdAt: Date;
  
  // Agregados
  mentionedUser?: User;
  mentionedByUser?: User;
  post?: { id, title, slug };
  comment?: { id, content };
}
```

---

## Ejemplos Prácticos

### Ejemplo 1: Sistema de Seguimiento

```typescript
// Component: ProfileHeader.tsx
import { useEffect, useState } from 'react';

export const ProfileHeader = ({ userId }) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  const handleFollow = async () => {
    try {
      const response = await fetch(
        `http://localhost:3000/api/v1/social/follow/${userId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      setIsFollowing(data.following);
      setFollowerCount(data.followerCount);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div>
      <button 
        onClick={handleFollow}
        className={isFollowing ? 'btn-following' : 'btn-follow'}
      >
        {isFollowing ? 'Siguiendo' : 'Seguir'}
      </button>
      <span>{followerCount} seguidores</span>
    </div>
  );
};
```

### Ejemplo 2: Sistema de Reacciones

```typescript
// Component: ReactionButtons.tsx
import { Socket } from 'socket.io-client';

interface Props {
  postId: string;
  socket: Socket;
}

const ReactionButtons = ({ postId, socket }: Props) => {
  const reactionTypes = ['LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY'] as const;
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // Cargar reacciones iniciales
    fetchReactions();
    
    // Escuchar actualizaciones en tiempo real
    socket.on('reaction:added', (data) => {
      if (data.targetId === postId) {
        updateReactionUI(data);
      }
    });
    
    return () => {
      socket.off('reaction:added');
    };
  }, [postId]);

  const handleReaction = async (type: string) => {
    try {
      const response = await fetch(
        'http://localhost:3000/api/v1/social/react',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            targetId: postId,
            targetType: 'POST',
            type
          })
        }
      );
      
      const data = await response.json();
      if (data.action === 'updated' || data.action === 'removed') {
        setUserReaction(data.newType || null);
      }
    } catch (error) {
      console.error('Error en reacción:', error);
    }
  };

  return (
    <div className="reactions">
      {reactionTypes.map(type => (
        <button
          key={type}
          onClick={() => handleReaction(type)}
          className={userReaction === type ? 'active' : ''}
        >
          {getEmojiForType(type)} {reactionCounts[type] || 0}
        </button>
      ))}
    </div>
  );
};
```

### Ejemplo 3: Feed en Tiempo Real

```typescript
// Component: Feed.tsx
import { Socket } from 'socket.io-client';

interface FeedProps {
  socket: Socket;
}

export const Feed = ({ socket }: FeedProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFeed();
    setupRealtimeListeners();
    
    return () => {
      cleanupListeners();
    };
  }, []);

  const setupRealtimeListeners = () => {
    // Actualización de contadores
    socket.on('post:counters', (data) => {
      setPosts(prev => prev.map(post => 
        post.id === data.postId 
          ? { ...post, ...data }
          : post
      ));
    });

    // Nuevo comentario
    socket.on('comment:added', (data) => {
      setPosts(prev => prev.map(post =>
        post.id === data.postId
          ? { ...post, commentsCount: post.commentsCount + 1 }
          : post
      ));
    });

    // Nueva reacción
    socket.on('reaction:added', (data) => {
      setPosts(prev => prev.map(post =>
        post.id === data.targetId
          ? { ...post, reactionsCount: post.reactionsCount + 1 }
          : post
      ));
    });
  };

  const cleanupListeners = () => {
    socket.off('post:counters');
    socket.off('comment:added');
    socket.off('reaction:added');
  };

  return (
    <div className="feed">
      {posts.map(post => (
        <PostCard key={post.id} post={post} socket={socket} />
      ))}
    </div>
  );
};
```

### Ejemplo 4: Notificaciones

```typescript
// Hook: useNotifications.ts
import { Socket } from 'socket.io-client';

export const useNotifications = (socket: Socket) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
    
    socket.on('notification:new', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    socket.on('notification:read', ({ notificationId }) => {
      setNotifications(prev => prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    });

    socket.on('follower:gained', (data) => {
      showNotification({
        title: 'Nuevo seguidor',
        body: `${data.follower.username} te sigue`,
        icon: data.follower.avatarUrl
      });
    });

    return () => {
      socket.off('notification:new');
      socket.off('notification:read');
      socket.off('follower:gained');
    };
  }, [socket]);

  const markAsRead = (notificationId: string) => {
    socket.emit('notification:mark-read', notificationId);
  };

  return { notifications, unreadCount, markAsRead };
};
```

---

## Guía de Integración

### 1. Instalación de Dependencias

```bash
npm install socket.io-client axios zustand @tanstack/react-query
```

### 2. Setup Inicial

```typescript
// lib/api.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000
});

// Interceptor para agregar token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejo de errores
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Redirigir a login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 3. Context para Socket.io

```typescript
// context/SocketContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const newSocket = io('http://localhost:3000', {
      auth: { token },
      reconnection: true
    });

    newSocket.on('connect', () => {
      console.log('✅ Conectado');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const socket = useContext(SocketContext);
  if (!socket) throw new Error('useSocket debe usarse dentro de SocketProvider');
  return socket;
};
```

### 4. Estructura de Carpetas Recomendada

```
src/
  api/
    auth.ts
    social.ts
    posts.ts
    comments.ts
    notifications.ts
  hooks/
    useFollow.ts
    useReactions.ts
    useNotifications.ts
    useSearch.ts
  context/
    SocketContext.tsx
    AuthContext.tsx
  components/
    Social/
      FollowButton.tsx
      ReactionButtons.tsx
      PostCard.tsx
      CommentSection.tsx
    Notifications/
      NotificationBell.tsx
      NotificationList.tsx
    Search/
      UserSearch.tsx
  pages/
    Profile.tsx
    Feed.tsx
    Explore.tsx
```

### 5. Variables de Entorno

```env
REACT_APP_API_URL=http://localhost:3000/api/v1
REACT_APP_SOCKET_URL=http://localhost:3000
REACT_APP_ENV=development
```

---

## Tips para Developers

### Rate Limiting
- Máximo 100 requests por 15 minutos
- Implementar debounce en búsquedas
- Usar cache local para datos no críticos

### Performance
- Lazy load notificaciones
- Virtualizar listas largas (100+ items)
- Implementar pagination siempre que sea posible
- Usar WebSocket para actualizaciones en tiempo real

### Errores Comunes
- ❌ Olvidar token en requests autenticados
- ❌ No manejar desconexiones de WebSocket
- ❌ Hacer polling en lugar de usar WebSocket
- ❌ No validar input del usuario antes de enviar

### Best Practices
- ✅ Usar React Query para caché de datos
- ✅ Implementar error boundaries
- ✅ Mostrar loading states
- ✅ Validar respuestas del servidor
- ✅ Implementar retry logic

---

## Soporte y Contacto

**Email:** tech@example.com  
**Slack:** #backend-api  
**Docs:** /docs  
**Status:** status.example.com  

---

**Última revisión:** 22 de Abril 2026  
**Siguiente actualización:** 29 de Abril 2026
