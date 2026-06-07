'use client';

import { useEffect, useState } from 'react';
import { fetchMomentum, type MomentumSnapshot } from '@/lib/api';

function moodLabel(pct: number) {
  if (pct >= 75) return 'High energy';
  if (pct >= 50) return 'Steady';
  if (pct >= 25) return 'Low';
  return 'Dragging';
}

/** Compact horizontal metrics ribbon — no wasted vertical space. */
export function MomentumMeter() {
  const [snap, setSnap] = useState<MomentumSnapshot | null>(null);

  const load = () => fetchMomentum().then(setSnap).catch(() => {});

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const pct = snap?.percentage ?? 50;
  const label = moodLabel(pct);

  return (
    <section
      className="pulse-glass flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:gap-x-6 sm:px-5"
      aria-label="Team momentum"
    >
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0 sm:h-12 sm:w-12">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke="rgb(255 255 255 / 0.06)"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke="url(#momentum-ribbon-grad)"
              strokeWidth="3"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
            <defs>
              <linearGradient id="momentum-ribbon-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-bold tabular-nums text-white sm:text-xs">
              {pct}%
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-pulse-muted">
            Team momentum
          </p>
          <p className="text-sm font-semibold text-white sm:text-base">{label}</p>
        </div>
      </div>

      <div className="min-w-[140px] flex-1 basis-[180px]">
        <div className="mb-1 flex items-center justify-between text-[10px] text-pulse-muted">
          <span>24h mood rolling avg</span>
          <span className="tabular-nums text-slate-400">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5 sm:h-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-pulse-accent to-sky-400 transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {snap && (
        <div className="flex shrink-0 items-center gap-4 border-l border-white/8 pl-4 sm:gap-6 sm:pl-6">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-pulse-muted">Mood avg</p>
            <p className="text-sm font-semibold tabular-nums text-slate-200">
              {snap.average.toFixed(2)}
              <span className="text-pulse-muted"> / 4</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-pulse-muted">Events</p>
            <p className="text-sm font-semibold tabular-nums text-slate-200">
              {snap.eventCount}
              <span className="text-pulse-muted"> / 24h</span>
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
