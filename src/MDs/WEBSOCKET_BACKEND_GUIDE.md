# 🔌 WebSocket - Guía Completa Backend

## 1️⃣ ¿Cómo Funciona el WebSocket?

### Conceptos Clave

El WebSocket permite **comunicación bidireccional en tiempo real** entre cliente y servidor:

```
Cliente (Frontend)                  Servidor (Backend)
    ↓                                    ↑
    → Conecta con token JWT  →  
                              ← Usuario entra a sala personal "user:userId"
    → Emite evento           →  Se recibe el evento
                              ← Se emite respuesta
    ← Recibe evento          ←
```

### Arquitectura de Socket.io en tu Backend

**Archivo**: [src/shared/config/socket.ts](src/shared/config/socket.ts)

#### 🔑 Componentes Principales

```typescript
// 1. MAPAS DE TRACKING
const userSockets = new Map<string, Set<string>>();    // userId → socketIds
const userPresence = new Map<string, {...}>();         // userId → presence data

// 2. MIDDLEWARE DE AUTENTICACIÓN
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  socket.userId = payload.sub;
  socket.username = payload.username;
  next();  // Permitir conexión autenticada
});

// 3. EVENTOS DE CONEXIÓN
io.on('connection', (socket) => {
  // Usuario está online
  socket.join(`user:${userId}`);  // Sala privada
  socket.join('global');           // Sala global
  
  // Escuchar eventos del cliente
  socket.on('join:post', (postId) => {
    socket.join(`post:${postId}`);  // Unirse a sala del post
  });
});
```

### 🏠 Sistema de Salas (Rooms)

Tu servidor organiza usuarios en **salas** para eficiencia:

| Sala | Propósito | Miembros |
|------|-----------|----------|
| `user:{userId}` | Notificaciones privadas | Solo ese usuario |
| `post:{postId}` | Comentarios en tiempo real | Todos viendo ese post |
| `global` | Broadcasts a todos | Todos online |

**Ventaja**: No se envían mensajes a todos, solo a quienes interesan.

---

## 2️⃣ Flujo de Conexión

### Paso a Paso (Cliente + Servidor)

```typescript
// 🔵 CLIENTE (Frontend)
const socket = io('http://localhost:3000', {
  auth: { token: localStorage.getItem('accessToken') }
});

socket.on('connect', () => {
  console.log('✅ Conectado');
  // Ahora puede emitir eventos
});
```

```typescript
// 🟡 SERVIDOR (Backend)
// 1. Token llega en handshake
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  // Verificar JWT
  next();
});

// 2. Conexión aceptada
io.on('connection', (socket) => {
  const userId = socket.userId;
  
  // 3. Usuario automáticamente en su sala privada
  socket.join(`user:${userId}`);
  
  // 4. Notificar a todos que está online
  io.emit('user:online', { userId, timestamp: new Date() });
  
  // 5. Esperar eventos del cliente
  socket.on('join:post', (postId) => {
    socket.join(`post:${postId}`);
  });
});
```

---

## 3️⃣ Eventos Disponibles

### 📤 Eventos que EMITE el Cliente (recibe el servidor)

```typescript
socket.emit('join:post', postId);                    // Unirse a sala del post
socket.emit('leave:post', postId);                   // Salir de sala
socket.emit('typing:start', { postId });             // Escribiendo comentario
socket.emit('typing:stop', { postId });              // Dejó de escribir
socket.emit('notification:mark-read', notifId);      // Marcar leída
socket.emit('notification:mark-all-read');           // Todas leídas
socket.emit('reaction:add', { postId, type });       // Reacción nueva
socket.emit('reaction:remove', { postId, type });    // Quitar reacción
socket.emit('comment:added', { postId, commentId }); // Comentario nuevo
socket.emit('user:followed', { followedUserId });    // Seguir usuario
socket.emit('ping');                                 // Keep-alive
```

### 📥 Eventos que RECIBE el Cliente (emite el servidor)

