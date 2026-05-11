# CMS Backend — Resumen Ejecutivo

## ¿Qué es?

Backend dockerizado de **arquitectura modular** que combina un **CMS de contenidos** con una **red social**, desarrollado en Node.js 20 + Express + TypeScript. Expone una API REST versionada (`/api/v1`) con soporte de tiempo real vía WebSockets.

---

## Módulos funcionales

| Módulo | Responsabilidad |
|---|---|
| **Auth** | Registro, login, JWT (access + refresh), OTP por email |
| **CMS** | Creación, edición y publicación de posts con metadatos SEO |
| **Social** | Feed social, sistema de follows y likes |
| **Comments** | Comentarios anidados en hilos |
| **Media** | Carga y gestión de archivos (imágenes, vídeos) |
| **Search** | Búsqueda full-text sobre contenidos |
| **Notifications** | Sistema de notificaciones en tiempo real |
| **Analytics** | Tracking de eventos y comportamiento de usuarios |

---

## Arquitectura de contenedores Docker

### Servicios principales (siempre activos)

| Contenedor | Imagen | Rol |
|---|---|---|
| `cms_api` | Node.js 20 custom | Monolito principal — lógica de negocio, API REST, WebSockets |
| `cms_nginx` | nginx:1.25-alpine | Reverse proxy / gateway HTTP/HTTPS en puertos 80 y 443 |
| `cms_postgres` | postgres:16-alpine | Base de datos relacional principal (usuarios, posts, relaciones sociales) |
| `cms_redis` | redis:7.2-alpine | Caché, sesiones, rate limiting y colas de tareas (BullMQ) |
| `cms_mongodb` | mongo:7.0 | Almacenamiento flexible de eventos de analytics y logs |
| `cms_minio` | minio/minio | Almacenamiento de archivos compatible con S3 (imágenes, media) |
| `cms_elasticsearch` | elasticsearch:8.12 | Motor de búsqueda full-text sobre contenidos del CMS |

### Servicios opcionales — perfil `dev-tools`

| Contenedor | Imagen | Rol |
|---|---|---|
| `cms_bull_board` | deadly0/bull-board | UI visual para inspeccionar y gestionar las colas de trabajo de Redis |

### Servicios opcionales — perfil `monitoring`

| Contenedor | Imagen | Rol |
|---|---|---|
| `cms_prometheus` | prom/prometheus | Recolección y retención de métricas (30 días) |
| `cms_grafana` | grafana/grafana | Dashboards de monitoreo sobre las métricas de Prometheus |

---

## Diagrama de flujo simplificado

```
Internet
   │
   ▼
[ NGINX :80/:443 ]  ←── Reverse Proxy / TLS
   │
   ▼
[ API Node.js :3000 ]  ←── REST + WebSockets
   ├──► PostgreSQL :5432   (datos estructurados)
   ├──► Redis :6379         (caché / colas / sesiones)
   ├──► MongoDB :27017      (analytics / eventos)
   ├──► MinIO :9000         (archivos / media)
   └──► Elasticsearch :9200 (búsqueda full-text)

Herramientas (opcionales)
   ├──► Bull Board :3001    (gestión de colas — dev)
   ├──► Prometheus :9090    (métricas)
   └──► Grafana :3002       (dashboards)
```

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework | Express.js + TypeScript |
| ORM | Prisma |
| Auth | JWT (access + refresh) + OTP vía SendGrid |
| Tiempo real | Socket.io |
| Colas asíncronas | BullMQ sobre Redis |
| Logs | Pino |
| Tests | Vitest |
| Infraestructura | Docker + Docker Compose |

---

## Datos de despliegue

- **Red interna Docker:** `172.20.0.0/16` (aislada, bridge)
- **Punto de entrada público:** puerto `80` / `443` vía NGINX
- **Persistencia:** 9 volúmenes Docker nombrados (datos, certs, logs, uploads, métricas)
- **Healthchecks:** todos los servicios de datos cuentan con health checks automáticos antes de arrancar la API
