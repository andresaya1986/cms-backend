-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- búsqueda fuzzy
CREATE EXTENSION IF NOT EXISTS "unaccent";  -- ignorar tildes

-- Índice de texto completo para búsquedas
-- (Prisma maneja la creación de tablas, esto solo agrega extensiones)
