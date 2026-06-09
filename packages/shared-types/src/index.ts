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

/** How a sentiment score was produced: instant lexicon baseline vs LLM refine */
export type SentimentSource = 'lexicon' | 'llm';

/** BullMQ job payload — all workers read this shape */
export interface TaskEvent {
  id: string;
  taskId: string;
  actorId: string;
  eventType: EventType;
  oldValue?: string;
  newValue?: string;
  commentText?: string;
  /** Energy axis (arousal). Auto-derived by the LLM unless moodManual. */
  mood: Mood;
  /** true = user picked the mood; the LLM must not overwrite it. */
  moodManual?: boolean;
  /** Valence axis, -1 (negative) .. 1 (positive). null = not scored. */
  sentiment?: number | null;
  sentimentSource?: SentimentSource;
  /** Discrete emotions from the LLM (e.g. "frustrated", "optimistic"). */
  emotions?: string[];
  occurredAt: string;
}

/** Enriched event for the live activity feed (workers JOIN tasks + users) */
export interface ActivityFeedItem extends TaskEvent {
  taskTitle: string;
  taskStatus: TaskStatus;
  actorName: string;
  /** Task's current health, for divergence detection in the feed. */
  healthScore: number;
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

// ── Multi-dimensional mood: valence (sentiment) × energy (mood) + health ──

/** Energy / arousal axis (0..1) derived from the mood enum. */
export const MOOD_ENERGY: Record<Mood, number> = {
  high: 1,
  medium: 0.6,
  neutral: 0.4,
  low: 0.15,
};

/** Valence band thresholds (-1..1). */
export const VALENCE = {
  positive: 0.15,
  negative: -0.15,
} as const;

/** Midpoint that splits low vs high energy on the affect plane. */
export const ENERGY_MIDPOINT = 0.5;

/** Affect-circumplex quadrant from (valence, energy). */
export type Vibe = 'in_flow' | 'firefighting' | 'cruising' | 'stalled';

export const VIBE_LABELS: Record<Vibe, string> = {
  in_flow: 'In flow',
  firefighting: 'Firefighting',
  cruising: 'Cruising',
  stalled: 'Stalled',
};

/** Map a point on the affect plane to its named quadrant. */
export function classifyVibe(valence: number, energy: number): Vibe {
  const energetic = energy >= ENERGY_MIDPOINT;
  if (valence >= 0) return energetic ? 'in_flow' : 'cruising';
  return energetic ? 'firefighting' : 'stalled';
}

/**
 * Surface tension between what people *say* (valence), how energetic they
 * seem (mood), and what's objectively true (health). Returns a short label
 * for the most salient mismatch, or null when the signals agree.
 */
export function detectDivergence(input: {
  valence: number | null | undefined;
  mood: Mood;
  healthScore: number;
}): string | null {
  const { valence, mood, healthScore } = input;
  if (valence == null) return null;
  if (valence <= VALENCE.negative && MOOD_ENERGY[mood] >= 0.6) {
    return 'Strain behind high energy';
  }
  if (valence >= VALENCE.positive && healthScore < HEALTH_THRESHOLDS.amber) {
    return 'Upbeat, but health is critical';
  }
  if (valence <= VALENCE.negative && healthScore > HEALTH_THRESHOLDS.green) {
    return 'Negative tone while health still green';
  }
  return null;
}

/** Team affect over a rolling window — replaces the 1-D momentum meter. */
export interface Momentum2D {
  /** Average valence, -1..1. */
  valence: number;
  /** Average energy, 0..1. */
  energy: number;
  /** Quadrant of the centroid. */
  vibe: Vibe;
  /** Event count per quadrant over the window. */
  quadrants: Record<Vibe, number>;
  eventCount: number;
}

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

/** Task event row for Intel task detail drawer + Board activity timeline */
export interface IntelTaskEvent {
  id: string;
  eventType: EventType;
  actorName: string;
  oldValue?: string;
  newValue?: string;
  commentText?: string;
  mood: Mood;
  /** Valence axis, -1..1; null/undefined when not scored. */
  sentiment?: number | null;
  /** 'lexicon' = instant baseline; 'llm' = refined (lets the UI await refine). */
  sentimentSource?: SentimentSource;
  emotions?: string[];
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
