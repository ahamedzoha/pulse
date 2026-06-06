import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';

/**
 * Recomputes task health from time-since-last-activity decay.
 * health = 100 - (hours_since_activity × decay_rate), floored at 0.
 * `done` tasks are frozen (excluded from recompute).
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly db: DatabaseService) {}

  @Cron('*/15 * * * *')
  async scheduledRecompute(): Promise<void> {
    const count = await this.recompute();
    this.logger.log(`Health recompute updated ${count} tasks`);
  }

  /** Recompute health for all non-done tasks; returns rows affected. */
  async recompute(): Promise<number> {
    const { rowCount } = await this.db.query(
      `UPDATE tasks
         SET health_score = GREATEST(0, LEAST(100, ROUND(
           100 - (EXTRACT(EPOCH FROM (now() - last_activity_at)) / 3600.0)
                 * CASE status
                     WHEN 'todo'        THEN 2
                     WHEN 'in_progress' THEN 1
                     WHEN 'review'      THEN 0.5
                     ELSE 0
                   END
         )))
       WHERE status <> 'done'`,
    );
    return rowCount ?? 0;
  }
}
