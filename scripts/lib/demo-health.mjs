/**
 * Shared demo health backdating — keeps health_score aligned with the decay
 * formula after seed or worker/cron activity.
 */

const DECAY = { todo: 2, in_progress: 1, review: 0.5, done: 0 };

export const HEALTH_SCORE_EXPR = `GREATEST(0, LEAST(100, ROUND(
  100 - (EXTRACT(EPOCH FROM (now() - last_activity_at)) / 3600.0)
        * CASE status
            WHEN 'todo'        THEN 2
            WHEN 'in_progress' THEN 1
            WHEN 'review'      THEN 0.5
            ELSE 0
          END
)))`;

export function hoursAgoForHealth(health, status) {
  const rate = DECAY[status] ?? 0;
  if (status === 'done' || rate === 0) return 0;
  return (100 - health) / rate;
}

export function queueDepth(execSync) {
  const wait = Number(
    execSync(`docker exec pulse-redis redis-cli LLEN 'bull:task-events:wait'`, {
      encoding: 'utf8',
    }).trim(),
  );
  const active = Number(
    execSync(`docker exec pulse-redis redis-cli LLEN 'bull:task-events:active'`, {
      encoding: 'utf8',
    }).trim(),
  );
  const delayed = Number(
    execSync(`docker exec pulse-redis redis-cli LLEN 'bull:task-events:delayed'`, {
      encoding: 'utf8',
    }).trim(),
  );
  return wait + active + delayed;
}

/** Wait until BullMQ has no pending/active/delayed task-events jobs. */
export async function waitForQueueIdle(execSync, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const depth = queueDepth(execSync);
    if (depth === 0) return;
    console.log(`  … queue depth=${depth}`);
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error('Timed out waiting for task-events queue to drain');
}

/**
 * Backdate last_activity_at per scenario target, then derive health_score from
 * the same formula the API workers use (single source of truth).
 */
export function applyDemoHealth(scenarios, execSync) {
  console.log('▸ Syncing demo health (backdate + formula recompute)…');
  for (const s of scenarios) {
    const title = (s.create?.title ?? s.title).replace(/'/g, "''");
    const hours = hoursAgoForHealth(s.health, s.status);
    if (s.status === 'done') {
      execSync(
        `docker exec pulse-postgres psql -U pulse -d pulse -c "UPDATE tasks SET health_score = ${s.health}, status = 'done' WHERE title = '${title}';"`,
        { stdio: 'pipe' },
      );
    } else {
      execSync(
        `docker exec pulse-postgres psql -U pulse -d pulse -c "UPDATE tasks SET status = '${s.status}', last_activity_at = now() - interval '${hours} hours' WHERE title = '${title}';"`,
        { stdio: 'pipe' },
      );
    }
  }

  execSync(
    `docker exec pulse-postgres psql -U pulse -d pulse -c "UPDATE tasks SET health_score = ${HEALTH_SCORE_EXPR} WHERE status <> 'done';"`,
    { stdio: 'pipe' },
  );

  const drift = execSync(
    `docker exec pulse-postgres psql -U pulse -d pulse -t -A -c "
      SELECT count(*) FROM tasks t
       WHERE t.status <> 'done'
         AND t.health_score <> ${HEALTH_SCORE_EXPR};
    "`,
    { encoding: 'utf8' },
  ).trim();
  if (drift !== '0') {
    console.warn(`  ⚠ ${drift} non-done tasks still out of sync with decay formula`);
  }

  const atRisk = execSync(
    `docker exec pulse-postgres psql -U pulse -d pulse -t -A -c "SELECT count(*) FROM tasks WHERE health_score < 40 AND status <> 'done';"`,
    { encoding: 'utf8' },
  ).trim();
  console.log(`  ✓ at-risk tasks (health < 40): ${atRisk}`);
}
