import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { DashScopeService } from '../llm/dashscope.service';

export interface SourceChunk {
  taskId: string;
  title: string;
  status: string;
  contentText: string;
  score: number;
}

interface SearchRow {
  task_id: string;
  title: string;
  status: string;
  content_text: string;
  score: number;
}

@Injectable()
export class IntelService {
  private readonly logger = new Logger(IntelService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly dashscope: DashScopeService,
  ) {}

  /** Embed the question and pgvector cosine-search the top matching events. */
  async search(
    question: string,
    limit = 10,
  ): Promise<{ embedded: boolean; sources: SourceChunk[] }> {
    const vector = await this.dashscope.embed(question);
    if (!vector) return { embedded: false, sources: [] };

    const literal = `[${vector.join(',')}]`;
    const { rows } = await this.db.query<SearchRow>(
      `SELECT ee.task_id, t.title, t.status, ee.content_text,
              1 - (ee.embedding <=> $1::vector) AS score
         FROM event_embeddings ee
         JOIN tasks t ON t.id = ee.task_id
        WHERE ee.embedding IS NOT NULL
        ORDER BY ee.embedding <=> $1::vector
        LIMIT $2`,
      [literal, limit],
    );

    return {
      embedded: true,
      sources: rows.map((r) => ({
        taskId: r.task_id,
        title: r.title,
        status: r.status,
        contentText: r.content_text,
        score: Number(r.score),
      })),
    };
  }

  /** Stream a grounded answer from Qwen using the retrieved context. */
  async *streamAnswer(
    question: string,
    sources: SourceChunk[],
  ): AsyncGenerator<string> {
    const context = sources.length
      ? sources
          .map((s, i) => `[${i + 1}] (${s.status}) ${s.contentText}`)
          .join('\n')
      : '(no relevant activity found)';

    const stream = await this.dashscope.raw.chat.completions.create({
      model: env.dashscope.llmModel,
      stream: true,
      messages: [
        {
          role: 'system',
          content:
            'You are Pulse Intel, an assistant that answers questions about a team task ' +
            'board using the provided activity context. Use ONLY the context below. If it ' +
            "doesn't contain the answer, say you don't have enough information. Be concise.",
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${question}`,
        },
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
