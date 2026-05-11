# 📋 Actualización: Posts ahora incluyen Imágenes

**Fecha:** Abril 21, 2026  
**Cambio:** Los endpoints de posts ahora retornan las imágenes asociadas automáticamente

---

## 🔄 Resumen de Cambios

### Endpoints Actualizados ✅

| Endpoint | Cambio | Impacto |
|----------|--------|--------|
| `GET /api/v1/posts` | Ahora incluye `media` | Listar posts con galería |
| `PATCH /api/v1/posts/:id` | Ahora incluye `media` | Editar posts muestra imágenes |
| `GET /api/v1/posts/:slug` | Sin cambios (ya incluía) | Sigue igual |
| `GET /api/v1/posts/:id/images` | Sin cambios | Sigue igual |

---

## 📊 Estructura de Respuesta

### Antes (Lisra de Posts)

```json
{
  "data": [
    {
      "id": "80d70a18-1dea-44c8-9f2e-c5d95886187e",
      "title": "prueba real",
      "excerpt": "prueba subida",
      "author": { "id": "...", "username": "jaya" },
      "categories": [],
      "tags": []
      // ❌ SIN media
    }
  ]
}
```

### Después (Lista de Posts)

```json
{
  "data": [
    {
      "id": "80d70a18-1dea-44c8-9f2e-c5d95886187e",
      "title": "prueba real",
      "excerpt": "prueba subida",
      "author": { "id": "...", "username": "jaya" },
      "categories": [],
      "tags": [],
      "media": [
        {
          "mediaId": "48098ad9-4e8b-42b3-b66d-b3b263bc6fc7",
          "postId": "80d70a18-1dea-44c8-9f2e-c5d95886187e",
          "order": 0,
          "media": {
            "id": "2372c0f8-63c9-4e33-8d33-3fe3b025b218",
            "filename": "f11be69f-ef5f-465c-8787-4994d79c6555.png",
            "originalName": "Captura de pantalla 2026-02-12 093348.png",
            "url": "http://localhost:9000/cms-public/uploads/fd883a38-.../f11be69f....png",
            "thumbnailUrl": "http://localhost:9000/cms-public/uploads/fd883a38-.../f11be69f..._thumb.webp",
            "width": 683,
            "height": 772
          }
        },
        // ... más imágenes ordenadas
      ]
    }
  ]
}
```

---

## 🛠️ Migración en el Frontend

### 1️⃣ Actualizar Hook de Posts

**Antes:**
```jsx
import { useState, useEffect } from 'react';

export function usePostsList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPosts = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/posts?page=${page}&limit=20`);
      const data = await res.json();
      setPosts(data.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  return { posts, loading, fetchPosts };
}
```

**Después (Mejorado):**
```jsx
import { useState, useEffect } from 'react';

