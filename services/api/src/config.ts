import 'dotenv/config';
import { resolve } from 'node:path';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  accessTtl: '15m' as const,
  refreshTtlDays: 30,
  storageDir: resolve(process.env.STORAGE_DIR ?? './storage'),
  issuerKeysDir: resolve(process.env.ISSUER_KEYS_DIR ?? './.keys'),
  corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean),
  verifyBaseUrl: process.env.VERIFY_BASE_URL ?? 'http://localhost:5174/v',
  presentationTtlSeconds: Number(process.env.PRESENTATION_TTL_SECONDS ?? 120),
  // Number of reverse proxies in front of the API (e.g. 1 behind Coolify's Traefik),
  // so rate limits apply per client rather than per proxy.
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  maxUploadBytes: 10 * 1024 * 1024,
  credentialValidityYears: 5,
};
