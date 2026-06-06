import { Injectable, Logger } from '@nestjs/common';
import type { ActivityFeedItem } from '@pulse/shared-types';
import { DatabaseService } from '../database/database.service';
import { DashScopeService } from '../llm/dashscope.service';
import { buildContentText } from './content-text';

@Injectable()
export class EmbedService {
  private readonly logger = new Logger(EmbedService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly dashscope: DashScopeService,
  ) {}

  /** Embed the event's content_text and store it in event_embeddings. */
  async embedEvent(item: ActivityFeedItem): Promise<void> {
    const contentText = buildContentText(item);
    const embedding = await this.dashscope.embed(contentText);

    // pgvector accepts a '[a,b,c]' string literal. Store NULL if unavailable
    // (no API key) so content_text is still retrievable once re-embedded.
    const vectorLiteral = embedding ? `[${embedding.join(',')}]` : null;

    await this.db.query(
      `INSERT INTO event_embeddings (task_event_id, task_id, content_text, embedding)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (task_event_id) DO UPDATE
         SET content_text = EXCLUDED.content_text,
             embedding = EXCLUDED.embedding`,
      [item.id, item.taskId, contentText, vectorLiteral],
    );

    this.logger.debug(
      `Embedded event ${item.id} (${embedding ? 'vector' : 'text-only'})`,
    );
  }
}
