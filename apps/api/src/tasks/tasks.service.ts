import { Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type {
  EventType,
  IntelTaskEvent,
  Mood,
  TaskStatus,
} from '@pulse/shared-types';
import { DatabaseService } from '../database/database.service';
import { EventsService } from '../events/events.service';
import { QueueService } from '../queue/queue.service';
import type { CreateTaskDto } from './dto/create-task.dto';
import type { UpdateStatusDto } from './dto/update-status.dto';
import type { CreateCommentDto } from './dto/create-comment.dto';
import type { ReassignDto } from './dto/reassign.dto';

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  health_score: number;
  last_activity_at: Date;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly events: EventsService,
    private readonly queue: QueueService,
  ) {}

  list(): Promise<TaskRow[]> {
    return this.db
      .query<TaskRow>('SELECT * FROM tasks ORDER BY created_at DESC')
      .then((r) => r.rows);
  }

  async getById(id: string): Promise<TaskRow> {
    const { rows } = await this.db.query<TaskRow>(
      'SELECT * FROM tasks WHERE id = $1',
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Task not found');
    return rows[0];
  }

  /** Activity history for a task (newest first) — powers the Board timeline. */
  async listEvents(taskId: string): Promise<IntelTaskEvent[]> {
    const exists = await this.db.query('SELECT 1 FROM tasks WHERE id = $1', [
      taskId,
    ]);
    if (!exists.rows[0]) throw new NotFoundException('Task not found');

    const { rows } = await this.db.query<{
      id: string;
      event_type: EventType;
      old_value: string | null;
      new_value: string | null;
      comment_text: string | null;
      mood: Mood;
      occurred_at: Date;
      actor_name: string;
    }>(
      `SELECT te.id, te.event_type, te.old_value, te.new_value, te.comment_text,
              te.mood, te.occurred_at, u.display_name AS actor_name
         FROM task_events te
         JOIN users u ON u.id = te.actor_id
        WHERE te.task_id = $1
        ORDER BY te.occurred_at DESC
        LIMIT 100`,
      [taskId],
    );

    return rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      actorName: r.actor_name,
      oldValue: r.old_value ?? undefined,
      newValue: r.new_value ?? undefined,
      commentText: r.comment_text ?? undefined,
      mood: r.mood,
      occurredAt: r.occurred_at.toISOString(),
    }));
  }

  async create(actorId: string, dto: CreateTaskDto): Promise<TaskRow> {
    const { task, event } = await this.db.withTransaction(async (c) => {
      const task = await this.insertTask(c, actorId, dto);
      const event = await this.events.emit(c, {
        taskId: task.id,
        actorId,
        eventType: 'created',
        newValue: task.title,
        mood: dto.mood,
      });
      return { task, event };
    });
    await this.queue.enqueueTaskEvent(event);
    return task;
  }

  async updateStatus(
    actorId: string,
    taskId: string,
    dto: UpdateStatusDto,
  ): Promise<TaskRow> {
    const { task, event } = await this.db.withTransaction(async (c) => {
      const existing = await this.lockTask(c, taskId);
      const { rows } = await c.query<TaskRow>(
        `UPDATE tasks SET status = $1, updated_at = now(), last_activity_at = now()
         WHERE id = $2 RETURNING *`,
        [dto.status, taskId],
      );
      const event = await this.events.emit(c, {
        taskId,
        actorId,
        eventType: 'status_changed',
        oldValue: existing.status,
        newValue: dto.status,
        mood: dto.mood,
      });
      return { task: rows[0], event };
    });
    await this.queue.enqueueTaskEvent(event);
    return task;
  }

  async comment(
    actorId: string,
    taskId: string,
    dto: CreateCommentDto,
  ): Promise<TaskRow> {
    const { task, event } = await this.db.withTransaction(async (c) => {
      await this.lockTask(c, taskId);
      const { rows } = await c.query<TaskRow>(
        `UPDATE tasks SET updated_at = now(), last_activity_at = now()
         WHERE id = $1 RETURNING *`,
        [taskId],
      );
      const event = await this.events.emit(c, {
        taskId,
        actorId,
        eventType: 'commented',
        commentText: dto.commentText,
        mood: dto.mood,
      });
      return { task: rows[0], event };
    });
    await this.queue.enqueueTaskEvent(event);
    return task;
  }

  async reassign(
    actorId: string,
    taskId: string,
    dto: ReassignDto,
  ): Promise<TaskRow> {
    const { task, event } = await this.db.withTransaction(async (c) => {
      const existing = await this.lockTask(c, taskId);
      const { rows } = await c.query<TaskRow>(
        `UPDATE tasks SET assignee_id = $1, updated_at = now(), last_activity_at = now()
         WHERE id = $2 RETURNING *`,
        [dto.assigneeId, taskId],
      );
      const event = await this.events.emit(c, {
        taskId,
        actorId,
        eventType: 'reassigned',
        oldValue: existing.assignee_id ?? undefined,
        newValue: dto.assigneeId,
        mood: dto.mood,
      });
      return { task: rows[0], event };
    });
    await this.queue.enqueueTaskEvent(event);
    return task;
  }

  private async insertTask(
    c: PoolClient,
    actorId: string,
    dto: CreateTaskDto,
  ): Promise<TaskRow> {
    const { rows } = await c.query<TaskRow>(
      `INSERT INTO tasks (title, description, assignee_id, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [dto.title, dto.description ?? null, dto.assigneeId ?? null, actorId],
    );
    return rows[0];
  }

  private async lockTask(c: PoolClient, taskId: string): Promise<TaskRow> {
    const { rows } = await c.query<TaskRow>(
      'SELECT * FROM tasks WHERE id = $1 FOR UPDATE',
      [taskId],
    );
    if (!rows[0]) throw new NotFoundException('Task not found');
    return rows[0];
  }
}
