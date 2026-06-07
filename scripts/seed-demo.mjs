/**
 * Seed Pulse with realistic demo data via the API (full pipeline:
 * task_events → BullMQ → embed + health recompute + SSE → event_embeddings → RAG).
 *
 * Usage: pnpm seed:demo
 * Requires: infra up, API on :4000, DASHSCOPE_API_KEY in .env
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyDemoHealth,
  waitForQueueIdle,
} from './lib/demo-health.mjs';

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
const FALLBACK_ALICE = 'ca06f92f-7b97-4545-8ce6-bb69d8206218';
const FALLBACK_BOB = '3b58ca1f-43c2-4ee6-b089-156e5a9faf79';

const token = (sub, role, name) =>
  jwt.sign({ sub, role, name, email: `${name}@pulse.local` }, SECRET, {
    expiresIn: '2h',
  });

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

async function waitForEmbeddings(expected, timeoutMs = 180_000) {
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

function resolveUserIds(execSync) {
  const out = execSync(
    `docker exec pulse-postgres psql -U pulse -d pulse -t -A -F'|' -c "SELECT id, display_name FROM users"`,
    { encoding: 'utf8' },
  ).trim();
  const ids = { alice: FALLBACK_ALICE, bob: FALLBACK_BOB };
  for (const line of out.split('\n').filter(Boolean)) {
    const [id, name] = line.split('|');
    if (name?.includes('Alice')) ids.alice = id.trim();
    if (name?.includes('Bob')) ids.bob = id.trim();
  }
  return ids;
}

/** Carol is viewer — API blocks her mutations; prefix her voice in comments. */
const carol = (text) => `[Carol Viewer] ${text}`;

// ── Health check ───────────────────────────────────────────────────────────
console.log('▸ Checking API…');
const health = await fetch(`${API}/health`);
if (!health.ok) throw new Error('API not reachable — run pnpm dev:api');
console.log('  API OK');

const { execSync } = await import('node:child_process');
const userIds = resolveUserIds(execSync);
const alice = token(userIds.alice, 'pulse-admin', 'Alice Admin');
const bob = token(userIds.bob, 'pulse-member', 'Bob Member');

// ── Reset demo tables (keep users) ───────────────────────────────────────────
console.log('▸ Resetting tasks/events/embeddings/chat…');
execSync(
  `docker exec pulse-postgres psql -U pulse -d pulse -c "TRUNCATE event_embeddings, task_events, intel_chat_turns, tasks RESTART IDENTITY CASCADE;"`,
  { stdio: 'inherit' },
);
execSync(
  `docker exec pulse-redis redis-cli EVAL "local k=redis.call('keys', 'bull:task-events:*'); for i=1,#k do redis.call('del', k[i]) end; return #k" 0`,
  { stdio: 'pipe' },
);

// ── Sprint backlog scenarios ─────────────────────────────────────────────────
console.log('▸ Creating tasks and activity…');

