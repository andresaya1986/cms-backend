# 🔴 Endpoints Sociales Requeridos - Backend

**Estado**: CRÍTICO - Bloqueando módulo social  
**Prioridad**: ALTA  
**Asignado a**: Equipo Backend  
**Fecha**: 24 Abril 2026

---

## Resumen Ejecutivo

El frontend tiene implementados todos los hooks y componentes sociales, pero **faltan 5 endpoints críticos en el backend** que bloquean el funcionamiento del módulo social.

**Status Actual:**
- ✅ Búsqueda de usuarios - IMPLEMENTADO (Elasticsearch)
- ✅ Sugerencias de usuarios - IMPLEMENTADO
- ✅ Notificaciones - IMPLEMENTADO (con Socket.io)
- ✅ Bookmarks - IMPLEMENTADO (Toggle + List)
- ✅ Reacciones - IMPLEMENTADO (7 tipos)

---

## 1. Buscar Usuarios (CRÍTICO)

### Endpoint Requerido
```http
GET /api/v1/social/search/users?q=juan&page=1&limit=20
Authorization: Bearer {accessToken}
```

### Query Parameters
- `q` (string): Término de búsqueda (username, displayName, bio)
- `page` (number): Página de resultados (default: 1)
- `limit` (number): Items por página, máximo 50 (default: 20)

