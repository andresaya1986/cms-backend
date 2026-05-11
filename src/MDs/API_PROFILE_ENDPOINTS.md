# 👤 API de Perfil de Usuario

Documentación de endpoints para gestióny actualización del perfil de usuario, incluyendo avatar y datos personales.

---

## 📋 Tabla de Contenidos

- [Autenticación](#autenticación)
- [Endpoints](#endpoints)
  - [PATCH /api/v1/auth/profile](#patch-apiv1authprofile)
  - [POST /api/v1/auth/profile/avatar](#post-apiv1authprofileavatar)
- [Ejemplos de Uso](#ejemplos-de-uso)
- [Formatos de Respuesta](#formatos-de-respuesta)
- [Códigos de Error](#códigos-de-error)

---

## 🔐 Autenticación

**Todos los endpoints requieren autenticación JWT en el header:**

```
Authorization: Bearer YOUR_JWT_TOKEN
```

Obtén el token mediante `POST /api/v1/auth/login`

---

## 📍 Endpoints

### PATCH `/api/v1/auth/profile`

Actualizar datos del perfil de usuario sin subir archivos.

#### Parámetros

```json
{
  "displayName": "string?",    // Máx 50 caracteres
  "bio": "string?",            // Máx 500 caracteres
  "avatarUrl": "string?",      // URL válida de imagen de perfil
  "coverUrl": "string?"        // URL válida de imagen de portada
}
```

#### Request

```bash
curl -X PATCH http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Juan García",
    "bio": "Desarrollador Full Stack | Amante del café ☕",
    "avatarUrl": "http://localhost:9000/cms-public/avatars/user-id/avatar.webp",
    "coverUrl": "http://localhost:9000/cms-public/covers/user-id/cover.webp"
  }'
```

#### Response (201 Created)

```json
{
  "user": {
    "id": "727db222-545b-41dd-9345-925eb1a5c832",
    "email": "juan@example.com",
    "username": "juangarcia",
    "displayName": "Juan García",
    "bio": "Desarrollador Full Stack | Amante del café ☕",
    "avatarUrl": "http://localhost:9000/cms-public/avatars/user-id/avatar.webp",
    "coverUrl": "http://localhost:9000/cms-public/covers/user-id/cover.webp",
    "role": "USER",
    "emailVerified": true,
    "twoFactorEnabled": false,
    "createdAt": "2026-04-20T22:30:00.000Z",
    "_count": {
      "followers": 42,
      "following": 15,
      "posts": 8
    }
  }
}
```

#### Validaciones

| Campo | Validaciones |
|-------|--------------|
| `displayName` | Máximo 50 caracteres |
| `bio` | Máximo 500 caracteres |
| `avatarUrl` | URL válida HTTP/HTTPS |
| `coverUrl` | URL válida HTTP/HTTPS |

**Todos los campos son opcionales.** Solo envía los que quieras actualizar.

---

### POST `/api/v1/auth/profile/avatar`

**Subir una imagen de perfil (avatar).** Este endpoint procesa la imagen automáticamente:
- Redimensiona a 300x300px
- Convierte a WebP de alta calidad
- Sube a MinIO
- Actualiza automáticamente `User.avatarUrl`

#### Request

```bash
curl -X POST http://localhost:3000/api/v1/auth/profile/avatar \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -F "avatar=@/ruta/a/imagen.png"
```

**Usando JavaScript/Fetch:**

```javascript
const formData = new FormData();
formData.append('avatar', fileInput.files[0]); // File object

const response = await fetch('http://localhost:3000/api/v1/auth/profile/avatar', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const data = await response.json();
console.log('Avatar URL:', data.url);
console.log('Updated user:', data.user);
```

**Usando React:**

```jsx
import { useState } from 'react';

export function AvatarUpload({ token }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch(
        'http://localhost:3000/api/v1/auth/profile/avatar',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        }
      );

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const { user, url } = await response.json();
      console.log('Avatar updated:', url);
      // Actualizar estado global o redibujar UI
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        disabled={loading}
      />
      {loading && <p>Subiendo...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

#### Formatos Aceptados

```
✅ image/jpeg
✅ image/png
✅ image/webp
❌ image/gif (NO soportado)
❌ Otros formatos
```

#### Límites

| Parámetro | Valor |
|-----------|-------|
| Tamaño máximo | 10 MB |
| Dimensiones mín | 100x100 px |
| Dimensiones máx | Sin límite (se redimensiona a 300x300) |

#### Response (201 Created)

```json
{
  "user": {
    "id": "727db222-545b-41dd-9345-925eb1a5c832",
    "email": "juan@example.com",
    "username": "juangarcia",
    "displayName": "Juan García",
    "avatarUrl": "http://localhost:9000/cms-public/avatars/727db222/a1b2c3d4.webp",
    "coverUrl": null,
    "bio": null,
    "role": "USER",
    "emailVerified": true,
    "twoFactorEnabled": false,
    "createdAt": "2026-04-20T22:30:00.000Z",
    "_count": {
      "followers": 42,
      "following": 15,
      "posts": 8
    }
  },
  "url": "http://localhost:9000/cms-public/avatars/727db222/a1b2c3d4.webp"
}
```

---

## 💡 Ejemplos de Uso

### Ejemplo 1: Actualizar solo displayName

```bash
curl -X PATCH http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Nueva Identidad"
  }'
```

### Ejemplo 2: Actualizar bio

```bash
curl -X PATCH http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Soy un desarrollador apasionado por la tecnología"
  }'
```

### Ejemplo 3: Flux completo - Avatar + Datos

```bash
# 1. Subir avatar
TOKEN="eyJhbGciOiJIUzI1NiIs..."
AVATAR_URL=$(curl -s -X POST http://localhost:3000/api/v1/auth/profile/avatar \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatar=@mifoto.png" | jq -r '.url')

# 2. Actualizar perfil con URLs finales
curl -X PATCH http://localhost:3000/api/v1/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"displayName\": \"Mi Nuevo Nombre\",
    \"bio\": \"Mi biografía\",
    \"avatarUrl\": \"$AVATAR_URL\"
  }"
```

### Ejemplo 4: React Hook para subir avatar

```jsx
import { useCallback } from 'react';

export function useAvatarUpload(token) {
  const uploadAvatar = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch(
      'http://localhost:3000/api/v1/auth/profile/avatar',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Upload failed');
    }

    return response.json();
  }, [token]);

  return { uploadAvatar };
}

// Uso:
function MyProfile() {
  const { uploadAvatar } = useAvatarUpload(token);

  const handleFileSelect = async (event) => {
    try {
      const file = event.target.files[0];
      const { user, url } = await uploadAvatar(file);
      setUser(user);
      setAvatarUrl(url);
    } catch (error) {
      console.error('Error:', error.message);
    }
  };

  return <input type="file" onChange={handleFileSelect} />;
}
```

---

## 📦 Formatos de Respuesta

### Success (2xx)

```json
{
  "user": { /* User object */ },
  "url": "http://..." // Solo en POST /profile/avatar
}
```

### Error (4xx/5xx)

```json
{
  "success": false,
  "error": {
    "message": "Descripción del error",
    "details": [
      {
        "field": "nombre_del_campo",
        "message": "Descripción del problema"
      }
    ]
  }
}
```

---

## ⚠️ Códigos de Error

| Código | Escenario | Solución |
|--------|-----------|----------|
| `400` | No hay archivo en POST /avatar | Envía un archivo en el campo `avatar` |
| `400` | Tipo de archivo no permitido | Usa JPG, PNG o WebP |
| `400` | Archivo > 10MB | Reduce el tamaño de la imagen |
| `400` | URL inválida en avatarUrl/coverUrl | Asegúrate que sea HTTP/HTTPS válida |
| `400` | displayName > 50 caracteres | Máximo 50 caracteres |
| `400` | bio > 500 caracteres | Máximo 500 caracteres |
| `401` | Token ausente o inválido | Incluye Authorization header válido |
| `404` | Usuario no encontrado | Token no corresponde a usuario válido |
| `429` | Rate limit excedido | Espera antes de reintentar |
| `500` | Error del servidor | Contacta a soporte |

---

## 🔄 Flujo de Actualización de Avatar (Recomendado)

```
Frontend
   ↓
1. Usuario selecciona imagen
   ↓
2. POST /api/v1/auth/profile/avatar (upload + procesar)
   ↓
3. Recibe { user, url }
   ↓
4. Actualiza estado global (Redux/Context/Zustand)
   ↓
5. Renderiza nueva imagen
   ↓
6. ✅ Listo
```

**NO** requieres hacer PATCH después. El POST actualiza automáticamente.

---

## 📊 Estructura del Usuario

```typescript
interface User {
  id: string;                  // UUID
  email: string;               // Email único
  username: string;            // Username único
  displayName: string | null;  // Nombre visible
  bio: string | null;          // Biografía
  avatarUrl: string | null;    // URL de avatar
  coverUrl: string | null;     // URL de portada
  role: 'USER' | 'AUTHOR' | 'EDITOR' | 'ADMIN' | 'SUPER_ADMIN';
  emailVerified: boolean;      // ¿Email verificado?
  twoFactorEnabled: boolean;   // ¿2FA activo?
  createdAt: string;           // ISO 8601 timestamp
  _count: {
    followers: number;
    following: number;
    posts: number;
  };
}
```

---

## 🚀 Endpoints Relacionados

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/v1/auth/me` | GET | Obtener perfil actual |
| `/api/v1/auth/profile` | PATCH | Actualizar datos sin archivos |
| `/api/v1/auth/profile/avatar` | POST | Subir + actualizar avatar |
| `/api/v1/media/upload` | POST | Subir archivo genérico (alternativa) |

---

## 📞 Soporte

Para reportar bugs o issues:

- Email: support@cms.local
- Slack: #api-support
- Repository: [Link al repo]

**Última actualización:** Abril 20, 2026
