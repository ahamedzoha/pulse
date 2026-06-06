# @pulse/api

NestJS backend shared by Board and Intel frontends.

**Port:** 4000 (host)

## Modules

| Module | Status | Notes |
|--------|--------|-------|
| `config/` | Done | Root `.env` loader + fail-fast validation |
| `database/` | Done | Global `pg` Pool service |
| `users/` | Done | `upsertFromEntra`, `findById` |
| `auth/` | Done | MSAL OIDC flow, passport-jwt, RolesGuard, group→role map |
| `health/` | Done | `GET /health` (DB ping) |
| `tasks/` | Pending | CRUD, status, comments, reassignment (step 4) |
| `events/` | Pending | `task_events` persistence + BullMQ enqueue (step 4) |
| `workers/` | Pending | embed, health (cron), realtime (`@nestjs/bullmq`) (step 5) |
| `intel/` | Pending | leaderboard, momentum, SSE `@Sse()`, RAG (steps 5–6) |

## Endpoints (current)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/health` | public | DB connectivity check |
| GET | `/auth/login?app=board\|intel` | public | Redirect to Entra (MSAL) |
| GET | `/auth/callback` | public | Exchange code, upsert user, redirect to frontend with `#token=` |
| GET | `/auth/me` | Bearer JWT | Current user (fresh role from DB) |

## Run

```bash
pnpm install
pnpm infra:up          # Postgres + Redis
cp .env.example .env   # fill Entra + DashScope secrets
pnpm dev:api           # http://localhost:4000
```

## Auth flow

1. Frontend → `GET /auth/login?app=board` → MSAL `getAuthCodeUrl` → Entra
2. Entra → `GET /auth/callback?code&state` → MSAL `acquireTokenByCode` → read `oid/name/email/groups`
3. Map `groups` → role (`role-mapping.ts`), upsert `users` row
4. Sign app session JWT (`JWT_SECRET`, 8h) → redirect to frontend `#token=...`
5. Frontend sends `Authorization: Bearer <jwt>`; `JwtStrategy` validates; `RolesGuard` checks role

Protect routes with:

```typescript
@Roles('pulse-admin', 'pulse-member')
@UseGuards(JwtAuthGuard, RolesGuard)
```

See root **README.md** for remaining build order steps 4–8.
