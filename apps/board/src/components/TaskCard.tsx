'use client';

import type { CSSProperties } from 'react';
import type { Task } from '@/lib/api';
import { healthColor } from '@/lib/health';
import { formatRelativeTime } from '@/lib/time';
import { HealthBadge } from './HealthBadge';
import { UserAvatar } from './UserAvatar';

const accent: Record<'green' | 'amber' | 'red', string> = {
  green: 'bg-emerald-500/70',
  amber: 'bg-amber-500/70',
  red: 'bg-red-500/70',
};

interface Props {
  task: Task;
  assigneeName?: string;
  onClick: () => void;
  style?: CSSProperties;
}

export function TaskCard({ task, assigneeName, onClick, style }: Props) {
  const color = healthColor(task.health_score);

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className="pulse-fade-in group relative w-full shrink-0 cursor-pointer overflow-hidden rounded-xl border border-white/8 bg-pulse-elevated/80 p-3.5 pl-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-pulse-accent/40 hover:bg-pulse-elevated hover:shadow-lg hover:shadow-pulse-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent"
    >
      <span
        className={`absolute inset-y-0 left-0 w-1 ${accent[color]}`}
        aria-hidden
      />
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug text-white group-hover:text-pulse-glow">
          {task.title}
        </h3>
        <HealthBadge score={task.health_score} />
      </div>
      {task.description && (
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-pulse-muted">
          {task.description}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        {assigneeName ? (
          <span className="flex items-center gap-1.5 text-[10px] text-pulse-muted">
            <UserAvatar name={assigneeName} />
            <span className="truncate">{assigneeName}</span>
          </span>
        ) : (
          <span className="text-[10px] italic text-slate-600">Unassigned</span>
        )}
        <span className="text-[10px] tabular-nums text-slate-600">
          {formatRelativeTime(task.last_activity_at)}
        </span>
      </div>
    </button>
  );
}
