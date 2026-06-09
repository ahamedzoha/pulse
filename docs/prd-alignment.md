# Pulse ↔ RBDOps AI — PRD Alignment

How this POC maps to the **RBD AI Operations Command Center** PRD (RBDOps AI, May 2026). Pulse is a deliberate warm-up: it rehearses the PRD's **architecture, auth, ingestion pipeline, and AI patterns** end-to-end on a small self-contained dataset, so the real build starts from proven foundations rather than a blank page.

> **Verdict:** Pulse demonstrates the full **spine** of the RBDOps MVP — Entra SSO + RBAC → event ingestion → queue workers → AI analysis (sentiment + RAG + health scoring) → real-time executive view — on the **exact recommended stack**. The deltas are **integration breadth** (real M365/Asana/GHL/SharePoint/Clockify connectors), the **governance layer** (HR separation, audit logs, per-alert confidence/ownership), and **multi-signal scoring** — all *extensions* of patterns Pulse already proves, not new architecture.

**Legend:** ✅ demonstrated · 🟡 pattern shown / partial · ⬜ out of POC scope (by design)

---

## 1. Architecture & stack — near 1:1 (PRD §12, §16)

| PRD recommendation | Pulse | Status |
|--------------------|-------|--------|
| Frontend: React / Next.js | Next.js 16 (App Router) ×2 apps | ✅ |
| Backend: Node.js or Python | NestJS (Node, TypeScript strict) | ✅ |
| Database: PostgreSQL | PostgreSQL 16 | ✅ |
| Vector store: pgvector / Pinecone / … | pgvector (1536-dim, HNSW cosine) | ✅ |
| Auth: Microsoft Entra ID / Azure AD SSO | Entra ID via MSAL OIDC → app JWT | ✅ |
| Queueing: Celery / BullMQ / cloud queue | BullMQ + Redis | ✅ |
| AI model: **Claude API**, switchable | DashScope **Qwen** via OpenAI-compatible SDK | 🟡 *swap-ready, not Claude today* |
| Hosting: Azure; Monitoring: Azure Monitor/Datadog | Local Docker Compose; Nest logger | ⬜ *POC runs locally* |
| AI Layer: RAG, structured JSON, prompt templates, confidence | pgvector RAG, structured-JSON sentiment, `prompts.ts`, relevance floor | 🟡 *confidence partial* |
| Data Layer: normalized activity DB, entity matching, audit logs, retention | Normalized `task_events` + entities; JOIN-based enrichment | 🟡 *no audit logs / retention* |
| Application Layer: dashboard, RBAC, search/Q&A, scoring engine, alerting, approval workflow | Intel dashboard, RolesGuard, AI Q&A, health engine | 🟡 *alert engine + approval workflow ⬜* |

