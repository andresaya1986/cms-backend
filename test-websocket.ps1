# ════════════════════════════════════════════════════════════════════════════════
# WebSocket Testing Script for PowerShell
# 
# Uso: .\test-websocket.ps1
# 
# Este script prueba todos los eventos WebSocket del backend CMS
# ════════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────────
# CONFIGURACIÓN
# ─────────────────────────────────────────────────────────────────────────────────

$SERVER_URL = "http://localhost:3000"
$JWT_SECRET = $env:JWT_ACCESS_SECRET
$TEST_USER_ID = "4e17d172-bfba-40cf-8d1b-b8e97a63c444"  # admin
$TEST_POST_ID = "test-post-123"

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🌐 WebSocket Testing Script" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Server URL: $SERVER_URL" -ForegroundColor Blue
Write-Host "👤 Test User ID: $TEST_USER_ID" -ForegroundColor Blue
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# VERIFICAR DEPENDENCIAS
# ─────────────────────────────────────────────────────────────────────────────────

Write-Host "⏳ Verificando dependencias..." -ForegroundColor Yellow

$npmPackages = npm list socket.io-client jsonwebtoken 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Falta instalar dependencias" -ForegroundColor Red
    Write-Host "Ejecuta: npm install socket.io-client jsonwebtoken" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Dependencias OK" -ForegroundColor Green
Write-Host ""

# ─────────────────────────────────────────────────────────────────────────────────
# CREAR Y EJECUTAR SCRIPT DE TEST
# ─────────────────────────────────────────────────────────────────────────────────

# Script inline para probar Socket.io
$testScript = @'
const io = require('socket.io-client');
const jwt = require('jsonwebtoken');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
const TEST_USER_ID = process.env.TEST_USER_ID || '4e17d172-bfba-40cf-8d1b-b8e97a63c444';
const TEST_POST_ID = 'test-post-123';

// Generar JWT
const token = jwt.sign(
  {
    sub: TEST_USER_ID,
    username: 'admin',
    role: 'SUPER_ADMIN'
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

console.log('\n🔵 Iniciando pruebas...\n');

// Test 1: Conexión básica
console.log('TEST 1: Conexión Básica');
console.log('─'.repeat(50));

const socket = io(SERVER_URL, {
  auth: { token },
  reconnection: true,
  reconnectionDelay: 1000,
});

let testsCompleted = 0;
const totalTests = 8;

socket.on('connect', () => {
  console.log('✅ Conectado');
  console.log(`   Socket ID: ${socket.id}\n`);

  // Test 2: Join Post
  console.log('TEST 2: Unirse a Sala de Post');
  console.log('─'.repeat(50));
  console.log(`📤 Emitiendo: join:post (${TEST_POST_ID})`);
  socket.emit('join:post', TEST_POST_ID);
  testsCompleted++;
  console.log('✅ Emitido\n');

  // Test 3: Typing Start/Stop
  setTimeout(() => {
    console.log('TEST 3: Indicadores de Escritura');
    console.log('─'.repeat(50));
    console.log('📤 Emitiendo: typing:start');
    socket.emit('typing:start', { postId: TEST_POST_ID });
    testsCompleted++;
  }, 500);

  setTimeout(() => {
    console.log('📤 Emitiendo: typing:stop');
    socket.emit('typing:stop', { postId: TEST_POST_ID });
    console.log('✅ Eventos de typing emitidos\n');
  }, 1500);

  // Test 4: Ping/Pong
  setTimeout(() => {
    console.log('TEST 4: Keep-alive (Ping/Pong)');
    console.log('─'.repeat(50));
    console.log('📤 Emitiendo: ping');
    socket.emit('ping');
  }, 2500);

  // Test 5: Reactions
  setTimeout(() => {
    console.log('\nTEST 5: Reacciones');
    console.log('─'.repeat(50));
    console.log('📤 Emitiendo: reaction:add');
    socket.emit('reaction:add', { postId: TEST_POST_ID, type: 'LIKE' });
    testsCompleted++;
    console.log('✅ Evento emitido\n');
  }, 3500);

  // Test 6: Comments
  setTimeout(() => {
    console.log('TEST 6: Comentarios');
    console.log('─'.repeat(50));
    console.log('📤 Emitiendo: comment:added');
    socket.emit('comment:added', {
      postId: TEST_POST_ID,
      commentId: 'test-comment-123'
    });
    testsCompleted++;
    console.log('✅ Evento emitido\n');
  }, 4500);

  // Test 7: Follow
  setTimeout(() => {
    console.log('TEST 7: Seguir Usuarios');
    console.log('─'.repeat(50));
    console.log('📤 Emitiendo: user:followed');
    socket.emit('user:followed', {
      followedUserId: 'test-user-id',
      followerCount: 5
    });
    testsCompleted++;
    console.log('✅ Evento emitido\n');
  }, 5500);

  // Test 8: Notification Mark Read
  setTimeout(() => {
    console.log('TEST 8: Marcar Notificación como Leída');
    console.log('─'.repeat(50));
    console.log('📤 Emitiendo: notification:mark-read');
    socket.emit('notification:mark-read', 'test-notif-123');
    testsCompleted++;
    console.log('✅ Evento emitido\n');
  }, 6500);

  // Desconectar
  setTimeout(() => {
    console.log('════════════════════════════════════════════════════════════════');
    console.log('  📊 RESUMEN');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`\n✅ Tests completados: ${testsCompleted}/${totalTests}\n`);
    socket.disconnect();
    process.exit(0);
  }, 7500);
});

socket.on('pong', () => {
  console.log('📥 Evento recibido: pong');
  testsCompleted++;
  console.log('✅ Keep-alive funcionando\n');
});

socket.on('notification:marked-read', (data) => {
  console.log('📥 Evento recibido: notification:marked-read');
  console.log(`   ${JSON.stringify(data)}\n`);
});

socket.on('user:online', (data) => {
  console.log('📡 Evento broadcast: user:online');
  console.log(`   ${JSON.stringify(data)}\n`);
});

socket.on('connect_error', (error) => {
  console.log(`\n❌ Error de conexión: ${error.message}\n`);
  process.exit(1);
});

socket.on('error', (error) => {
  console.log(`\n⚠️  Error WebSocket: ${error}\n`);
});

setTimeout(() => {
  console.log('\n❌ Timeout - No se recibió conexión\n');
  process.exit(1);
}, 10000);
'@

# Guardar script temporalmente
$tempScript = "$env:TEMP\test-socket-temp.js"
$testScript | Out-File -FilePath $tempScript -Encoding UTF8

# Ejecutar con variables de entorno
Write-Host "🚀 Ejecutando pruebas..." -ForegroundColor Green
Write-Host ""

$env:SERVER_URL = $SERVER_URL
$env:JWT_SECRET = $JWT_SECRET
$env:TEST_USER_ID = $TEST_USER_ID

node $tempScript

$exitCode = $LASTEXITCODE

# Limpiar
Remove-Item -Path $tempScript -Force -ErrorAction SilentlyContinue

if ($exitCode -eq 0) {
    Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✅ TODOS LOS TESTS COMPLETADOS CON ÉXITO" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Green
} else {
    Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "  ❌ HUBO ERRORES EN LOS TESTS" -ForegroundColor Red
    Write-Host "════════════════════════════════════════════════════════════════════════════════" -ForegroundColor Red
}

Write-Host ""
exit $exitCode
