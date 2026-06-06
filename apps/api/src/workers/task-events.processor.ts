import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import {
  QUEUES,
  type ActivityFeedItem,
  type EventType,
  type Mood,
  type TaskEvent,
  type TaskStatus,
} from '@pulse/shared-types';
import { DatabaseService } from '../database/database.service';
import { EmbedService } from './embed.service';
import { RealtimeService } from '../realtime/realtime.service';

interface EnrichRow {
  task_title: string;
  task_status: TaskStatus;
  actor_name: string;
}

/**
 * Single consumer of the `task-events` queue. BullMQ delivers each job to one
 * worker, so embed + realtime broadcast share this processor (separate
 * @Processor classes on the same queue would compete for jobs).
 */
@Processor(QUEUES.TASK_EVENTS)
export class TaskEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(TaskEventsProcessor.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly embed: EmbedService,
    private readonly realtime: RealtimeService,
  ) {
    super();
  }

  async process(job: Job<TaskEvent>): Promise<void> {
    const event = job.data;

    const { rows } = await this.db.query<EnrichRow>(
      `SELECT t.title AS task_title, t.status AS task_status,
              u.display_name AS actor_name
         FROM task_events te
         JOIN tasks t ON t.id = te.task_id
         JOIN users u ON u.id = te.actor_id
        WHERE te.id = $1`,
      [event.id],
    );

    if (!rows[0]) {
      this.logger.warn(`Event ${event.id} not found — skipping`);
      return;
    }

    const item: ActivityFeedItem = {
      ...event,
      eventType: event.eventType as EventType,
      mood: event.mood as Mood,
      taskTitle: rows[0].task_title,
      taskStatus: rows[0].task_status,
      actorName: rows[0].actor_name,
    };

    await this.embed.embedEvent(item);
    this.realtime.broadcast(item);
  }
}
