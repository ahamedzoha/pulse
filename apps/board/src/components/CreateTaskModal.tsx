'use client';

import { useState } from 'react';
import type { Mood } from '@pulse/shared-types';
import type { UserOption } from '@/lib/api';
import { Modal } from './Modal';
import { MoodPicker } from './MoodPicker';

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

  return (
    <Modal title="New task" onClose={onClose} maxWidth="md">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="task-title" className="pulse-label">
            Title
          </label>
          <input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="pulse-input"
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
          <label htmlFor="task-assignee" className="pulse-label">
            Assignee
          </label>
          <select
            id="task-assignee"
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
        </div>
        <MoodPicker value={mood} onChange={setMood} label="Starting mood" />

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="pulse-btn-ghost px-4 py-2 text-sm">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="pulse-btn-primary">
            {busy ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
