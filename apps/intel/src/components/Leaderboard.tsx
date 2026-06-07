'use client';

import { useEffect, useState } from 'react';
import { fetchLeaderboard, type LeaderboardEntry } from '@/lib/api';
import { healthBarClasses, healthColor } from '@/lib/health';
import { Panel } from './Panel';

const STATUS_STYLES: Record<string, string> = {
  done: 'text-emerald-400',
  in_progress: 'text-sky-400',
  review: 'text-amber-400',
  todo: 'text-slate-400',
};

const RANK_STYLES = [
  'text-red-400',
  'text-orange-400',
  'text-amber-400',
];

function LeaderboardIcon() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 ring-1 ring-white/10">
      <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 0 1-5.395 4.972M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 0 1-2.77.732 6.023 6.023 0 0 1-2.77-.732" />
      </svg>
    </div>
  );
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const load = () => fetchLeaderboard().then(setEntries).catch(() => {});

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Panel
      title="Health leaderboard"
      subtitle="Lowest scores first — tasks at risk"
      icon={<LeaderboardIcon />}
    >
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
        {entries.map((e, i) => {
          const color = healthColor(e.healthScore);
          const statusClass = STATUS_STYLES[e.status] ?? 'text-slate-400';
          const rankClass = i < 3 ? RANK_STYLES[i] : 'text-pulse-muted';
          return (
            <li
              key={e.id}
              className="group rounded-xl border border-white/5 bg-pulse-bg/60 px-3 py-2.5 transition-all duration-200 hover:border-white/12 hover:bg-pulse-bg/90"
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <span className="min-w-0 flex-1 text-xs font-medium leading-snug text-slate-200">
                  <span className={`mr-1.5 font-bold tabular-nums ${rankClass}`}>
                    #{i + 1}
                  </span>
                  {e.title}
                </span>
                <span
                  className={`shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ring-1 ring-inset ${
                    color === 'green'
                      ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
                      : color === 'amber'
                        ? 'bg-amber-500/15 text-amber-300 ring-amber-500/25'
                        : 'bg-red-500/15 text-red-300 ring-red-500/25'
                  }`}
                >
                  {e.healthScore}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${healthBarClasses[color]} group-hover:brightness-110`}
                  style={{ width: `${e.healthScore}%` }}
                />
              </div>
              <p className={`mt-1.5 text-[10px] capitalize ${statusClass}`}>
                {e.status.replace(/_/g, ' ')}
                {e.assigneeName ? (
                  <span className="text-pulse-muted"> · {e.assigneeName}</span>
                ) : null}
              </p>
            </li>
          );
        })}
        {entries.length === 0 && (
          <li className="py-10 text-center text-xs text-slate-600">No tasks yet</li>
        )}
      </ul>
    </Panel>
  );
}
