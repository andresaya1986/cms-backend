# 🚀 WebSocket Quick Start - Cheat Sheet

## 1️⃣ Entender en 30 segundos

**WebSocket** = Conexión bidireccional en tiempo real
- Cliente se conecta con JWT
- Se une automáticamente a sala `user:{userId}`
- Puede unirse a otras salas: `post:{postId}`, `global`
- Emisor y receptor se comunican en tiempo real

```
Cliente emite → Servidor recibe → Servidor procesa → 
Servidor emite → Clientes reciben
```

---

## 2️⃣ Cómo Probarlo Rápidamente

### Opción A: PowerShell (Windows)
```powershell
cd c:\Users\jaime\Downloads\cms-backend

# Ejecutar suite de tests completa
.\test-websocket.ps1
```

### Opción B: Node.js (Todos los SO)
```bash
# Suite completa (10 tests)
node test-websocket-complete.js

# O crear tu propio test
node -e "
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { sub: 'user-id', username: 'test', role: 'USER' },
  'secret'
);

const socket = io('http://localhost:3000', { auth: { token } });

socket.on('connect', () => {
  console.log('✅ Conectado');
  socket.emit('ping');
  setTimeout(() => socket.disconnect(), 1000);
});

socket.on('pong', () => console.log('✅ Pong recibido'));
"
```

---

## 3️⃣ Emitir Eventos desde Backend (REST Endpoint)

Cuando creas un comentario, reacción, o notificación, emitir en tiempo real:

```typescript
router.post('/react', authenticate, async (req: Request, res) => {
  const io = req.app.get('io');  // ← Obtener Socket.io
  const { postId, type } = req.body;
  
  // Guardar en BD
  const reaction = await prisma.reaction.create({...});
  
  // 🔴 EMITIR EVENTO en tiempo real
  io.to(`post:${postId}`).emit('reaction:added', {
    userId: req.user.id,
    type,
    timestamp: new Date()
  });
  
  res.json(reaction);
});
```

---

## 4️⃣ Eventos Principales

| Cliente Emite | Servidor Responde |
|---------------|-------------------|
| `join:post` | (sin respuesta directa) |
| `leave:post` | (sin respuesta) |
| `typing:start` | (sin respuesta) |
| `typing:stop` | (sin respuesta) |
| `reaction:add` | (sin respuesta) |
| `ping` | ✅ `pong` |
| `notification:mark-read` | ✅ `notification:marked-read` |

---

## 5️⃣ Emitir a Diferentes Destinos

```typescript
// 📍 A un usuario específico
io.to(`user:${userId}`).emit('notification:new', data);

// 📍 A todos viendo un post
io.to(`post:${postId}`).emit('comment:added', data);

// 📍 A todos online (global)
io.to('global').emit('trending:updated', data);

// 📍 A ABSOLUTAMENTE TODOS
io.emit('announcement', data);

// 📍 A todos MENOS el emisor
socket.broadcast.emit('event', data);
```

---

## 6️⃣ Casos de Uso Reales

### ✅ Nuevo Comentario en Post
```typescript
// Endpoint REST: POST /comments
const comment = await prisma.comment.create({...});

// Emitir a todos viendo ese post
io.to(`post:${postId}`).emit('comment:added', {
  id: comment.id,
  author: comment.author.username,
  content: comment.content,
  createdAt: comment.createdAt
});
```

### ✅ Nuevo Seguidor
```typescript
// Endpoint: POST /follow/:userId
await prisma.follow.create({...});

// Notificar SOLO al usuario seguido
io.to(`user:${followedUserId}`).emit('follower:gained', {
  username: req.user.username,
  followerCount: 42
});
```

### ✅ Reacción a Post
```typescript
// Endpoint: POST /react
const reaction = await prisma.reaction.create({...});

// Notificar a todos viendo ese post
io.to(`post:${postId}`).emit('reaction:added', {
  type,
  username: req.user.username
});
```

---

## 7️⃣ Debugging - Ver qué Pasa

### Ver logs en servidor
```bash
npm run dev
# Verás: "[Socket.io] User connected", "Joined post room", etc
```

