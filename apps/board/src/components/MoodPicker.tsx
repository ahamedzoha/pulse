'use client';

import type { ReactNode } from 'react';
import { MOODS, type Mood } from '@pulse/shared-types';

const config: Record<
  Mood,
  { label: string; ring: string; active: string; icon: ReactNode }
> = {
  high: {
    label: 'High',
    ring: 'ring-emerald-500/40',
    active: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5 10.5 6.75 14.25 10.5 21 3.75M3.75 19.5h16.5" />
      </svg>
    ),
  },
  medium: {
    label: 'Medium',
    ring: 'ring-sky-500/40',
    active: 'border-sky-500/50 bg-sky-500/15 text-sky-200',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
      </svg>
    ),
  },
  low: {
    label: 'Low',
    ring: 'ring-red-500/40',
    active: 'border-red-500/50 bg-red-500/15 text-red-200',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.563C9 8.252 10.248 7 11.5 7S14 8.252 14 9.563 12.752 12 11.5 12 9 10.874 9 9.563ZM9 15h5" />
      </svg>
    ),
  },
  neutral: {
    label: 'Neutral',
    ring: 'ring-slate-500/40',
    active: 'border-slate-500/50 bg-slate-500/15 text-slate-200',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
    ),
  },
};

interface Props {
  value: Mood;
  onChange: (mood: Mood) => void;
  label?: string;
}

export function MoodPicker({ value, onChange, label = 'Mood' }: Props) {
  return (
    <div>
      <span className="pulse-label">{label}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {MOODS.map((m) => {
          const c = config[m];
          const selected = value === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              aria-pressed={selected}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent ${
                selected
                  ? `${c.active} ring-2 ${c.ring}`
                  : 'border-white/8 bg-pulse-elevated/60 text-pulse-muted hover:border-white/15 hover:text-slate-200'
              }`}
            >
              {c.icon}
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
