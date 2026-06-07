'use client';

import { useEffect, useState } from 'react';
import type { EventType, IntelTaskDetail, Mood, TaskStatus } from '@pulse/shared-types';
import { fetchTaskDetail } from '@/lib/api';
import { healthBarClasses, healthColor } from '@/lib/health';
import type { TaskDetailHighlight } from './TaskDetailContext';
import { Spinner } from './Spinner';
import { UserAvatar } from './UserAvatar';

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  in_progress: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  review: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  done: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

const MOOD_STYLES: Record<Mood, string> = {
  high: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25',
  medium: 'bg-sky-500/15 text-sky-300 ring-sky-500/25',
  low: 'bg-red-500/15 text-red-300 ring-red-500/25',
  neutral: 'bg-slate-500/15 text-slate-300 ring-slate-500/25',
};

const EVENT_LABELS: Record<EventType, string> = {
  created: 'Created',
  status_changed: 'Status changed',
  commented: 'Comment',
  reassigned: 'Reassigned',
};

function formatEventSummary(event: IntelTaskDetail['events'][number]): string {
  switch (event.eventType) {
    case 'created':
      return `${event.actorName} created this task`;
    case 'status_changed':
      return `${event.actorName} moved ${event.oldValue ?? '?'} → ${event.newValue ?? '?'}`;
    case 'commented':
      return event.commentText ?? `${event.actorName} commented`;
    case 'reassigned':
      return `${event.actorName} reassigned the task`;
    default:
      return `${event.actorName} updated the task`;
  }
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface Props {
  taskId: string;
  highlight: TaskDetailHighlight | null;
  onClose: () => void;
}

export function TaskDetailDrawer({ taskId, highlight, onClose }: Props) {
  const [task, setTask] = useState<IntelTaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setTask(null);

    fetchTaskDetail(taskId)
      .then((detail) => {
        if (!cancelled) setTask(detail);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load task');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const health = task ? healthColor(task.healthScore) : 'amber';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/55 backdrop-blur-[2px] transition-opacity duration-300"
        aria-label="Close task details"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
        className="pulse-drawer-in relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-pulse-panel/95 shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:max-w-lg"
      >
        <header className="relative shrink-0 border-b border-white/8 px-5 py-4">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pulse-accent/12 via-transparent to-transparent" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-pulse-muted">
                Task details
              </p>
              <h2
                id="task-detail-title"
                className="mt-1 text-base font-semibold leading-snug text-white"
              >
                {loading ? 'Loading…' : (task?.title ?? 'Task')}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400 transition-colors duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent"
              aria-label="Close"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {loading && (
            <div className="flex h-48 items-center justify-center">
              <Spinner label="Loading task…" size="sm" />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {task && !loading && (
            <div className="space-y-4 pulse-fade-in">
              {highlight?.contentText && (
                <section className="rounded-xl border border-pulse-accent/30 bg-gradient-to-br from-pulse-accent/10 to-violet-600/5 p-4 ring-1 ring-pulse-accent/20">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-pulse-accent">
                      {highlight.label ?? 'AI context match'}
                    </span>
                    {highlight.score != null && (
                      <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] tabular-nums text-slate-300">
                        {Math.round(highlight.score * 100)}% relevance
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">
                    {highlight.contentText}
                  </p>
                </section>
              )}

              <section className="rounded-xl border border-white/8 bg-pulse-bg/50 p-4">
                {task.description ? (
                  <p className="text-sm leading-relaxed text-slate-300">
                    {task.description}
                  </p>
                ) : (
                  <p className="text-sm italic text-slate-600">No description</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${STATUS_STYLES[task.status]}`}
                  >
                    {STATUS_LABELS[task.status]}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums ring-1 ring-inset ${
                      health === 'green'
                        ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25'
                        : health === 'amber'
                          ? 'bg-amber-500/15 text-amber-300 ring-amber-500/25'
                          : 'bg-red-500/15 text-red-300 ring-red-500/25'
                    }`}
                  >
                    Health {task.healthScore}
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${healthBarClasses[health]}`}
                    style={{ width: `${task.healthScore}%` }}
                  />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <dt className="text-pulse-muted">Assignee</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-slate-200">
                      {task.assigneeName ? (
                        <>
                          <UserAvatar name={task.assigneeName} />
                          {task.assigneeName}
                        </>
                      ) : (
                        <span className="text-slate-500">Unassigned</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">Created by</dt>
                    <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-slate-200">
                      <UserAvatar name={task.creatorName} />
                      {task.creatorName}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">Last activity</dt>
                    <dd className="mt-0.5 font-medium text-slate-200">
                      {formatRelativeTime(task.lastActivityAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-pulse-muted">Created</dt>
                    <dd className="mt-0.5 font-medium text-slate-200">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-pulse-muted">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  Activity timeline
                  <span className="rounded-full bg-white/8 px-1.5 py-0.5 tabular-nums text-slate-400">
                    {task.events.length}
                  </span>
                </h3>

                {task.events.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 py-8 text-center text-xs text-slate-600">
                    No events recorded yet
                  </p>
                ) : (
                  <ul className="relative space-y-0">
                    <span
                      className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-pulse-accent/40 via-white/10 to-transparent"
                      aria-hidden
                    />
                    {task.events.map((event, i) => (
                      <li
                        key={event.id}
                        className="relative pl-8 pb-4 last:pb-0"
                        style={{ animationDelay: `${i * 40}ms` }}
                      >
                        <span
                          className="absolute left-0 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-white/10 bg-pulse-elevated text-[9px] font-bold text-pulse-muted"
                          aria-hidden
                        >
                          {EVENT_LABELS[event.eventType].slice(0, 1)}
                        </span>
                        <div className="rounded-lg border border-white/6 bg-pulse-bg/40 px-3 py-2.5 transition-colors hover:border-white/12 hover:bg-pulse-bg/70">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-medium text-slate-300">
                              {EVENT_LABELS[event.eventType]}
                            </p>
                            <time
                              className="shrink-0 text-[10px] tabular-nums text-pulse-muted"
                              dateTime={event.occurredAt}
                            >
                              {formatRelativeTime(event.occurredAt)}
                            </time>
                          </div>
                          <p className="mt-1 text-sm leading-snug text-slate-200">
                            {formatEventSummary(event)}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <UserAvatar name={event.actorName} />
                            <span className="text-[11px] text-pulse-muted">
                              {event.actorName}
                            </span>
                            <span
                              className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize ring-1 ring-inset ${MOOD_STYLES[event.mood]}`}
                            >
                              {event.mood}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
