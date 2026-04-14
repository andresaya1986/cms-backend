import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomOtp, sha256, generateSlug, truncate, omit, pick, parsePagination, detectDevice } from '../shared/utils/index';

// ─────────────────────────────────────────
//  Utils — Tests
// ─────────────────────────────────────────
describe('generateSlug', () => {
  it('convierte a minúsculas y reemplaza espacios', () => {
    expect(generateSlug('Hola Mundo')).toBe('hola-mundo');
  });

  it('elimina tildes y caracteres especiales', () => {
    expect(generateSlug('Cómo crear una API')).toBe('como-crear-una-api');
  });

  it('elimina guiones al inicio y al final', () => {
    expect(generateSlug('  ---hello---  ')).toBe('hello');
  });

  it('colapsa múltiples guiones', () => {
    expect(generateSlug('hello   world')).toBe('hello-world');
  });
});

describe('randomOtp', () => {
  it('genera un código de la longitud correcta', () => {
    expect(randomOtp(6)).toHaveLength(6);
    expect(randomOtp(8)).toHaveLength(8);
  });

  it('solo contiene dígitos', () => {
    const otp = randomOtp(6);
    expect(/^\d+$/.test(otp)).toBe(true);
  });

  it('genera valores distintos en llamadas consecutivas', () => {
    const a = randomOtp(6);
    const b = randomOtp(6);
    // Probabilidad de colisión: 1 en 1,000,000
    expect(a).not.toBe(b);
  });
});

describe('sha256', () => {
  it('produce el mismo hash para la misma entrada', () => {
    expect(sha256('test')).toBe(sha256('test'));
  });

  it('produce hashes distintos para entradas distintas', () => {
    expect(sha256('a')).not.toBe(sha256('b'));
  });

  it('produce un hash de 64 caracteres hexadecimales', () => {
    expect(sha256('hello')).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('truncate', () => {
  it('no trunca si el texto cabe', () => {
    expect(truncate('hola', 10)).toBe('hola');
  });

  it('trunca correctamente', () => {
    const result = truncate('abcdefghij', 6);
    expect(result.length).toBeLessThanOrEqual(6);
    expect(result.endsWith('…')).toBe(true);
  });

  it('usa sufijo personalizado', () => {
    expect(truncate('abcdef', 5, '...')).toMatch(/\.\.\.$/);
  });
});

describe('omit', () => {
  it('omite claves especificadas', () => {
    const user = { id: '1', email: 'a@b.com', passwordHash: 'xxx' };
    const safe = omit(user, 'passwordHash');
    expect(safe).not.toHaveProperty('passwordHash');
    expect(safe).toHaveProperty('email');
  });

  it('omite múltiples claves', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(omit(obj, 'a', 'b')).toEqual({ c: 3 });
  });
});

describe('pick', () => {
  it('selecciona solo las claves indicadas', () => {
    const obj = { a: 1, b: 2, c: 3 };
    expect(pick(obj, 'a', 'c')).toEqual({ a: 1, c: 3 });
  });
});

describe('parsePagination', () => {
  it('retorna defaults cuando no hay query', () => {
    const { page, limit, skip } = parsePagination({});
    expect(page).toBe(1);
    expect(limit).toBe(20);
    expect(skip).toBe(0);
  });

  it('parsea valores correctamente', () => {
    const { page, limit, skip } = parsePagination({ page: '3', limit: '10' });
    expect(page).toBe(3);
    expect(limit).toBe(10);
    expect(skip).toBe(20);
  });

  it('limita el máximo de limit a 100', () => {
    const { limit } = parsePagination({ limit: '999' });
    expect(limit).toBe(100);
  });

  it('garantiza page mínimo de 1', () => {
    const { page } = parsePagination({ page: '-5' });
    expect(page).toBe(1);
  });
});

describe('detectDevice', () => {
  it('detecta mobile', () => {
    expect(detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')).toBe('mobile');
  });

  it('detecta tablet', () => {
    expect(detectDevice('Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)')).toBe('tablet');
  });

  it('detecta desktop', () => {
    expect(detectDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0')).toBe('desktop');
  });

  it('retorna unknown para UA vacío', () => {
    expect(detectDevice('')).toBe('unknown');
  });
});