const scenarios = [
  // ── 🔴 At risk / blocked ───────────────────────────────────────────────────
  {
    tok: bob,
    create: {
      title: 'Migrate primary database from PostgreSQL 14 to 16',
      description:
        'Migration script keeps timing out on the audit_logs table. May need to archive 2023 logs before retry.',
      assigneeId: userIds.bob,
      mood: 'low',
    },
    steps: [
      { who: bob, status: 'in_progress', mood: 'low' },
      {
        who: bob,
        comment:
          'Still blocked. We might need to archive the 2023 logs before attempting the migration again. I\'ve pinged DevOps but they are swamped.',
        mood: 'low',
      },
    ],
    health: 22,
    status: 'in_progress',
  },
  {
    tok: alice,
    create: {
      title: 'Fix memory leak in Node.js worker',
      description:
        'Background email worker OOM-killed every ~4 hours under heavy load. Production alert fired repeatedly.',
      mood: 'low',
    },
    steps: [
      {
        who: alice,
        comment:
          'Production alert fired 5 times last night. We are losing uncommitted jobs.',
        mood: 'low',
      },
    ],
    health: 15,
    status: 'todo',
  },
  {
    tok: alice,
    create: {
      title: 'Secure Redis instance with TLS for BullMQ',
      description:
        'Switching to rediss:// causes BullMQ workers to disconnect with ECONNRESET — likely cert mismatch on managed Redis.',
      assigneeId: userIds.bob,
      mood: 'neutral',
    },
    steps: [
      { who: bob, status: 'in_progress', mood: 'neutral' },
      {
        who: bob,
        comment:
          'I suspect it\'s a certificate mismatch between the client and the managed cloud Redis. Waiting on AWS support.',
        mood: 'neutral',
      },
    ],
    health: 30,
    status: 'in_progress',
  },
  {
    tok: bob,
    create: {
      title: 'Update Terms of Service and Privacy Policy pages',
      description:
        'Blocked by Legal — new AI features language not approved. Blocks user registration flow deploy.',
      mood: 'neutral',
    },
    steps: [
      {
        who: alice,
        comment: carol(
          'Legal hasn\'t approved the final draft regarding the new AI features. We can\'t deploy the new user registration flow until this is merged.',
        ),
        mood: 'neutral',
      },
    ],
    health: 10,
    status: 'todo',
  },
  {
    tok: bob,
    create: {
      title: 'Upgrade Next.js App Router',
      description:
        'Extensive hydration errors on dynamic routes that rely on user-specific session data.',
      assigneeId: userIds.bob,
      mood: 'medium',
    },
    steps: [{ who: bob, status: 'in_progress', mood: 'medium' }],
    health: 45,
    status: 'in_progress',
  },

  // ── 🟡 Warning / needs attention ───────────────────────────────────────────
  {
    tok: alice,
    create: {
      title: 'Design dark mode for Pulse Intel dashboard',
      description:
        'CSS custom properties conflict with legacy charting library that hardcodes background colors.',
      mood: 'medium',
    },
    steps: [
      { who: alice, status: 'in_progress', mood: 'medium' },
      {
        who: alice,
        comment:
          'The charts look completely illegible in dark mode. We either need to fork the library or replace it entirely.',
        mood: 'medium',
      },
    ],
    health: 65,
    status: 'in_progress',
  },
  {
    tok: bob,
    create: {
      title: 'Integrate Stripe for subscription billing',
      description:
        'Webhook signatures fail validation in staging — works locally. Staging LB may strip raw body.',
      mood: 'medium',
    },
    steps: [
      { who: bob, status: 'review', mood: 'medium' },
      {
        who: bob,
        comment:
          'PR is up, but hold off on merging. I need to figure out why the staging load balancer is stripping the raw body needed for Stripe validation.',
        mood: 'medium',
      },
    ],
    health: 70,
    status: 'review',
  },
  {
    tok: bob,
    create: {
      title: 'Setup GitHub Actions CI/CD for staging environment',
      description:
        'Environment secrets not passing correctly to the Docker build step. IAM role may lack registry pull.',
      assigneeId: userIds.bob,
      mood: 'neutral',
    },
    steps: [
      { who: bob, status: 'in_progress', mood: 'neutral' },
      { who: bob, reassign: userIds.alice, mood: 'neutral' },
      {
        who: bob,
        comment:
          'Alice — can you check the IAM permissions on the GitHub Actions role? It keeps failing to pull from the private registry.',
        mood: 'neutral',
      },
    ],
    health: 55,
    status: 'in_progress',
  },
  {
    tok: bob,
    create: {
      title: 'Write unit tests for RAG pipeline chunking logic',
      description:
        'Technical debt — edge cases with markdown tables break the tokenizer. Need coverage before embedding model swap.',
      mood: 'medium',
    },
    steps: [
      {
        who: bob,
        comment:
          'We need coverage here before we swap embedding models, otherwise we won\'t know if we broke the chunker.',
        mood: 'medium',
      },
    ],
    health: 60,
    status: 'todo',
  },
  {
    tok: alice,
    create: {
      title: "Implement 'Forgot Password' email flow using SendGrid",
      description:
        'Staging emails landing in spam — domain not fully authenticated for DKIM/SPF.',
      mood: 'medium',
    },
    steps: [{ who: alice, status: 'review', mood: 'medium' }],
    health: 68,
    status: 'review',
  },

  // ── 🟢 Healthy / moving well ─────────────────────────────────────────────────
  {
    tok: bob,
    create: {
      title: 'Implement WebSocket failover to polling',
      description:
        'Solves intermittent disconnects on mobile clients on poor 4G networks. Ready for QA.',
      mood: 'high',
    },
    steps: [
      { who: bob, status: 'review', mood: 'high' },
      {
        who: alice,
        comment:
          'Tested locally and on my phone with throttled network. Fallback is seamless. Ready for QA.',
        mood: 'high',
      },
    ],
    health: 95,
    status: 'review',
  },
  {
    tok: bob,
    create: {
      title: 'Optimize React component rendering on Kanban board',
      description:
        'Drag-and-drop lagged with 50+ cards. Fixed via virtualization and memoized card components.',
      mood: 'high',
    },
    steps: [
      { who: bob, status: 'in_progress', mood: 'high' },
      { who: bob, status: 'done', mood: 'high' },
      {
        who: bob,
        comment:
          'Huge performance win. Dragging is back to 60fps even with 200 cards.',
        mood: 'high',
      },
    ],
    health: 100,
    status: 'done',
  },
  {
    tok: alice,
    create: {
      title: 'Implement rate limiting on public API endpoints',
      description:
        'Urgent fix after malicious IPs scraped data over the weekend.',
      mood: 'high',
    },
    steps: [
      { who: alice, status: 'in_progress', mood: 'high' },
      { who: alice, status: 'done', mood: 'high' },
      {
        who: alice,
        comment:
          'Fired up Redis rate-limiter middleware. Scraping bots are now getting 429s. Disaster averted.',
        mood: 'high',
      },
    ],
    health: 100,
    status: 'done',
  },
  {
    tok: alice,
    create: {
      title: 'Audit AWS IAM roles for least privilege',
      description: 'Routine security maintenance. No blockers — needs scheduling.',
      mood: 'neutral',
    },
    steps: [],
    health: 90,
    status: 'todo',
  },
  {
    tok: bob,
    create: {
      title: 'Build export to CSV feature for analytics',
      description:
        'Minor QA feedback on date formatting in Excel; otherwise feature-complete.',
      mood: 'neutral',
    },
    steps: [
      { who: bob, status: 'review', mood: 'neutral' },
      {
        who: alice,
        comment: carol(
          'Can we ensure the timestamps export in ISO format so Excel doesn\'t mangle the timezones?',
        ),
        mood: 'neutral',
      },
    ],
    health: 88,
    status: 'review',
  },

  // ── 🟣 Wildcards / cross-team ────────────────────────────────────────────────
  {
    tok: alice,
    create: {
      title: 'Create onboarding flow for new users',
      description:
        'Scope creep — Product wants mandatory 3-step tutorial; engineering pushing back on Friday deadline.',
      mood: 'low',
    },
    steps: [
      { who: alice, status: 'in_progress', mood: 'low' },
      {
        who: alice,
        comment:
          'If we add the mandatory tutorial, we will miss the Friday release cutoff. We need a product decision today.',
        mood: 'low',
      },
    ],
    health: 40,
    status: 'in_progress',
  },
  {
    tok: bob,
    create: {
      title: 'Investigate sudden spike in API latency',
      description:
        'Mystery latency regression — successfully resolved.',
      mood: 'high',
    },
    steps: [
      { who: bob, status: 'in_progress', mood: 'high' },
      { who: bob, status: 'done', mood: 'high' },
      {
        who: bob,
        comment:
          'Found it! Turned out to be a missing index on the task_events table when filtering by user ID. Added the index and latency dropped from 800ms to 45ms.',
        mood: 'high',
      },
    ],
    health: 100,
    status: 'done',
  },
  {
    tok: alice,
    create: {
      title: 'Add multi-language support (i18n) to UI',
      description:
        'Waiting on external translation agency for Spanish and French JSON. Code is instrumented.',
      assigneeId: userIds.bob,
      mood: 'neutral',
    },
    steps: [{ who: bob, status: 'in_progress', mood: 'neutral' }],
    health: 75,
    status: 'in_progress',
  },
  {
    tok: alice,
    create: {
      title: 'Refactor state management from Redux to Zustand',
      description: 'Risky refactor that paid off — bundle size down 15%.',
      mood: 'high',
    },
    steps: [
      { who: alice, status: 'in_progress', mood: 'high' },
      { who: alice, status: 'done', mood: 'high' },
      {
        who: alice,
        comment:
          'Smooth transition, deleted 400 lines of boilerplate, and bundle size is reduced by 15%.',
        mood: 'high',
      },
    ],
    health: 100,
    status: 'done',
  },
  {
    tok: bob,
    create: {
      title: "Create animated success state for 'Done' tasks",
      description:
        'Lottie animation file is 3MB — causes jank on low-end devices until design compresses JSON.',
      mood: 'medium',
    },
    steps: [
      { who: bob, status: 'review', mood: 'medium' },
      {
        who: bob,
        comment:
          'Animation looks great, but we need the design team to compress the JSON file before we ship this. Pinging them now.',
        mood: 'medium',
      },
    ],
    health: 82,
    status: 'review',
  },

  // ── Pulse platform (meta — keeps Entra/RAG demo queries grounded) ───────────
  {
    tok: alice,
    create: {
      title: 'Fix Entra redirect URI mismatch on Board login',
      description:
        'Users hitting AADSTS50011 — redirect URI in portal must match ENTRA_REDIRECT_URI exactly.',
      mood: 'low',
    },
    steps: [
      {
        who: bob,
        comment:
          'Root cause: portal had trailing slash, .env did not. Fixed both to http://localhost:4000/auth/callback',
        mood: 'high',
      },
      { who: alice, status: 'in_progress', mood: 'medium' },
    ],
    health: 72,
    status: 'in_progress',
  },
  {
    tok: alice,
    create: {
      title: 'Implement pgvector RAG pipeline for Intel',
      description:
        'Embed task events with text-embedding-v4 (1536d), cosine top-10, stream Qwen with chat history.',
      assigneeId: userIds.bob,
      mood: 'high',
    },
    steps: [
      { who: bob, status: 'in_progress', mood: 'high' },
      {
        who: bob,
        comment:
          'Persistent intel_chat_turns + multi-turn context. Workspace URL needs /compatible-mode/v1.',
        mood: 'medium',
      },
      { who: alice, status: 'review', mood: 'high' },
    ],
    health: 92,
    status: 'review',
  },
  {
    tok: bob,
    create: {
      title: 'Intel SSE live activity feed with history hydration',
      description:
        'EventSource on GET /intel/feed; GET /intel/feed/recent hydrates on page load.',
      mood: 'high',
    },
    steps: [
      { who: bob, status: 'in_progress', mood: 'high' },
      { who: bob, status: 'done', mood: 'high' },
    ],
    health: 100,
    status: 'done',
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
  console.log(`  ✓ ${task.title.slice(0, 56)}…`);
}

console.log(`▸ Waiting for ${eventCount} embeddings (workers + DashScope)…`);
await waitForEmbeddings(eventCount);
console.log('▸ Waiting for task-events queue to drain…');
await waitForQueueIdle(execSync);
applyDemoHealth(scenarios, execSync);

// ── RAG smoke tests ────────────────────────────────────────────────────────
console.log('▸ RAG smoke tests…');
const questions = [
  'What are the biggest bottlenecks right now?',
  'Why is team momentum dropping?',
  'What were our recent wins?',
  'Who has been the most active today?',
  'What caused the API latency spike and how was it fixed?',
];

for (const q of questions) {
  const { answer, sources } = await ragQuery(bob, q);
  console.log(`\n  Q: ${q}`);
  console.log(`  Sources: ${sources}`);
  console.log(`  A: ${answer.slice(0, 240)}${answer.length > 240 ? '…' : ''}`);
}

// Re-sync after RAG tests in case embed retries touched health mid-flight.
console.log('▸ Final demo health sync…');
await waitForQueueIdle(execSync);
applyDemoHealth(scenarios, execSync);

// ── Summary ────────────────────────────────────────────────────────────────
const summary = execSync(
  `docker exec pulse-postgres psql -U pulse -d pulse -t -A -F' | ' -c "
    SELECT 'tasks', count(*) FROM tasks
    UNION ALL SELECT 'events', count(*) FROM task_events
    UNION ALL SELECT 'embeddings', count(*) FROM event_embeddings
    UNION ALL SELECT 'vectors', count(*) FROM event_embeddings WHERE embedding IS NOT NULL
    UNION ALL SELECT 'at_risk', count(*) FROM tasks WHERE health_score < 40 AND status <> 'done';
  "`,
  { encoding: 'utf8' },
);
console.log('\n▸ DB summary');
for (const line of summary.trim().split('\n')) console.log(`  ${line}`);

console.log('\n✓ Demo seed complete — open Board :3000 and Intel :3001');
console.log('  Intel AI quick prompts (chips + README § Intel AI quick prompts):');
for (const q of [
  'What are the biggest bottlenecks right now?',
  'Which tasks are at critical risk—and why?',
  'What were our recent sprint wins?',
  "What's blocking the user registration deploy?",
  'How was the API latency spike fixed?',
  'What production alerts came up last night?',
  "What's stuck waiting on Legal, DevOps, or AWS?",
  'What needs a Product decision before Friday?',
]) {
  console.log(`    · ${q}`);
}
