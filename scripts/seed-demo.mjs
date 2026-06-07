/**
 * Seed Pulse with realistic demo data via the API (full pipeline:
 * task_events → BullMQ → embed worker → event_embeddings → RAG-ready).
 *
 * Usage: node scripts/seed-demo.mjs
 * Requires: infra up, API on :4000, DASHSCOPE_API_KEY in .env
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const jwt = require(
  resolve(__dir, '../node_modules/.pnpm/jsonwebtoken@9.0.3/node_modules/jsonwebtoken'),
);

for (const p of [resolve(process.cwd(), '.env'), resolve(__dir, '../.env')]) {
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
  break;
}

const API = process.env.API_URL ?? 'http://localhost:4000';
const SECRET = process.env.JWT_SECRET;
const ALICE = 'ca06f92f-7b97-4545-8ce6-bb69d8206218';
const BOB = '3b58ca1f-23c2-4ee6-b089-156e5a9faf79';

const token = (sub, role, name) =>
  jwt.sign({ sub, role, name, email: `${name}@pulse.local` }, SECRET, {
    expiresIn: '2h',
  });

const alice = token(ALICE, 'pulse-admin', 'Alice Admin');
const bob = token(BOB, 'pulse-member', 'Bob Member');

async function api(tok, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${tok}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function waitForEmbeddings(expected, timeoutMs = 90_000) {
  const { execSync } = await import('node:child_process');
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const out = execSync(
      `docker exec pulse-postgres psql -U pulse -d pulse -t -A -c "SELECT count(*) FROM event_embeddings WHERE embedding IS NOT NULL;"`,
      { encoding: 'utf8' },
    ).trim();
    const wait = execSync(
      `docker exec pulse-redis redis-cli LLEN 'bull:task-events:wait'`,
      { encoding: 'utf8' },
    ).trim();
    const n = Number(out);
    console.log(`  … embeddings=${n}/${expected}, queue_wait=${wait}`);
    if (n >= expected && wait === '0') return n;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timed out waiting for ${expected} embeddings`);
}

async function ragQuery(tok, question) {
  const res = await fetch(`${API}/intel/query`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${tok}`,
    },
    body: JSON.stringify({ question }),
  });
  let answer = '';
  let sources = 0;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    for (const line of buf.split('\n')) {
      if (!line.startsWith('data:')) continue;
      try {
        const msg = JSON.parse(line.slice(5).trim());
        if (msg.type === 'sources') sources = msg.sources?.length ?? 0;
        if (msg.type === 'token') answer += msg.value;
        if (msg.type === 'error') throw new Error(msg.message);
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
    buf = buf.split('\n').pop() ?? '';
  }
  return { answer: answer.trim(), sources };
}

// ── Health check ───────────────────────────────────────────────────────────
console.log('▸ Checking API…');
const health = await fetch(`${API}/health`);
if (!health.ok) throw new Error('API not reachable — run pnpm dev:api');
console.log('  API OK');

// ── Reset demo tables (keep users) ───────────────────────────────────────────
console.log('▸ Resetting tasks/events/embeddings…');
const { execSync } = await import('node:child_process');
execSync(
  `docker exec pulse-postgres psql -U pulse -d pulse -c "TRUNCATE event_embeddings, task_events, tasks RESTART IDENTITY CASCADE;"`,
  { stdio: 'inherit' },
);
execSync(
  `docker exec pulse-redis redis-cli --scan --pattern 'bull:task-events:*' | xargs -r docker exec -i pulse-redis redis-cli DEL`,
  { shell: '/bin/bash', stdio: 'pipe' },
);

// ── Seed via API (realistic RBDOps-style sprint backlog) ─────────────────────
console.log('▸ Creating tasks and activity…');

const scenarios = [
  {
    tok: alice,
    create: {
      title: 'Fix Entra redirect URI mismatch on Board login',
      description:
        'Users hitting AADSTS50011 after SSO — redirect URI in portal must match ENTRA_REDIRECT_URI exactly.',
      mood: 'low',
    },
    steps: [
      { who: bob, comment: 'Root cause: portal had trailing slash, .env did not. Fixed both to http://localhost:4000/auth/callback', mood: 'high' },
      { who: alice, status: 'in_progress', mood: 'medium' },
      { who: bob, comment: 'Verified login flow for Alice and Bob — callback returns JWT fragment correctly.', mood: 'high' },
    ],
  },
  {
    tok: alice,
    create: {
      title: 'Implement pgvector RAG pipeline for Intel',
      description: 'Embed task events with text-embedding-v4 (1536d), cosine top-10, stream Qwen answers.',
      assigneeId: BOB,
      mood: 'high',
    },
    steps: [
      { who: bob, status: 'in_progress', mood: 'high' },
      { who: bob, comment: 'Switched from v3 to v4 — schema is vector(1536). Workspace URL needs /compatible-mode/v1.', mood: 'medium' },
      { who: alice, status: 'review', mood: 'high' },
      { who: alice, comment: 'Smoke test: "What is happening with the login bug?" returned grounded answer with 7 sources.', mood: 'high' },
    ],
  },
  {
    tok: bob,
    create: {
      title: 'Board Kanban with health badges and mood picker',
      description: 'Four columns, health color thresholds green>70 amber 40-70 red<40, mood on every mutation.',
      mood: 'medium',
    },
    steps: [
      { who: bob, status: 'in_progress', mood: 'medium' },
      { who: alice, comment: 'Block pulse-viewer from Board — redirect to Intel with sign-out options.', mood: 'neutral' },
      { who: bob, status: 'review', mood: 'high' },
    ],
  },
  {
    tok: alice,
    create: {
      title: 'Health decay worker — 15 minute cron',
      description: 'todo=2/hr, in_progress=1/hr, review=0.5/hr, done=frozen. Floor at 0.',
      mood: 'neutral',
    },
    steps: [
      { who: alice, status: 'in_progress', mood: 'neutral' },
      { who: bob, comment: 'Validated formula: 10h todo → score 80, 30h in_progress → score 70.', mood: 'high' },
      { who: alice, status: 'done', mood: 'high' },
    ],
  },
  {
    tok: bob,
    create: {
      title: 'Intel SSE live activity feed',
      description: 'EventSource on GET /intel/feed, enriched ActivityFeedItem from workers.',
      mood: 'high',
    },
    steps: [
      { who: bob, status: 'in_progress', mood: 'high' },
      { who: alice, comment: 'Feed shows actor name, task title, mood, and event type in real time.', mood: 'high' },
      { who: bob, status: 'done', mood: 'high' },
    ],
  },
  {
    tok: alice,
    create: {
      title: 'Entra federated logout and account picker',
      description: 'Sign out must hit /auth/logout → Microsoft logout → /auth/logged-out. Switch users via prompt=select_account.',
      assigneeId: BOB,
      mood: 'low',
    },
    steps: [
      { who: bob, status: 'in_progress', mood: 'medium' },
      { who: bob, comment: 'Added http://localhost:4000/auth/logged-out as Web redirect URI in Entra portal.', mood: 'high' },
      { who: alice, status: 'review', mood: 'medium' },
    ],
  },
  {
    tok: alice,
    create: {
      title: 'Momentum meter — 24h mood rolling average',
      description: 'MOOD_WEIGHTS: high=4, medium=3, neutral=2, low=1. Display as percentage of max.',
      mood: 'medium',
    },
    steps: [
      { who: alice, status: 'in_progress', mood: 'medium' },
      { who: bob, comment: 'GET /intel/momentum returns average, percentage, and eventCount for last 24h.', mood: 'neutral' },
    ],
  },
  {
    tok: bob,
    create: {
      title: 'Redis BullMQ task-events queue reliability',
      description: 'Enqueue after tx commit; single processor for embed + realtime broadcast.',
      mood: 'neutral',
    },
    steps: [
      { who: bob, status: 'todo', mood: 'neutral' },
      { who: alice, reassign: BOB, mood: 'low' },
      { who: bob, comment: 'Stalled jobs after API restart — need to drain queue on seed. Using removeOnComplete.', mood: 'low' },
    ],
  },
];

let eventCount = 0;
for (const s of scenarios) {
  const task = await api(s.tok, 'POST', '/tasks', s.create);
  eventCount += 1;
  for (const step of s.steps) {
    if (step.comment) {
      await api(step.who, 'POST', `/tasks/${task.id}/comments`, {
        commentText: step.comment,
        mood: step.mood,
      });
      eventCount += 1;
    }
    if (step.status) {
      await api(step.who, 'PATCH', `/tasks/${task.id}/status`, {
        status: step.status,
        mood: step.mood,
      });
      eventCount += 1;
    }
    if (step.reassign) {
      await api(step.who, 'PATCH', `/tasks/${task.id}/assignee`, {
        assigneeId: step.reassign,
        mood: step.mood,
      });
      eventCount += 1;
    }
  }
  console.log(`  ✓ ${task.title.slice(0, 50)}…`);
}

console.log(`▸ Waiting for ${eventCount} embeddings (workers + DashScope)…`);
await waitForEmbeddings(eventCount);

// ── Health variety for leaderboard demo ──────────────────────────────────────
console.log('▸ Applying health decay spread for leaderboard…');
execSync(
  `docker exec pulse-postgres psql -U pulse -d pulse -c "
    UPDATE tasks SET last_activity_at = now() - interval '18 hours', status = 'todo'
      WHERE title LIKE 'Redis BullMQ%';
    UPDATE tasks SET last_activity_at = now() - interval '36 hours', status = 'in_progress'
      WHERE title LIKE 'Entra federated logout%';
    UPDATE tasks SET last_activity_at = now() - interval '8 hours', status = 'in_progress'
      WHERE title LIKE 'Momentum meter%';
    UPDATE tasks SET health_score = GREATEST(0, LEAST(100, ROUND(
      100 - (EXTRACT(EPOCH FROM (now() - last_activity_at)) / 3600.0)
            * CASE status WHEN 'todo' THEN 2 WHEN 'in_progress' THEN 1 WHEN 'review' THEN 0.5 ELSE 0 END
    ))) WHERE status <> 'done';
  "`,
  { stdio: 'inherit' },
);

// ── RAG smoke tests ────────────────────────────────────────────────────────
console.log('▸ RAG smoke tests…');
const questions = [
  'What caused the Entra login redirect issue and how was it fixed?',
  'Which tasks are at risk or have low health?',
  'What is the status of the RAG pipeline implementation?',
];

for (const q of questions) {
  const { answer, sources } = await ragQuery(bob, q);
  console.log(`\n  Q: ${q}`);
  console.log(`  Sources: ${sources}`);
  console.log(`  A: ${answer.slice(0, 220)}${answer.length > 220 ? '…' : ''}`);
}

// ── Summary ────────────────────────────────────────────────────────────────
const summary = execSync(
  `docker exec pulse-postgres psql -U pulse -d pulse -t -A -F' | ' -c "
    SELECT 'tasks', count(*) FROM tasks
    UNION ALL SELECT 'events', count(*) FROM task_events
    UNION ALL SELECT 'embeddings', count(*) FROM event_embeddings
    UNION ALL SELECT 'vectors', count(*) FROM event_embeddings WHERE embedding IS NOT NULL;
  "`,
  { encoding: 'utf8' },
);
console.log('\n▸ DB summary');
for (const line of summary.trim().split('\n')) console.log(`  ${line}`);

console.log('\n✓ Demo seed complete — open Board :3000 and Intel :3001');
