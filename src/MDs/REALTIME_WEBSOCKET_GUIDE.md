# Real-time Notifications - WebSocket Guide

Documento de referencia para usar las notificaciones en tiempo real del backend CMS con Socket.io.

## 🔌 Conexión Inicial

```javascript
import { io } from 'socket.io-client';

// Conectar al servidor de WebSocket
const socket = io('http://localhost:3000', {
  auth: {
    token: localStorage.getItem('accessToken') // Token JWT
  }
});

// Eventos de conexión
socket.on('connect', () => {
  console.log('✅ Conectado al servidor');
});

socket.on('connect_error', (error) => {
  console.error('❌ Error de conexión:', error);
});

socket.on('disconnect', () => {
  console.log('⚠️ Desconectado del servidor');
});
```

## 📬 Eventos de Notificaciones (Recibir)

### Notificación Nueva
```javascript
socket.on('notification:new', (notification) => {
  console.log('📬 Nueva notificación:', notification);
  // {
  //   id: 'notification-uuid',
  //   type: 'NEW_FOLLOWER' | 'POST_LIKE' | 'NEW_COMMENT' | etc,
  //   title: 'Nuevo seguidor',
  //   body: '@usuario te sigue ahora',
  //   data: { followerId, ... },
  //   createdAt: '2026-04-21T12:00:00Z'
  // }
});
```

### Todas las Notificaciones Leídas
```javascript
socket.on('notification:all-read', (data) => {
  console.log(`✓ ${data.count} notificaciones marcadas como leídas`);
});
```

### Notificación Individual Leída
```javascript
socket.on('notification:read', (data) => {
  console.log('✓ Notificación leída:', data.notificationId);
});
```

### Notificación Eliminada
```javascript
socket.on('notification:deleted', (data) => {
  console.log('🗑️ Notificación eliminada:', data.notificationId);
});
```

### Todas las Notificaciones Leídas Borradas
```javascript
socket.on('notification:cleared', (data) => {
  console.log(`🗑️ ${data.count} notificaciones eliminadas`);
});
```

## 👥 Eventos de Seguidores

### Nuevo Seguidor
```javascript
socket.on('follower:gained', (data) => {
  console.log('👤 Nuevo seguidor:', data.follower);
  // {
  //   follower: { id: 'user-uuid', username: 'juan_dev' },
  //   followerCount: 42,
  //   timestamp: '2026-04-21T12:00:00Z'
  // }
});
```

### Seguidor Perdido
```javascript
socket.on('follower:lost', (data) => {
  console.log('👋 Perdiste un seguidor:', data.followerId);
});
```

### Usuario Online
```javascript
socket.on('user:online', (data) => {
  console.log('🟢 Usuario online:', data.username);
  // { userId, username, timestamp }
});
```

### Usuario Offline
```javascript
socket.on('user:offline', (data) => {
  console.log('🔴 Usuario offline:', data.userId);
});
```

## ❤️ Eventos de Reacciones

### Reacción Agregada
```javascript
socket.on('reaction:added', (data) => {
  console.log('❤️ Nueva reacción:', data.type);
  // {
  //   userId: 'user-uuid',
  //   username: 'juan_dev',
  //   postId: 'post-uuid',
  //   type: 'LIKE' | 'LOVE' | 'CARE' | 'HAHA' | 'WOW' | 'SAD' | 'ANGRY',
  //   timestamp: '2026-04-21T12:00:00Z'
  // }
});
```

### Reacción Removida
```javascript
socket.on('reaction:removed', (data) => {
  console.log('❌ Reacción removida:', data.type, 'del post:', data.postId);
});
```

### Reacción Actualizada
```javascript
socket.on('reaction:updated', (data) => {
  console.log(`🔄 Reacción actualizada: ${data.oldType} → ${data.newType}`);
});
```

### Contadores Actualizados
```javascript
socket.on('post:counters', (data) => {
  console.log('📊 Contadores del post actualizados:');
  // {
  //   postId: 'post-uuid',
  //   reactionsCount: 45,
  //   commentsCount: 12,
  //   sharesCount: 3,
  //   bookmarksCount: 8,
  //   viewCount: 324,
  //   timestamp: '2026-04-21T12:00:00Z'
  // }
});
```

## 💬 Eventos de Comentarios

