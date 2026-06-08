// Canonical enums — must match infra/postgres/init.sql CHECK constraints.
// Runtime arrays are the single source; types are derived for compile-time use.

export const MOODS = ['high', 'medium', 'low', 'neutral'] as const;
export type Mood = (typeof MOODS)[number];

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const EVENT_TYPES = [
  'created',
  'status_changed',
  'commented',
  'reassigned',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const ROLES = ['pulse-admin', 'pulse-member', 'pulse-viewer'] as const;
export type Role = (typeof ROLES)[number];

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

/** Enriched event for the live activity feed (workers JOIN tasks + users) */
export interface ActivityFeedItem extends TaskEvent {
  taskTitle: string;
  taskStatus: TaskStatus;
  actorName: string;
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

/** RAG source citation stored on an Intel chat turn */
export interface IntelChatSource {
  taskId: string;
  title: string;
  status: string;
  /** Current task health at query time (joined from tasks.health_score). */
  healthScore?: number;
  contentText: string;
  score: number;
}

/** Persisted Intel AI Q&A turn (per user) */
export interface IntelChatTurn {
  id: string;
  question: string;
  answer: string;
  sources: IntelChatSource[];
  error?: string;
  createdAt: string;
}

/** Max prior turns sent to the LLM as conversation context */
export const INTEL_CHAT_LLM_HISTORY_LIMIT = 20;

/** Task event row for Intel task detail drawer */
export interface IntelTaskEvent {
  id: string;
  eventType: EventType;
  actorName: string;
  oldValue?: string;
  newValue?: string;
  commentText?: string;
  mood: Mood;
  occurredAt: string;
}

/** Full task detail for Intel expandable cards (read-only) */
export interface IntelTaskDetail {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  healthScore: number;
  assigneeName: string | null;
  creatorName: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  events: IntelTaskEvent[];
}

// Worker pattern: TaskEvent payload is minimal. Workers JOIN tasks + users
// tables to enrich context (title, status, actor name) when building embeddings
// or computing health scores. Queue stays lean; workers read current state.