```typescript
socket.on('notification:new', (notif) => {});        // Notificación nueva
socket.on('follower:gained', (data) => {});          // Nuevo seguidor
socket.on('reaction:added', (data) => {});           // Reacción en post
socket.on('comment:added', (data) => {});            // Comentario nuevo
socket.on('typing:start', (data) => {});             // Usuario escribiendo
socket.on('user:online', (user) => {});              // Usuario conectó
socket.on('user:offline', (user) => {});             // Usuario desconectó
socket.on('pong', () => {});                         // Respuesta keep-alive
```

---

## 4️⃣ ¿Cómo Emitir Eventos DESDE el Backend?

### Opción 1: Desde un Endpoint REST

Cuando algo sucede en el backend (crear post, comentario, etc), envías evento WebSocket:

```typescript
// 📁 src/modules/social/social.routes.ts

import { Router, Request } from 'express';
import { emitToUser } from '../../shared/config/socket';

router.post('/react', authenticate, async (req: Request, res) => {
  const io = req.app.get('io');  // ← Obtener instancia de Socket.io
  const userId = req.user.id;
  const { postId, type } = req.body;

  // 1. Guardar en base de datos
  const reaction = await prisma.reaction.create({
    data: { userId, postId, type }
  });

  // 2. 🔴 EMITIR EVENTO en tiempo real a todos viendo ese post
  io.to(`post:${postId}`).emit('reaction:added', {
    userId,
    username: req.user.username,
    postId,
    type,
    timestamp: new Date()
  });

  res.json({ success: true, reaction });
});
```

### Opción 2: Usar Helpers Disponibles

Backend tiene **helpers predefinidos**:

```typescript
// 🟡 Helper 1: Enviar a usuario específico
import { emitToUser } from '../../shared/config/socket';

emitToUser(io, userId, 'notification:new', {
  type: 'FOLLOW',
  actor: { id: followerId, username: 'juan' },
  message: 'juan te está siguiendo'
});

// 🟡 Helper 2: Enviar a todos en un post
import { emitToPost } from '../../shared/config/socket';

emitToPost(io, postId, 'comment:added', {
  userId,
  username,
  postId,
  commentId
});

// 🟡 Helper 3: Broadcast a todos online
import { broadcastToAll } from '../../shared/config/socket';

broadcastToAll(io, 'trending:updated', {
  hashtags: [...],
  timestamp: new Date()
});
```

### Opción 3: Emitir Directamente

```typescript
// Opción más flexible
io.to(`user:${userId}`).emit('event', data);      // Sala privada
io.to(`post:${postId}`).emit('event', data);      // Sala del post
io.to('global').emit('event', data);              // Global
io.emit('event', data);                           // Absolutamente todos
```

---

## 5️⃣ Cómo Probar desde el Backend

### ⚡ Método 1: Script Node.js (MÁS FÁCIL)

Crear archivo `test-websocket.js`:

```javascript
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

// 1. Generar token JWT (simular login)
const token = jwt.sign(
  { 
    sub: '4e17d172-bfba-40cf-8d1b-b8e97a63c444',  // admin userId
    username: 'admin',
    role: 'SUPER_ADMIN'
  },
  'tu_jwt_secret_aqui',  // De env.JWT_ACCESS_SECRET
  { expiresIn: '1h' }
);

// 2. Conectar como cliente
const socket = io('http://localhost:3000', {
  auth: { token }
});

// 3. Escuchar eventos
socket.on('connect', () => {
  console.log('✅ Conectado, socketId:', socket.id);
});

socket.on('notification:new', (data) => {
  console.log('📬 Notificación nueva:', data);
});

socket.on('follower:gained', (data) => {
  console.log('👥 Nuevo seguidor:', data);
});

socket.on('disconnect', () => {
  console.log('⚠️ Desconectado');
});

// 4. Emitir evento (simular cliente)
setTimeout(() => {
  socket.emit('join:post', 'post-uuid-123');
  console.log('📤 Emitido: join:post');
}, 1000);

// 5. Mantener conectado
setTimeout(() => {
  console.log('Cerrando...');
  socket.disconnect();
  process.exit(0);
}, 5000);
```

