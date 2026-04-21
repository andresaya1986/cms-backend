# Social API & Real-time WebSocket - Frontend Integration Guide

**Versión:** v1.0  
**Fecha:** 21 Abril 2026  
**Stack:** Express.js + TypeScript + PostgreSQL + Socket.io  
**Status:** ✅ Producción

---

## 📋 Tabla de Contenidos

1. [Overview](#overview)
2. [Autenticación](#autenticación)
3. [Features Implementadas](#features-implementadas)
4. [Endpoints por Categoría](#endpoints-por-categoría)
5. [WebSocket Real-time](#websocket-real-time)
6. [Tipos de Datos](#tipos-de-datos)
7. [Ejemplos de Uso](#ejemplos-de-uso)
8. [Integración en Frontend](#integración-en-frontend)

---

## Overview

### ¿Qué es esto?

Documentación completa de la **API Social** del CMS Backend - un sistema de redes sociales integrado con notificaciones en tiempo real via WebSocket.

### Features Incluidas

| # | Feature | Status | Endpoints | Real-time |
|---|---------|--------|-----------|-----------|
| 1 | Following/Followers | ✅ | 4 | ✅ |
| 2 | Advanced Reactions | ✅ | 3 | ✅ |
| 3 | Nested Comments | ✅ | 5 | ✅ |
| 4 | User Search | ✅ | 2 | ❌ |
| 5 | User Suggestions | ✅ | 1 | ❌ |
| 6 | Bookmarks | ✅ | 3 | ❌ |
| 7 | Share Posts | ✅ | 2 | ❌ |
| 8 | Mentions (@usuario) | ✅ | 3 | ✅ |
| 9 | Hashtags (#tema) | ✅ | 4 | ❌ |
| 10 | Trending | ✅ | incl. Hashtags | ❌ |
| 11 | Real-time WebSocket | ✅ | see WebSocket | ✅ |

### Base URL

```
HTTP: http://localhost:3000/api/v1
WebSocket: http://localhost:3000
```

### Rate Limiting

- Límite: **100 requests por 15 minutos** (desarrollo)
- Headers de respuesta:
  - `X-RateLimit-Limit: 100`
  - `X-RateLimit-Remaining: 45`
  - `X-RateLimit-Reset: 1645123456`

---

## Autenticación

### 🔐 Headers Requeridos

Todos los endpoints requieren autenticación JWT:

```bash
Authorization: Bearer {accessToken}
```

### 🎫 Tokens

- **Access Token**: 15 minutos de validez
- **Refresh Token**: 7 días de validez
- **2FA/OTP**: Soportado en login

### 🚀 Obtener Token

```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "otp": "123456" // opcional si tiene 2FA
}

Response:
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": { id, email, username, ... }
}
```

---

## Features Implementadas

### 1️⃣ Following / Followers System

**Descripción**: Seguir y ser seguido por otros usuarios.

**Endpoints**:
- `POST /social/follow/:userId` - Seguir usuario
- `POST /social/unfollow/:userId` - Dejar de seguir
- `GET /social/:userId/followers` - Lista de seguidores
- `GET /social/:userId/following` - Lista de seguidos

**Real-time Events**:
- `follower:gained` - Nuevo seguidor (emitido al usuario seguido)
- `follower:lost` - Seguidor perdido

---

### 2️⃣ Advanced Reactions System

**Descripción**: Reaccionar con 7 tipos de emojis a posts y comentarios.

**Tipos de Reacción**:
```typescript
enum ReactionType {
  LIKE = "LIKE",       // 👍
  LOVE = "LOVE",       // ❤️
  CARE = "CARE",       // 🤗
  HAHA = "HAHA",       // 😂
  WOW = "WOW",         // 😮
  SAD = "SAD",         // 😢
  ANGRY = "ANGRY"      // 😠
}
```

**Endpoints**:
- `POST /reactions` - Toggle reacción (create/update/delete)
- `GET /reactions?targetId=postId&targetType=POST` - Obtener reacciones
- `GET /reactions/stats?targetId=postId` - Estadísticas de reacciones

**Real-time Events**:
- `reaction:added` - Nueva reacción
- `reaction:removed` - Reacción removida
- `reaction:updated` - Reacción cambiada (LIKE → LOVE)
- `post:counters` - Contadores actualizados

---

### 3️⃣ Nested Comments

**Descripción**: Comentarios con replies (respuestas anidadas).

**Endpoints**:
- `POST /comments` - Crear comentario
- `GET /comments/:postId` - Obtener comentarios del post
- `PUT /comments/:commentId` - Editar comentario
- `DELETE /comments/:commentId` - Eliminar comentario
- `GET /comments/:commentId/replies` - Obtener replies

**Características**:
- ✅ Replies (parentId)
- ✅ Edición después de creación
- ✅ Soft delete (isDeleted flag)
- ✅ Cascade delete de replies al eliminar comentario padre
- ✅ Auto-parsing de @menciones y #hashtags

**Real-time Events**:
- `comment:added` - Nuevo comentario
- `comment:deleted` - Comentario eliminado
- `typing:start` - Usuario escribiendo
- `typing:stop` - Usuario dejó de escribir

---

### 4️⃣ User Search

**Descripción**: Buscar usuarios por username, displayName, o bio.

**Endpoints**:
- `GET /social/search?q=juan` - Buscar usuarios
- `GET /social/search/advanced?query=juan&limit=10&offset=0` - Búsqueda avanzada

**Query Parameters**:
- `q` (string): Término de búsqueda
- `limit` (number): Máximo 50, default 20
- `offset` (number): Pagination, default 0

**Response**:
```json
{
  "users": [
    {
      "id": "uuid",
      "username": "juan_dev",
      "displayName": "Juan Developer",
      "avatar": "https://...",
      "bio": "Developer and tech enthusiast",
      "isFollowing": false,
      "isFollowedBy": true,
      "followerCount": 42
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

### 5️⃣ User Suggestions

**Descripción**: Obtener sugerencias de usuarios a seguir.

**Endpoints**:
- `GET /social/suggestions?limit=10` - Sugerencias

**Algoritmo**:
- Usuarios no seguidos
- Que siguen a usuarios que tú sigues (amigos en común)
- Ordenados por número de amigos en común
- Excluye al usuario actual

---

### 6️⃣ Bookmarks (Guardar Posts)

**Descripción**: Guardar posts para leer después.

**Endpoints**:
- `POST /social/bookmarks/:postId` - Guardar/unsave post
- `GET /social/bookmarks?limit=20&offset=0` - Obtener posts guardados
- `DELETE /social/bookmarks/:postId` - Eliminar bookmark

**Características**:
- Toggle (POST es save/unsave)
- Paginación
- Soft delete

---

### 7️⃣ Share Posts

**Descripción**: Compartir posts a tu timeline con mensaje personal.

**Endpoints**:
- `POST /social/shares/:postId` - Compartir post
- `GET /posts/:postId/shares?limit=10` - Ver quién compartió

**Body**:
```json
{
  "message": "Esto es genial! 🚀" // opcional
}
```

---

### 8️⃣ Mentions (@username)

**Descripción**: Mencionar usuarios en posts y comentarios con @ + username.

**Endpoints**:
- `GET /social/mentions?postId=uuid` - Obtener menciones
- `GET /social/mentions/received?limit=20` - Menciones recibidas
- `POST /social/mentions/:mentionId/read` - Marcar mención como leída

**Parsing Automático**:
```
Texto: "Hola @juan_dev, ¿qué tal @maria_tech?"
→ Crea 2 Mention records automáticamente
→ Notifica a juan_dev y maria_tech
```

**Real-time Events**:
- `mention:new` - Fuiste mencionado

---

### 9️⃣ Hashtags (#tema)

**Descripción**: Marcar posts y comentarios con #hashtags para categorización y descubrimiento.

**Endpoints**:
- `GET /social/hashtags/search?query=dev` - Buscar hashtags
- `GET /social/hashtags/trending?limit=20` - Trending hashtags
- `GET /social/hashtags/:tagName?limit=10` - Posts con hashtag
- `GET /social/hashtags/:tagName/stats` - Estadísticas del hashtag

**Parsing Automático**:
```
Texto: "Amando #nodejs #javascript #typescript"
→ Crea 3 Hashtag records (o incrementa count)
→ Crea 3 HashtagPost associations
→ Calcula trending score
```

**Trending Algorithm**:
```
trendingScore = count * (1 + recentActivity * 0.1)
```

---

### 🔟 Real-time WebSocket

**Ver sección dedicada:** [WebSocket Real-time](#websocket-real-time)

---

## Endpoints por Categoría

### 👥 Following / Followers

```http
POST /api/v1/social/follow/:userId
Authorization: Bearer {token}

Response 200:
{
  "isFollowing": true,
  "followerCount": 43
}
```

```http
POST /api/v1/social/unfollow/:userId
Authorization: Bearer {token}

Response 200:
{
  "isFollowing": false,
  "followerCount": 42
}
```

```http
GET /api/v1/social/:userId/followers?limit=20&offset=0
Authorization: Bearer {token}

Response 200:
{
  "followers": [
    {
      "id": "uuid",
      "username": "follower1",
      "displayName": "User One",
      "avatar": "https://...",
      "isFollowedBy": true
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

```http
GET /api/v1/social/:userId/following?limit=20&offset=0
Authorization: Bearer {token}

Response: Similar estructura
```

---

### ❤️ Reactions

```http
POST /api/v1/reactions
Authorization: Bearer {token}
Content-Type: application/json

{
  "targetId": "post-uuid",
  "targetType": "POST",  // POST | COMMENT
  "type": "LIKE"         // LIKE | LOVE | CARE | HAHA | WOW | SAD | ANGRY
}

Response 201 (new):
{
  "id": "reaction-uuid",
  "type": "LIKE",
  "targetId": "post-uuid",
  "targetType": "POST",
  "userId": "user-uuid",
  "createdAt": "2026-04-21T12:00:00Z"
}

Response 200 (update/delete):
{
  "action": "updated|removed",
  "oldType": "LIKE",
  "newType": "LOVE" // null if removed
}
```

```http
GET /api/v1/reactions?targetId=post-uuid&targetType=POST&limit=20&offset=0
Authorization: Bearer {token}

Response 200:
{
  "reactions": [
    {
      "userId": "user1",
      "username": "juan",
      "type": "LIKE",
      "createdAt": "2026-04-21T12:00:00Z"
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

```http
GET /api/v1/reactions/stats?targetId=post-uuid&targetType=POST
Authorization: Bearer {token}

Response 200:
{
  "LIKE": 25,
  "LOVE": 12,
  "CARE": 5,
  "HAHA": 2,
  "WOW": 1,
  "SAD": 0,
  "ANGRY": 0,
  "total": 45,
  "userReaction": "LIKE" // null si usuario no reaccionó
}
```

---

### 💬 Comments

```http
POST /api/v1/comments
Authorization: Bearer {token}
Content-Type: application/json

{
  "postId": "post-uuid",
  "parentId": "comment-uuid",  // opcional para replies
  "content": "Excelente post! @juan_dev #amazing"
}

Response 201:
{
  "id": "comment-uuid",
  "postId": "post-uuid",
  "userId": "current-user",
  "username": "mi_usuario",
  "content": "Excelente post! @juan_dev #amazing",
  "createdAt": "2026-04-21T12:00:00Z",
  "updatedAt": null,
  "parentId": null,
  "mentions": ["juan_dev"],
  "hashtags": ["amazing"],
  "reactionsCount": 0,
  "repliesCount": 0
}
```

```http
GET /api/v1/comments/:postId?limit=20&offset=0&sort=newest
Authorization: Bearer {token}

Response 200:
{
  "comments": [ /* array de comentarios */ ],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

```http
PUT /api/v1/comments/:commentId
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Contenido actualizado"
}

Response 200:
{
  "id": "comment-uuid",
  "content": "Contenido actualizado",
  "updatedAt": "2026-04-21T12:05:00Z"
}
```

```http
DELETE /api/v1/comments/:commentId
Authorization: Bearer {token}

Response 200:
{
  "deleted": true,
  "repliesDeleted": 3
}
```

---

### 🔍 Search

```http
GET /api/v1/social/search?q=juan&limit=20&offset=0
Authorization: Bearer {token}

Response 200:
{
  "users": [
    {
      "id": "uuid",
      "username": "juan_dev",
      "displayName": "Juan Developer",
      "avatar": "https://...",
      "bio": "Developer and tech enthusiast",
      "isFollowing": false,
      "isFollowedBy": false,
      "followerCount": 42
    }
  ],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

---

### 💡 Suggestions

```http
GET /api/v1/social/suggestions?limit=10
Authorization: Bearer {token}

Response 200:
{
  "suggestions": [
    {
      "id": "uuid",
      "username": "suggested_user",
      "displayName": "User Name",
      "avatar": "https://...",
      "mutualFollowers": 5,
      "mutualFollowerNames": ["user1", "user2"]
    }
  ],
  "limit": 10
}
```

---

### 🔖 Bookmarks

```http
POST /api/v1/social/bookmarks/:postId
Authorization: Bearer {token}

Response 200:
{
  "isBookmarked": true
}
```

```http
GET /api/v1/social/bookmarks?limit=20&offset=0
Authorization: Bearer {token}

Response 200:
{
  "bookmarks": [
    {
      "id": "post-uuid",
      "title": "Post Title",
      "content": "Post content...",
      "author": { /* user object */ },
      "savedAt": "2026-04-21T10:00:00Z",
      "viewCount": 100,
      "reactionsCount": 25
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

---

### 📤 Shares

```http
POST /api/v1/social/shares/:postId
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "Esto es increíble! 🚀"  // opcional
}

Response 201:
{
  "id": "share-uuid",
  "postId": "post-uuid",
  "userId": "current-user",
  "message": "Esto es increíble! 🚀",
  "createdAt": "2026-04-21T12:00:00Z"
}
```

```http
GET /api/v1/posts/:postId/shares?limit=10&offset=0
Authorization: Bearer {token}

Response 200:
{
  "shares": [
    {
      "sharedBy": { id, username, displayName, avatar },
      "message": "personal message",
      "sharedAt": "2026-04-21T12:00:00Z"
    }
  ],
  "total": 8,
  "limit": 10
}
```

---

### @ Mentions

```http
GET /api/v1/social/mentions?postId=post-uuid&limit=20&offset=0
Authorization: Bearer {token}

Response 200:
{
  "mentions": [
    {
      "id": "mention-uuid",
      "mentionedUser": { id, username, displayName, avatar },
      "mentionedBy": { id, username, displayName },
      "postId": "post-uuid",
      "commentId": null,
      "type": "POST_MENTION",
      "read": false,
      "createdAt": "2026-04-21T12:00:00Z"
    }
  ],
  "total": 3,
  "limit": 20
}
```

```http
GET /api/v1/social/mentions/received?limit=20&offset=0
Authorization: Bearer {token}

Response 200:
{
  "mentions": [ /* lista de menciones recibidas */ ],
  "unreadCount": 3,
  "total": 25
}
```

---

### # Hashtags

```http
GET /api/v1/social/hashtags/search?query=dev&limit=20
Authorization: Bearer {token}

Response 200:
{
  "hashtags": [
    {
      "name": "developers",
      "slug": "developers",
      "count": 150,
      "trendingScore": 85.5,
      "trendingRank": 1
    }
  ],
  "total": 8
}
```

```http
GET /api/v1/social/hashtags/trending?limit=20
Authorization: Bearer {token}

Response 200:
{
  "trending": [
    {
      "rank": 1,
      "name": "nodejs",
      "slug": "nodejs",
      "count": 1200,
      "trendingScore": 950.0,
      "postsInLast24h": 45,
      "trend": "up"  // up | down | stable
    }
  ],
  "lastUpdated": "2026-04-21T12:00:00Z"
}
```

```http
GET /api/v1/social/hashtags/:tagName?limit=10&offset=0
Authorization: Bearer {token}

Response 200:
{
  "hashtag": {
    "name": "nodejs",
    "slug": "nodejs",
    "count": 1200,
    "trendingScore": 950.0,
    "createdAt": "2026-01-01T00:00:00Z"
  },
  "posts": [
    {
      "id": "post-uuid",
      "title": "Node.js best practices",
      "content": "...",
      "author": { /* user */ },
      "createdAt": "2026-04-21T10:00:00Z",
      "reactionsCount": 45
    }
  ],
  "total": 1200,
  "limit": 10
}
```

---

### 🔔 Notifications

```http
GET /api/v1/notifications?limit=20&offset=0
Authorization: Bearer {token}

Response 200:
{
  "notifications": [
    {
      "id": "notif-uuid",
      "type": "NEW_FOLLOWER",
      "title": "Nuevo seguidor",
      "body": "@juan_dev te sigue ahora",
      "data": { followerId, followerUsername, followerCount },
      "read": false,
      "createdAt": "2026-04-21T12:00:00Z"
    }
  ],
  "unreadCount": 5,
  "total": 47
}
```

```http
GET /api/v1/notifications/unread/count
Authorization: Bearer {token}

Response 200:
{
  "unreadCount": 5,
  "total": 47
}
```

```http
GET /api/v1/notifications/type/:type?limit=20&offset=0
Authorization: Bearer {token}

Response 200:
{
  "notifications": [ /* tipos: NEW_FOLLOWER, POST_LIKE, NEW_COMMENT, etc */ ],
  "total": 12
}
```

```http
PATCH /api/v1/notifications/:notificationId/read
Authorization: Bearer {token}

Response 200:
{
  "read": true,
  "readAt": "2026-04-21T12:05:00Z"
}
```

```http
PATCH /api/v1/notifications/read-all
Authorization: Bearer {token}

Response 200:
{
  "markedAsRead": 5,
  "timestamp": "2026-04-21T12:05:00Z"
}
```

```http
DELETE /api/v1/notifications/:notificationId
Authorization: Bearer {token}

Response 200:
{
  "deleted": true
}
```

```http
DELETE /api/v1/notifications/all/read
Authorization: Bearer {token}

Response 200:
{
  "deleted": 10,
  "timestamp": "2026-04-21T12:05:00Z"
}
```

---

## WebSocket Real-time

### 🔌 Conexión

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: localStorage.getItem('accessToken')
  }
});

socket.on('connect', () => console.log('✅ Conectado'));
socket.on('connect_error', (error) => console.error('❌', error));
socket.on('disconnect', () => console.log('⚠️ Desconectado'));
```

### 📬 Eventos de Notificaciones

```javascript
// Nueva notificación
socket.on('notification:new', (notification) => {
  // { id, type, title, body, data, createdAt }
});

// Notificación leída
socket.on('notification:read', ({ notificationId, readAt }) => {});

// Todas leídas
socket.on('notification:all-read', ({ count, timestamp }) => {});

// Notificación eliminada
socket.on('notification:deleted', ({ notificationId }) => {});

// Todas las leídas eliminadas
socket.on('notification:cleared', ({ count, timestamp }) => {});
```

### 👥 Eventos de Seguidores/Presencia

```javascript
// Nuevo seguidor
socket.on('follower:gained', (data) => {
  // { follower: {id, username}, followerCount, timestamp }
});

// Seguidor perdido
socket.on('follower:lost', ({ followerId, followerCount }) => {});

// Usuario online
socket.on('user:online', (data) => {
  // { userId, username, timestamp }
});

// Usuario offline
socket.on('user:offline', ({ userId, timestamp }) => {});
```

### ❤️ Eventos de Reacciones

```javascript
// Reacción agregada
socket.on('reaction:added', (data) => {
  // { userId, username, postId, type, timestamp }
});

// Reacción removida
socket.on('reaction:removed', (data) => {
  // { userId, postId, oldType, timestamp }
});

// Reacción actualizada
socket.on('reaction:updated', (data) => {
  // { userId, postId, oldType, newType, timestamp }
});

// Contadores del post actualizados
socket.on('post:counters', (data) => {
  // { postId, reactionsCount, commentsCount, sharesCount, bookmarksCount, viewCount }
});
```

### 💬 Eventos de Comentarios

```javascript
// Nuevo comentario
socket.on('comment:added', (data) => {
  // { userId, username, postId, commentId, timestamp }
});

// Comentario eliminado
socket.on('comment:deleted', (data) => {
  // { postId, commentId, repliesDeleted }
});

// Usuario escribiendo
socket.on('typing:start', (data) => {
  // { userId, username, postId }
});

socket.on('typing:stop', ({ userId, postId }) => {});
```

### @️ Menciones

```javascript
// Fuiste mencionado
socket.on('mention:new', (data) => {
  // { type, title, body, mentioningUser, postId, commentId, timestamp }
});
```

### 📍 Posts

```javascript
// Usuario viendo el post
socket.on('post:viewer:joined', (data) => {
  // { userId, username, postId, viewerCount }
});

// Usuario dejó el post
socket.on('post:viewer:left', (data) => {
  // { userId, postId, viewerCount }
});
```

### 📤 Emitir Eventos (Cliente → Servidor)

```javascript
// Marcar notificación leída
socket.emit('notification:mark-read', notificationId);

// Marcar todas leídas
socket.emit('notification:mark-all-read');

// Unirse a post (recibir actualizaciones)
socket.emit('join:post', postId);

// Salir de post
socket.emit('leave:post', postId);

// Escribiendo comentario
socket.emit('typing:start', { postId });
socket.emit('typing:stop', { postId });

// Ping (keep-alive)
socket.emit('ping');
socket.on('pong', () => {});
```

---

## Tipos de Datos

### User

```typescript
interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  website?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
  followerCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing?: boolean;        // agregado al buscar/sugerir
  isFollowedBy?: boolean;       // agregado al buscar/sugerir
  mutualFollowers?: number;     // agregado al sugerir
}
```

### Post

```typescript
interface Post {
  id: string;
  userId: string;
  title: string;
  content: string;
  media?: {
    type: 'image' | 'video' | 'document';
    url: string;
  }[];
  viewCount: number;
  reactionsCount: number;
  commentsCount: number;
  sharesCount: number;
  bookmarksCount: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: User;
  userReaction?: ReactionType;   // si user tiene reacción
  isBookmarked?: boolean;        // si user lo guardó
  isShared?: boolean;            // si user lo compartió
}
```

### Comment

```typescript
interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  parentId?: string;             // para replies
  createdAt: Date;
  updatedAt?: Date;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
  };
  reactionsCount: number;
  repliesCount: number;
  mentions: string[];            // usernames mencionados
  hashtags: string[];            // hashtags sin #
  userReaction?: ReactionType;
  replies?: Comment[];            // replies si expandido
}
```

### Reaction

```typescript
interface Reaction {
  id: string;
  userId: string;
  username: string;
  targetId: string;              // postId o commentId
  targetType: 'POST' | 'COMMENT';
  type: ReactionType;
  createdAt: Date;
}

enum ReactionType {
  LIKE = 'LIKE',
  LOVE = 'LOVE',
  CARE = 'CARE',
  HAHA = 'HAHA',
  WOW = 'WOW',
  SAD = 'SAD',
  ANGRY = 'ANGRY'
}
```

### Notification

```typescript
interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

enum NotificationType {
  NEW_FOLLOWER = 'NEW_FOLLOWER',
  POST_LIKE = 'POST_LIKE',
  POST_COMMENT = 'POST_COMMENT',
  COMMENT_LIKE = 'COMMENT_LIKE',
  COMMENT_REPLY = 'COMMENT_REPLY',
  POST_SHARE = 'POST_SHARE',
  POST_MENTION = 'POST_MENTION',
  COMMENT_MENTION = 'COMMENT_MENTION'
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
  trendingRank?: number;         // en top 20
  postsInLast24h?: number;       // para trending
  trend?: 'up' | 'down' | 'stable';
  createdAt: Date;
  updatedAt: Date;
}
```

### Mention

```typescript
interface Mention {
  id: string;
  mentionedUserId: string;
  postId?: string;
  commentId?: string;
  mentionedByUserId: string;
  createdAt: Date;
  mentionedUser?: User;
  mentionedBy?: User;
}
```

---

## Ejemplos de Uso

### Ejemplo 1: Seguir Usuario

```javascript
// Botón seguir
async function followUser(userId) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/v1/social/follow/${userId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const data = await response.json();
    console.log(`Siguiendo: ${data.isFollowing}`);
    updateFollowerCount(data.followerCount);
  } catch (error) {
    console.error('Error:', error);
  }
}

// WebSocket: escuchar si ganaste seguidor
socket.on('follower:gained', (data) => {
  showNotification(`${data.follower.username} te sigue!`);
  updateFollowerCount(data.followerCount);
});
```

### Ejemplo 2: Sistema de Reacciones

```javascript
// Agregar reacción
async function addReaction(postId, type) {
  const response = await fetch(
    'http://localhost:3000/api/v1/reactions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        targetId: postId,
        targetType: 'POST',
        type: type  // LIKE, LOVE, CARE, etc
      })
    }
  );
  
  return response.json();
}

// WebSocket: actualización en tiempo real
socket.on('reaction:added', (data) => {
  // Actualizar UI con la nueva reacción
  updateReactionsUI(data.postId, data.type);
});

socket.on('post:counters', (data) => {
  // Actualizar contadores
  updatePostCounters(data.postId, data.reactionsCount);
});
```

### Ejemplo 3: Comentarios con Menciones

```javascript
// Publicar comentario
async function postComment(postId, content, parentId = null) {
  const response = await fetch(
    'http://localhost:3000/api/v1/comments',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        postId,
        parentId,
        content  // "Hola @juan_dev, ¿qué tal?"
      })
    }
  );
  
  return response.json();
}

// El backend automáticamente:
// 1. Extrae @juan_dev
// 2. Crea Mention record
// 3. Notifica a juan_dev en tiempo real

socket.on('mention:new', (data) => {
  showNotification(`${data.mentioningUser.username} te mencionó`);
});

socket.on('comment:added', (data) => {
  addCommentToUI(data);
});
```

### Ejemplo 4: Búsqueda de Usuarios

```javascript
// Búsqueda con debounce
let searchTimeout;
const searchInput = document.querySelector('#user-search');

searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value;
  
  if (query.length < 2) return;
  
  searchTimeout = setTimeout(async () => {
    const response = await fetch(
      `http://localhost:3000/api/v1/social/search?q=${encodeURIComponent(query)}&limit=10`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );
    
    const data = await response.json();
    displaySearchResults(data.users);
  }, 300);
});

function displaySearchResults(users) {
  users.forEach(user => {
    const isFollowing = user.isFollowing;
    // Mostrar botón "Seguir" o "Siguiendo" basado en isFollowing
  });
}
```

### Ejemplo 5: Hashtags y Trending

```javascript
// Ver trending hashtags
async function loadTrendingHashtags() {
  const response = await fetch(
    'http://localhost:3000/api/v1/social/hashtags/trending?limit=10',
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );
  
  const data = await response.json();
  displayTrendingList(data.trending);
}

// Posts con hashtag
async function getPostsByHashtag(tagName) {
  const response = await fetch(
    `http://localhost:3000/api/v1/social/hashtags/${tagName}?limit=20`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );
  
  return response.json();
}

// Ver posts con parse automático de #hashtags
const content = "Amando estos #nodejs tips! #javascript #typescript";
// Automáticamente crea 3 Hashtag records y HashtagPost associations
```

### Ejemplo 6: Notificaciones en Tiempo Real

```javascript
class NotificationManager {
  constructor(socket) {
    this.socket = socket;
    this.notifications = [];
    this.setupListeners();
  }
  
  setupListeners() {
    this.socket.on('notification:new', (notif) => {
      this.notifications.unshift(notif);
      this.updateBadge();
      this.playSound();
      this.showToast(notif.title, notif.body);
    });
    
    this.socket.on('notification:read', ({ notificationId }) => {
      const notif = this.notifications.find(n => n.id === notificationId);
      if (notif) notif.read = true;
      this.updateBadge();
    });
    
    this.socket.on('follower:gained', (data) => {
      this.showToast(
        'Nuevo seguidor!',
        `${data.follower.username} te sigue`
      );
    });
  }
  
  updateBadge() {
    const unread = this.notifications.filter(n => !n.read).length;
    document.querySelector('.notification-badge').textContent = unread;
  }
  
  playSound() {
    new Audio('/sounds/notification.mp3').play().catch(() => {});
  }
  
  showToast(title, body) {
    // Implementar toast/snackbar
  }
  
  markAsRead(notificationId) {
    this.socket.emit('notification:mark-read', notificationId);
  }
}

// Uso
const notifManager = new NotificationManager(socket);
```

---

## Integración en Frontend

### Setup Inicial

```bash
npm install socket.io-client
```

### App.tsx

```typescript
import { io, Socket } from 'socket.io-client';

const App = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    
    const newSocket = io('http://localhost:3000', {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    newSocket.on('notification:new', (notif) => {
      setNotifications(prev => [notif, ...prev]);
    });

    newSocket.on('follower:gained', (data) => {
      showNotification(`${data.follower.username} te sigue!`);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <div>
      <Header notifications={notifications} socket={socket} />
      <Feed socket={socket} />
    </div>
  );
};
```

### Hooks Personalizados

```typescript
// useFollow.ts
const useFollow = () => {
  const follow = async (userId: string) => {
    const response = await fetch(
      `http://localhost:3000/api/v1/social/follow/${userId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        }
      }
    );
    return response.json();
  };

  return { follow };
};

// useReactions.ts
const useReactions = (postId: string) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const addReaction = async (type: ReactionType) => {
    const response = await fetch(
      'http://localhost:3000/api/v1/reactions',
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
    return response.json();
  };

  return { reactions, addReaction };
};

// useNotifications.ts
const useNotifications = (socket: Socket) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!socket) return;

    const fetchUnreadCount = async () => {
      const response = await fetch(
        'http://localhost:3000/api/v1/notifications/unread/count',
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );
      const data = await response.json();
      setUnreadCount(data.unreadCount);
    };

    socket.on('notification:new', () => {
      fetchUnreadCount();
    });

    fetchUnreadCount();
  }, [socket]);

  return { unreadCount };
};
```

### Componentes

```typescript
// FollowButton.tsx
const FollowButton = ({ userId, initialFollowing }: Props) => {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const { follow } = useFollow();

  const handleClick = async () => {
    try {
      const result = await follow(userId);
      setIsFollowing(result.isFollowing);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <button onClick={handleClick}>
      {isFollowing ? 'Siguiendo' : 'Seguir'}
    </button>
  );
};

// ReactionButtons.tsx
const ReactionButtons = ({ postId, userReaction }: Props) => {
  const { addReaction } = useReactions(postId);
  const reactionTypes = ['LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY'];

  return (
    <div className="reactions">
      {reactionTypes.map(type => (
        <button
          key={type}
          onClick={() => addReaction(type as ReactionType)}
          className={userReaction === type ? 'active' : ''}
        >
          {getEmojiForType(type)}
        </button>
      ))}
    </div>
  );
};

// CommentInput.tsx
const CommentInput = ({ postId, socket }: Props) => {
  const [content, setContent] = useState('');

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    
    // Emitir typing events
    if (e.target.value.length > 0) {
      socket?.emit('typing:start', { postId });
    } else {
      socket?.emit('typing:stop', { postId });
    }
  };

  const handleSubmit = async () => {
    const response = await fetch(
      'http://localhost:3000/api/v1/comments',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postId,
          content  // auto-parse @mentions y #hashtags
        })
      }
    );

    socket?.emit('typing:stop', { postId });
    setContent('');
    return response.json();
  };

  return (
    <div className="comment-input">
      <textarea
        value={content}
        onChange={handleChange}
        placeholder="Escribe un comentario... (Usa @ para mencionar, # para hashtags)"
      />
      <button onClick={handleSubmit}>Comentar</button>
    </div>
  );
};
```

---

## 📚 Recursos Adicionales

### Documentación Completa WebSocket
Ver: `REALTIME_WEBSOCKET_GUIDE.md`

### Rate Limiting
- Límite: 100 requests/15 minutos
- Headers: `X-RateLimit-*`
- Error: 429 Too Many Requests

### Error Handling

```typescript
// Responda consistentemente:
// 2xx - Success
// 4xx - Client error (validation, auth, not found)
// 5xx - Server error

// Ejemplo:
{
  "error": "VALIDATION_ERROR",
  "message": "El campo nombre es requerido",
  "statusCode": 400,
  "details": {
    "field": "nombre",
    "reason": "required"
  }
}
```

### Best Practices

1. **Autenticación**: Siempre incluir header `Authorization`
2. **Rate Limiting**: Implementar backoff exponencial
3. **WebSocket**: Subscribir a eventos relevantes, no todos
4. **Paginación**: Usar `limit` y `offset`, max limit 50
5. **Caché**: Cachear usuario actual, trending, sugerencias
6. **Error Handling**: Mostrar mensajes amigables al usuario
7. **Optimización**: Usar pagination

### Checklist de Integración

- [ ] Setup Socket.io con JWT auth
- [ ] Implementar useFollow hook
- [ ] Implementar useReactions hook
- [ ] Implementar useNotifications hook
- [ ] Componente FollowButton
- [ ] Componente ReactionButtons
- [ ] Componente CommentInput
- [ ] Componente NotificationBell
- [ ] Página de Followers/Following
- [ ] Página de Search
- [ ] Página de Trending
- [ ] Dashboard de Bookmarks
- [ ] Testing con Postman Collection

---

## 🔗 Links Útiles

- **Servidor**: http://localhost:3000
- **API Base**: http://localhost:3000/api/v1
- **WebSocket**: ws://localhost:3000
- **Postman Collection**: `CMS_Backend_Postman_Collection.json`
- **Swagger Docs**: http://localhost:3000/api/docs

---

## 📞 Soporte

Para preguntas sobre:
- **Endpoints**: Ver sección "Endpoints por Categoría"
- **WebSocket**: Ver `REALTIME_WEBSOCKET_GUIDE.md`
- **Tipos**: Ver sección "Tipos de Datos"
- **Ejemplos**: Ver sección "Ejemplos de Uso"

---

**Documento generado:** 21 Abril 2026  
**Última actualización:** Feature #11: Real-time WebSocket  
**Commits:** 79379f2, 4d3830c
