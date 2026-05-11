# 🔥 WebSocket - Ejemplos Prácticos de Backend

## Cómo Funciona en 2 Minutos

```
┌─────────────────────────────────────────────────────────────────┐
│ CLIENTE (Frontend)          SERVIDOR (Backend)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Conecta con JWT                                                │
│  ─────────────────────→  Valida token                          │
│                           ↓                                     │
│                         Se une a: user:userId                   │
│                                                                  │
│  Emite evento              Recibe y procesa                      │
│  join:post ───────────→    Guarda en BD                         │
│                            ↓                                    │
│  Recibe evento             Emite a otros                        │
│  ←────────── reaction:added                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Ejemplo 1: Crear Comentario (Lo Más Común)

### 📝 Backend - Endpoint POST

```typescript
// 📁 src/modules/comments/comments.routes.ts

router.post('/:postId/comments', authenticate, async (req: Request, res) => {
  const io = req.app.get('io');  // ← PASO 1: Obtener instancia de Socket.io
  const { postId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  try {
    // PASO 2: Guardar en base de datos
    const comment = await prisma.comment.create({
      data: {
        postId,
        userId,
        content,
      },
      include: {
        author: {
          select: { id: true, username: true, avatarUrl: true },
        },
      },
    });

    // PASO 3: 🔴 EMITIR EVENTO en tiempo real
    // Todos los clientes viendo este post recibirán:
    io.to(`post:${postId}`).emit('comment:added', {
      id: comment.id,
      postId,
      author: {
        id: comment.author.id,
        username: comment.author.username,
        avatarUrl: comment.author.avatarUrl,
      },
      content: comment.content,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      // Contador de reacciones
      _count: {
        reactions: 0,
      },
    });

    // PASO 4: Responder al cliente REST
    return res.status(201).json({
      success: true,
      comment,
      message: 'Comentario creado',
    });
  } catch (error) {
    logger.error({ error, postId }, 'Error creating comment');
    return res.status(500).json({
      success: false,
      error: 'Error al crear comentario',
    });
  }
});
```

### 🔵 Frontend - Recibir Evento

```typescript
// 📱 React Component

useEffect(() => {
  // 1. Conectar a Socket.io
  const socket = io('http://localhost:3000', {
    auth: { token: localStorage.getItem('accessToken') }
  });

  // 2. Unirse a la sala del post
  socket.emit('join:post', postId);

  // 3. Escuchar nuevo comentario
  socket.on('comment:added', (newComment) => {
    console.log('💬 Nuevo comentario:', newComment);
    setComments(prev => [newComment, ...prev]);
  });

  return () => {
    socket.emit('leave:post', postId);
    socket.disconnect();
  };
}, [postId]);
```

### 📋 Resumen del Flujo

```
Frontend hace POST /comments  →  Backend crea comentario
                               ↓
                     Emite evento WebSocket
                               ↓
     Todos viendo el post recibirán actualización automática
     Sin necesidad de hacer refresh o poll
```

---

## Ejemplo 2: Reacción a Post (Con Notificación Privada)

### 📝 Backend

```typescript
// 📁 src/modules/social/social.routes.ts

router.post('/react', authenticate, async (req: Request, res) => {
  const io = req.app.get('io');
  const { postId, type } = req.body;  // type: LIKE, LOVE, CARE, etc
  const userId = req.user.id;

  try {
    // PASO 1: Guardar reacción
    const reaction = await prisma.reaction.create({
      data: {
        postId,
        userId,
        type,
      },
      include: {
        user: { select: { username: true } },
      },
    });

    // PASO 2: Emitir a todos viendo este post
    io.to(`post:${postId}`).emit('reaction:added', {
      userId,
      username: reaction.user.username,
      postId,
      type,
      timestamp: new Date(),
    });

    // PASO 3: Obtener dueño del post
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    // PASO 4: Si no es el propio autor, notificar privadamente
    if (post && post.authorId !== userId) {
      io.to(`user:${post.authorId}`).emit('notification:new', {
        id: randomUUID(),
        type: 'REACTION',
        actor: {
          id: userId,
          username: req.user.username,
          avatarUrl: req.user.avatarUrl,
        },
        relatedPost: {
          id: postId,
          slug: req.body.postSlug,
        },
        message: `${req.user.username} reaccionó con ${type}`,
        read: false,
        createdAt: new Date(),
      });
    }

    return res.json({
      success: true,
      reaction,
    });
  } catch (error) {
    logger.error({ error, postId }, 'Error adding reaction');
    return res.status(500).json({ success: false, error: error.message });
  }
});
```

### 🔵 Frontend

```typescript
// 1. Escuchar reacción a todos los posts visibles
socket.on('reaction:added', (data) => {
  // Actualizar contador de reacciones del post
  setReactions(prev => ({
    ...prev,
    [data.postId]: [...(prev[data.postId] || []), data]
  }));
});

// 2. Escuchar notificación privada (solo para ti)
socket.on('notification:new', (notification) => {
  console.log('🔔 Alguien reaccionó a tu post!', notification.message);
  setNotifications(prev => [notification, ...prev]);
});
```

---

## Ejemplo 3: Seguir Usuarios

### 📝 Backend

```typescript
router.post('/follow/:userId', authenticate, async (req: Request, res) => {
  const io = req.app.get('io');
  const currentUserId = req.user.id;
  const followedUserId = req.params.userId;

  try {
    // PASO 1: Crear follow
    await prisma.follow.create({
      data: {
        followerId: currentUserId,
        followingId: followedUserId,
      },
    });

    // PASO 2: Contar seguidores
    const followerCount = await prisma.follow.count({
      where: { followingId: followedUserId },
    });

    // PASO 3: Notificar SOLO al usuario seguido (sala privada)
    io.to(`user:${followedUserId}`).emit('follower:gained', {
      follower: {
        id: currentUserId,
        username: req.user.username,
        avatarUrl: req.user.avatarUrl,
      },
      followerCount,
      timestamp: new Date(),
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error following user');
    return res.status(500).json({ success: false, error: error.message });
  }
});
```

### 🔵 Frontend

```typescript
// Solo el usuario seguido recibe esto (privado)
socket.on('follower:gained', (data) => {
  console.log(`✅ Nuevo seguidor: @${data.follower.username}`);
  setFollowerCount(data.followerCount);
  
  // Mostrar notificación
  showToast(`${data.follower.username} te está siguiendo!`);
});
```

---

## Patrón General (Aplica a Todo)

```typescript
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATRÓN 1: Evento Público (Todos viendo algo específico)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

io.to(`post:${postId}`).emit('event:name', {
  // Datos para actualizar UI
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATRÓN 2: Evento Privado (Notificación a usuario específico)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

io.to(`user:${userId}`).emit('notification:new', {
  // Datos de notificación privada
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PATRÓN 3: Broadcast a Todos
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

io.to('global').emit('trending:updated', {
  // Datos para todos
});

// O usando helper
broadcastToAll(io, 'announcement', { message: 'Important!' });
```

---

## Cómo Probar Desde Backend

### 🧪 Opción 1: Crear Comentario Real via REST

**Terminal 1**: Iniciar servidor
```bash
npm run dev
```

**Terminal 2**: Cliente escuchando WebSocket
```bash
node -e "
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { sub: '4e17d172-bfba-40cf-8d1b-b8e97a63c444', username: 'admin' },
  'tu_jwt_secret'
);

const socket = io('http://localhost:3000', { auth: { token } });

socket.on('connect', () => {
  console.log('✅ Conectado');
  // Unirse a un post
  socket.emit('join:post', 'test-post-id-actual');
});

socket.on('comment:added', (data) => {
  console.log('💬 Comentario recibido:', data);
});

socket.on('disconnect', () => {
  console.log('❌ Desconectado');
  process.exit(0);
});
"
```

**Terminal 3**: Crear comentario real
```bash
curl -X POST http://localhost:3000/api/v1/posts/test-post-id-actual/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Mi comentario de prueba"}'
```

**Resultado**: Terminal 2 recibe evento automáticamente ✅

---

### 🧪 Opción 2: Ejecutar Suite Completa

```bash
# PowerShell (Windows)
.\test-websocket.ps1

# Node.js (Todos los SO)
node test-websocket-complete.js
```

---

### 🧪 Opción 3: Desde Postman REST

1. Crear comentario via Postman
2. Cliente en otra ventana escucha evento
3. Verificar que UI se actualiza sin refresh

```bash
POST /api/v1/posts/{postId}/comments
Authorization: Bearer {token}
Content-Type: application/json

{
  "content": "Mi comentario"
}
```

---

## Debugging - Ver qué Pasa

### En Servidor (Terminal con npm run dev)

```
[Socket.io] User connected: userId=4e17d172...
[Socket.io] Joined post room: post:abc123
[Socket.io] Emitted: reaction:added to post:abc123
[Socket.io] User disconnected: userId=4e17d172...
```

### Logs Manual

```typescript
logger.debug({ userId, postId }, 'Event emitted');
logger.error({ error }, 'Socket error');
```

### Ver Salas Activas (Endpoint Debug)

```typescript
// Agregar en src/server.ts
app.get('/debug/rooms', (req, res) => {
  const rooms = req.app.get('io').sockets.adapter.rooms;
  const data = {};
  rooms.forEach((sockets, room) => {
    data[room] = Array.from(sockets);
  });
  res.json(data);
});

// GET http://localhost:3000/debug/rooms
```

---

## Errores Comunes

| Problema | Causa | Solución |
|----------|-------|----------|
| "Socket no recibe eventos" | Client no está en sala | Emitir `join:post` primero |
| "Eventos se pierden" | Redis offline | Verificar redis: `docker-compose logs redis` |
| "Token inválido" | JWT secret no coincide | Verificar `env.JWT_ACCESS_SECRET` |
| "Desconexión frecuente" | Timeout | Aumentar en cliente: `reconnectionAttempts: 10` |
| "Emitir no hace nada" | `io` no inicializado | `const io = req.app.get('io')` |

---

## Checklist de Implementación

- [ ] Agregar `const io = req.app.get('io');` en endpoint
- [ ] Determinar sala: `post:${id}`, `user:${id}`, o `global`
- [ ] Emitir con `io.to(...).emit(event, data)`
- [ ] Frontend: `socket.emit('join:X')` antes de escuchar
- [ ] Frontend: `socket.on('event', (data) => {...})`
- [ ] Probar con `node test-websocket-complete.js`
- [ ] Verificar logs en servidor
- [ ] Test real: crear comentario → escuchar evento

---

## Resumen

```typescript
// EL CÓDIGO MÍNIMO QUE NECESITAS EN BACKEND

const io = req.app.get('io');  // Obtener instancia

// Emitir a todos en una sala
io.to(`post:${postId}`).emit('eventName', data);

// Emitir privadamente
io.to(`user:${userId}`).emit('eventName', data);

// Emitir a todos
io.to('global').emit('eventName', data);
```

**¡Eso es todo!** WebSocket hace el resto automáticamente. 🚀
