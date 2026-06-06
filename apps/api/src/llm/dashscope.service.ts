import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { env } from '../config/env';

/**
 * Thin wrapper around the DashScope OpenAI-compatible endpoint.
 * Embeddings now; chat/streaming for RAG lands in Step 6.
 */
@Injectable()
export class DashScopeService {
  private readonly logger = new Logger(DashScopeService.name);
  private readonly client = new OpenAI({
    apiKey: env.dashscope.apiKey || 'missing',
    baseURL: env.dashscope.baseUrl,
  });

  /** Whether a usable API key is configured (placeholder/empty → disabled). */
  readonly enabled =
    !!env.dashscope.apiKey &&
    !env.dashscope.apiKey.includes('placeholder') &&
    env.dashscope.apiKey !== 'missing';

  /** Returns the embedding vector, or null when disabled / on failure. */
  async embed(text: string): Promise<number[] | null> {
    if (!this.enabled) {
      this.logger.warn('DashScope disabled (no API key) — skipping embedding');
      return null;
    }
    try {
      const res = await this.client.embeddings.create({
        model: env.dashscope.embedModel,
        input: text,
        dimensions: env.dashscope.embedDimensions,
        encoding_format: 'float',
      });
      return res.data[0]?.embedding ?? null;
    } catch (err) {
      this.logger.error(
        `Embedding failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /** Raw client for chat/streaming (used by the RAG module in Step 6). */
  get raw(): OpenAI {
    return this.client;
  }
}
