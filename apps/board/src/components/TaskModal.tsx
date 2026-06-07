'use client';

import { useState, type ReactNode } from 'react';
import { TASK_STATUSES, type Mood, type TaskStatus } from '@pulse/shared-types';
import type { Task, UserOption } from '@/lib/api';
import { HealthBadge } from './HealthBadge';
import { Modal } from './Modal';
import { MoodPicker } from './MoodPicker';
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

interface Props {
  task: Task;
  users: UserOption[];
  onClose: () => void;
  onUpdate: () => Promise<void>;
  onStatus: (status: TaskStatus, mood: Mood) => Promise<void>;
  onComment: (text: string, mood: Mood) => Promise<void>;
  onReassign: (assigneeId: string, mood: Mood) => Promise<void>;
}

function SectionIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/6 text-pulse-muted">
      {children}
    </span>
  );
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
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [statusMood, setStatusMood] = useState<Mood>('neutral');
  const [comment, setComment] = useState('');
  const [commentMood, setCommentMood] = useState<Mood>('neutral');
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? '');
  const [reassignMood, setReassignMood] = useState<Mood>('neutral');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const assignee = users.find((u) => u.id === task.assignee_id);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={task.title} onClose={onClose}>
      <div className="space-y-4">
        {/* Task meta */}
        <div className="flex items-start justify-between gap-4 rounded-xl border border-white/6 bg-pulse-bg/50 p-4">
          <div className="min-w-0 flex-1">
            {task.description ? (
              <p className="text-sm leading-relaxed text-slate-300">{task.description}</p>
            ) : (
              <p className="text-sm italic text-slate-600">No description</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium capitalize ${statusColors[task.status]}`}
              >
                {statusLabels[task.status]}
              </span>
              {assignee && (
                <span className="flex items-center gap-1.5 text-xs text-pulse-muted">
                  <UserAvatar name={assignee.display_name} />
                  {assignee.display_name}
                </span>
              )}
            </div>
          </div>
          <HealthBadge score={task.health_score} showBar />
        </div>

        {/* Move status */}
        <section className="pulse-section">
          <div className="flex items-center gap-2">
            <SectionIcon>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 21 21 7.5M3 16.5l4.5 4.5" />
              </svg>
            </SectionIcon>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-pulse-muted">
              Move status
            </h3>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Target status">
            {TASK_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                aria-pressed={status === s}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent ${
                  status === s
                    ? `${statusColors[s]} ring-2 ring-white/10`
                    : 'border-white/8 bg-pulse-elevated/50 text-pulse-muted hover:border-white/15 hover:text-slate-200'
                }`}
              >
                {statusLabels[s]}
              </button>
            ))}
          </div>
          <MoodPicker value={statusMood} onChange={setStatusMood} />
          <button
            type="button"
            disabled={busy || status === task.status}
            onClick={() => run(() => onStatus(status, statusMood))}
            className="pulse-btn-primary w-full py-2 text-xs disabled:opacity-40"
          >
            {busy ? 'Updating…' : 'Update status'}
          </button>
        </section>

        {/* Comment */}
        <section className="pulse-section">
          <div className="flex items-center gap-2">
            <SectionIcon>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
            </SectionIcon>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-pulse-muted">
              Comment
            </h3>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Add context, blockers, or updates…"
            className="pulse-input resize-none"
          />
          <MoodPicker value={commentMood} onChange={setCommentMood} />
          <button
            type="button"
            disabled={busy || !comment.trim()}
            onClick={() =>
              run(async () => {
                await onComment(comment.trim(), commentMood);
                setComment('');
              })
            }
            className="pulse-btn-secondary w-full py-2 text-xs disabled:opacity-40"
          >
            Post comment
          </button>
        </section>

        {/* Reassign */}
        <section className="pulse-section">
          <div className="flex items-center gap-2">
            <SectionIcon>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
            </SectionIcon>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-pulse-muted">
              Reassign
            </h3>
          </div>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="pulse-input cursor-pointer"
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name}
              </option>
            ))}
          </select>
          <MoodPicker value={reassignMood} onChange={setReassignMood} />
          <button
            type="button"
            disabled={busy || !assigneeId}
            onClick={() => run(() => onReassign(assigneeId, reassignMood))}
            className="pulse-btn-secondary w-full py-2 text-xs disabled:opacity-40"
          >
            Reassign
          </button>
        </section>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
