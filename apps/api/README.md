# @pulse/api

NestJS backend shared by Board and Intel frontends.

**Port:** 4000 (host) — routes at root (`/auth`, `/tasks`, `/intel`, …), no `/api` prefix.

## Modules

| Module | Status | Notes |
|--------|--------|-------|
| `config/` | Done | Root `.env` loader + fail-fast validation |
| `database/` | Done | Global `pg` Pool service |
| `users/` | Done | Upsert from Entra, assignee list |
| `auth/` | Done | MSAL OIDC, passport-jwt, RolesGuard, federated logout |
| `health/` | Done | `GET /health` (DB ping) |
| `tasks/` | Done | CRUD, status, comments, reassignment + events + enqueue |
| `events/` | Done | Append-only `task_events` |
| `queue/` | Done | BullMQ `task-events` queue |
| `workers/` | Done | Single processor: embed + health recompute + SSE; health cron |
| `intel/` | Done | Feed, leaderboard, momentum, RAG chat, persistent chat |

## Key endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/health` | public | DB connectivity |
| GET | `/auth/login?app=board\|intel` | public | Entra OIDC redirect |
| GET | `/auth/logout?app=…` | public | Federated sign-out |
| GET | `/auth/callback` | public | Token exchange → `#token=` redirect |
| GET | `/auth/me` | JWT | Current user (role from DB) |
| GET/POST/PATCH | `/tasks` | JWT + member/admin | Task board API |
| GET | `/users` | JWT + member/admin | Assignee picker |
| GET | `/intel/feed` | public (POC) | SSE live activity |
| GET | `/intel/feed/recent` | JWT | Feed hydration |
| GET/DELETE | `/intel/chat` | JWT | AI chat history |
| POST | `/intel/query` | JWT | Streaming RAG + persist turn |
| GET | `/intel/leaderboard`, `/intel/momentum` | JWT | Intel panels |

## Run

```bash
pnpm install
pnpm infra:up
cp .env.example .env
pnpm dev:api
```

See root **README.md** for Entra, DashScope, and `pnpm seed:demo`.
