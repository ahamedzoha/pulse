'use client';

import { useState } from 'react';
import type { Mood } from '@pulse/shared-types';
import type { UserOption } from '@/lib/api';
import { Modal } from './Modal';
import { MoodPicker } from './MoodPicker';
import { UserAvatar } from './UserAvatar';

interface Props {
  users: UserOption[];
  onClose: () => void;
  onCreate: (input: {
    title: string;
    description?: string;
    assigneeId?: string;
    mood: Mood;
  }) => Promise<void>;
}

export function CreateTaskModal({ users, onClose, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [mood, setMood] = useState<Mood>('neutral');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId: assigneeId || undefined,
        mood,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) =>
    `inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pulse-accent ${
      active
        ? 'border-pulse-accent/50 bg-pulse-accent/10 text-white ring-2 ring-pulse-accent/20'
        : 'border-white/8 bg-pulse-elevated/50 text-pulse-muted hover:border-white/15 hover:text-slate-200'
    }`;

  return (
    <Modal title="New task" onClose={onClose} maxWidth="lg">
      <form onSubmit={submit} className="space-y-5">
        <div>
          <input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-pulse-bg/80 px-4 py-3 text-lg font-medium text-white shadow-inner transition-colors duration-200 placeholder:text-slate-600 focus:border-pulse-accent/50 focus:outline-none focus:ring-2 focus:ring-pulse-accent/20"
            placeholder="What needs to get done?"
            required
            maxLength={200}
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="task-desc" className="pulse-label">
            Description
          </label>
          <textarea
            id="task-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="pulse-input resize-none"
            placeholder="Context, acceptance criteria, links…"
            maxLength={2000}
          />
        </div>

        <div>
          <span className="pulse-label">Assignee</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Assignee">
            <button
              type="button"
              onClick={() => setAssigneeId('')}
              aria-pressed={assigneeId === ''}
              className={chip(assigneeId === '')}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-white/25 text-[10px]">
                —
              </span>
              Unassigned
            </button>
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setAssigneeId(u.id)}
                aria-pressed={assigneeId === u.id}
                className={chip(assigneeId === u.id)}
              >
                <UserAvatar name={u.display_name} />
                {u.display_name}
              </button>
            ))}
          </div>
        </div>

        <MoodPicker value={mood} onChange={setMood} label="Starting mood" />

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="pulse-btn-ghost px-4 py-2 text-sm">
            Cancel
          </button>
          <button type="submit" disabled={busy || !title.trim()} className="pulse-btn-primary">
            {busy ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