### Ver salas activas
```bash
# Endpoint custom:
GET http://localhost:3000/debug/rooms

# Response:
{
  "user:4e17d172-...": ["socket-1", "socket-2"],
  "post:abc123": ["socket-3", "socket-4"],
  "global": ["socket-1", "socket-2", "socket-3", "socket-4"]
}
```

### Ver usuarios online
```bash
GET http://localhost:3000/debug/online-users

# Response:
{
  "online": ["user-1", "user-2", "user-3"],
  "count": 3
}
```

---

## 8️⃣ Frontend - Cómo Recibir

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: { token: localStorage.getItem('accessToken') }
});

// Escuchar notificación nueva
socket.on('notification:new', (data) => {
  console.log('🔔 Nueva notificación:', data);
  addNotification(data);
});

// Escuchar comentario nuevo en post
socket.on('comment:added', (data) => {
  console.log('💬 Nuevo comentario:', data);
  addComment(data);
});

// Escuchar reacción nueva
socket.on('reaction:added', (data) => {
  console.log('❤️ Nueva reacción:', data);
  updateReactionCount(data);
});

// Escuchar presencia
socket.on('user:online', (user) => {
  console.log(`✅ ${user.username} está online`);
});
```

---

## 9️⃣ Flujo Completo Ejemplo

### Backend: Crear Comentario
```typescript
// 1. POST /posts/:postId/comments
router.post('/:postId/comments', authenticate, async (req, res) => {
  const io = req.app.get('io');
  
  // 2. Guardar en BD
  const comment = await prisma.comment.create({
    data: { postId, userId: req.user.id, content: req.body.content }
  });
  
  // 3. Emitir evento
  io.to(`post:${postId}`).emit('comment:added', {
    id: comment.id,
    author: req.user.username,
    content: comment.content
  });
  
  // 4. Responder al cliente REST
  res.json(comment);
});
```

### Frontend: Recibir Comentario
```typescript
// 1. Unirse a sala del post
socket.emit('join:post', postId);

// 2. Escuchar evento
socket.on('comment:added', (comment) => {
  // 3. Actualizar UI
  comments.push(comment);
  re-render();
});

// 4. Crear comentario via REST
await fetch(`/api/v1/posts/${postId}/comments`, {
  method: 'POST',
  body: JSON.stringify({ content: 'Mi comentario' })
});
// Automáticamente recibirá evento en tiempo real
```

---

## 🔟 Troubleshooting

| Problema | Solución |
|----------|----------|
| **"Token requerido"** | Pasar JWT en auth durante conexión |
| **No recibe eventos** | Verificar que cliente esté en sala correcta (`join:post`) |
| **Desconexión frecuente** | Verificar logs del servidor, Redis puede estar offline |
| **Eventos no llegan** | Asegurarse que el endpoint emita con `io.to()` correcto |
| **Múltiples conexiones** | Esperado si hay múltiples pestañas/dispositivos (cada uno es socket distinto) |

---

## ✨ Archivos Importantes

- 📄 [WEBSOCKET_BACKEND_GUIDE.md](WEBSOCKET_BACKEND_GUIDE.md) - Guía completa
- 📄 [REALTIME_WEBSOCKET_GUIDE.md](REALTIME_WEBSOCKET_GUIDE.md) - Eventos detallados
- 📁 [src/shared/config/socket.ts](src/shared/config/socket.ts) - Código principal
- 🧪 [test-websocket.ps1](test-websocket.ps1) - Tests PowerShell
- 🧪 [test-websocket-complete.js](test-websocket-complete.js) - Tests Node.js

---

## 📞 Comandos Rápidos

```bash
# Ejecutar tests
.\test-websocket.ps1          # PowerShell
node test-websocket-complete.js  # Node.js

# Escuchar eventos desde terminal
node -e "const io=require('socket.io-client');const s=io('http://localhost:3000',{auth:{token:'JWT'}});s.onAny((e,d)=>console.log(e,d));"

# Ver qué salas hay
curl http://localhost:3000/debug/rooms

# Ver usuarios online
curl http://localhost:3000/debug/online-users
```

---

**🎯 Lo Importante**: WebSocket es bidireccional. El backend EMITE eventos y el frontend los RECIBE automáticamente. No necesita hacer polls (consultas repetidas).
