# 📸 Guía de Carga de Imágenes — CMS Backend

## 🎯 Descripción General

El sistema de media (imágenes, videos, PDFs) en el CMS funciona con **MinIO** (compatible con S3) para almacenar archivos y **Prisma** para gestionar la base de datos. Cada usuario puede subir archivos que se procesan, optimizan y se asocian con posts.

---

## 📊 Arquitectura

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │ (1) POST /api/v1/media/upload
       ↓
┌─────────────────────┐
│  Express Multer     │
│ (Validación de tipo)│
└──────┬──────────────┘
       │
       ↓
┌──────────────────────────┐
│ Sharp (Procesar imagen)  │
│ - Resize/Optimize        │
│ - Generar thumbnail      │
└──────┬───────────────────┘
       │
       ↓
┌──────────────────────────┐
│     MinIO (S3)           │
│ - Guardar original       │
│ - Guardar thumbnail      │
└──────┬───────────────────┘
       │
       ↓
┌──────────────────────────┐
│    Base de Datos         │
│    (Tabla: media)        │
└──────────────────────────┘
       │ (2) Retornar URL + metadata
       ↓
┌─────────────┐
│   Frontend  │
│ Usar URL en │
│  posts, etc │
└─────────────┘
```

---

## 🚀 Endpoints

### 1️⃣ Subir Archivo — POST `/api/v1/media/upload`

**Autenticación:** ✅ Requerida (Bearer token)

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/media/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.png"
```

**Parámetros:**
- `file` (FormData): Archivo a subir

**Tipos de archivo permitidos:**
```
Imágenes:
- image/jpeg
- image/png
- image/webp
- image/gif

Videos:
- video/mp4
- video/webm

Documentos:
- application/pdf
```

**Límites:**
- Tamaño máximo: **50 MB**
- Rate limit: 10 uploads / 15 minutos por usuario

**Response (201 Created):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "uploaderId": "user-id-123",
    "filename": "550e8400-e29b_41d4.webp",
    "originalName": "photo.png",
    "mimeType": "image/png",
    "size": 1024000,
    "url": "http://localhost:9000/cms-public/uploads/user-id-123/550e8400.webp",
    "thumbnailUrl": "http://localhost:9000/cms-public/uploads/user-id-123/550e8400_thumb.webp",
    "bucket": "cms-public",
    "key": "uploads/user-id-123/550e8400.webp",
    "width": 1920,
    "height": 1080,
    "altText": null,
    "caption": null,
    "createdAt": "2026-04-20T14:30:00Z"
  }
}
```

---

### 2️⃣ Mis Archivos — GET `/api/v1/media`

**Autenticación:** ✅ Requerida

**Parámetros:**
- `page` (query, default=1): Número de página
- `limit` (query, default=20): Archivos por página

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "uploaderId": "user-id-123",
      "filename": "550e8400-e29b_41d4.webp",
      "originalName": "photo.png",
      "url": "http://localhost:9000/cms-public/uploads/user-id-123/550e8400.webp",
      "thumbnailUrl": "http://localhost:9000/cms-public/uploads/user-id-123/550e8400_thumb.webp",
      "width": 1920,
      "height": 1080,
      "size": 1024000,
      "createdAt": "2026-04-20T14:30:00Z"
    }
  ]
}
```

---

### 3️⃣ Eliminar Archivo — DELETE `/api/v1/media/:id`

**Autenticación:** ✅ Requerida (solo el que subió)

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/v1/media/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (200 OK):**
```json
{
  "message": "Media deleted"
}
```

**Errores:**
- `404`: Media no encontrada
- `403`: No tienes permisos (no eres el que subió)

---

## 🖼️ Procesamiento de Imágenes

### Qué sucede al subir una imagen:

1. **Validación:**
   - Verifica que sea imagen válida (JPEG, PNG, WebP, GIF)
   - Máximo 50 MB

2. **Lectura de Metadata:**
   - Se extrae ancho (`width`) y alto (`height`) de la imagen original
   - Se preserva la información de la imagen

3. **Optimización (si no es GIF):**
   - Redimensiona a máximo 2048x2048px
   - Convierte a WebP con calidad 85
   - Resultado: ~60-70% menor tamaño

4. **Thumbnail:**
   - Genera preview de 400x400px
   - Formato WebP, calidad 75
   - Ideal para galerías/listados

5. **Subida a MinIO:**
   - Original optimizado en `uploads/{userId}/{fileId}.webp`
   - Thumbnail en `uploads/{userId}/{fileId}_thumb.webp`
   - Both con caché público (1 año)

6. **Registro en BD:**
   - Guarda metadata en tabla `media`
   - Vincula con usuario (`uploaderId`)

---

## 🔗 Asociar Imagen con Post

### Paso 1: Subir Archivo
```bash
POST /api/v1/media/upload
# Retorna mediaId
```

### Paso 2: Crear/Editar Post
```bash
POST /api/v1/posts
{
  "title": "Mi Post",
  "content": "Contenido...",
  "featuredImage": "http://localhost:9000/cms-public/uploads/..../image.webp",
  "categoryIds": ["uuid"],
  "tagIds": ["uuid"]
}
```

