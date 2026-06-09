import { Injectable, Logger } from '@nestjs/common';
import { MOODS, type Mood } from '@pulse/shared-types';
import { env } from '../config/env';
import { DashScopeService } from '../llm/dashscope.service';
import { SENTIMENT_PROMPT } from './sentiment.prompt';

export interface SentimentAnalysis {
  /** Valence -1..1. */
  valence: number;
  /** Energy/arousal mapped onto the mood enum. */
  energy: Mood;
  emotions: string[];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * LLM half of the hybrid: refines the lexicon's valence and infers energy +
 * discrete emotions from a comment. Runs in the worker (off the request path).
 * Returns null when DashScope is disabled or the call/parse fails — callers
 * keep the instant lexicon baseline in that case.
 */
@Injectable()
export class SentimentService {
  private readonly logger = new Logger(SentimentService.name);

  constructor(private readonly dashscope: DashScopeService) {}

  async analyze(text: string): Promise<SentimentAnalysis | null> {
    if (!this.dashscope.enabled || !text.trim()) return null;

    try {
      const res = await this.dashscope.raw.chat.completions.create({
        model: env.dashscope.llmModel,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SENTIMENT_PROMPT },
          { role: 'user', content: text },
        ],
      });

      const raw = res.choices[0]?.message?.content;
      if (!raw) return null;

      const parsed = JSON.parse(raw) as {
        valence?: unknown;
        energy?: unknown;
        emotions?: unknown;
      };

      const valence = Number(parsed.valence);
      if (Number.isNaN(valence)) return null;

      const energy: Mood = MOODS.includes(parsed.energy as Mood)
        ? (parsed.energy as Mood)
        : 'neutral';

      const emotions = Array.isArray(parsed.emotions)
        ? parsed.emotions.slice(0, 3).map((e) => String(e).toLowerCase())
        : [];

      return { valence: clamp(valence, -1, 1), energy, emotions };
    } catch (err) {
      this.logger.warn(
        `Sentiment analysis failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
