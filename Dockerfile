# ─────────────────────────────────────────
#  BASE — dependencias comunes
# ─────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

# ─────────────────────────────────────────
#  DEPS — solo dependencias de producción
# ─────────────────────────────────────────
FROM base AS deps
RUN npm ci --only=production && npm cache clean --force

# ─────────────────────────────────────────
#  BUILD — compilar TypeScript
# ─────────────────────────────────────────
FROM base AS builder
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# ─────────────────────────────────────────
#  DEVELOPMENT — con hot reload
# ─────────────────────────────────────────
FROM base AS development
ENV NODE_ENV=development
RUN npm ci
COPY . .
RUN npx prisma generate

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "run", "dev"]

# ─────────────────────────────────────────
#  PRODUCTION — imagen final mínima
# ─────────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache curl dumb-init
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Usuario no-root para seguridad
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 appuser

COPY --from=deps --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

# Directorio de uploads con permisos correctos
RUN mkdir -p /app/uploads && chown -R appuser:nodejs /app/uploads

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# dumb-init maneja señales PID 1 correctamente
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