### Paso 3: Opcional - Asociar múltiples imágenes
En la respuesta del POST de posts, podrás hacer:
```bash
POST /api/v1/media-associations
{
  "postId": "post-uuid",
  "mediaIds": ["media-id-1", "media-id-2"],
  "order": [0, 1]
}
```

---

## 📋 Flujo Completo: Usuario Publica Post con Imagen

### Frontend (pseudocódigo)

```javascript
// 1. Usuario selecciona archivo
const file = document.getElementById('fileInput').files[0];

// 2. Subir imagen
const formData = new FormData();
formData.append('file', file);

const uploadResponse = await fetch('http://localhost:3000/api/v1/media/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData,
});

const { data: media } = await uploadResponse.json();
console.log('Imagen URL:', media.url);

// 3. Crear post con la imagen
const postResponse = await fetch('http://localhost:3000/api/v1/posts', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: document.getElementById('titleInput').value,
    content: document.getElementById('contentInput').value,
    featuredImage: media.url,  // ← Usar URL de la imagen
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    categoryIds: ['cat-uuid'],
    tagIds: ['tag-uuid'],
  }),
});

const { data: post } = await postResponse.json();
console.log('Post creado:', post.id);
```

---

## 🏗️ Base de Datos

### Tabla: `media`
```sql
CREATE TABLE "media" (
  "id" TEXT PRIMARY KEY,
  "uploaderId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "url" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "bucket" TEXT NOT NULL,
  "key" TEXT NOT NULL,        -- Ruta en MinIO
  "width" INTEGER,             -- Para imágenes
  "height" INTEGER,            -- Para imágenes
  "duration" INTEGER,          -- Para videos (segundos)
  "altText" TEXT,              -- SEO
  "caption" TEXT,              -- Descripción
  "createdAt" TIMESTAMP DEFAULT NOW()
);
```

### Tabla: `media_posts` (Relación)
```sql
CREATE TABLE "media_posts" (
  "mediaId" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,   -- Orden dentro del post
  
  PRIMARY KEY ("mediaId", "postId")
);
```

---

## 🔐 Seguridad

### Validaciones

| Aspecto | Implementado |
|---------|-------------|
| **Autenticación** | ✅ Bearer token requerido |
| **Tipo de archivo** | ✅ Whitelist de MIME types |
| **Tamaño máximo** | ✅ 50 MB |
| **Rate limiting** | ✅ 10 uploads/15min por usuario |
| **Ownership** | ✅ Solo el uploader puede eliminar |
| **Stored** | ✅ En MinIO protegido, no en BD |

### Headers de Seguridad

```http
Content-Security-Policy: default-src 'self';img-src 'self' data: https://
Cache-Control: public, max-age=31536000  (1 año para imágenes procesadas)
```

---

## 📈 Optimizaciones

| Técnica | Beneficio |
|---------|----------|
| **WebP + Resize** | 60-70% menor tamaño |
| **Thumbnail separado** | Carga rápida de galerías |
| **Caché 1 año** | URLs estables, CDN friendly |
| **Metadata en BD** | Queries sin acceder a S3 |
| **Sharp processing** | CPU-intensive: 1 imagen ≈ 100-200ms |

---

## 🐛 Errores Comunes

### Error 400: "Tipo de archivo no permitido"
```
Causa: Intentaste subir un archivo .exe, .zip, etc.
Solución: Solo imágenes, videos y PDFs permitidos
```

### Error 413: "Payload too large"
```
Causa: Archivo > 50 MB
Solución: Comprime o divide el archivo
```

### Error 429: "Too many requests"
```
Causa: Excediste el rate limit (10 uploads/15min)
Solución: Espera 15 minutos o intenta después
```

### Error 404: "Media not found"
```
Causa: El archivo fue eliminado o ID inválido
Solución: Verifica que el ID existe en tu galería
```

---

## 🎨 Uso en Templates

### En HTML
```html
<img src="http://localhost:9000/cms-public/uploads/.../image.webp" 
     alt="Descripción" 
     title="Post title" />
```

### En Markdown
```markdown
![Alt text](http://localhost:9000/cms-public/uploads/.../image.webp)
```

### En JSON (Featured image)
```json
{
  "title": "Mi Post",
  "content": "...",
  "featuredImage": "http://localhost:9000/cms-public/uploads/.../image.webp"
}
```

---

## 📝 Notas Importantes

- ⚠️ **URLs son públicas**: No guardes contenido sensible
- ⚠️ **Limpieza manual**: Archivos huérfanos (sin post) no se eliminan automáticamente
- ✅ **Escalabilidad**: MinIO puede crecer sin límite
- ✅ **Redundancia**: Puedes replicar MinIO para HA
- ✅ **CDN Compatible**: Las URLs son ideales para CDN (Cloudflare, etc)

---

## 🚀 Flujo Recomendado para Frontend

```
1. Usuario selecciona imagen en formulario
   ↓
2. Muestra preview local
   ↓
3. Al publicar post, sube imagen primero
   ↓
4. Una vez confirmada la carga, crea el post con la URL
   ↓
5. Muestra confirmación con imagen integrada
```

---

**Última actualización:** 20 de abril 2026, 10:00 AM
