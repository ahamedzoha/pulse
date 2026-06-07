'use client';

import { useEffect, useState } from 'react';
import { fetchMomentum, type MomentumSnapshot } from '@/lib/api';
import { Panel } from './Panel';

function MomentumIcon() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pulse-accent/30 to-sky-500/20 ring-1 ring-white/10">
      <svg className="h-4 w-4 text-pulse-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    </div>
  );
}

export function MomentumMeter() {
  const [snap, setSnap] = useState<MomentumSnapshot | null>(null);

  const load = () => fetchMomentum().then(setSnap).catch(() => {});

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const pct = snap?.percentage ?? 50;
  const label =
    pct >= 75 ? 'High energy' : pct >= 50 ? 'Steady' : pct >= 25 ? 'Low' : 'Dragging';

  return (
    <Panel
      title="Team momentum"
      subtitle="24h mood rolling average"
      icon={<MomentumIcon />}
    >
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-2">
        <div className="relative mb-2 h-24 w-24 sm:h-28 sm:w-28">
          <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgb(255 255 255 / 0.06)" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.9"
              fill="none"
              stroke="url(#momentum-grad)"
              strokeWidth="3"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
            <defs>
              <linearGradient id="momentum-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums text-white">{pct}%</span>
          </div>
        </div>
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {snap && (
          <p className="mt-1.5 text-center text-[10px] text-pulse-muted">
            avg {snap.average.toFixed(2)} / 4 · {snap.eventCount} events (24h)
          </p>
        )}
      </div>
    </Panel>
  );
}
