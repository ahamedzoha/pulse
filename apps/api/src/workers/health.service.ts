import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';

/** Shared decay formula — matches HEALTH_DECAY_RATES in @pulse/shared-types */
const HEALTH_SCORE_EXPR = `GREATEST(0, LEAST(100, ROUND(
  100 - (EXTRACT(EPOCH FROM (now() - last_activity_at)) / 3600.0)
        * CASE status
            WHEN 'todo'        THEN 2
            WHEN 'in_progress' THEN 1
            WHEN 'review'      THEN 0.5
            ELSE 0
          END
)))`;

/**
 * Recomputes task health from time-since-last-activity decay.
 * health = 100 - (hours_since_activity × decay_rate), floored at 0.
 * `done` tasks are frozen (excluded from recompute).
 *
 * Primary path: `recomputeForTask` after each task event (via processor).
 * Safety net: cron bulk recompute every 15 min for anything missed.
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly db: DatabaseService) {}

  @Cron('*/15 * * * *')
  async scheduledRecompute(): Promise<void> {
    const count = await this.recomputeAll();
    this.logger.log(`Health cron recompute updated ${count} tasks`);
  }

  /** Recompute health for one task (skips `done`). Called after task mutations. */
  async recomputeForTask(taskId: string): Promise<void> {
    await this.db.query(
      `UPDATE tasks
          SET health_score = ${HEALTH_SCORE_EXPR}
        WHERE id = $1 AND status <> 'done'`,
      [taskId],
    );
  }

  /** Bulk recompute for all non-done tasks — cron safety net. */
  async recomputeAll(): Promise<number> {
    const { rowCount } = await this.db.query(
      `UPDATE tasks
          SET health_score = ${HEALTH_SCORE_EXPR}
        WHERE status <> 'done'`,
    );
    return rowCount ?? 0;
  }
}
