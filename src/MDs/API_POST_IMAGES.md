# 📸 API de Imágenes en Posts

Documentación de endpoints para gestionar imágenes dentro de posts.

---

## 📋 Tabla de Contenidos

- [Endpoints](#endpoints)
  - [POST /api/v1/posts/:id/images](#post-apiv1postsidimages)
  - [GET /api/v1/posts/:id/images](#get-apiv1postsidimages)
  - [DELETE /api/v1/posts/:id/images/:mediaId](#delete-apiv1postsidimagesmedaid)
- [Ejemplos de Uso](#ejemplos-de-uso)
- [Respuestas](#respuestas)
- [Flujos Recomendados](#flujos-recomendados)

---

## 📍 Endpoints

### POST `/api/v1/posts/:id/images`

**Subir una o múltiples imágenes a un post.**

#### Autenticación

```
Authorization: Bearer YOUR_JWT_TOKEN
```

#### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|----------|------------|
| `:id` | string (UUID) | ✅ | ID del post |
| `images` | file[] | ✅ | Array de imágenes (máx 10) |

#### Límites

| Parámetro | Valor |
|-----------|-------|
| Imágenes por request | 10 |
| Tamaño máximo por imagen | 50 MB |
| Formatos soportados | JPG, PNG, WebP, GIF |

#### Request (cURL)

```bash
curl -X POST http://localhost:3000/api/v1/posts/550e8400-e29b-41d4-a716-446655440000/images \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -F "images=@imagen1.png" \
  -F "images=@imagen2.jpg" \
  -F "images=@imagen3.webp"
```

#### Request (JavaScript/Fetch)

```javascript
const formData = new FormData();
formData.append('images', fileInput.files[0]);
formData.append('images', fileInput.files[1]);
// ... agregar más...

const response = await fetch(
  `http://localhost:3000/api/v1/posts/${postId}/images`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  }
);

const { data } = await response.json();
console.log('Imágenes subidas:', data);
```

#### Request (React)

```jsx
import { useState } from 'react';

export function PostImageUpload({ postId, token }) {
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState([]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);

    const formData = new FormData();
    files.forEach(file => formData.append('images', file));

    try {
      const response = await fetch(
        `http://localhost:3000/api/v1/posts/${postId}/images`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        }
      );

      if (!response.ok) throw new Error('Upload failed');

      const { data } = await response.json();
      setImages(prev => [...prev, ...data]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={handleUpload}
        disabled={uploading}
      />
      {uploading && <p>Subiendo...</p>}
      {images.map(img => (
        <img key={img.id} src={img.url} alt={img.originalName} style={{ maxWidth: '200px' }} />
      ))}
    </div>
  );
}
```

#### Response (201 Created)

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "uploaderId": "user-id-123",
      "filename": "a1b2c3d4.png",
      "originalName": "mi-foto.png",
      "mimeType": "image/png",
      "size": 524288,
      "url": "http://localhost:9000/cms-public/posts/user-id/a1b2c3d4.png",
      "thumbnailUrl": "http://localhost:9000/cms-public/posts/user-id/a1b2c3d4_thumb.webp",
      "bucket": "cms-public",
      "key": "posts/user-id-123/a1b2c3d4.webp",
      "width": 1920,
      "height": 1080,
      "altText": null,
      "caption": null,
      "createdAt": "2026-04-21T00:08:47.037Z"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f01234567890",
      "uploaderId": "user-id-123",
      "filename": "b2c3d4e5.jpg",
      "originalName": "foto-2.jpg",
      "mimeType": "image/jpeg",
      "size": 786432,
      "url": "http://localhost:9000/cms-public/posts/user-id/b2c3d4e5.webp",
      "thumbnailUrl": "http://localhost:9000/cms-public/posts/user-id/b2c3d4e5_thumb.webp",
      "bucket": "cms-public",
      "key": "posts/user-id-123/b2c3d4e5.webp",
      "width": 2560,
      "height": 1440,
      "altText": null,
      "caption": null,
      "createdAt": "2026-04-21T00:08:47.145Z"
    }
  ]
}
```

---

### GET `/api/v1/posts/:id/images`

**Obtener lista de imágenes de un post.**

#### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|----------|------------|
| `:id` | string (UUID) | ✅ | ID del post |

#### Request

```bash
curl -X GET http://localhost:3000/api/v1/posts/550e8400-e29b-41d4-a716-446655440000/images
```

#### Response (200 OK)

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "uploaderId": "user-id-123",
      "filename": "a1b2c3d4.png",
      "originalName": "mi-foto.png",
      "mimeType": "image/png",
      "size": 524288,
      "url": "http://localhost:9000/cms-public/posts/user-id/a1b2c3d4.png",
      "thumbnailUrl": "http://localhost:9000/cms-public/posts/user-id/a1b2c3d4_thumb.webp",
      "bucket": "cms-public",
      "key": "posts/user-id-123/a1b2c3d4.webp",
      "width": 1920,
      "height": 1080,
      "createdAt": "2026-04-21T00:08:47.037Z"
    }
  ]
}
```

---

### DELETE `/api/v1/posts/:id/images/:mediaId`

**Eliminar una imagen de un post.**

#### Autenticación

```
Authorization: Bearer YOUR_JWT_TOKEN
(Solo propietario del post o admin)
```

#### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|----------|------------|
| `:id` | string (UUID) | ✅ | ID del post |
| `:mediaId` | string (UUID) | ✅ | ID de la imagen/media |

#### Request

```bash
curl -X DELETE http://localhost:3000/api/v1/posts/550e8400-e29b-41d4-a716-446655440000/images/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

#### Response (200 OK)

```json
{
  "message": "Imagen eliminada"
}
```

#### Errores

| Código | Escenario |
|--------|-----------|
| `400` | No hay archivos en la request |
| `400` | Tipo de archivo no permitido |
| `400` | Archivo > 50MB |
| `401` | Token ausente o inválido |
| `403` | Sin permisos (no es propietario) |
| `404` | Post o imagen no encontrada |
| `500` | Error en el servidor |

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Crear post con imágenes en un flujo

```javascript
async function createPostWithImages(post, imageFiles, token) {
  // 1. Crear post
  const createResponse = await fetch('http://localhost:3000/api/v1/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(post)
  });

  const { data: createdPost } = await createResponse.json();
  
  // 2. Subir imágenes
  if (imageFiles && imageFiles.length > 0) {
    const formData = new FormData();
    imageFiles.forEach(file => formData.append('images', file));

    const uploadResponse = await fetch(
      `http://localhost:3000/api/v1/posts/${createdPost.id}/images`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      }
    );

    const { data: uploadedImages } = await uploadResponse.json();
    return { post: createdPost, images: uploadedImages };
  }

  return { post: createdPost, images: [] };
}
```

### Ejemplo 2: Mostrar galería de imágenes de un post

```jsx
import { useEffect, useState } from 'react';

