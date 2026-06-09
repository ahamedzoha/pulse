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
import { RealtimeService } from '../realtime/realtime.service';
import { SentimentService } from '../sentiment/sentiment.service';
import { EmbedService } from './embed.service';
import { HealthService } from './health.service';

interface EnrichRow {
  task_title: string;
  task_status: TaskStatus;
  actor_name: string;
  health_score: number;
}

/**
 * Single consumer of the `task-events` queue. BullMQ delivers each job to one
 * worker, so embed + health recompute + realtime broadcast share this
 * processor (separate @Processor classes on the same queue would compete).
 */
@Processor(QUEUES.TASK_EVENTS)
export class TaskEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(TaskEventsProcessor.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly embed: EmbedService,
    private readonly health: HealthService,
    private readonly realtime: RealtimeService,
    private readonly sentiment: SentimentService,
  ) {
    super();
  }

  async process(job: Job<TaskEvent>): Promise<void> {
    const event = job.data;

    // Recompute health first so the enrich read (and the broadcast item)
    // carry the post-activity score — needed for feed divergence detection.
    await this.health.recomputeForTask(event.taskId);

    const { rows } = await this.db.query<EnrichRow>(
      `SELECT t.title AS task_title, t.status AS task_status,
              t.health_score AS health_score,
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
      healthScore: rows[0].health_score,
    };

    // Refine the instant lexicon read with the LLM (valence + energy +
    // emotions). Energy only overwrites mood when the user didn't set it.
    await this.refineSentiment(event, item);

    await this.embed.embedEvent(item);
    this.realtime.broadcast(item);
  }

  private async refineSentiment(
    event: TaskEvent,
    item: ActivityFeedItem,
  ): Promise<void> {
    if (event.eventType !== 'commented' || !event.commentText) return;

    const analysis = await this.sentiment.analyze(event.commentText);
    if (!analysis) return;

    await this.db.query(
      `UPDATE task_events
          SET sentiment = $2,
              sentiment_src = 'llm',
              emotions = $3::jsonb,
              mood = CASE WHEN mood_manual THEN mood ELSE $4 END
        WHERE id = $1`,
      [event.id, analysis.valence, JSON.stringify(analysis.emotions), analysis.energy],
    );

    item.sentiment = analysis.valence;
    item.sentimentSource = 'llm';
    item.emotions = analysis.emotions;
    if (!event.moodManual) item.mood = analysis.energy;
  }
}
