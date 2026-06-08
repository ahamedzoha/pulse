'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { TASK_STATUSES, type Mood, type TaskStatus } from '@pulse/shared-types';
import { fetchTaskEvents, type Task, type TaskEventItem, type UserOption } from '@/lib/api';
import { healthColor } from '@/lib/health';
import { formatRelativeTime } from '@/lib/time';
import { ActivityTimeline } from './ActivityTimeline';
import { HealthBadge } from './HealthBadge';
import { Modal } from './Modal';
import { MoodPicker } from './MoodPicker';
import { Spinner } from './Spinner';
import { UserAvatar } from './UserAvatar';

const statusLabels: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

const statusColors: Record<TaskStatus, string> = {
  todo: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
  in_progress: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  review: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  done: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
};

type Tab = 'comment' | 'status' | 'assign';

const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: 'comment',
    label: 'Comment',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
  },
  {
    id: 'status',
    label: 'Move',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 21 21 7.5M3 16.5l4.5 4.5" />
      </svg>
    ),
  },
  {
    id: 'assign',
    label: 'Assign',
    icon: (
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
      </svg>
    ),
  },
];

interface Props {
  task: Task;
  users: UserOption[];
  onClose: () => void;
  onUpdate: () => Promise<void>;
  onStatus: (status: TaskStatus, mood: Mood) => Promise<void>;
  onComment: (text: string, mood: Mood) => Promise<void>;
  onReassign: (assigneeId: string, mood: Mood) => Promise<void>;
}

export function TaskModal({
  task,
  users,
  onClose,
  onUpdate,
  onStatus,
  onComment,
  onReassign,
}: Props) {
  const [tab, setTab] = useState<Tab>('comment');
  const [mood, setMood] = useState<Mood>('neutral');
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [events, setEvents] = useState<TaskEventItem[] | null>(null);
  const [eventsError, setEventsError] = useState('');

  const assignee = users.find((u) => u.id === task.assignee_id);
  const color = healthColor(task.health_score);

  const loadEvents = useCallback(async () => {
    try {
      setEvents(await fetchTaskEvents(task.id));
      setEventsError('');
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : 'Failed to load activity');
    }
  }, [task.id]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // Keep pending selections in sync if the task changes underneath us.
  useEffect(() => {
    setStatus(task.status);
    setAssigneeId(task.assignee_id ?? '');
  }, [task.status, task.assignee_id]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await Promise.all([onUpdate(), loadEvents()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const currentAssignee = task.assignee_id ?? '';
  const action =
    tab === 'comment'
      ? {
          label: 'Post comment',
          disabled: !comment.trim(),
          submit: () =>
            run(async () => {
              await onComment(comment.trim(), mood);
              setComment('');
            }),
        }
      : tab === 'status'
        ? {
            label:
              status === task.status
                ? 'Move status'
                : `Move to ${statusLabels[status]}`,
            disabled: status === task.status,
            submit: () => run(() => onStatus(status, mood)),
          }
        : {
            label:
              assigneeId === '' && currentAssignee !== '' ? 'Unassign' : 'Reassign',
            disabled: assigneeId === currentAssignee,
            submit: () => run(() => onReassign(assigneeId, mood)),
          };

  return (
    <Modal
      title={task.title}
      onClose={onClose}
      maxWidth="xl"
      headerAccessory={<HealthBadge score={task.health_score} />}
    >
      <div className="space-y-5">
        {/* Meta */}
        <section className="rounded-xl border border-white/6 bg-pulse-bg/50 p-4">
          {task.description ? (
            <p className="text-sm leading-relaxed text-slate-300">{task.description}</p>
          ) : (
            <p className="text-sm italic text-slate-600">No description</p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${statusColors[task.status]}`}
            >
              {statusLabels[task.status]}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-pulse-muted">
              {assignee ? (
                <>
                  <UserAvatar name={assignee.display_name} />
                  {assignee.display_name}
                </>
              ) : (
                <span className="italic text-slate-600">Unassigned</span>
              )}
            </span>
            <span className="text-[11px] text-pulse-muted">
              Active {formatRelativeTime(task.last_activity_at)}
            </span>
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                color === 'green'
                  ? 'bg-emerald-500'
                  : color === 'amber'
                    ? 'bg-amber-500'
                    : 'bg-red-500'
              }`}
              style={{ width: `${task.health_score}%` }}
            />
          </div>
        </section>

        {/* Composer */}
        <section className="rounded-xl border border-white/8 bg-pulse-elevated/40 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-pulse-muted">
            Add an update
          </h3>

          <div
            className="mb-3 inline-flex gap-1 rounded-xl border border-white/8 bg-pulse-bg/60 p-1"
            role="tablist"
            aria-label="Update type"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent ${
                  tab === t.id
                    ? 'bg-pulse-accent/15 text-pulse-glow ring-1 ring-pulse-accent/30'
                    : 'text-pulse-muted hover:text-slate-200'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'comment' && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Add context, blockers, or a quick update…"
              className="pulse-input resize-none"
              autoFocus
            />
          )}

          {tab === 'status' && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Target status">
              {TASK_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  aria-pressed={status === s}
                  className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent ${
                    status === s
                      ? `${statusColors[s]} ring-2 ring-white/10`
                      : 'border-white/8 bg-pulse-elevated/50 text-pulse-muted hover:border-white/15 hover:text-slate-200'
                  }`}
                >
                  {statusLabels[s]}
                  {s === task.status && (
                    <span className="ml-1.5 text-[9px] opacity-60">current</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {tab === 'assign' && (
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="pulse-input cursor-pointer"
              aria-label="Assignee"
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name}
                </option>
              ))}
            </select>
          )}

          <div className="mt-3">
            <MoodPicker value={mood} onChange={setMood} label="Mood for this update" />
          </div>

          <button
            type="button"
            disabled={busy || action.disabled}
            onClick={action.submit}
            className="pulse-btn-primary mt-3 w-full py-2 text-xs disabled:opacity-40"
          >
            {busy ? 'Saving…' : action.label}
          </button>

          {error && (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </section>

        {/* Activity */}
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pulse-muted">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Activity
            {events && (
              <span className="rounded-full bg-white/8 px-1.5 py-0.5 tabular-nums text-slate-400">
                {events.length}
              </span>
            )}
          </h3>

          {eventsError ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
              {eventsError}
            </div>
          ) : events === null ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner label="Loading activity…" size="sm" />
            </div>
          ) : (
            <ActivityTimeline events={events} />
          )}
        </section>
      </div>
    </Modal>
  );
}