The LLM is reached through an OpenAI-compatible client, so switching Qwen → **Claude API** (the PRD's preference) is a base-URL + key change, not a rewrite.

---

## 2. Auth & role routing (PRD §2, §6.1, §14)

| PRD | Pulse | Status |
|-----|-------|--------|
| Entra ID / Azure AD SSO | MSAL Node OIDC, app session JWT | ✅ |
| Route insights by leadership responsibility (CEO/MD/HR/PM/Employee) | Entra groups → roles (`admin`/`member`/`viewer`) → `RolesGuard` | 🟡 *same pattern, fewer roles* |
| Managers see only their scope; HR-only sensitive alerts | RBAC gating (viewer is read-only, blocked from Board writes) | 🟡 *gating proven; per-scope/HR separation not built* |

Pulse proves the **Entra-group → role → server-enforced access** chain the PRD requires; RBDOps extends it to five roles with data-scoping and an HR-only partition.

---

## 3. Ingestion pipeline — the core spine (PRD §5, §6, §18 M2–M3)

| PRD | Pulse | Status |
|-----|-------|--------|
| Ingest activity from M365 / Asana / GHL / SharePoint / Clockify | **Board emits `task_events`** as the stand-in source | 🟡 *one source, manual — by design* |
| Normalize to a project/activity DB | Append-only `task_events` (event sourcing) | ✅ *pattern* |
| Event → process → outputs (alerts, scores, digests) | `task-events` → BullMQ worker → health + sentiment + embed + SSE | ✅ *exact shape* |

This is the most important alignment: the **ingest → normalize → queue → AI workers → real-time output** loop is built and working. In RBDOps, integration connectors replace the Board as the event *source*; the pipeline downstream is the same.

---

## 4. AI analysis layer (PRD §7, AI Layer)

| PRD capability | Pulse | Status |
|----------------|-------|--------|
| Tone-based issue detection (negative tone, frustration, urgency, confusion) | **Hybrid sentiment** (lexicon + Qwen) → valence + emotions | ✅ |
| Structured JSON outputs | Sentiment service returns `{valence, energy, emotions}` (validated/clamped) | ✅ |
| Retrieval-augmented generation | pgvector cosine top-K + relevance floor → Qwen, grounded + cited | ✅ |
| Natural-language Q&A interface (PRD Phase 2) | Intel AI panel: streamed answers, citations, multi-turn memory | ✅ *ahead of the PRD's MVP* |
| Meeting summarization / action-item extraction | — | ⬜ *needs transcripts* |
| Confidence scoring on outputs | RAG relevance score + sentiment source (`lexicon`/`llm`) | 🟡 *no formal per-insight confidence* |

See [`mood-intelligence.md`](mood-intelligence.md) for the sentiment + RAG internals.

---

## 5. Project health scoring (PRD §8)

| PRD | Pulse | Status |
|-----|-------|--------|
| 0–100 score, transparent, banded | `health_score` 0–100, SQL formula, green/amber/red | ✅ *pattern* |
| Multi-signal inputs (tasks, deadline movement, client + internal sentiment, response time, action items, SharePoint progress, time logged) | Single signal: time-since-activity decay by status | 🟡 *one signal; sentiment tracked as a separate axis* |
| Admin-configurable scoring | Decay rates are constants | ⬜ |

Pulse proves the **scoring-engine + banded-status + event-driven recompute** machinery (immediate + 15-min cron). RBDOps swaps the single decay signal for a weighted blend — and Pulse's **divergence model** (below) already shows how to fuse an objective score with a sentiment signal.

> Band thresholds differ (Pulse green>70/amber 40–70/red<40 vs PRD 90–100/75–89/60–74/<60) — trivially re-tunable.

---

## 6. Proactive risk detection — Pulse's standout alignment (Exec Summary, §3, §9)

The PRD is emphatic: *"should not function as a passive reporting tool… proactively identify project risk… negative tone… before they become larger business problems."* Pulse was built around exactly this:

| PRD intent | Pulse | Status |
|------------|-------|--------|
| Surface risk *before* it shows in hard metrics | **Divergence detection** — sentiment (leading) vs health (lagging) | ✅ *direct hit* |
| Detect negative tone / frustration / escalation risk | Valence + emotions + divergence flags in feed & drawer | ✅ |
| Deadline drift / overdue / stale / reassignment loops | Status-regression valence + health decay; append-only history with `old_value`/`new_value` | 🟡 *subset; full substrate present* |
| Employee workload / burnout (work-pattern, not medical) | Energy axis per actor | 🟡 *seed only* |
| Alerts: typed, severity, source evidence, confidence, owner | Divergence flags + RAG citations | 🟡 *no formal alert engine* |

Pulse's *"negative tone while health still green"* flag is precisely the PRD's early-warning mandate, demonstrated end-to-end.

---

## 7. Reporting & executive visibility (PRD §15)

| PRD | Pulse | Status |
|-----|-------|--------|
| Real-time executive command center | Intel: live feed, 2-D mood map, health leaderboard (SSE) | ✅ *concept* |
| Daily digest (differentiated CEO vs MD) | Single role-gated Intel view | 🟡 *one view; no per-role digest* |
| Weekly / monthly reports | — | ⬜ |

---

## 8. Data model (PRD §13)

| PRD entity | Pulse | Status |
|------------|-------|--------|
| Tasks — incl. original vs current due date, due-date changes, status | `tasks` + append-only `task_events` (`old_value`/`new_value`) | ✅ *change-history pattern* |
| Communications — sentiment, urgency, topics, action items, escalation | `task_events` comment + `sentiment` + `emotions` | 🟡 *analog on task comments* |
| Projects / People | `tasks` / `users` (Entra-synced) | 🟡 *simplified* |
| Meetings / Time Entries | — | ⬜ |

---

## 9. Guardrails (PRD §14) — the biggest gap to close

| PRD requirement | Pulse | Status |
|-----------------|-------|--------|
| Source evidence on every AI output | RAG answers cite source tasks | 🟡 |
| Confidence level on every alert | relevance/source signals only | 🟡 |
| HR alerts separated; managers see only their scope; audit logs of sensitive views | RBAC base only | ⬜ |
| Human review before HR action; approval workflows | — | ⬜ |
| **AI Must Not** label burnout / use clinical language | Pulse tags task emotions (`overwhelmed`, `stressed`) — fine for *tasks*, but **must not** carry to *employees* without cautious-language guardrails | ⚠️ *governance to add* |

This is the area RBDOps must invest in that Pulse intentionally doesn't: governance, auditability, and the "AI Should / Must Not" guardrails — especially since RBDOps analyzes **people**, where Pulse only analyzes **tasks**.

---

## 10. MVP feature coverage (PRD §10)

| PRD MVP feature | Pulse |
|-----------------|-------|
| Project health dashboard | ✅ leaderboard + health scoring |
| Overdue / deadline-drift detection | 🟡 staleness + status regression |
| Meeting transcript action items | ⬜ |
| Timecard draft generation | ⬜ |
| Client/project tone alerts | ✅ sentiment + divergence |
| Employee workload risk indicators | 🟡 energy axis |
| Daily executive digest | 🟡 real-time Intel view (not a digest) |
| Weekly project health report | ⬜ |
| **Bonus, PRD Phase 2:** NL chat / Q&A | ✅ already built |

---

## 11. Build-milestone readiness (PRD §18)

| PRD milestone | What Pulse de-risks |
|---------------|---------------------|
| 1 — Discovery & Architecture | Architecture + stack already validated working (this POC) |
| 2 — Core Integrations | Ingestion→normalize→queue pipeline proven; connectors plug into `task_events`-shaped events |
| 3 — AI Analysis Engine | Sentiment, structured JSON, RAG, health scoring, risk/divergence — **built and tested** |
| 4 — Dashboards & Alerts | Real-time dashboard + RBAC done; alert engine + role digests to add |
| 5 — Testing & Rollout | Seed/backfill + smoke-test patterns established |

---

## 12. The carry-over path

To evolve Pulse → RBDOps AI:

1. **Swap the event source** — replace the Board with ingestion workers (Microsoft Graph, Asana, Clockify, SharePoint metadata, later GHL) that emit the same normalized activity events. The queue + AI workers downstream are unchanged.
2. **Swap the model** — point the OpenAI-compatible client at the **Claude API**.
3. **Generalize health** — turn the single decay signal into the PRD's weighted multi-signal score; reuse the divergence concept to fuse objective + sentiment signals.
4. **Add the alert engine** — typed alerts with severity, source evidence, confidence, recommended action, owner; route by the five-role model.
5. **Add governance** — HR-only partition, manager data-scoping, audit logs, human-review/approval workflows, and the cautious-language guardrails (critical once analyzing people).
6. **Add reporting** — per-role daily digests + weekly/monthly rollups on top of the existing event store.

Everything in steps 3–6 builds on machinery Pulse already runs; steps 1–2 are configuration/connector work, not architectural change.

---

*PRD: RBD AI Operations Command Center (Working Name: RBDOps AI), May 2026 — Private & Confidential. This mapping is for internal onboarding/scoping.*
