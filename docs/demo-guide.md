# Pulse — Demo Guide

A step-by-step runbook for presenting Pulse end to end. Shows **what to click**, **what to say**, and **the tech each beat showcases**.

- **Audience:** technical + semi-technical (engineers, leads, stakeholders)
- **Duration:** ~12–15 min (core), +5 min for the under-the-hood section
- **One-liner:** *"A task board where every update is read on three axes — health, sentiment, and energy — streamed live into an AI intelligence console."*

---

## TL;DR — the demo arc

```
Sign in (3 roles, RBAC)  →  Board: create + comment (instant sentiment)
   →  ⭐ Live loop: post a frustrated comment, watch Intel react in real time
   →  Mood map + divergence + per-task vibe
   →  AI panel: ask grounded questions over the activity
   →  (optional) peek under the hood: DB, worker, architecture
```

The **money shot** is the live loop (step 3): one action on the Board ripples through the queue, the hybrid sentiment pipeline, and the SSE stream into Intel — visible in seconds.

---

## Before you present (pre-flight, ~3 min)

Run these and confirm each is green:

```bash
pnpm infra:up                      # Postgres + Redis (Docker)

# Existing DB? ensure the sentiment migration is applied (idempotent):
docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -U pulse -d pulse < infra/postgres/migrations/002_event_sentiment.sql

pnpm dev:api                       # :4000  (workers run inside this process)
pnpm dev:board                     # :3000
pnpm dev:intel                     # :3001

# Demo data + scored history (so the mood map & divergence aren't empty):
pnpm seed:demo                     # realistic tasks/comments + embeddings
pnpm --filter @pulse/api build && pnpm --filter @pulse/api backfill:sentiment -- --llm
```

Verify:

```bash
curl -s http://localhost:4000/health        # {"status":"ok",...}
```

**Browser setup:** open **two windows side by side** — Board (`:3000`) on the left, Intel (`:3001`) on the right. For role-switching, use separate browser profiles or incognito windows.

**Demo accounts:** in `users.txt` (gitignored, local only).

| Account | Role | Use it for |
|---------|------|-----------|
| Alice | `pulse-admin` | Full Board + Intel (the main driver) |
| Bob | `pulse-member` | Board writes + Intel |
| Carol | `pulse-viewer` | Intel **read-only** — shows RBAC gating |

> **AI key check:** the LLM features (RAG answers, sentiment energy/emotions) need a valid `DASHSCOPE_API_KEY`. Without it, valence still works (lexicon) but energy/emotions won't refine — verify a quick AI question returns text before going live.

---

## The story you're telling

Pulse is a **warm-up build that practices the RBDOps AI patterns** — event ingestion → queue workers → AI analysis → real-time executive view, with SSO/RBAC and RAG — on a small, self-contained system. Keep tying each feature back to that: *"this is the same shape as ingesting emails/meetings and surfacing project risk."*

---

## Walkthrough

### 0 — The pitch (30s)

