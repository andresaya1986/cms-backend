# 🎯 Endpoints Necesarios - Solicitud al Backend

**Fecha**: 23 Abril 2026  
**Solicitante**: Equipo Frontend  
**Prioridad**: ALTA  
**Estado**: ⏳ Pendiente Implementación

---

## 📋 Resumen

El módulo social necesita los siguientes **5 endpoints** que actualmente no están implementados en el backend. Esta es la especificación técnica exacta para que el backend los implemente.

---

## ✅ Endpoints Requeridos

### 1. Obtener Seguidores de un Usuario

**Endpoint:**
```
GET /api/v1/social/users/:username/followers?page=1&limit=20
Authorization: Bearer {accessToken}
```

**Parámetros:**
- `:username` - Username del usuario (en la URL)
- `page` - Número de página (query, default: 1)
- `limit` - Items por página (query, default: 20, máximo: 50)

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
      "isFollowing": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**Error 404:**
```json
{
  "error": "User not found",
  "statusCode": 404
}
```

---

### 2. Obtener Usuarios que Sigue (Following)

**Endpoint:**
```
GET /api/v1/social/users/:username/following?page=1&limit=20
Authorization: Bearer {accessToken}
```

**Parámetros:** (Idénticos a Followers)

**Response 200:** (Estructura idéntica a Followers)

---

### 3. Obtener Notificaciones

**Endpoint:**
```
GET /api/v1/notifications?page=1&limit=20&unreadOnly=false
Authorization: Bearer {accessToken}
```

**Parámetros:**
- `page` - Número de página (default: 1)
- `limit` - Items por página (default: 20, máximo: 50)
- `unreadOnly` - Filtrar solo no leídas (default: false)

**Response 200:**
```json
{
  "data": [
    {
      "id": "notification-uuid",
      "type": "NEW_FOLLOWER|LIKE|COMMENT|MENTION|SHARE",
      "title": "Nuevo seguidor",
      "body": "@juan_dev ahora te sigue",
      "actor": {
        "id": "user-uuid",
        "username": "juan_dev",
        "displayName": "Juan Dev",
        "avatarUrl": "https://cdn.example.com/avatar.jpg"
      },
      "isRead": false,
      "createdAt": "2026-04-22T14:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "unreadCount": 5
}
```

---

### 4. Contar Notificaciones No Leídas

**Endpoint:**
```
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

---

### 5. Marcar Notificación como Leída

**Endpoint:**
```
PATCH /api/v1/notifications/:id/read
Authorization: Bearer {accessToken}
```

**Body:**
```json
{
  "isRead": true
}
```

**Response 200:**
```json
{
  "id": "notification-uuid",
  "isRead": true
}
```

---

## 📊 Notas de Implementación

### Autenticación
- Todos los endpoints requieren **Bearer token válido**
- Usar el middleware de autenticación existente

### Paginación
- Seguir el patrón de respuesta existente
- Incluir campos: `page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage`

### Validaciones
- Username debe existir (retornar 404 si no existe)
- Limit máximo 50 items
- Offset debe estar dentro del rango

### Performance
- Usar indexes en DB para: `username`, `user_id`, `created_at`
- Considerar caché para followers/following (invalidar en follow/unfollow)

### Seguridad
- Solo el usuario autenticado puede ver sus propias notificaciones
- Followers/Following públicos pero requieren autenticación

---

## 🔗 Documentación de Referencia

Endpoint existentes que siguen el patrón:
- `GET /api/v1/social/search?q=...` - Búsqueda de usuarios
- `GET /api/v1/social/suggestions` - Sugerencias de usuarios
- `GET /api/v1/posts` - Obtener posts

---

## 📝 Ejemplo de Curl para Testing

```bash
# Obtener followers de un usuario
curl -X GET "http://localhost:3000/api/v1/social/users/juan_dev/followers?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Obtener notificaciones
curl -X GET "http://localhost:3000/api/v1/notifications?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Contar no leídas
curl -X GET "http://localhost:3000/api/v1/notifications/unread/count" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Marcar como leída
curl -X PATCH "http://localhost:3000/api/v1/notifications/{id}/read" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isRead": true}'
```

---

## 🚀 Próximos Pasos

**Una vez implementado en backend:**

1. ✅ El frontend automáticamente los consumirá
2. ✅ Las páginas `/network`, `/notifications` funcionarán correctamente
3. ✅ No hay cambios necesarios en el frontend

**Estimado de Esfuerzo Backend:**
- Followers/Following: ~30-45 min (son similares)
- Notificaciones (GET): ~30-45 min
- Marcar como leída: ~15 min
- Testing: ~30 min
- **Total: ~2-2.5 horas**

---

## ✉️ Contacto

**Dudas sobre especificación**: Revisar ejemplos en SOCIAL_API_DOCUMENTATION.md  
**Dudas sobre implementación**: Contactar equipo frontend
