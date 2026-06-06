// Canonical types — must match infra/postgres/init.sql CHECK constraints

export type Mood = 'high' | 'medium' | 'low' | 'neutral';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

export type EventType =
  | 'created'
  | 'status_changed'
  | 'commented'
  | 'reassigned';

export type Role = 'pulse-admin' | 'pulse-member' | 'pulse-viewer';

/** BullMQ job payload — all workers read this shape */
export interface TaskEvent {
  id: string;
  taskId: string;
  actorId: string;
  eventType: EventType;
  oldValue?: string;
  newValue?: string;
  commentText?: string;
  mood: Mood;
  occurredAt: string;
}

/** Health decay points per hour by status */
export const HEALTH_DECAY_RATES: Record<TaskStatus, number> = {
  todo: 2,
  in_progress: 1,
  review: 0.5,
  done: 0,
};

/** Health badge color thresholds */
export const HEALTH_THRESHOLDS = {
  green: 70,
  amber: 40,
} as const;

/** Numeric weights for momentum meter (rolling 24h average) */
export const MOOD_WEIGHTS: Record<Mood, number> = {
  high: 4,
  medium: 3,
  low: 1,
  neutral: 2,
} as const;

/** BullMQ queue names */
export const QUEUES = {
  TASK_EVENTS: 'task-events',
} as const;

// Worker pattern: TaskEvent payload is minimal. Workers JOIN tasks + users
// tables to enrich context (title, status, actor name) when building embeddings
// or computing health scores. Queue stays lean; workers read current state.
