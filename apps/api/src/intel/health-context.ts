import { HEALTH_THRESHOLDS } from '@pulse/shared-types';
import type { LeaderboardEntry } from './intel.service';

export type HealthBand = 'critical' | 'warning' | 'healthy' | 'frozen';

/** Aligns with Board/Intel badge bands (done tasks are frozen, not decaying). */
export function healthBand(score: number, status?: string): HealthBand {
  if (status === 'done') return 'frozen';
  if (score < HEALTH_THRESHOLDS.amber) return 'critical';
  if (score <= HEALTH_THRESHOLDS.green) return 'warning';
  return 'healthy';
}

/** Prefix event text with live task health for RAG citations + LLM context. */
export function enrichEventContent(
  contentText: string,
  healthScore: number,
  status: string,
): string {
  const band = healthBand(healthScore, status);
  return `[health ${healthScore}/100 — ${band}, status ${status}] ${contentText}`;
}

/** Live leaderboard block injected into every Intel query (lowest health first). */
export function formatHealthSnapshot(entries: LeaderboardEntry[]): string {
  if (!entries.length) return '(no tasks in board)';
  return entries
    .map((e, i) => {
      const band = healthBand(e.healthScore, e.status);
      const assignee = e.assigneeName ? `, assignee ${e.assigneeName}` : '';
      return (
        `${i + 1}. "${e.title}" — health ${e.healthScore}/100 (${band}), ` +
        `status ${e.status}${assignee}`
      );
    })
    .join('\n');
}
