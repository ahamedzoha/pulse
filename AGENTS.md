# Pulse — Agent Context

This file is the **on-ramp** for AI agents working in this repo. **Authoritative project knowledge** lives in **README.md**, **infra/postgres/init.sql**, and the source next to your change. Do not invent stack choices, env vars, or file layout — read the docs and code first.

## What this project is

**Pulse** is a learning/demo system (not production) that practices RBDOps AI patterns:

- **App 1 — Pulse Board** (`apps/board`, port 3000): SSO-gated Kanban task board with health decay and mood tagging
- **App 2 — Pulse Intel** (`apps/intel`, port 3001): Live activity feed, health leaderboard, momentum meter, RAG Q&A panel
- **Shared API** (`apps/api`, port 4000): NestJS backend — auth (MSAL Node OIDC + passport-jwt session), tasks, events, BullMQ workers, SSE, RAG

**Purpose:** Validate event ingestion → queue → AI analysis → contextual summaries, plus Entra SSO/RBAC and pgvector RAG before onboarding to the RBDOps AI client project.

## Mandatory reading

| Priority | File | When to read |
|----------|------|--------------|
| 1 | **README.md** | Architecture, build order, ports, env vars, event/RAG flows, **§13 Troubleshooting** |
| 2 | **infra/postgres/init.sql** | Schema, enums, pgvector dimensions (1536) |
| 3 | **.env.example** | All required environment variables |
| 4 | **packages/shared-types/** | Canonical `TaskEvent`, mood enum, DTOs |
| 5 | **infra/docker-compose.yml** | Local infra — Postgres + Redis only |

## Stack (do not swap without strong reason)

| Layer | Technology |
|-------|------------|
| Auth | Microsoft Entra ID (Free tier OK) via MSAL Node OIDC in NestJS; app session JWT (passport-jwt); `groups` → RBAC |
| Frontends | Next.js 16 App Router, TypeScript, Tailwind CSS v4 (`@theme` in CSS) |
| API | NestJS, TypeScript strict |
| Database | PostgreSQL 16 + pgvector (same instance) |
| Queue | BullMQ + Redis |
| LLM + embeddings | Alibaba DashScope (OpenAI-compatible SDK, intl endpoint) |
| Local infra | Docker Compose: `pgvector/pgvector:pg16` + `redis:7-alpine` |
| Package mgmt | pnpm workspaces |

**Apps run on the host** (`pnpm dev`), not in Docker — fast DX.

## Repository map

```
pulse/
├── AGENTS.md                 ← this file
├── README.md                 ← full project spec
├── .env.example
├── apps/
│   ├── api/                  ← NestJS (shared backend)
│   ├── board/                ← Next.js App 1 (port 3000)
│   └── intel/                ← Next.js App 2 (port 3001)
├── packages/
│   └── shared-types/         ← TaskEvent schema, DTOs, mood enum
└── infra/
    ├── docker-compose.yml    ← postgres + redis only
    └── postgres/init.sql
```

## Build order (follow unless told otherwise)

1. Infra — Docker Compose + schema *(scaffolded)*
2. Entra ID — tenant (Free tier OK), groups, single app registration — see `docs/entra-setup.md`
3. NestJS API — AuthModule, RolesGuard, `/auth/me`, user upsert
4. Task CRUD + event emission → `task_events` + BullMQ `task-events` queue
5. Workers — single `task-events` processor (embed + per-task health recompute + SSE); health cron (15 min) as safety net
6. RAG — `POST /intel/query` (embed → pgvector → Qwen stream + chat persistence)
7. Board UI — Kanban, health badges, mood picker
8. Intel UI — SSE feed, leaderboard, momentum meter, AI chat panel (scrollable session history)

## Key domain rules

### Health decay

| Status | Decay rate |
|--------|------------|
| `todo` | 2 pts / hour |
| `in_progress` | 1 pt / hour |
| `review` | 0.5 pts / hour |
| `done` | 0 (frozen) |

Formula: `100 - (hours_since_last_activity × decay_rate)`, floor at 0. Badge colors: green >70, amber 40–70, red <40. Recomputes immediately after each task event (processor); cron every 15 min catches stragglers.

### Mood tags (on every task update)

`high` | `medium` | `low` | `neutral` — stored on `task_events.mood`.

### RBAC (Entra security groups → JWT `groups`)

| Role | Group | Access |
|------|-------|--------|
| `pulse-admin` | pulse-admin | Full Board + Intel |
| `pulse-member` | pulse-member | Create/update tasks, comment, Intel |
| `pulse-viewer` | pulse-viewer | Intel read-only only |

NestJS pattern (`passport-azure-ad` is deprecated — backend runs MSAL OIDC, issues an app session JWT, validates it with `passport-jwt`):

```typescript
@Roles('pulse-admin', 'pulse-member')
@UseGuards(AuthGuard('jwt'), RolesGuard)
```

### Event flow

Every task mutation → `task_events` row → BullMQ `task-events` job → workers (embed, health, realtime SSE).

Workers JOIN `tasks` + `users` by `taskId`/`actorId` to enrich context — queue payload stays minimal.

### SSE realtime (Intel feed)

Simple EventEmitter pattern in the task-events processor. Intel endpoint: `GET /intel/feed` — SSE stream (unauthenticated POC); `GET /intel/feed/recent` hydrates history on load. No reconnect logic (POC scope).

### RAG flow

Question → DashScope `text-embedding-v4` → pgvector cosine search (top 10) → Qwen prompt with prior chat turns + RAG context → stream response; persist in `intel_chat_turns`.

### Intel AI panel (chat UX)

- **DB-backed per user** (`intel_chat_turns`): `GET /intel/chat` on load, `DELETE /intel/chat` to clear
- Each query persists a turn; prior turns (up to `INTEL_CHAT_LLM_HISTORY_LIMIT`) are sent to Qwen as multi-turn context alongside RAG retrieval for the new question
- Chat-style scrollable UI; input clears on send; eight quick-prompt chips on empty state (`SUGGESTIONS` in `AiPanel.tsx`) — grounded in `pnpm seed:demo` data
- Expandable task detail drawer: `GET /intel/tasks/:id` from leaderboard, feed, and AI source cards
- Feed hydration: `GET /intel/feed/recent` loads activity on load; SSE streams only new events after connect

**Intel AI demo chips** (require seeded data):

| Prompt | Demonstrates |
|--------|----------------|
| What are the biggest bottlenecks right now? | Cross-task synthesis |
| Which tasks are at critical risk—and why? | Health score + comment context |
| What were our recent sprint wins? | High-mood / completed work |
| What's blocking the user registration deploy? | Legal/ToS blocker retrieval |
| How was the API latency spike fixed? | Root-cause narrative |
| What production alerts came up last night? | Production incident thread |
| What's stuck waiting on Legal, DevOps, or AWS? | External dependency map |
| What needs a Product decision before Friday? | Release urgency / scope decision |

### DashScope client

DashScope == Alibaba **Model Studio** == Bailian (just rebranded console). Key setup:
see `docs/dashscope-setup.md`.

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
});
```

Models: `qwen-plus` (LLM), `text-embedding-v4` (1536 dims). **Note:** `text-embedding-v3` caps at
1024 dims — v4 is required for the `vector(1536)` schema. Configurable via `EMBED_MODEL` /
`EMBED_DIMENSIONS`.

## Code conventions

- **TypeScript strict** everywhere
- **pnpm** for package management; shared types in `@pulse/shared-types`
- **Minimize scope** — focused diffs, match existing patterns
- **No Docker for apps** — only Postgres + Redis in Compose
- **Append-only events** — `task_events` is the activity source of truth
- **Workers are separate concerns** — embed, health, realtime; each reads the same canonical event DTO

## Common commands

```bash
cp .env.example .env          # fill in Entra + DashScope secrets
pnpm install
pnpm infra:up                 # postgres + redis
pnpm dev:api                  # NestJS on :4000
pnpm dev:board                # Next.js on :3000
pnpm dev:intel                # Next.js on :3001
pnpm seed:demo                # demo tasks + embeddings + health targets
pnpm seed:sync-health         # repair health scores without full reseed
```

Local issues (health all 100, empty feed, RAG/embed failures, auth): **README.md §13 Troubleshooting**.

Verify infra:

```bash
docker compose -f infra/docker-compose.yml exec postgres \
  psql -U pulse -d pulse -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
```

## Anti-patterns

- Putting NestJS or Next.js apps in `docker-compose.yml`
- Using China-region DashScope endpoint (`dashscope.aliyuncs.com` without `-intl`)
- Writing to `task_events` without enqueueing a BullMQ job
- Hardcoding role names instead of mapping Entra group IDs from env
- Suggesting alternate vector DBs, auth providers, or message brokers without cause
- Reaching for deprecated `passport-azure-ad` — use MSAL Node for the OIDC flow
- Over-engineering abstractions — this is a demo, not production

## Agent style

- Engineer is experienced — skip basics unless asked
- Give **real code, real commands, real config** — not pseudocode
- Goal is **working, demonstrable code** — not perfect architecture