**Ejecutar:**
```bash
node test-websocket.js
```

---

### ⚡ Método 2: Desde Postman (WebSocket Plugin)

1. En Postman: **New → WebSocket**
2. URL: `ws://localhost:3000/socket.io/?EIO=4&transport=websocket`
3. Headers → Auth → Bearer Token
4. Conectar
5. Enviar JSON:

```json
{
  "type": "event",
  "data": ["notification:mark-read", "notification-uuid"]
}
```

---

### ⚡ Método 3: Terminal PowerShell (MÁS DIRECTO)

Crear `test-socket.ps1`:

```powershell
# Instalar cliente socket.io via npm si no existe
npm install socket.io-client jwt-simple

# Script inline
node -e "
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { sub: '4e17d172-bfba-40cf-8d1b-b8e97a63c444', username: 'admin' },
  'JWT_SECRET',
  { expiresIn: '1h' }
);

const socket = io('http://localhost:3000', { auth: { token } });

socket.on('connect', () => console.log('✅ Connected'));
socket.on('notification:new', (d) => console.log('📬', d));

setTimeout(() => {
  socket.emit('join:post', 'test-post-id');
  console.log('📤 Emitted join:post');
  setTimeout(() => socket.disconnect(), 2000);
}, 1000);
"
```

**Ejecutar:**
```powershell
powershell -File test-socket.ps1
```

---

## 6️⃣ Cómo Probar desde Backend REST Endpoint

### Scenario: Cuando se crea un comentario, notificar en tiempo real

```typescript
// 📁 src/modules/comments/comments.routes.ts

router.post('/:postId/comments', authenticate, async (req: Request, res) => {
  const io = req.app.get('io');  // ← Instancia Socket.io
  const { postId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  // Guardar comentario
  const comment = await prisma.comment.create({
    data: { postId, userId, content },
    include: { author: { select: { username: true } } }
  });

  // 🔴 EMITIR en tiempo real
  io.to(`post:${postId}`).emit('comment:added', {
    commentId: comment.id,
    userId,
    username: comment.author.username,
    content,
    createdAt: comment.createdAt,
    postId
  });

  return res.json({ success: true, comment });
});
```

**Probar:**
```bash
# Terminal 1: Cliente WebSocket escuchando
node test-websocket.js

# Terminal 2: Crear comentario via REST
curl -X POST http://localhost:3000/api/v1/comments/post-123/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Mi primer comentario"}'

# Resultado: Terminal 1 recibe evento en tiempo real ✅
```

---

## 7️⃣ Debugging - Cómo Ver qué Pasa

### Logs del Servidor

Tus eventos generan logs automáticos:

```typescript
// En socket.ts hay console.logs
logger.debug({ userId, postId }, 'Joined post room');
logger.error({ notificationId, error }, 'Error marking notification as read');
```

**Ver logs en tiempo real:**
```bash
npm run dev
# Verás eventos de conexión/desconexión
```

### Inspeccionar Salas Activas

```typescript
// Agregar endpoint debug (solo desarrollo)
router.get('/debug/rooms', (req, res) => {
  const io = req.app.get('io');
  const rooms = io.sockets.adapter.rooms;
  
  const roomData = {};
  rooms.forEach((value, key) => {
    roomData[key] = Array.from(value);
  });
  
  res.json(roomData);
});

// Acceder:
// GET http://localhost:3000/debug/rooms
```

### Ver Usuarios Online

```typescript
// De socket.ts ya tienes:
export function getOnlineUsers(): string[] {
  return Array.from(userSockets.keys());
}

// Usar en endpoint:
router.get('/debug/online-users', (req, res) => {
  const onlineUsers = getOnlineUsers();
  res.json({ online: onlineUsers, count: onlineUsers.length });
});
```

---

## 8️⃣ Casos de Uso Reales

### ✅ Caso 1: Usuario Sigue a Otro