export function usePostsList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPosts = async (page = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/posts?page=${page}&limit=20`);
      const data = await res.json();
      // ✅ Ahora posts incluyen media automáticamente
      setPosts(data.data.map(post => ({
        ...post,
        images: post.media?.map(mp => mp.media) || [], // Extrae media objects
        mainImage: post.media?.[0]?.media?.url || post.featuredImage, // Primera imagen o featured
      })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  return { posts, loading, fetchPosts };
}
```

---

### 2️⃣ Componente de Tarjeta de Post

**Antes:**
```jsx
export function PostCard({ post }) {
  return (
    <div className="post-card">
      <img 
        src={post.featuredImage} 
        alt={post.title}
        className="post-image"
      />
      <h2>{post.title}</h2>
      <p>{post.excerpt}</p>
    </div>
  );
}
```

**Después (Mejorado con galería):**
```jsx
export function PostCard({ post }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Extrae las imágenes del post
  const images = post.media?.map(mp => mp.media) || [];
  const mainImage = post.featuredImage || images[0]?.url;

  const handleNext = () => {
    if (images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }
  };

  return (
    <div className="post-card">
      {/* Galería de imágenes */}
      <div className="post-image-gallery">
        <img 
          src={images[currentImageIndex]?.url || mainImage}
          alt={post.title}
          className="post-image"
        />
        {images.length > 1 && (
          <div className="image-counter">
            {currentImageIndex + 1} / {images.length}
            <button onClick={handleNext}>
              Siguiente →
            </button>
          </div>
        )}
      </div>

      <h2>{post.title}</h2>
      <p>{post.excerpt}</p>

      {/* Miniaturas */}
      {images.length > 1 && (
        <div className="thumbnails">
          {images.map((img, idx) => (
            <img
              key={img.id}
              src={img.thumbnailUrl}
              alt={`Thumbnail ${idx}`}
              className={`thumbnail ${idx === currentImageIndex ? 'active' : ''}`}
              onClick={() => setCurrentImageIndex(idx)}
              style={{ width: '60px', height: '60px', objectFit: 'cover' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### 3️⃣ Componente Editor de Posts

**Antes:**
```jsx
export function PostEditor({ postId }) {
  const [post, setPost] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  });

  useEffect(() => {
    if (postId) {
      fetch(`/api/v1/posts/${postId}`)
        .then(r => r.json())
        .then(data => {
          setPost(data.data);
          setFormData({
            title: data.data.title,
            content: data.data.content,
          });
        });
    }
  }, [postId]);

  return (
    <form>
      <input 
        value={formData.title}
        onChange={e => setFormData({...formData, title: e.target.value})}
      />
      <textarea 
        value={formData.content}
        onChange={e => setFormData({...formData, content: e.target.value})}
      />
      <button type="submit">Guardar</button>
    </form>
  );
}
```

**Después (Mejorado con galería):**
```jsx
export function PostEditor({ postId }) {
  const [post, setPost] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
  });

  useEffect(() => {
    if (postId) {
      fetch(`/api/v1/posts/${postId}`)
        .then(r => r.json())
        .then(data => {
          setPost(data.data);
          setFormData({
            title: data.data.title,
            content: data.data.content,
          });
        });
    }
  }, [postId]);

  // ✅ Nueva: Galería de imágenes del post
  const postImages = post?.media?.map(mp => mp.media) || [];

  const handleDeleteImage = async (mediaId) => {
    if (!confirm('¿Eliminar imagen?')) return;
    
    try {
      await fetch(`/api/v1/posts/${postId}/images/${mediaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      // Recargar post
      const res = await fetch(`/api/v1/posts/${postId}`);
      setPost((await res.json()).data);
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  };

  return (
    <form>
      <input 
        value={formData.title}
        onChange={e => setFormData({...formData, title: e.target.value})}
        placeholder="Título del post"
      />
      <textarea 
        value={formData.content}
        onChange={e => setFormData({...formData, content: e.target.value})}
        placeholder="Contenido"
      />

      {/* ✅ Nueva: Galería de imágenes */}
      {postImages.length > 0 && (
        <div className="editor-gallery">
          <h3>Imágenes del Post ({postImages.length})</h3>
          <div className="gallery-grid">
            {postImages.map((img, idx) => (
              <div key={img.id} className="gallery-item">
                <img 
                  src={img.thumbnailUrl}
                  alt={`Imagen ${idx + 1}`}
                  style={{ width: '100%' }}
                />
                <div className="img-info">
                  <small>{img.width}x{img.height}</small>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteImage(img.id)}
                  className="btn-delete"
                >
                  ✕ Eliminar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button type="submit">Guardar Post</button>
    </form>
  );
}
```

---

## 📱 Ejemplos de Uso

### Ejemplo 1: Mostrar lista con miniaturas

```jsx
export function PostsList() {
  const { posts, loading } = usePostsList();

  return (
    <div className="posts-grid">
      {posts.map(post => (
        <article key={post.id} className="post-item">
          {/* Imagen principal o featured */}
          <img
            src={post.media?.[0]?.media?.thumbnailUrl || post.featuredImage}
            alt={post.title}
            className="post-thumbnail"
          />
          
          {/* Badge de cantidad de imágenes */}
          {post.media?.length > 0 && (
            <span className="image-badge">
              📸 {post.media.length} {post.media.length === 1 ? 'imagen' : 'imágenes'}
            </span>
          )}

          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </article>
      ))}
    </div>
  );
}
```

### Ejemplo 2: Carrusel de imágenes

```jsx
export function PostCarousel({ post }) {
  const [index, setIndex] = useState(0);
  const images = post.media?.map(mp => mp.media) || [];

  if (images.length === 0) return <img src={post.featuredImage} />;

  return (
    <div className="carousel">
      <button 
        onClick={() => setIndex(i => (i - 1 + images.length) % images.length)}
        className="carousel-btn prev"
      >
        ◀
      </button>

      <img
        key={images[index].id}
        src={images[index].url}
        alt={images[index].originalName}
        className="carousel-image"
      />

      <button 
        onClick={() => setIndex(i => (i + 1) % images.length)}
        className="carousel-btn next"
      >
        ▶
      </button>

      {/* Miniaturas */}
      <div className="carousel-thumbnails">
        {images.map((img, i) => (
          <img
            key={img.id}
            src={img.thumbnailUrl}
            alt={`Thumb ${i}`}
            className={`thumb ${i === index ? 'active' : ''}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}
```

### Ejemplo 3: TypeScript Types

```typescript
// types/post.ts

interface MediaFile {
  id: string;
  uploaderId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl: string;
  bucket: string;
  key: string;
  width?: number;
  height?: number;
  createdAt: string;
}

interface MediaPost {
  mediaId: string;
  postId: string;
  order: number;
  media: MediaFile;
}

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'PUBLISHED' | 'SCHEDULED';
  type: string;
  visibility: string;
  viewCount: number;
  reactionsCount: number;
  commentsCount: number;
  publishedAt?: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  categories: any[];
  tags: any[];
  media: MediaPost[]; // ✅ Nuevo campo
}

interface PostsListResponse {
  data: Post[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
  };
}
```

---

## 🔄 Flujo de Actualización de Edición

### Flujo Anterior (sin imágenes en respuesta PATCH)
```
1. GET /posts/:id → Lee datos del post
2. Usuario edita título/contenido
3. PATCH /posts/:id → Actualiza post
4. ❌ Respuesta NO incluía media (hay que ir a buscar de nuevo)
5. Acceder imágenes: GET /posts/:id/images o GET /posts/:id
```

### Flujo Nuevo (con imágenes en respuesta PATCH) ✅
```
1. GET /posts/:id → Lee datos del post (con media)
2. Usuario edita título/contenido
3. PATCH /posts/:id → Actualiza post
4. ✅ Respuesta YA incluye media (datos frescos)
5. Mostrar imágenes: Ya están en la respuesta PATCH
```

### Código de React

```jsx
const handleSavePost = async (title, content) => {
  try {
    const res = await fetch(`/api/v1/posts/${postId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        content,
      }),
    });

    const result = await res.json();
    
    // ✅ Ahora la respuesta YA incluye media actualizado
    setPost(result.data);
    
    // ✅ Las imágenes se actualizaron automáticamente
    const updatedImages = result.data.media?.map(mp => mp.media) || [];
    setImages(updatedImages);
    
    showNotification('Post guardado con imágenes actualizadas');
  } catch (error) {
    showError('Error al guardar');
  }
};
```

---

## 📋 Checklist de Migración

- [ ] Actualizar tipos TypeScript / interfaces
- [ ] Modificar hook `usePostsList()` para extraer media
- [ ] Actualizar componente `PostCard` con galería
- [ ] Actualizar componente `PostEditor` con gestión de imágenes
- [ ] Actualizar carruseles/galerías
- [ ] Remover llamadas redundantes a `GET /posts/:id/images` (opcional)
- [ ] Pruebas end-to-end: Crear → Editar → Ver imágenes
- [ ] Pruebas: Eliminar imagen y recargar post
- [ ] Validar performance con múltiples imágenes

---

## ⚡ Optimizaciones Recomendadas

### 1️⃣ Memoización en React

```jsx
const PostCardMemo = React.memo(PostCard, (prev, next) => {
  return prev.post.id === next.post.id && 
         prev.post.media?.length === next.post.media?.length;
});
```

### 2️⃣ Lazy Loading de Miniaturas

```jsx
const ThumbnailImage = ({ src, alt }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  
  return (
    <>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        style={{ opacity: isLoaded ? 1 : 0.5 }}
      />
    </>
  );
};
```

### 3️⃣ Extraer lógica a hooks personalizados

```jsx
export function usePostImages(post) {
  const images = useMemo(
    () => post?.media?.map(mp => mp.media) || [],
    [post?.media]
  );
  
  const mainImage = useMemo(
    () => post?.featuredImage || images[0]?.url,
    [post?.featuredImage, images]
  );

  return { images, mainImage };
}
```

---

## 🔗 Endpoints Relacionados

| Endpoint | Método | Descripción | Media |
|----------|--------|------------|-------|
| `/api/v1/posts` | GET | Lista posts | ✅ Incluido |
| `/api/v1/posts/:slug` | GET | Post por slug | ✅ Incluido |
| `/api/v1/posts/:id` | GET | Post por ID | ✅ Incluido |
| `/api/v1/posts` | POST | Crear post | ✅ Incluido |
| `/api/v1/posts/:id` | PATCH | Editar post | ✅ **NUEVO** |
| `/api/v1/posts/:id/images` | GET | Listar imágenes | ✅ Específico |
| `/api/v1/posts/:id/images` | POST | Subir imágenes | - |
| `/api/v1/posts/:id/images/:mediaId` | DELETE | Eliminar imagen | - |

---

## 📞 Notas Importantes

⚠️ **CAMBIO BREAKING:** Si tu código asume que `media` NO existe en GET /posts, necesitas actualizar la lógica.

✅ **Mejora Backwards Compatible:** El campo `media` es nuevo pero no rompe código existente.

✅ **Mejor Performance:** Menos llamadas API - obtienes imágenes directamente en la lista.

❌ **Antes tenías que hacer 2 llamadas:**
```js
// Old way (2 llamadas)
const posts = await fetch('/api/v1/posts').then(r => r.json());
const images = await Promise.all(
  posts.map(p => fetch(`/api/v1/posts/${p.id}/images`))
);
```

✅ **Ahora 1 sola llamada:**
```js
// New way (1 llamada)
const posts = await fetch('/api/v1/posts').then(r => r.json());
// Las imágenes ya vienen en posts[].media
```

---

**Última actualización:** Abril 21, 2026
