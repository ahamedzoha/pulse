/**
 * Re-apply demo health targets without a full reseed.
 * Use when Board/Intel show all-green 100 but tasks still exist.
 *
 * Usage: pnpm seed:sync-health
 * Requires: Docker (postgres + redis), API can stay running.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyDemoHealth,
  waitForQueueIdle,
} from './lib/demo-health.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));

for (const p of [resolve(process.cwd(), '.env'), resolve(__dir, '../.env')]) {
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
  break;
}

const { execSync } = await import('node:child_process');

const taskCount = Number(
  execSync(
    `docker exec pulse-postgres psql -U pulse -d pulse -t -A -c "SELECT count(*) FROM tasks;"`,
    { encoding: 'utf8' },
  ).trim(),
);
if (taskCount === 0) {
  console.error('No tasks in DB — run pnpm seed:demo first.');
  process.exit(1);
}

import healthTargets from './demo-health-targets.mjs';

console.log('▸ Waiting for task-events queue to drain…');
await waitForQueueIdle(execSync);
applyDemoHealth(healthTargets, execSync);
console.log('✓ Demo health synced — refresh Board (:3000) and Intel (:3001)');
