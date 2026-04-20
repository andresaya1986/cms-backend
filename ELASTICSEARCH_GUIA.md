# Elasticsearch en CMS-Backend
## Búsqueda Full-Text Escalable

---

## 🔍 **¿Qué es Elasticsearch?**

**Elasticsearch** es un buscador y analizador de datos construido sobre [Lucene](https://lucene.apache.org/). 

```
Base de Datos Normal        →    Elasticsearch (Motor de Búsqueda)
┌─────────────────────────┐    ┌──────────────────────────────┐
│ SELECT * FROM posts     │    │ GET /cms_posts/_search       │
│ WHERE title LIKE '%foo%'│    │ {                            │
│ Lento con muchos datos  │    │   "query": {                 │
└─────────────────────────┘    │     "multi_match": {         │
                               │       "query": "foo"         │
                               │     }                        │
                               │   }                          │
                               │ }                            │
                               │                              │
                               │ Rápido → índices invertidos  │
                               └──────────────────────────────┘
```

### **Características:**
- ✅ **Búsqueda full-text** - Busca texto en documentos complejos
- ✅ **Fuzzy matching** - Encuentra resultados incluso con typos (`Searsh` → `Search`)
- ✅ **Análisis de texto** - Tokenización, stemming, corrección
- ✅ **Índices invertidos** - Búsquedas ultra rápidas en millones de documentos
- ✅ **Escalable** - Distribuido y replicado (clustering)
- ✅ **JSON-based** - API REST simple
- ✅ **Real-time** - Indexación inmediata

---

## 📦 **¿Cómo está montado en Docker?**

### **Configuración en `docker-compose.yml`:**

```yaml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.12.0
  container_name: cms_elasticsearch
  restart: unless-stopped
  environment:
    - discovery.type=single-node                    # Nodo único (dev)
    - ES_JAVA_OPTS=-Xms512m -Xmx512m              # Memoria JVM
    - ELASTIC_PASSWORD=${ELASTIC_PASSWORD}        # Contraseña
    - xpack.security.enabled=true                 # Autenticación
    - xpack.security.http.ssl.enabled=false       # Sin SSL (dev)
  volumes:
    - elasticsearch_data:/usr/share/elasticsearch/data
  ports:
    - '9200:9200'                                  # Puerto HTTP
  healthcheck:
    test: ['CMD-SHELL', 'curl -u elastic:${ELASTIC_PASSWORD} -s http://localhost:9200/_cluster/health']
  networks:
    - cms_net
```

### **Puertos y Acceso:**
```
🔗 Elasticsearch API:    http://elasticsearch:9200  (dentro de Docker)
🔗 Local:               http://localhost:9200
👤 Username:            elastic
🔐 Password:            ${ELASTIC_PASSWORD} (de .env)
```

---

## 🔌 **¿Cómo se configura en el código?**

### **1. Conexión (search.routes.ts):**

```typescript
import { Client } from '@elastic/elasticsearch';

const esClient = new Client({
  node: env.ELASTIC_HOST,  // http://elasticsearch:9200
  auth: { 
    username: env.ELASTIC_USERNAME,    // 'elastic'
    password: env.ELASTIC_PASSWORD     // password from .env
  },
});
```

### **2. Índices creados:**

```
cms_posts  → Documentos de posts (title, excerpt, content, tags, etc)
cms_users  → Documentos de usuarios (username, displayName, bio, etc)
```

### **3. Flujo de indexación:**

```
1. Usuario crea un POST en PostgreSQL
                    ↓
2. BullMQ queue agrega job: "index-post"
                    ↓
3. Worker procesa el job
                    ↓
4. indexPost() envía documento a Elasticsearch
                    ↓
5. Elasticsearch indexa en cms_posts
                    ↓
6. Disponible para búsqueda inmediatamente
```

---

## 🎯 **Endpoints de Búsqueda**

### **GET /api/v1/search**

**Parámetros:**
- `q` - Término de búsqueda (requerido)
- `type` - `'posts'` | `'users'` | `'all'` (default: `'all'`)
- `page` - Número de página (default: 1)
- `limit` - Resultados por página, max 50 (default: 20)

**Ejemplo:**
```bash
GET /api/v1/search?q=typescript&type=posts&page=1&limit=10
```

**Respuesta:**
```json
{
  "query": "typescript",
  "total": 145,
  "results": [
    {
      "id": "post-123",
      "index": "cms_posts",
      "score": 8.5,
      "title": "TypeScript Advanced Types",
      "excerpt": "Aprende sobre tipos avanzados...",
      "content": "TypeScript es un lenguaje...",
      "highlight": {
        "title": ["<em>TypeScript</em> Advanced Types"],
        "content": ["...usando <em>TypeScript</em> para..."]
      }
    }
  ],
  "page": 1,
  "limit": 10
}
```

---

## 🛠️ **Comandos Útiles**

### **Verificar estado de Elasticsearch:**
```bash
docker-compose exec elasticsearch curl -u elastic:${ELASTIC_PASSWORD} http://localhost:9200/_cluster/health
```

**Respuesta esperada:**
```json
{
  "cluster_name": "docker-cluster",
  "status": "green",
  "timed_out": false,
  "number_of_nodes": 1,
  "active_primary_shards": 1
}
```

### **Ver todos los índices:**
```bash
docker-compose exec elasticsearch curl -u elastic:${ELASTIC_PASSWORD} http://localhost:9200/_cat/indices?v
```

### **Ver documentos en un índice:**
```bash
docker-compose exec elasticsearch curl -u elastic:${ELASTIC_PASSWORD} http://localhost:9200/cms_posts/_search | jq
```

### **Limpiar un índice (borrar todos sus documentos):**
```bash
docker-compose exec elasticsearch curl -X DELETE -u elastic:${ELASTIC_PASSWORD} http://localhost:9200/cms_posts
```

### **Reindexar todos los posts:**
```bash
# Desde la app Node.js, ejecutar:
npm run reindex:posts
```

---

## 📊 **Estrategia de Búsqueda**

La búsqueda usa **multi_match query** con boosting:

```javascript
{
  multi_match: {
    query: "typescript framework",
    fields: [
      'title^3',           // Título: 3x peso
      'excerpt^2',         // Resumen: 2x peso
      'content',           // Contenido: 1x peso
      'username^2',        // Username: 2x peso
      'displayName',       // Display name: 1x peso
      'bio'                // Bio: 1x peso
    ],
    fuzziness: 'AUTO',     // Tolera typos
    operator: 'or'         // Cualquier término
  }
}
```

**Ejemplo:**
- Búsqueda: `"typescrit"` → Encuentra `"typescript"` (fuzzy)
- Búsqueda: `"angular framework"` → Encuentra docs con ambas palabras
- Búsqueda en títulos tiene prioridad (score más alto)

---

## 🚀 **Cuándo usar Elasticsearch vs PostgreSQL**

### **PostgreSQL (tus tablas actuales):**
```sql
SELECT * FROM posts WHERE id = '123';           -- ✅ Rápido
SELECT * FROM posts WHERE authorId = '456';     -- ✅ Rápido
SELECT * FROM posts WHERE title = 'exact';      -- ❌ Lento en millones
```

### **Elasticsearch (para búsqueda):**
```
GET /cms_posts/_search?q=framework         -- ✅ Ultra rápido
GET /cms_posts/_search?q=typescri*         -- ✅ Con wildcard
GET /cms_posts/_search?q=react typescript  -- ✅ Multi-término
```

---

## ⚙️ **Variables de Entorno (`.env`)**

```env
# Elasticsearch
ELASTIC_HOST=http://elasticsearch:9200    # URL en Docker
ELASTIC_USERNAME=elastic                  # Usuario default
ELASTIC_PASSWORD=your_password_here       # Tu contraseña (required)
ELASTIC_PORT=9200                         # Puerto expuesto

# Ejemplo:
ELASTIC_PASSWORD=secure_elastic_pass_2024
```

---

## 🔄 **Cómo se Indexan los Datos**

### **Opción 1: Automático al crear/editar post**

Cuando creas un post en `/api/v1/posts` (POST), el worker automáticamente:
1. Guarda en PostgreSQL
2. Envía job a BullMQ
3. Elasticsearch lo indexa en segundo plano

### **Opción 2: Reindexado manual**

Si necesitas reindexar todos los posts:

```bash
# Script que lee de PostgreSQL y envía a Elasticsearch
npm run reindex:posts
```

---

## 📈 **Monitoreo y Troubleshooting**

### **¿Elasticsearch no responde?**

1. **Verificar que está corriendo:**
   ```bash
   docker-compose ps elasticsearch
   ```

2. **Ver logs:**
   ```bash
   docker-compose logs elasticsearch
   ```

3. **Reiniciar:**
   ```bash
   docker-compose restart elasticsearch
   ```

4. **Limpiar datos y reiniciar:**
   ```bash
   docker-compose down -v elasticsearch
   docker-compose up -d elasticsearch
   ```

### **¿Las búsquedas son lentas?**

- Aumentar memoria JVM en docker-compose.yml:
  ```yaml
  ES_JAVA_OPTS=-Xms1024m -Xmx1024m  # En lugar de 512m
  ```

- Agregar shards y replicas (producción):
  ```json
  {
    "settings": {
      "number_of_shards": 3,
      "number_of_replicas": 2
    }
  }
  ```

---

## 🎓 **Resumen**

| Aspecto | Descripción |
|------------|-------------|
| **¿Qué es?** | Motor de búsqueda full-text en tiempo real |
| **¿Dónde corre?** | Contenedor Docker (`image: elasticsearch:8.12.0`) |
| **¿Puerto?** | 9200 (HTTP) |
| **¿Autenticación?** | Username/password (elastic/password) |
| **¿Índices?** | cms_posts, cms_users |
| **¿Endpoint?** | GET /api/v1/search?q=... |
| **¿Performance?** | 1000x más rápido que LIKE en BD grandes |
| **¿Cuándo usar?** | Búsqueda full-text, análisis de texto |

---

## 🔗 **Recursos**

- [Elasticsearch Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [JavaScript Client](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/index.html)
- [Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html)
