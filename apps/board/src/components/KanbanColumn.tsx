'use client';

import type { TaskStatus } from '@pulse/shared-types';
import type { Task } from '@/lib/api';
import { TaskCard } from './TaskCard';

const config: Record<
  TaskStatus,
  { title: string; accent: string; dot: string; empty: string }
> = {
  todo: {
    title: 'To Do',
    accent: 'border-t-slate-500/60',
    dot: 'bg-slate-400',
    empty: 'Drop tasks here',
  },
  in_progress: {
    title: 'In Progress',
    accent: 'border-t-sky-500/70',
    dot: 'bg-sky-400',
    empty: 'Nothing in flight',
  },
  review: {
    title: 'Review',
    accent: 'border-t-amber-500/70',
    dot: 'bg-amber-400',
    empty: 'Queue is clear',
  },
  done: {
    title: 'Done',
    accent: 'border-t-emerald-500/70',
    dot: 'bg-emerald-400',
    empty: 'Shipped tasks land here',
  },
};

interface Props {
  status: TaskStatus;
  tasks: Task[];
  assigneeNames: Record<string, string>;
  onTaskClick: (task: Task) => void;
}

export function KanbanColumn({ status, tasks, assigneeNames, onTaskClick }: Props) {
  const c = config[status];

  return (
    <section
      className={`pulse-fade-in flex h-full min-h-0 min-w-[260px] flex-1 flex-col overflow-hidden rounded-2xl border border-white/8 border-t-2 bg-pulse-panel/60 backdrop-blur-sm ${c.accent}`}
    >
      <header className="flex shrink-0 items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden />
          <h2 className="text-sm font-semibold text-slate-100">{c.title}</h2>
        </div>
        <span className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-medium tabular-nums text-pulse-muted">
          {tasks.length}
        </span>
      </header>
      <div className="pulse-scroll pulse-scroll-fade flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain py-1 pl-3 pr-2">
        {tasks.map((t, i) => (
          <TaskCard
            key={t.id}
            task={t}
            assigneeName={
              t.assignee_id ? assigneeNames[t.assignee_id] : undefined
            }
            onClick={() => onTaskClick(t)}
            style={{ animationDelay: `${i * 40}ms` }}
          />
        ))}
        {tasks.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/8 px-4 py-10 text-center">
            <p className="text-xs text-slate-600">{c.empty}</p>
          </div>
        )}
      </div>
    </section>
  );
}
