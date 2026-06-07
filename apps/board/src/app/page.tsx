'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TASK_STATUSES, type TaskStatus } from '@pulse/shared-types';
import {
  addComment,
  createTask,
  fetchMe,
  fetchTasks,
  fetchUsers,
  reassignTask,
  updateStatus,
  type Task,
  type User,
  type UserOption,
} from '@/lib/api';
import {
  captureTokenFromHash,
  getToken,
  signIn,
  signInAsDifferentUser,
} from '@/lib/auth';
import { INTEL_URL } from '@/lib/config';
import { healthColor } from '@/lib/health';
import { AuthScreen } from '@/components/AuthScreen';
import { CreateTaskModal } from '@/components/CreateTaskModal';
import { Header } from '@/components/Header';
import { KanbanColumn } from '@/components/KanbanColumn';
import { Spinner } from '@/components/Spinner';
import { TaskModal } from '@/components/TaskModal';

export default function BoardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [gate, setGate] = useState<'none' | 'viewer' | 'auth'>('none');
  const [selected, setSelected] = useState<Task | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = useCallback(async () => {
    const [t, u] = await Promise.all([fetchTasks(), fetchUsers()]);
    setTasks(t);
    setUsers(u);
    setSelected((prev) =>
      prev ? (t.find((x) => x.id === prev.id) ?? null) : null,
    );
  }, []);

  useEffect(() => {
    captureTokenFromHash();
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(async (me) => {
        if (me.role === 'pulse-viewer') {
          setUser(me);
          setGate('viewer');
          return;
        }
        setUser(me);
        await refresh();
      })
      .catch(() => setGate('auth'))
      .finally(() => setLoading(false));
  }, [refresh]);

  const assigneeNames = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.display_name])),
    [users],
  );

  const stats = useMemo(() => {
    const avg =
      tasks.length > 0
        ? Math.round(
            tasks.reduce((s, t) => s + t.health_score, 0) / tasks.length,
          )
        : 0;
    const atRisk = tasks.filter((t) => healthColor(t.health_score) === 'red').length;
    const inFlight = tasks.filter((t) => t.status === 'in_progress').length;
    return { avg, atRisk, inFlight };
  }, [tasks]);

  if (loading) {
    return (
      <main className="flex h-dvh items-center justify-center">
        <Spinner label="Loading board…" />
      </main>
    );
  }

  if (!getToken()) {
    return (
      <AuthScreen
        appLabel="Pulse Board"
        title="Sign in to continue"
        description="Sign in with Microsoft Entra ID to create and manage tasks on the board."
        actions={[{ label: 'Sign in with Microsoft', onClick: signIn, primary: true }]}
      />
    );
  }

  if (gate === 'viewer' && user) {
    return (
      <AuthScreen
        appLabel="Pulse Board"
        title="Board access restricted"
        description={
          <>
            Your role (<code className="rounded bg-white/8 px-1.5 py-0.5 text-amber-300">pulse-viewer</code>) is
            read-only on the board. Use Pulse Intel for the activity feed,
            leaderboard, and AI panel.
          </>
        }
        user={{ displayName: user.displayName, role: user.role }}
        actions={[
          { label: 'Open Pulse Intel', href: INTEL_URL, primary: true },
        ]}
      />
    );
  }

  if (gate === 'auth' || !user) {
    return (
      <AuthScreen
        appLabel="Pulse Board"
        title="Session expired"
        description="Your sign-in could not be verified. Sign in again or sign out to use a different account."
        actions={[
          {
            label: 'Sign in again',
            onClick: signInAsDifferentUser,
            primary: true,
          },
        ]}
      />
    );
  }

  const byStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header user={user} taskCount={tasks.length} />
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/6 bg-pulse-surface/50 px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap gap-2 sm:gap-4">
          <StatPill label="Avg health" value={`${stats.avg}`} accent="text-sky-300" />
          <StatPill label="In progress" value={`${stats.inFlight}`} accent="text-emerald-300" />
          <StatPill label="At risk" value={`${stats.atRisk}`} accent="text-red-300" />
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="pulse-btn-primary shrink-0 text-xs sm:text-sm"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New task
        </button>
      </div>
      <main className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-4 sm:p-6">
        <div className="flex h-full min-h-[400px] gap-4">
          {TASK_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={byStatus(status)}
              assigneeNames={assigneeNames}
              onTaskClick={setSelected}
            />
          ))}
        </div>
      </main>

      {showCreate && (
        <CreateTaskModal
          users={users}
          onClose={() => setShowCreate(false)}
          onCreate={async (input) => {
            await createTask(input);
            await refresh();
          }}
        />
      )}

      {selected && (
        <TaskModal
          task={selected}
          users={users}
          onClose={() => setSelected(null)}
          onUpdate={refresh}
          onStatus={(s, mood) => updateStatus(selected.id, s, mood).then(() => {})}
          onComment={(text, mood) =>
            addComment(selected.id, text, mood).then(() => {})
          }
          onReassign={(assigneeId, mood) =>
            reassignTask(selected.id, assigneeId, mood).then(() => {})
          }
        />
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/6 bg-pulse-panel/60 px-3 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-pulse-muted">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${accent}`}>{value}</span>
    </div>
  );
}
