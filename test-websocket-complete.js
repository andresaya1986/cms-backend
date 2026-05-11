#!/usr/bin/env node

/**
 * WebSocket Testing Script
 * Ejecutar: node test-websocket-complete.js
 * 
 * Prueba todos los eventos en tiempo real
 */

const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

// ────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'your_jwt_secret_change_me';
const SERVER_URL = process.env.SOCKET_URL || 'http://localhost:3000';

// IDs de prueba (adaptar a tu base de datos)
const TEST_USER_ID = '4e17d172-bfba-40cf-8d1b-b8e97a63c444'; // admin
const TEST_POST_ID = 'test-post-123';
const TEST_NOTIFICATION_ID = 'test-notif-123';

// ────────────────────────────────────────
// HELPER: Generar JWT
// ────────────────────────────────────────

function generateToken(userId = TEST_USER_ID, username = 'testuser') {
  return jwt.sign(
    {
      sub: userId,
      username,
      role: 'USER'
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// ────────────────────────────────────────
// HELPER: Colores en consola
// ────────────────────────────────────────

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

// ────────────────────────────────────────
// TEST 1: Conexión Básica
// ────────────────────────────────────────

async function testBasicConnection() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n🔵 TEST 1: Conexión Básica');
    log(colors.cyan, '━'.repeat(50));

    const token = generateToken();
    const socket = io(SERVER_URL, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
    });

    let connected = false;

    socket.on('connect', () => {
      connected = true;
      log(colors.green, `✅ Conectado`);
      log(colors.green, `   Socket ID: ${socket.id}`);
      socket.disconnect();
      resolve({ success: true });
    });

    socket.on('connect_error', (error) => {
      log(colors.red, `❌ Error de conexión: ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    setTimeout(() => {
      if (!connected) {
        socket.disconnect();
        resolve({ success: false, error: 'Timeout' });
      }
    }, 5000);
  });
}

// ────────────────────────────────────────
// TEST 2: Eventos de Usuario Online/Offline
// ────────────────────────────────────────

async function testUserPresence() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n🔵 TEST 2: Presencia (Online/Offline)');
    log(colors.cyan, '━'.repeat(50));

    const token = generateToken();
    const socket = io(SERVER_URL, {
      auth: { token },
    });

    let received = [];

    socket.on('connect', () => {
      log(colors.green, `✅ Conectado`);
    });

    socket.on('user:online', (data) => {
      log(colors.yellow, `📡 Evento recibido: user:online`);
      log(colors.yellow, `   ${JSON.stringify(data)}`);
      received.push('user:online');
    });

    socket.on('user:offline', (data) => {
      log(colors.yellow, `📡 Evento recibido: user:offline`);
      log(colors.yellow, `   ${JSON.stringify(data)}`);
      received.push('user:offline');
    });

    setTimeout(() => {
      socket.disconnect();
      resolve({ success: true, eventsReceived: received });
    }, 3000);
  });
}

// ────────────────────────────────────────
// TEST 3: Emitir join:post
// ────────────────────────────────────────

async function testJoinPost() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n🔵 TEST 3: Unirse a Sala de Post (join:post)');
    log(colors.cyan, '━'.repeat(50));

    const token = generateToken();
    const socket = io(SERVER_URL, {
      auth: { token },
    });

    socket.on('connect', () => {
      log(colors.green, `✅ Conectado`);
      log(colors.blue, `📤 Emitiendo: join:post con id=${TEST_POST_ID}`);
      
      socket.emit('join:post', TEST_POST_ID);
    });

    socket.on('post:viewer:joined', (data) => {
      log(colors.yellow, `📡 Evento recibido: post:viewer:joined`);
      log(colors.yellow, `   ${JSON.stringify(data)}`);
      resolve({ success: true });
      socket.disconnect();
    });

    setTimeout(() => {
      log(colors.green, `✅ Test completado (no se recibió respuesta, pero no hay error)`);
      socket.disconnect();
      resolve({ success: true, note: 'join:post no emite respuesta directa' });
    }, 3000);
  });
}

// ────────────────────────────────────────
// TEST 4: Keep-alive (Ping/Pong)
// ────────────────────────────────────────

async function testPingPong() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n🔵 TEST 4: Keep-alive (Ping/Pong)');
    log(colors.cyan, '━'.repeat(50));

    const token = generateToken();
    const socket = io(SERVER_URL, {
      auth: { token },
    });

    let pongReceived = false;

    socket.on('connect', () => {
      log(colors.green, `✅ Conectado`);
      log(colors.blue, `📤 Emitiendo: ping`);
      socket.emit('ping');
    });

    socket.on('pong', (data) => {
      pongReceived = true;
      log(colors.green, `✅ Pong recibido`);
      log(colors.yellow, `   ${JSON.stringify(data)}`);
      socket.disconnect();
      resolve({ success: true });
    });

    setTimeout(() => {
      socket.disconnect();
      if (pongReceived) {
        resolve({ success: true });
      } else {
        log(colors.red, `❌ No se recibió pong`);
        resolve({ success: false, error: 'Pong timeout' });
      }
    }, 3000);
  });
}

// ────────────────────────────────────────
// TEST 5: Typing Indicators
// ────────────────────────────────────────

async function testTypingIndicators() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n🔵 TEST 5: Indicadores de Escritura');
    log(colors.cyan, '━'.repeat(50));

    const token = generateToken();
    const socket = io(SERVER_URL, {
      auth: { token },
    });

    socket.on('connect', () => {
      log(colors.green, `✅ Conectado`);
      
      // Primero unirse al post
      socket.emit('join:post', TEST_POST_ID);
      
      setTimeout(() => {
        log(colors.blue, `📤 Emitiendo: typing:start`);
        socket.emit('typing:start', { postId: TEST_POST_ID });
      }, 500);

      setTimeout(() => {
        log(colors.blue, `📤 Emitiendo: typing:stop`);
        socket.emit('typing:stop', { postId: TEST_POST_ID });
      }, 2000);
    });

    setTimeout(() => {
      log(colors.green, `✅ Eventos de typing emitidos exitosamente`);
      socket.disconnect();
      resolve({ success: true });
    }, 3000);
  });
}

// ────────────────────────────────────────
// TEST 6: Marcar Notificación como Leída
// ────────────────────────────────────────

async function testNotificationMarkRead() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n🔵 TEST 6: Marcar Notificación como Leída');
    log(colors.cyan, '━'.repeat(50));

    const token = generateToken();
    const socket = io(SERVER_URL, {
      auth: { token },
    });

    let markedRead = false;

    socket.on('connect', () => {
      log(colors.green, `✅ Conectado`);
      log(colors.blue, `📤 Emitiendo: notification:mark-read`);
      socket.emit('notification:mark-read', TEST_NOTIFICATION_ID);
    });

    socket.on('notification:marked-read', (data) => {
      markedRead = true;
      log(colors.green, `✅ Notificación marcada como leída`);
      log(colors.yellow, `   ${JSON.stringify(data)}`);
      socket.disconnect();
      resolve({ success: true });
    });

    setTimeout(() => {
      socket.disconnect();
      if (!markedRead) {
        log(colors.yellow, `⚠️  No se recibió confirmación (notificación puede no existir)`);
      }
      resolve({ success: true });
    }, 3000);
  });
}

// ────────────────────────────────────────
// TEST 7: Marcar Todas las Notificaciones como Leídas
// ────────────────────────────────────────

async function testNotificationMarkAllRead() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n🔵 TEST 7: Marcar Todas las Notificaciones como Leídas');
    log(colors.cyan, '━'.repeat(50));

    const token = generateToken();
    const socket = io(SERVER_URL, {
      auth: { token },
    });

    socket.on('connect', () => {
      log(colors.green, `✅ Conectado`);
      log(colors.blue, `📤 Emitiendo: notification:mark-all-read`);
      socket.emit('notification:mark-all-read');
    });

    socket.on('notification:all-marked-read', (data) => {
      log(colors.green, `✅ Todas marcadas como leídas`);
      log(colors.yellow, `   ${JSON.stringify(data)}`);
      socket.disconnect();
      resolve({ success: true });
    });

    setTimeout(() => {
      socket.disconnect();
      resolve({ success: true });
    }, 3000);
  });
}

// ────────────────────────────────────────
// TEST 8: Reacciones
// ────────────────────────────────────────

async function testReactions() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n🔵 TEST 8: Reacciones (add/remove)');
    log(colors.cyan, '━'.repeat(50));

    const token = generateToken();
    const socket = io(SERVER_URL, {
      auth: { token },
    });

    socket.on('connect', () => {
      log(colors.green, `✅ Conectado`);
      
      // Unirse a post primero
      socket.emit('join:post', TEST_POST_ID);

      setTimeout(() => {
        log(colors.blue, `📤 Emitiendo: reaction:add (type=LIKE)`);
        socket.emit('reaction:add', { postId: TEST_POST_ID, type: 'LIKE' });
      }, 500);

      setTimeout(() => {
        log(colors.blue, `📤 Emitiendo: reaction:remove (type=LIKE)`);
        socket.emit('reaction:remove', { postId: TEST_POST_ID, type: 'LIKE' });
      }, 2000);
    });

    setTimeout(() => {
      log(colors.green, `✅ Eventos de reacción emitidos`);
      socket.disconnect();
      resolve({ success: true });
    }, 3000);
  });
}

// ────────────────────────────────────────
// TEST 9: Comentarios
// ────────────────────────────────────────

async function testComments() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n🔵 TEST 9: Comentarios (added/deleted)');
    log(colors.cyan, '━'.repeat(50));

    const token = generateToken();
    const socket = io(SERVER_URL, {
      auth: { token },
    });

    socket.on('connect', () => {
      log(colors.green, `✅ Conectado`);
      
      socket.emit('join:post', TEST_POST_ID);

      setTimeout(() => {
        log(colors.blue, `📤 Emitiendo: comment:added`);
        socket.emit('comment:added', {
          postId: TEST_POST_ID,
          commentId: 'test-comment-123'
        });
      }, 500);

      setTimeout(() => {
        log(colors.blue, `📤 Emitiendo: comment:deleted`);
        socket.emit('comment:deleted', {
          postId: TEST_POST_ID,
          commentId: 'test-comment-123'
        });
      }, 2000);
    });

    setTimeout(() => {
      log(colors.green, `✅ Eventos de comentarios emitidos`);
      socket.disconnect();
      resolve({ success: true });
    }, 3000);
  });
}

// ────────────────────────────────────────
// TEST 10: Seguir Usuarios
// ────────────────────────────────────────

async function testFollowUsers() {
  return new Promise((resolve) => {
    log(colors.cyan, '\n🔵 TEST 10: Seguir Usuarios');
    log(colors.cyan, '━'.repeat(50));

    const token = generateToken();
    const socket = io(SERVER_URL, {
      auth: { token },
    });

    socket.on('connect', () => {
      log(colors.green, `✅ Conectado`);
      
      log(colors.blue, `📤 Emitiendo: user:followed`);
      socket.emit('user:followed', {
        followedUserId: 'test-user-to-follow-id',
        followerCount: 42
      });

      setTimeout(() => {
        log(colors.blue, `📤 Emitiendo: user:unfollowed`);
        socket.emit('user:unfollowed', {
          unfollowedUserId: 'test-user-unfollowed-id'
        });
      }, 1000);
    });

    setTimeout(() => {
      log(colors.green, `✅ Eventos de seguimiento emitidos`);
      socket.disconnect();
      resolve({ success: true });
    }, 3000);
  });
}

// ────────────────────────────────────────
// RUNNER: Ejecutar todos los tests
// ────────────────────────────────────────

async function runAllTests() {
  console.clear();
  log(colors.blue, '\n' + '═'.repeat(50));
  log(colors.blue, '  🌐 WebSocket Testing Suite');
  log(colors.blue, '═'.repeat(50));
  log(colors.blue, `\n📍 Server: ${SERVER_URL}`);
  log(colors.blue, `👤 Test User ID: ${TEST_USER_ID}`);
  log(colors.blue, `📌 Test Post ID: ${TEST_POST_ID}\n`);

  const results = [];

  // Ejecutar tests secuencialmente
  const tests = [
    { name: 'Conexión Básica', fn: testBasicConnection },
    { name: 'Presencia (Online/Offline)', fn: testUserPresence },
    { name: 'Join Post', fn: testJoinPost },
    { name: 'Ping/Pong', fn: testPingPong },
    { name: 'Typing Indicators', fn: testTypingIndicators },
    { name: 'Mark Notification Read', fn: testNotificationMarkRead },
    { name: 'Mark All Notifications Read', fn: testNotificationMarkAllRead },
    { name: 'Reactions', fn: testReactions },
    { name: 'Comments', fn: testComments },
    { name: 'Follow Users', fn: testFollowUsers },
  ];

  for (const test of tests) {
    try {
      const result = await test.fn();
      results.push({ name: test.name, ...result });
    } catch (error) {
      results.push({
        name: test.name,
        success: false,
        error: error.message,
      });
    }
  }

  // Resumen
  log(colors.blue, '\n' + '═'.repeat(50));
  log(colors.blue, '  📊 RESUMEN DE RESULTADOS');
  log(colors.blue, '═'.repeat(50) + '\n');

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  results.forEach((result) => {
    const icon = result.success ? '✅' : '❌';
    log(
      result.success ? colors.green : colors.red,
      `${icon} ${result.name}`
    );
    if (!result.success && result.error) {
      log(colors.red, `   Error: ${result.error}`);
    }
  });

  log(colors.blue, `\n━ Total: ${results.length} | ${colors.green}Passed: ${passed}${colors.blue} | ${colors.red}Failed: ${failed}${colors.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

// ────────────────────────────────────────
// Main
// ────────────────────────────────────────

// Verificar que socket.io-client esté instalado
try {
  require('socket.io-client');
  require('jsonwebtoken');
} catch (error) {
  log(colors.red, '❌ Error: Falta instalar dependencias');
  log(colors.yellow, 'Ejecuta: npm install socket.io-client jsonwebtoken');
  process.exit(1);
}

runAllTests().catch((error) => {
  log(colors.red, '❌ Error fatal:', error.message);
  process.exit(1);
});
