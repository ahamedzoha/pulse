import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type {
  EventType,
  Mood,
  SentimentSource,
  TaskEvent,
} from '@pulse/shared-types';
import { scoreValence, valenceFromTransition } from '../sentiment/lexicon';

interface TaskEventRow {
  id: string;
  task_id: string;
  actor_id: string;
  event_type: EventType;
  old_value: string | null;
  new_value: string | null;
  comment_text: string | null;
  mood: Mood;
  mood_manual: boolean;
  sentiment: number | null;
  sentiment_src: SentimentSource | null;
  emotions: string[] | null;
  occurred_at: Date;
}

export interface EmitEventInput {
  taskId: string;
  actorId: string;
  eventType: EventType;
  oldValue?: string;
  newValue?: string;
  commentText?: string;
  /** Omit for auto-derived energy; present means the user picked it. */
  mood?: Mood;
}

/** Instant lexicon/heuristic valence at write time (LLM refines it later). */
function initialSentiment(input: EmitEventInput): {
  valence: number | null;
  source: SentimentSource | null;
} {
  if (input.eventType === 'commented' && input.commentText?.trim()) {
    return { valence: scoreValence(input.commentText), source: 'lexicon' };
  }
  if (input.eventType === 'status_changed') {
    const valence = valenceFromTransition(input.oldValue, input.newValue);
    return valence == null
      ? { valence: null, source: null }
      : { valence, source: 'lexicon' };
  }
  return { valence: null, source: null };
}

@Injectable()
export class EventsService {
  /**
   * Append a task_events row using the provided transaction client.
   * Returns the canonical TaskEvent DTO (enqueue it AFTER the tx commits).
   */
  async emit(client: PoolClient, input: EmitEventInput): Promise<TaskEvent> {
    const moodManual = input.mood !== undefined;
    const mood: Mood = input.mood ?? 'neutral';
    const { valence, source } = initialSentiment(input);

    const { rows } = await client.query<TaskEventRow>(
      `INSERT INTO task_events
         (task_id, actor_id, event_type, old_value, new_value, comment_text,
          mood, mood_manual, sentiment, sentiment_src)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        input.taskId,
        input.actorId,
        input.eventType,
        input.oldValue ?? null,
        input.newValue ?? null,
        input.commentText ?? null,
        mood,
        moodManual,
        valence,
        source,
      ],
    );
    return EventsService.toTaskEvent(rows[0]);
  }

  private static toTaskEvent(row: TaskEventRow): TaskEvent {
    return {
      id: row.id,
      taskId: row.task_id,
      actorId: row.actor_id,
      eventType: row.event_type,
      oldValue: row.old_value ?? undefined,
      newValue: row.new_value ?? undefined,
      commentText: row.comment_text ?? undefined,
      mood: row.mood,
      moodManual: row.mood_manual,
      sentiment: row.sentiment,
      sentimentSource: row.sentiment_src ?? undefined,
      emotions: row.emotions ?? undefined,
      occurredAt: row.occurred_at.toISOString(),
    };
  }
}