export function PostGallery({ postId }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:3000/api/v1/posts/${postId}/images`)
      .then(r => r.json())
      .then(({ data }) => setImages(data))
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) return <p>Cargando imágenes...</p>;
  if (images.length === 0) return <p>Sin imágenes</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
      {images.map(img => (
        <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer">
          <img 
            src={img.thumbnailUrl} 
            alt={img.originalName}
            style={{ width: '100%', height: '200px', objectFit: 'cover' }}
          />
        </a>
      ))}
    </div>
  );
}
```

### Ejemplo 3: Batch upload con progreso

```jsx
export function BatchImageUpload({ postId, token, onComplete }) {
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  const handleUpload = async (files) => {
    const batchSize = 5; // Subir 5 imágenes a la vez
    setTotal(files.length);

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const formData = new FormData();
      
      batch.forEach(file => formData.append('images', file));

      try {
        await fetch(
          `http://localhost:3000/api/v1/posts/${postId}/images`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          }
        );

        setProgress(Math.min(i + batchSize, files.length));
      } catch (error) {
        console.error(`Error uploading batch ${i}:`, error);
      }
    }

    onComplete && onComplete();
  };

  return (
    <div>
      <progress value={progress} max={total} />
      <p>{progress} de {total} archivos</p>
    </div>
  );
}
```

---

## 📦 Respuestas

### Header estándar

```
Content-Type: application/json
Content-Length: ...
```

### Formatos de error

```json
{
  "success": false,
  "error": {
    "message": "No tienes permisos para editar este post",
    "statusCode": 403
  }
}
```

---

## 🔄 Flujos Recomendados

### Flujo 1: Crear post con imágenes

```
Frontend
   ↓
