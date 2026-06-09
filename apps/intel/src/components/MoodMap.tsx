'use client';

import { useEffect, useState } from 'react';
import { VIBE_LABELS, type Vibe } from '@pulse/shared-types';
import { fetchMomentum2d, type Momentum2D } from '@/lib/api';
import { useRealtime } from './RealtimeProvider';

const VIBE_META: Record<
  Vibe,
  { text: string; dot: string; chip: string; fill: string }
> = {
  in_flow: {
    text: 'text-emerald-300',
    dot: 'bg-emerald-400',
    chip: 'text-emerald-300',
    fill: 'rgb(16 185 129 / 0.13)',
  },
  firefighting: {
    text: 'text-red-300',
    dot: 'bg-red-400',
    chip: 'text-red-300',
    fill: 'rgb(239 68 68 / 0.13)',
  },
  cruising: {
    text: 'text-sky-300',
    dot: 'bg-sky-400',
    chip: 'text-sky-300',
    fill: 'rgb(56 189 248 / 0.13)',
  },
  stalled: {
    text: 'text-slate-300',
    dot: 'bg-slate-400',
    chip: 'text-slate-300',
    fill: 'rgb(148 163 184 / 0.13)',
  },
};

// Quadrant order for the breakdown chips (high→low energy, then valence).
const QUADRANTS: Vibe[] = ['firefighting', 'in_flow', 'stalled', 'cruising'];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Team affect on the valence × energy plane — replaces the 1-D meter. */
export function MoodMap() {
  const { subscribe } = useRealtime();
  const [snap, setSnap] = useState<Momentum2D | null>(null);

  useEffect(() => {
    const load = () => fetchMomentum2d().then(setSnap).catch(() => {});
    load();
    const poll = setInterval(load, 60_000); // fallback if the stream drops

    // Recompute shortly after live activity, debounced to coalesce bursts.
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribe(() => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(load, 800);
    });

    return () => {
      clearInterval(poll);
      if (debounce) clearTimeout(debounce);
      unsubscribe();
    };
  }, [subscribe]);

  const valence = snap?.valence ?? 0;
  const energy = snap?.energy ?? 0.4;
  const vibe = snap?.vibe ?? 'cruising';
  const empty = !snap || snap.eventCount === 0;
  const meta = VIBE_META[vibe];

  // Plane is a 100×100 viewBox: x = valence (−1 left … 1 right),
  // y = energy (1 top … 0 bottom).
  const cx = clamp(((valence + 1) / 2) * 100, 7, 93);
  const cy = clamp((1 - energy) * 100, 7, 93);

  return (
    <section
      className="pulse-glass flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:gap-x-7 sm:px-5"
      aria-label="Team mood map"
    >
      {/* Affect plane */}
      <div className="relative h-[88px] w-[88px] shrink-0">
        <svg viewBox="0 0 100 100" className="h-full w-full rounded-lg" aria-hidden>
          <rect x="0" y="0" width="50" height="50" fill={VIBE_META.firefighting.fill} />
          <rect x="50" y="0" width="50" height="50" fill={VIBE_META.in_flow.fill} />
          <rect x="0" y="50" width="50" height="50" fill={VIBE_META.stalled.fill} />
          <rect x="50" y="50" width="50" height="50" fill={VIBE_META.cruising.fill} />
          <line x1="50" y1="2" x2="50" y2="98" stroke="rgb(255 255 255 / 0.12)" strokeWidth="0.6" />
          <line x1="2" y1="50" x2="98" y2="50" stroke="rgb(255 255 255 / 0.12)" strokeWidth="0.6" />
          {!empty && (
            <>
              <circle cx={cx} cy={cy} r="9" fill="rgb(96 165 250 / 0.18)" className="transition-all duration-700 ease-out" />
              <circle cx={cx} cy={cy} r="4.2" fill="#fff" className="transition-all duration-700 ease-out" />
            </>
          )}
        </svg>
        <span className="pointer-events-none absolute -top-0.5 left-1/2 -translate-x-1/2 text-[8px] font-medium uppercase tracking-wide text-pulse-muted/70">
          energy
        </span>
        <span className="pointer-events-none absolute -bottom-0.5 right-0 text-[8px] font-medium uppercase tracking-wide text-pulse-muted/70">
          +
        </span>
        <span className="pointer-events-none absolute -bottom-0.5 left-0 text-[8px] font-medium uppercase tracking-wide text-pulse-muted/70">
          −
        </span>
      </div>

      {/* Headline vibe */}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-pulse-muted">
          Team vibe · 24h
        </p>
        <p className={`text-base font-semibold sm:text-lg ${empty ? 'text-slate-400' : meta.text}`}>
          {empty ? 'No signal yet' : VIBE_LABELS[vibe]}
        </p>
        {!empty && (
          <p className="mt-0.5 text-[11px] tabular-nums text-pulse-muted">
            valence {valence > 0 ? '+' : ''}{valence.toFixed(2)} · energy {energy.toFixed(2)}
          </p>
        )}
      </div>

      {/* Quadrant breakdown */}
      {!empty && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-l border-white/8 pl-4 sm:pl-6">
          {QUADRANTS.map((q) => (
            <div key={q} className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${VIBE_META[q].dot}`} aria-hidden />
              <span className="text-[11px] text-pulse-muted">{VIBE_LABELS[q]}</span>
              <span className="text-[11px] font-semibold tabular-nums text-slate-200">
                {snap.quadrants[q]}
              </span>
            </div>
          ))}
        </div>
      )}

      {snap && (
        <div className="ml-auto shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wider text-pulse-muted">Events</p>
          <p className="text-sm font-semibold tabular-nums text-slate-200">
            {snap.eventCount}
            <span className="text-pulse-muted"> / 24h</span>
          </p>
        </div>
      )}
    </section>
  );
}