### Comentario Agregado
```javascript
socket.on('comment:added', (data) => {
  console.log('💬 Nuevo comentario:', data.commentId);
  // {
  //   userId: 'user-uuid',
  //   username: 'usuario1',
  //   postId: 'post-uuid',
  //   commentId: 'comment-uuid',
  //   timestamp: '2026-04-21T12:00:00Z'
  // }
});
```

### Comentario Eliminado
```javascript
socket.on('comment:deleted', (data) => {
  console.log('🗑️ Comentario eliminado:', data.commentId);
});
```

### Escritura de Comentario (Typing)
```javascript
socket.on('typing:start', (data) => {
  console.log('✍️ Escribiendo:', data.username);
  // { userId, username, postId }
});

socket.on('typing:stop', (data) => {
  console.log('⏸️ Dejó de escribir:', data.userId);
});
```

## @️ Eventos de Menciones

### Mención Recibida
```javascript
socket.on('mention:new', (data) => {
  console.log('@️ Fuiste mencionado por:', data.mentioningUser.username);
  // {
  //   type: 'POST_MENTION' | 'COMMENT_MENTION',
  //   title: '@usuario te mencionó',
  //   body: 'Te mencionaron en un post/comentario',
  //   mentioningUser: {
  //     id: 'user-uuid',
  //     username: 'juan_dev',
  //     displayName: 'Juan'
  //   },
  //   postId: 'post-uuid',
  //   commentId: 'comment-uuid' (si aplica),
  //   timestamp: '2026-04-21T12:00:00Z'
  // }
});
```

## 📤 Enviar Eventos (Cliente → Servidor)

### Marcar Notificación como Leída
```javascript
socket.emit('notification:mark-read', notificationId);
```

### Marcar Todas las Notificaciones como Leídas
```javascript
socket.emit('notification:mark-all-read');
```

### Unirse a un Post (para recibir actualizaciones)
```javascript
socket.emit('join:post', postId);
```

### Salir de un Post
```javascript
socket.emit('leave:post', postId);
```

### Iniciar Escritura
```javascript
socket.emit('typing:start', { postId });
```

### Detener Escritura
```javascript
socket.emit('typing:stop', { postId });
```

### Ping (Keep-Alive)
```javascript
socket.emit('ping');

socket.on('pong', (data) => {
  console.log('Pong recibido');
});
```

### Emitir Reacción
```javascript
socket.emit('reaction:add', { postId, type: 'LIKE' });
socket.emit('reaction:remove', { postId, type: 'LIKE' });
```

### Emitir Comentario
```javascript
socket.emit('comment:added', { postId, commentId });
socket.emit('comment:deleted', { postId, commentId });
```

### Emitir Follow
```javascript
socket.emit('user:followed', { followedUserId, followerCount: 42 });
socket.emit('user:unfollowed', { unfollowedUserId });
```

## 🏠 Salas (Rooms) de Socket.io

El servidor organiza las conexiones en salas para eficiencia:

### Salas Automáticas
- `user:{userId}` - Sala personal de cada usuario (notificaciones privadas)
- `post:{postId}` - Sala de un post viendo comentarios en tiempo real
- `global` - A todos los usuarios online (presencia)

```javascript
// El usuario se une automáticamente a su sala personal
// Pero puede unirse manualmente a posts que está viendo:

socket.emit('join:post', 'post-123');  // Recibir actualizaciones de este post
socket.emit('leave:post', 'post-123'); // Dejar de recibir actualizaciones
```

## 🛠️ Ejemplo Completo: Dashboard de Notificaciones

