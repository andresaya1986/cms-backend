#!/usr/bin/env node
// ─────────────────────────────────────────
//  generate-secrets.js
//  Genera secretos seguros y los pega en .env
//  Uso: node scripts/generate-secrets.js
// ─────────────────────────────────────────
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ No se encontró el archivo .env. Ejecuta primero: cp .env.example .env');
  process.exit(1);
}

let content = fs.readFileSync(envPath, 'utf8');

const secrets = {
  JWT_ACCESS_SECRET:  crypto.randomBytes(48).toString('base64'),
  JWT_REFRESH_SECRET: crypto.randomBytes(48).toString('base64'),
  POSTGRES_PASSWORD:  crypto.randomBytes(24).toString('hex'),
  REDIS_PASSWORD:     crypto.randomBytes(24).toString('hex'),
  MONGO_PASSWORD:     crypto.randomBytes(24).toString('hex'),
  MINIO_PASSWORD:     crypto.randomBytes(24).toString('hex'),
  ELASTIC_PASSWORD:   crypto.randomBytes(20).toString('hex'),
  GRAFANA_PASSWORD:   crypto.randomBytes(16).toString('hex'),
};

let changed = 0;
for (const [key, value] of Object.entries(secrets)) {
  const regex = new RegExp(`^(${key}=)(.*)$`, 'm');
  if (regex.test(content)) {
    const current = content.match(regex)?.[2] || '';
    if (current.includes('CHANGE_ME') || current === '') {
      content = content.replace(regex, `$1${value}`);
      changed++;
      console.log(`✔ ${key} generado`);
    } else {
      console.log(`  ${key} ya tiene valor — se respeta`);
    }
  }
}

fs.writeFileSync(envPath, content);
console.log(`\n✅ ${changed} secretos generados en .env`);
console.log('⚠️  Recuerda configurar manualmente: SENDGRID_API_KEY, APP_URL, FRONTEND_URL\n');
