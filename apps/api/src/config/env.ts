import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load the repo-root .env (monorepo). cwd is the package dir under pnpm --filter.
for (const path of [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
]) {
  if (existsSync(path)) {
    config({ path });
    break;
  }
}

/**
 * Minimal env access with fail-fast validation for required secrets.
 * Read once at bootstrap; throws if a required var is missing.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  apiPort: Number(optional('API_PORT', '4000')),

  databaseUrl: required('DATABASE_URL'),
  redisUrl: optional('REDIS_URL', 'redis://localhost:6379'),

  jwtSecret: required('JWT_SECRET'),

  entra: {
    tenantId: required('ENTRA_TENANT_ID'),
    clientId: required('ENTRA_CLIENT_ID'),
    clientSecret: required('ENTRA_CLIENT_SECRET'),
    redirectUri: optional('ENTRA_REDIRECT_URI', 'http://localhost:4000/auth/callback'),
    groups: {
      admin: required('ENTRA_PULSE_ADMIN_GROUP_ID'),
      member: required('ENTRA_PULSE_MEMBER_GROUP_ID'),
      viewer: required('ENTRA_PULSE_VIEWER_GROUP_ID'),
    },
  },

  frontends: {
    board: optional('BOARD_URL', 'http://localhost:3000'),
    intel: optional('INTEL_URL', 'http://localhost:3001'),
  },
} as const;

export type Env = typeof env;