```javascript
import { io } from 'socket.io-client';

class NotificationManager {
  socket = null;
  notifications = [];

  connect(token) {
    this.socket = io('http://localhost:3000', {
      auth: { token }
    });

    this.setupListeners();
  }

  setupListeners() {
    // Notificación nueva
    this.socket.on('notification:new', (notification) => {
      this.notifications.unshift(notification);
      this.updateUI();
      this.playSound(); // opcional
    });

    // Seguidor nuevo
    this.socket.on('follower:gained', (data) => {
      this.showToast(`Nuevo seguidor: @${data.follower.username}`);
    });

    // Reacción nueva
    this.socket.on('reaction:added', (data) => {
      this.showToast(`${data.username} reaccionó con ${data.type}`);
    });

    // Comentario nuevo
    this.socket.on('comment:added', (data) => {
      this.showToast(`${data.username} comentó en tu post`);
    });

    // Usuario online
    this.socket.on('user:online', (data) => {
      console.log(`${data.username} está online`);
    });
  }

  markAsRead(notificationId) {
    this.socket.emit('notification:mark-read', notificationId);
  }

  markAllAsRead() {
    this.socket.emit('notification:mark-all-read');
  }

  joinPost(postId) {
    this.socket.emit('join:post', postId);
  }

  leavePost(postId) {
    this.socket.emit('leave:post', postId);
  }

  startTyping(postId) {
    this.socket.emit('typing:start', { postId });
  }

  stopTyping(postId) {
    this.socket.emit('typing:stop', { postId });
  }

  updateUI() {
    // Actualizar interfaz con nuevas notificaciones
    const unreadCount = this.notifications.filter(n => !n.read).length;
    document.querySelector('.notification-badge').textContent = unreadCount;
  }

  playSound() {
    // Reproducir sonido de notificación
    new Audio('/sounds/notification.mp3').play();
  }

  showToast(message) {
    // Mostrar notificación emergente
    console.log('Toast:', message);
  }

  disconnect() {
    this.socket.disconnect();
  }
}

// Uso
const notifManager = new NotificationManager();
notifManager.connect(localStorage.getItem('accessToken'));
```

## 📱 Emitir Eventos desde Comentarios

Cuando el usuario escribe en un input, emitir `typing:start`:

```javascript
const postId = 'post-123';
const commentInput = document.querySelector('#comment-input');

commentInput.addEventListener('input', () => {
  socket.emit('typing:start', { postId });
});

commentInput.addEventListener('blur', () => {
  socket.emit('typing:stop', { postId });
});

// Ver quién está escribiendo
const typingUsers = new Map();

socket.on('typing:start', (data) => {
  typingUsers.set(data.userId, data.username);
  updateTypingIndicator();
});

socket.on('typing:stop', (data) => {
  typingUsers.delete(data.userId);
  updateTypingIndicator();
});

function updateTypingIndicator() {
  const names = Array.from(typingUsers.values()).join(', ');
  const status = document.querySelector('.typing-status');
  if (names) {
    status.textContent = `${names} está escribiendo...`;
  } else {
    status.textContent = '';
  }
}
```

## 🔔 Conteo de No Leídas

La mayoría de clientes querrán mostrar un badge con el número de notificaciones no leídas:

```javascript
async function updateUnreadCount() {
  const response = await fetch('/api/v1/notifications/unread/count', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { unreadCount } = await response.json();
  document.querySelector('.notification-badge').textContent = unreadCount;
}

// Actualizar cuando se conecte
socket.on('connect', () => {
  updateUnreadCount();
});

// Actualizar cuando llegue notificación
socket.on('notification:new', () => {
  updateUnreadCount();
});

// Actualizar cuando marca como leído
socket.on('notification:read', () => {
  updateUnreadCount();
});
```

## ⚙️ Configuración Recomendada (Lado del Cliente)

```javascript
const socketConfig = {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling']
};

const socket = io('http://localhost:3000', socketConfig);
```

## 📊 Eventos Disponibles por Tipo

### Authentication
- `connect` - Conexión establecida
- `connect_error` - Error de autenticación
- `disconnect` - Desconexión

### Notifications
- `notification:new` - Nueva notificación
- `notification:read` - Notificación leída
- `notification:all-read` - Todas leídas
- `notification:deleted` - Notificación eliminada
- `notification:cleared` - Limpiadas las leídas

### Followers
- `follower:gained` - Nuevo seguidor
- `follower:lost` - Seguidor perdido
- `user:online` - Usuario online
- `user:offline` - Usuario offline

### Reactions
- `reaction:added` - Nueva reacción
- `reaction:removed` - Reacción removida
- `reaction:updated` - Reacción actualizada
- `post:counters` - Contadores actualizados

### Comments
- `comment:added` - Nuevo comentario
- `comment:deleted` - Comentario eliminado
- `typing:start` - Usuario escribiendo
- `typing:stop` - Usuario dejó de escribir

### Mentions
- `mention:new` - Fuiste mencionado

### Posts
- `post:viewer:joined` - Usuario viendo el post
- `post:viewer:left` - Usuario dejó de ver el post

## 🐛 Debugging

```javascript
// Habilitar logs detallados
socket.onAny((event, ...args) => {
  console.log(`Socket event: ${event}`, args);
});

socket.onAnyOutgoing((event, ...args) => {
  console.log(`Socket emit: ${event}`, args);
});
```
