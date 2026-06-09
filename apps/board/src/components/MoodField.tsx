'use client';

import type { Mood } from '@pulse/shared-types';
import { MoodPicker } from './MoodPicker';

interface Props {
  /** undefined = auto-derive; a Mood = manual override. */
  value: Mood | undefined;
  onChange: (mood: Mood | undefined) => void;
  /** Microcopy shown in the auto state. */
  autoHint?: string;
}

/**
 * Mood as an *optional* override. Default is "Auto" — the server reads energy
 * from sentiment, so there's nothing to pick. The user can drop into manual
 * mode if their words don't match how they feel.
 */
export function MoodField({ value, onChange, autoHint }: Props) {
  const manual = value !== undefined;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-pulse-muted">
          Mood
        </span>
        <button
          type="button"
          onClick={() => onChange(manual ? undefined : 'neutral')}
          className="cursor-pointer text-[11px] font-medium text-pulse-glow transition-colors hover:text-pulse-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent"
        >
          {manual ? 'Use auto' : 'Set manually'}
        </button>
      </div>

      {manual ? (
        <div className="mt-2">
          <MoodPicker value={value} onChange={(m) => onChange(m)} label="" />
        </div>
      ) : (
        <p className="mt-1.5 flex items-center gap-1.5 rounded-lg border border-white/8 bg-pulse-bg/50 px-3 py-2 text-xs text-pulse-muted">
          <svg className="h-3.5 w-3.5 shrink-0 text-pulse-glow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
          <span>Auto — {autoHint ?? 'inferred from your words'}</span>
        </p>
      )}
    </div>
  );
}