```typescript
router.post('/follow/:userId', authenticate, async (req: Request, res) => {
  const io = req.app.get('io');
  const currentUserId = req.user.id;
  const followedUserId = req.params.userId;

  // Guardar follow
  await prisma.follow.create({
    data: { followerId: currentUserId, followingId: followedUserId }
  });

  // 🔴 NOTIFICAR al usuario seguido
  emitToUser(io, followedUserId, 'follower:gained', {
    follower: {
      id: currentUserId,
      username: req.user.username
    },
    followerCount: await prisma.follow.count({
      where: { followingId: followedUserId }
    })
  });

  res.json({ success: true });
});
```

### ✅ Caso 2: Notificación de Reacción

```typescript
router.post('/react', authenticate, async (req: Request, res) => {
  const io = req.app.get('io');
  const { postId, type } = req.body;
  const userId = req.user.id;

  // Crear reacción
  const reaction = await prisma.reaction.create({
    data: { userId, postId, type }
  });

  // 1. Notificar a todos viendo el post
  io.to(`post:${postId}`).emit('reaction:added', {
    userId,
    type,
    timestamp: new Date()
  });

  // 2. Notificar privadamente al dueño del post
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (post && post.authorId !== userId) {
    emitToUser(io, post.authorId, 'notification:new', {
      type: 'REACTION',
      actor: { id: userId, username: req.user.username },
      relatedPost: { id: postId },
      message: `${req.user.username} reaccionó con ${type}`
    });
  }

  res.json({ success: true, reaction });
});
```

---

## 9️⃣ Testing Checklist

```typescript
// ✅ Script completo para probar todos los eventos

const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { sub: 'user-1', username: 'testuser', role: 'USER' },
  'secret',
  { expiresIn: '1h' }
);

const socket = io('http://localhost:3000', { auth: { token } });

socket.on('connect', () => {
  console.log('✅ Conectado');
  
  // Probar eventos
  const tests = [
    ['join:post', ['post-123']],
    ['typing:start', [{ postId: 'post-123' }]],
    ['typing:stop', [{ postId: 'post-123' }]],
    ['reaction:add', [{ postId: 'post-123', type: 'LIKE' }]],
    ['ping', []],
  ];
  
  tests.forEach(([event, args]) => {
    setTimeout(() => {
      socket.emit(event, ...args);
      console.log(`📤 Emitido: ${event}`);
    }, 500);
  });
  
  setTimeout(() => socket.disconnect(), 5000);
});

socket.on('pong', () => console.log('📥 Recibido: pong'));
socket.on('disconnect', () => console.log('❌ Desconectado'));
socket.on('error', (e) => console.error('⚠️ Error:', e));
```

---

## 🔟 Resumen

| Concepto | Explicación |
|----------|------------|
| **Salas** | Grupos de conexiones (user:id, post:id, global) |
| **Eventos** | Mensajes que se envían entre cliente-servidor |
| **io.to()** | Enviar a una sala específica |
| **emitToUser()** | Helper para enviar a usuario privadamente |
| **socket.emit()** | Enviar al cliente (solo ese) |
| **socket.broadcast** | Enviar a todos EXCEPTO el emisor |
| **io.emit()** | Enviar a ABSOLUTAMENTE TODOS |

**Flujo típico:**
1. Cliente se conecta con JWT ✅
2. Automáticamente entra a sala `user:userId` ✅
3. Cliente emite evento (ej: `join:post`) ✅
4. Servidor recibe y procesa ✅
5. Servidor emite respuesta a cliente/otros ✅
6. Todos reciben en tiempo real ✅

---

## 📚 Recursos

- [Real-time Guide](REALTIME_WEBSOCKET_GUIDE.md) - Eventos detallados
- [Frontend Guide](SOCIAL_API_FRONTEND_GUIDE.md) - Setup en React
- [Social API Docs](SOCIAL_API_DOCUMENTATION.md) - Todos los eventos
- Socket.io Docs: https://socket.io/docs/