### Response 200
```json
{
  "data": [
    {
      "id": "user-uuid",
      "username": "juan_dev",
      "displayName": "Juan Developer",
      "avatarUrl": "https://cdn.example.com/avatar.jpg",
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

### Nota sobre Implementación
**Recomendación**: Usar **Elasticsearch** para full-text search en usuarios (como se hace para posts). Permite:
- Búsqueda rápida en millones de usuarios
- Autocomplete
- Fuzzy matching
- Filtros por rol, fecha registro, etc.

---

## 2. Sugerencias de Usuarios (CRÍTICO)

### Endpoint Requerido
```http
GET /api/v1/social/suggestions/users?limit=10
Authorization: Bearer {accessToken}
```

### Query Parameters
- `limit` (number): Máximo usuarios sugeridos, máximo 50 (default: 10)

### Response 200
```json
{
  "data": [
    {
      "id": "user-uuid",
      "username": "suggested_user",
      "displayName": "Suggested User",
      "avatarUrl": "https://cdn.example.com/avatar.jpg",
      "bio": "Bio corta",
      "isFollowing": false,
      "mutualFollowers": 5,
      "mutualFollowerNames": ["user1", "user2", "user3"]
    }
  ],
  "limit": 10
}
```

### Lógica de Sugerencias
1. **Usuarios NO seguidos**
2. **Con mutuo followers** (gente que te sigue y sigue a ellos)
3. **Con mucho engagement** (posts populares, muchos followers)
4. **En el mismo campo** (si existe categoría/rol)
5. **Registrados recientemente** (para diversificar)

---

## 3. Notificaciones (CRÍTICO)

### Endpoint Requerido
```http
GET /api/v1/social/notifications?page=1&limit=20&unreadOnly=false
Authorization: Bearer {accessToken}
```

### Query Parameters
- `page` (number): Página de notificaciones (default: 1)
- `limit` (number): Items por página, máximo 50 (default: 20)
- `unreadOnly` (boolean): Solo notificaciones no leídas (default: false)

### Response 200
```json
{
  "data": [
    {
      "id": "notification-uuid",
      "userId": "target-user-id",
      "type": "FOLLOW",  // FOLLOW, LIKE, COMMENT, SHARE, MENTION, REPLY
      "actor": {
        "id": "actor-uuid",
        "username": "juan_dev",
        "displayName": "Juan Developer",
        "avatarUrl": "https://..."
      },
      "relatedPost": {
        "id": "post-uuid",
        "content": "Preview del post...",
        "slug": "post-slug"
      },
      "message": "Juan Developer te está siguiendo",
      "isRead": false,
      "createdAt": "2026-04-24T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 143,
    "unread": 12
  }
}
```

---

## 4. Reacciones a Posts (CRÍTICO)

### Endpoint: Crear/Actualizar Reacción

```http
POST /api/v1/social/react
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "targetId": "post-uuid",
  "targetType": "POST",  // POST | COMMENT
  "type": "LIKE"         // LIKE | LOVE | CARE | HAHA | WOW | SAD | ANGRY
}
```

### Response 201 (Nueva)
```json
{
  "id": "reaction-uuid",
  "type": "LIKE",
  "count": 12,
  "userReacted": true
}
```

### Response 200 (Actualizar)
```json
{
  "action": "updated",
  "oldType": "LIKE",
  "newType": "LOVE",
  "count": 12
}
```

---

## 5. Bookmarks (Guardar Posts) (IMPORTANTE)

### Endpoint: Toggle Bookmark

```http
POST /api/v1/social/bookmarks/:postId
Authorization: Bearer {accessToken}
```

### Response 200
```json
{
  "bookmarked": true,
  "message": "Post guardado"
}
```

### Endpoint: Obtener Bookmarks

```http
GET /api/v1/social/bookmarks?page=1&limit=20
Authorization: Bearer {accessToken}
```

### Response 200
```json
{
  "data": [
    {
      "id": "post-uuid",
      "title": "Título del post",
      "slug": "post-slug",
      "content": "...",
      "savedAt": "2026-04-22T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

---

## Endpoints que SÍ Funcionan ✅

Estos ya están implementados y funcionando:
- ✅ `GET /api/v1/social/search/users` - Búsqueda con Elasticsearch (Fuzzy matching)
- ✅ `GET /api/v1/social/suggestions/users` - Usuarios sugeridos (Mutual followers)
- ✅ `POST /api/v1/social/react` - Reacciones (7 tipos: LIKE, LOVE, CARE, HAHA, WOW, SAD, ANGRY)
- ✅ `POST /api/v1/social/bookmarks/:postId` - Guardar/quitar bookmarks
- ✅ `GET /api/v1/social/bookmarks` - Listar bookmarks del usuario
- ✅ `GET /api/v1/notifications` - Notificaciones con pagination
- ✅ `POST /api/v1/social/follow/:userId` - Seguir usuarios
- ✅ `GET /api/v1/social/users/:username/followers` - Obtener seguidores
- ✅ `GET /api/v1/social/users/:username/following` - Obtener seguidos
- ✅ `GET /api/v1/comments?postId=...` - Obtener comentarios

---

## Stack Recomendado para Implementación

### Para Búsqueda de Usuarios (Recomendación: Elasticsearch)

**Ventajas:**
- Full-text search rápido
- Autocomplete en tiempo real
- Fuzzy matching (buscar "juan" encuentra "juan", "jua", "jn")
- Agrupación por relevancia
- Escalable a millones de usuarios

**Alternativa Simple (si no hay Elasticsearch):**
```typescript
// Búsqueda SQL simple
WHERE username ILIKE $1 || '%' 
   OR display_name ILIKE $1 || '%'
   OR bio ILIKE $1 || '%'
ORDER BY followers_count DESC
LIMIT 50
```

### Para Sugerencias (SQL + Lógica)
```typescript
// Pseudocódigo
1. Obtener usuarios NO seguidos
2. Calcular "mutual followers" 
3. Ordenar por: engagement > mutuals > fecha registro
4. Limitar a 10-20
```

### Para Notificaciones (Tabla + Socket.io)
```typescript
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type VARCHAR(50),
  actor_id UUID REFERENCES users(id),
  related_post_id UUID REFERENCES posts(id),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP
);

// Trigger -> Socket.io broadcast cuando es creada
```

---

## Frontend Impact

**Estado Actual:**
- ❌ Página `/explore` - NO funciona (error 404 en búsqueda)
- ❌ Página `/network` - Funciona parcialmente (no hay sugerencias)
- ❌ Página `/notifications` - Error 500 en servidor
- ⚠️ Componente ReactionBar - No muestra reacciones

**Bloqueado Por:**
- 1. Búsqueda de usuarios
- 2. Sugerencias de usuarios
- 3. Notificaciones
- 4. Reacciones

---

## Timeline Estimado

- **Búsqueda (Elasticsearch)**: 2-3 horas
- **Búsqueda (SQL simple)**: 30 minutos
- **Sugerencias**: 1 hora
- **Notificaciones**: 1-2 horas
- **Reacciones**: 1 hora
- **Testing**: 1 hora

**Total**: 6-9 horas (o 2-3 horas con SQL simple)

---

## Documentación de Referencia

- **Social API Docs**: `SOCIAL_API_DOCUMENTATION.md`
- **Frontend Service**: `src/services/socialService.ts`
- **Hooks**: `src/hooks/useNotifications.ts`, etc.
- **Postman Collection**: `/md/CMS_Backend_Postman_Collection.json`
