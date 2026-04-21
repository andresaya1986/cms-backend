import crypto from 'crypto';

// ─────────────────────────────────────────
//  Slug generator
// ─────────────────────────────────────────
export function generateSlug(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function uniqueSlug(base: string): string {
  return `${generateSlug(base)}-${Date.now().toString(36)}`;
}

// ─────────────────────────────────────────
//  Crypto helpers
// ─────────────────────────────────────────
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function randomOtp(length = 6): string {
  const digits = '0123456789';
  const buf = crypto.randomBytes(length);
  return Array.from(buf, (b) => digits[b % digits.length]).join('');
}

// ─────────────────────────────────────────
//  Sanitización básica de HTML
// ─────────────────────────────────────────
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export function truncate(text: string, maxLength: number, suffix = '…'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length).trimEnd() + suffix;
}

// ─────────────────────────────────────────
//  Paginación
// ─────────────────────────────────────────
export function parsePagination(query: Record<string, unknown>, defaults = { page: 1, limit: 20 }) {
  const page = Math.max(1, Number(query.page) || defaults.page);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || defaults.limit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// ─────────────────────────────────────────
//  Delay / retry helper
// ─────────────────────────────────────────
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function retry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  delayMs = 500,
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      await sleep(delayMs * (i + 1));
    }
  }
  throw new Error('retry: should not reach here');
}

// ─────────────────────────────────────────
//  Detección de dispositivo desde User-Agent
// ─────────────────────────────────────────
export function detectDevice(ua: string): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
  if (!ua) return 'unknown';
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone|ipod|windows phone/i.test(ua)) return 'mobile';
  if (/mozilla|chrome|safari|firefox/i.test(ua)) return 'desktop';
  return 'unknown';
}

// ─────────────────────────────────────────
//  Extracción segura de Bearer token
// ─────────────────────────────────────────
export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}

// ─────────────────────────────────────────
//  Mention / Keyword extraction
// ─────────────────────────────────────────
/**
 * Extrae @menciones de un texto
 * @example extractMentions("Hola @usuario1 y @usuario2") → ["usuario1", "usuario2"]
 */
export function extractMentions(text: string): string[] {
  const regex = /@(\w+)/g;
  const mentions = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const username = match[1].toLowerCase();
    // Validar que sea un username válido (3-30 chars, alphanumeric + _-)
    if (/^[a-z0-9_-]{3,30}$/.test(username)) {
      mentions.add(username);
    }
  }
  return Array.from(mentions);
}

/**
 * Extrae #hashtags de un texto
 * @example extractHashtags("Esto es #awesome #cool") → ["awesome", "cool"]
 */
export function extractHashtags(text: string): string[] {
  const regex = /#(\w+)/g;
  const hashtags = new Set<string>();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const tag = match[1].toLowerCase();
    // Validar que sea válido (3-30 chars)
    if (/^[a-z0-9]{3,30}$/.test(tag)) {
      hashtags.add(tag);
    }
  }
  return Array.from(hashtags);
}

// ─────────────────────────────────────────
//  Formateo de bytes
// ─────────────────────────────────────────
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// ─────────────────────────────────────────
//  Omitir campos de un objeto (como passwordHash)
// ─────────────────────────────────────────
export function omit<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((k) => delete result[k]);
  return result as Omit<T, K>;
}

export function pick<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
  return keys.reduce((acc, k) => {
    if (k in obj) acc[k] = obj[k];
    return acc;
  }, {} as Pick<T, K>);
}