- **Say:** "Two apps over one backend. The **Board** is where work happens; **Intel** is the live intelligence layer that reads it. Every task has an objective **health** score that decays, and every update gets a **sentiment** read — combined into how the work *feels*."
- **Showcases:** the premise. Pull up the architecture diagram in the [README §3](../README.md#3-architecture) if the audience is technical.

### 1 — SSO + RBAC (1.5 min)

- **Do:** On Board, click **Sign in with Microsoft** → sign in as **Carol (viewer)**. The Board shows an *access-restricted* screen pointing to Intel. Then open Intel as Carol — full read access.
- **Do:** Switch to **Alice (admin)** on the Board — full Kanban.
- **Say:** "Single Entra app registration. The API runs the OIDC flow, maps Entra security groups to roles, and issues its own session JWT. Viewers can read Intel but can't touch the Board — enforced server-side, not just hidden in the UI."
- **Showcases:** **Microsoft Entra SSO**, **MSAL OIDC + passport-jwt**, **role-based guards** (`@Roles` + `RolesGuard`).

### 2 — Board: the write side (2 min)

- **Do:** Point out the columns and the **health badges** (green/amber/red) and the colored accent stripe. Note an at-risk (red) card.
- **Do:** Click **New task** → fill title/description → pick an **assignee chip** → leave **Mood: Auto** → create.
- **Do:** Open a task → **Comment** tab → type a positive update like *"Shipped the fix, tests green, looking clean!"* → leave mood **Auto** → **Post**. Point out the **instant valence chip** (lexicon scored it the moment you posted) and the **activity timeline** below.
- **Say:** "Mood used to be a chore — pick it on every action. Now it's **auto-derived** from what you write; the picker is just an optional override. Health is **derived**, not stored — it decays from time-since-activity by status (todo loses 2 pts/hr)."
- **Showcases:** **event-sourced `task_events`**, **DB transactions + row locking**, **instant lexicon sentiment** on the write path, **health-decay model**.

### 3 — ⭐ The live loop (3 min) — the money shot

Put Board (left) and Intel (right) side by side. On Intel, keep the **Live activity** feed and the **mood map** visible.

- **Do:** On the **Board**, open the worst-health (red) task and post a **frustrated** comment, e.g. *"This is blocked again — prod crashed overnight, really frustrating."* Mood **Auto**.
- **Watch Intel (right) in real time:**
  1. The event **streams into the feed instantly** (SSE) with a flash + toast.
  2. The valence chip shows the **lexicon** read, then **refines** — the task drawer shows a brief *"reading sentiment…"* as the LLM lands energy + emotions.
  3. The **mood map centroid shifts** toward the *Firefighting* quadrant (high energy, negative).
  4. A **divergence flag** may appear — *"strain behind high energy"* or *"negative tone while health still green."*
- **Say:** "One comment just went: API → Postgres → BullMQ queue → a worker that recomputed health, ran the **LLM sentiment refine**, embedded it for search, and pushed it over **SSE** — and the whole Intel view reacted in seconds. That async ingestion-to-insight loop is the core RBDOps pattern."
- **Showcases:** **BullMQ queue + worker**, **hybrid sentiment (instant lexicon → async LLM refine)**, **Server-Sent Events** (one shared connection feeding feed + map), the **valence × energy affect model**, **divergence detection**.

> See [`mood-intelligence.md`](mood-intelligence.md) for the model and formulas if anyone asks "how is sentiment computed?"

### 4 — Intel: mood intelligence (2 min)

- **Do:** Walk the **2-D mood map** — explain the axes (valence ← →, energy ↑↓) and the four quadrants (In flow / Cruising / Firefighting / Stalled). Point at the centroid + per-quadrant counts.
- **Do:** Open the **health leaderboard** (lowest-health first), click a red task → the **detail drawer** shows the **vibe badge**, a **divergence callout**, and per-event **valence + emotion tags**.
- **Say:** "Two signals on purpose. **Health is lagging** — it only drops once work goes stale. **Sentiment is leading** — people *sound* frustrated before the score falls. The divergence flag is the early warning: negative tone while health is still green."
- **Showcases:** **multi-dimensional model**, **leading vs lagging indicators**, **divergence** as the payoff a single blended score would hide.

### 5 — Intel: the AI panel / RAG (2.5 min)

- **Do:** Click a **quick-prompt chip**. Strong picks:
  - *"Which tasks are at critical risk—and why?"* → ties low health scores to the comment/mood narrative.
  - *"What are the biggest bottlenecks right now?"* → cross-task synthesis.
  - *"How was the API latency spike fixed?"* → root-cause storytelling from the activity log.
- **Do:** Watch the answer **stream in** with **source citations** (click one → opens the task drawer). Then ask a **follow-up** in your own words to show multi-turn memory.
- **Say:** "This is RAG over the activity history. The question is embedded, pgvector finds the most relevant events, we attach a live health snapshot, and Qwen answers — grounded, with citations, and aware of which tasks are actually at risk."
- **Showcases:** **pgvector semantic search** (with a relevance floor), **DashScope Qwen** streaming, **health-aware prompting**, **persistent multi-turn chat**.

### 6 — Under the hood (optional, ~5 min, technical audience)

- **Do (DB):**
  ```bash
  docker compose -f infra/docker-compose.yml exec postgres \
    psql -U pulse -d pulse -c \
    "SELECT left(comment_text,40) AS comment, mood AS energy, sentiment AS valence, sentiment_src AS src, emotions
       FROM task_events WHERE event_type='commented' ORDER BY occurred_at DESC LIMIT 5;"
  ```
  Show `sentiment_src` flipping `lexicon` → `llm` and the inferred `emotions`.
- **Do (live stream):** `curl -N "http://localhost:4000/intel/feed?token=<jwt>"` then post a comment — the raw SSE frame prints.
- **Do (code tour):** open `apps/api/src/workers/task-events.processor.ts` (the worker), `apps/api/src/sentiment/lexicon.ts` (classic NLP), and `packages/shared-types/src/index.ts` (`classifyVibe` / `detectDivergence`).
- **Showcases:** the monorepo, the single canonical event schema, and how thin/clean the worker is.

### 7 — Close + PRD alignment (1–2 min)

- **Say:** "Recap: SSO + RBAC, event-sourced board, queue-driven workers, hybrid sentiment, a multi-dimensional mood model with divergence alerts, real-time SSE, and RAG."
- **Tie it to the build:** "This is a deliberate warm-up for the RBDOps AI Command Center. It runs on the **exact recommended stack** — Next.js, NestJS/Node, Postgres + pgvector, BullMQ, Entra SSO, model-swappable LLM — and proves the whole **ingest → queue → AI → real-time view** spine. The deltas to the real build are integration breadth (M365/Asana/Clockify connectors replace the Board as the event source), multi-signal health scoring, and the governance layer (HR separation, audit, per-alert confidence). Those are *extensions* of what's already running, not new architecture."
- **If the audience knows the PRD:** open [`prd-alignment.md`](prd-alignment.md) — the section-by-section mapping (✅ demonstrated / 🟡 partial / ⬜ by-design gaps), including where Pulse is *ahead* of the MVP (the NL Q&A interface is a PRD Phase-2 item, already built) and the honest gaps (governance, alert engine, Claude swap).
- Point to the [README](../README.md), [`mood-intelligence.md`](mood-intelligence.md), and [`prd-alignment.md`](prd-alignment.md) for depth.

---

## Tech showcase cheat-sheet

| When you're showing… | …name-drop this |
|----------------------|-----------------|
| Sign-in / role gating | Entra ID SSO, MSAL OIDC, app-session JWT, `RolesGuard` |
| Creating / commenting | Event sourcing (`task_events`), Postgres transactions |
| Instant valence chip | Classic lexicon (AFINN-style, VADER normalization), zero-latency, no API |
| "reading sentiment…" → emotions | BullMQ worker + Qwen LLM refine (energy + emotions) |
| Feed updating live | Server-Sent Events, single shared `RealtimeProvider` |
| Mood map | Circumplex affect model (valence × energy), `momentum2d` aggregation |
| Divergence flag | Leading (sentiment) vs lagging (health) indicators |
| Health badges | Time-decay score computed in SQL, event-driven + 15-min cron |
| AI answers + citations | pgvector RAG, DashScope Qwen streaming, health-aware prompt |
| Whole thing | Next.js 16 · NestJS · pnpm monorepo · Docker (PG+pgvector, Redis) |

---

## If something goes sideways

| Symptom | Fix on the spot |
|---------|-----------------|
| Intel feed shows **Offline** | API down or token expired → hard-refresh Intel; confirm `:4000/health`. |
| New comment doesn't appear in Intel | Worker/Redis hiccup → `pnpm infra:logs`; the Board still shows it (refetch). |
| Sentiment stuck on lexicon (no emotions) | `DASHSCOPE_API_KEY` invalid/rate-limited → say "the LLM refine is degraded; the instant lexicon read still works" (it's a designed fallback). |
| AI answer errors / "Embeddings unavailable" | Same key issue → fall back to the mood map + leaderboard, which need no LLM. |
| Health all green / 100 | Fresh seed reset activity timestamps → `pnpm seed:sync-health`. |
| Mood map empty | History unscored → re-run `backfill:sentiment -- --llm`. |

See [README §13 Troubleshooting](../README.md#13-troubleshooting) for the full list.

---

## Reset between runs

```bash
pnpm seed:demo                                         # fresh tasks + embeddings
pnpm --filter @pulse/api backfill:sentiment -- --llm   # re-score history
```

Then hard-refresh both browser windows. A clean run starts from the [pre-flight checklist](#before-you-present-pre-flight-3-min).
