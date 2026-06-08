'use client';

import type { ReactNode } from 'react';
import { MOODS, type Mood } from '@pulse/shared-types';

/** Shared face base — eyes + a mouth path that conveys the energy level. */
function Face({ mouth }: { mouth: ReactNode }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.25" />
      <circle cx="8.75" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.25" cy="10" r="0.9" fill="currentColor" stroke="none" />
      {mouth}
    </svg>
  );
}

const config: Record<
  Mood,
  { label: string; ring: string; active: string; icon: ReactNode }
> = {
  high: {
    label: 'High',
    ring: 'ring-emerald-500/40',
    active: 'border-emerald-500/50 bg-emerald-500/15 text-emerald-200',
    icon: (
      <Face
        mouth={
          <path strokeLinecap="round" d="M8 14a4 4 0 0 0 8 0" />
        }
      />
    ),
  },
  medium: {
    label: 'Medium',
    ring: 'ring-sky-500/40',
    active: 'border-sky-500/50 bg-sky-500/15 text-sky-200',
    icon: (
      <Face
        mouth={
          <path strokeLinecap="round" d="M9 14.25q3 1.5 6 0" />
        }
      />
    ),
  },
  low: {
    label: 'Low',
    ring: 'ring-red-500/40',
    active: 'border-red-500/50 bg-red-500/15 text-red-200',
    icon: (
      <Face
        mouth={
          <path strokeLinecap="round" d="M8 15.5a4 4 0 0 1 8 0" />
        }
      />
    ),
  },
  neutral: {
    label: 'Neutral',
    ring: 'ring-slate-500/40',
    active: 'border-slate-500/50 bg-slate-500/15 text-slate-200',
    icon: (
      <Face mouth={<path strokeLinecap="round" d="M9 14.75h6" />} />
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
      {label && <span className="pulse-label">{label}</span>}
      <div
        className="grid grid-cols-4 gap-1.5"
        role="radiogroup"
        aria-label={label}
      >
        {MOODS.map((m) => {
          const c = config[m];
          const selected = value === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={c.label}
              onClick={() => onChange(m)}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition-all duration-200 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent ${
                selected
                  ? `${c.active} scale-[1.03] ring-2 ${c.ring}`
                  : 'border-white/8 bg-pulse-elevated/50 text-pulse-muted hover:-translate-y-0.5 hover:border-white/15 hover:text-slate-200'
              }`}
            >
              {c.icon}
              <span className="text-[10px] font-medium">{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