1. Usuario llena formulario de post + selecciona imágenes
   ↓
2. POST /api/v1/posts (crear post - status: DRAFT)
   ↓
3. Recibe post.id
   ↓
4. POST /api/v1/posts/:id/images (subir imágenes)
   ↓
5. Recibe array de imágenes con URLs
   ↓
6. PATCH /api/v1/posts/:id (actualizar con status: PUBLISHED)
   ↓
7. ✅ Post completo con imágenes publicado
```

### Flujo 2: Editar post - agregar más imágenes

```
Frontend
   ↓
1. Usuario está editando un post existente
   ↓
2. Selecciona nuevas imágenes
   ↓
3. POST /api/v1/posts/:id/images (agregar más imágenes)
   ↓
4. Se agregan a las imágenes existentes (sin eliminar)
   ↓
5. ✅ Imágenes agregadas al post
```

### Flujo 3: Eliminar imagen de un post

```
Frontend
   ↓
1. Usuario está editando galería del post
   ↓
2. Hace clic en "eliminar" en una imagen
   ↓
3. DELETE /api/v1/posts/:id/images/:mediaId
   ↓
4. Imagen se elimina de MinIO y BD
   ↓
5. ✅ Imagen removida del post
```

---

## 📊 Estructura de Media

```typescript
interface Media {
  id: string;              // UUID
  uploaderId: string;      // ID del usuario que subió
  filename: string;        // Nombre generado
  originalName: string;    // Nombre original del archivo
  mimeType: string;        // ej: "image/png"
  size: number;            // Tamaño en bytes
  url: string;             // URL completa de la imagen
  thumbnailUrl?: string;   // URL del thumbnail WebP
  bucket: string;          // Bucket de MinIO
  key: string;             // Clave en MinIO
  width?: number;          // Ancho en pixels
  height?: number;         // Alto en pixels
  altText?: string;        // Texto alternativo
  caption?: string;        // Caption/descripción
  createdAt: string;       // ISO 8601 timestamp
}
```

---

## 🚀 Procesamiento de Imágenes

### Transformaciones automáticas:

1. **Imagen principal:**
   - Redimensión: Máx 2048x2048px
   - Formato: WebP (si no es GIF)
   - Calidad: 85%
   - Caché: 1 año

2. **Thumbnail:**
   - Redimensión: 400x400px (cover)
   - Formato: WebP
   - Calidad: 75%
   - Caché: 1 año

### Almacenamiento:

- **Bucket:** `cms-public` (acceso público)
- **Ruta:** `posts/{userId}/{fileId}.{ext}`
- **Thumbnail:** `posts/{userId}/{fileId}_thumb.webp`

---

## 📞 Notas Importantes

✅ **Una imagen puede pertenecer a múltiples posts** (en futuras versiones)  
✅ **El orden de las imágenes se preserva** mediante el campo `order`  
✅ **Las imágenes se almacenan en MinIO** (S3-compatible)  
⚠️ **Solo el propietario del post o admin pueden eliminar imágenes**  
⚠️ **Máximo 10 imágenes por request** (puede hacerse bulk)

---

**Última actualización:** Abril 21, 2026
