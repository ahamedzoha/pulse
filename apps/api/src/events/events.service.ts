import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { EventType, Mood, TaskEvent } from '@pulse/shared-types';

interface TaskEventRow {
  id: string;
  task_id: string;
  actor_id: string;
  event_type: EventType;
  old_value: string | null;
  new_value: string | null;
  comment_text: string | null;
  mood: Mood;
  occurred_at: Date;
}

export interface EmitEventInput {
  taskId: string;
  actorId: string;
  eventType: EventType;
  oldValue?: string;
  newValue?: string;
  commentText?: string;
  mood: Mood;
}

@Injectable()
export class EventsService {
  /**
   * Append a task_events row using the provided transaction client.
   * Returns the canonical TaskEvent DTO (enqueue it AFTER the tx commits).
   */
  async emit(client: PoolClient, input: EmitEventInput): Promise<TaskEvent> {
    const { rows } = await client.query<TaskEventRow>(
      `INSERT INTO task_events
         (task_id, actor_id, event_type, old_value, new_value, comment_text, mood)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.taskId,
        input.actorId,
        input.eventType,
        input.oldValue ?? null,
        input.newValue ?? null,
        input.commentText ?? null,
        input.mood,
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
      occurredAt: row.occurred_at.toISOString(),
    };
  }
}
