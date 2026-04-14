#!/usr/bin/env bash
# ─────────────────────────────────────────
#  setup.sh — Inicialización del proyecto
#  Uso: bash scripts/setup.sh
# ─────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}✔${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $1"; }
error()   { echo -e "${RED}✗${NC} $1"; exit 1; }
section() { echo -e "\n${GREEN}━━━ $1 ━━━${NC}"; }

# ── Verificar dependencias ────────────────
section "Verificando dependencias"
command -v docker    >/dev/null 2>&1 || error "Docker no encontrado. Instálalo en https://docs.docker.com/get-docker/"
command -v node      >/dev/null 2>&1 || error "Node.js no encontrado. Instala la versión 20 LTS."
info "Docker: $(docker --version | cut -d ' ' -f3)"
info "Node:   $(node --version)"

# ── Verificar versión de Node ─────────────
NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 20 ]; then
  error "Se requiere Node.js 20+. Versión actual: $(node --version)"
fi

# ── .env ──────────────────────────────────
section "Configurando variables de entorno"
if [ -f ".env" ]; then
  warn ".env ya existe — no se sobreescribirá"
else
  cp .env.example .env
  info ".env creado desde .env.example"
  warn "IMPORTANTE: Edita .env con tus claves reales antes de continuar"
  echo ""
  echo "  Variables críticas a cambiar:"
  echo "  - POSTGRES_PASSWORD"
  echo "  - REDIS_PASSWORD"
  echo "  - MONGO_PASSWORD"
  echo "  - MINIO_PASSWORD"
  echo "  - ELASTIC_PASSWORD"
  echo "  - JWT_ACCESS_SECRET (min 32 chars)"
  echo "  - JWT_REFRESH_SECRET (min 32 chars)"
  echo "  - SENDGRID_API_KEY"
  echo ""
  read -p "  ¿Ya editaste el .env? (s/N): " confirm
  [[ "$confirm" =~ ^[sS]$ ]] || { warn "Edita el .env primero y vuelve a ejecutar este script"; exit 0; }
fi

# ── Instalar dependencias locales (para IDE) ──
section "Instalando dependencias Node.js"
npm install
info "Dependencias instaladas"

# ── Levantar Docker ───────────────────────
section "Levantando servicios Docker"
docker compose up -d postgres redis mongodb minio elasticsearch
info "Servicios de base de datos levantados"

echo "  Esperando que los servicios estén listos..."
sleep 15

# ── Generar Prisma client ─────────────────
section "Configurando Prisma"
npx prisma generate
info "Prisma client generado"

# ── Migraciones ───────────────────────────
section "Ejecutando migraciones"
npx prisma migrate dev --name init
info "Migraciones aplicadas"

# ── Seed ──────────────────────────────────
section "Cargando datos de ejemplo"
npm run prisma:seed
info "Seed completado"

# ── Levantar API ──────────────────────────
section "Levantando todos los servicios"
docker compose up -d
info "Todos los servicios corriendo"

# ── Verificar health ──────────────────────
section "Verificando health check"
sleep 5
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  info "API respondiendo en http://localhost:3000/health ✓"
else
  warn "La API aún no responde (status: $HTTP_STATUS). Revisa: docker compose logs api"
fi

# ── Resumen ───────────────────────────────
section "¡Todo listo!"
echo ""
echo "  Servicios disponibles:"
echo "  ┌─────────────────────────────────────────────────┐"
echo "  │  API         → http://localhost:3000            │"
echo "  │  Nginx       → http://localhost                 │"
echo "  │  MinIO UI    → http://localhost:9001            │"
echo "  │  Prisma      → npx prisma studio               │"
echo "  └─────────────────────────────────────────────────┘"
echo ""
echo "  Credenciales de ejemplo:"
echo "  Admin:  admin@example.com  /  Admin1234!"
echo "  Author: author@example.com /  Author1234!"
echo ""
echo "  Comandos útiles:"
echo "  docker compose logs -f api       # ver logs"
echo "  npm run prisma:studio            # Prisma Studio"
echo "  npm test                         # ejecutar tests"
echo "  docker compose down              # detener todo"
echo ""
