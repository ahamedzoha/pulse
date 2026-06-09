import OpenAI from 'openai';
import { Pool } from 'pg';
import { MOODS, type Mood } from '@pulse/shared-types';
import { env } from './config/env';
import { scoreValence, valenceFromTransition } from './sentiment/lexicon';
import { SENTIMENT_PROMPT } from './sentiment/sentiment.prompt';

/**
 * One-off backfill: scores existing task_events that predate the sentiment
 * feature (sentiment IS NULL). Lexicon by default (instant, free, deterministic);
 * pass --llm to also refine comments with energy + emotions via DashScope.
 *
 *   pnpm --filter @pulse/api build
 *   pnpm --filter @pulse/api backfill:sentiment          # lexicon only
 *   pnpm --filter @pulse/api backfill:sentiment -- --llm # + LLM refine
 */

const USE_LLM = process.argv.includes('--llm');
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

const dashscopeEnabled =
  !!env.dashscope.apiKey &&
  !env.dashscope.apiKey.includes('placeholder') &&
  env.dashscope.apiKey !== 'missing';

async function llmAnalyze(
  client: OpenAI,
  text: string,
): Promise<{ valence: number; energy: Mood; emotions: string[] } | null> {
  try {
    const res = await client.chat.completions.create({
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
  } catch {
    return null;
  }
}

interface Row {
  id: string;
  event_type: string;
  old_value: string | null;
  new_value: string | null;
  comment_text: string | null;
  mood: Mood;
  mood_manual: boolean;
}

async function main(): Promise<void> {
  const withLlm = USE_LLM && dashscopeEnabled;
  console.log(
    `Backfill mode: ${withLlm ? 'lexicon + LLM' : 'lexicon only'}` +
      (USE_LLM && !dashscopeEnabled ? ' (--llm requested but DashScope disabled)' : ''),
  );

  const pool = new Pool({ connectionString: env.databaseUrl });
  const client = withLlm
    ? new OpenAI({ apiKey: env.dashscope.apiKey, baseURL: env.dashscope.baseUrl })
    : null;

  const { rows } = await pool.query<Row>(
    `SELECT id, event_type, old_value, new_value, comment_text, mood, mood_manual
       FROM task_events
      WHERE sentiment IS NULL
      ORDER BY occurred_at ASC`,
  );
  console.log(`Found ${rows.length} unscored events`);

  let lexicon = 0;
  let llm = 0;
  let skipped = 0;

  for (const r of rows) {
    if (r.event_type === 'commented' && r.comment_text?.trim()) {
      let valence = scoreValence(r.comment_text);
      let src: 'lexicon' | 'llm' = 'lexicon';
      let emotions: string[] | null = null;
      let mood = r.mood;

      if (client) {
        const a = await llmAnalyze(client, r.comment_text);
        if (a) {
          valence = a.valence;
          src = 'llm';
          emotions = a.emotions;
          if (!r.mood_manual) mood = a.energy;
          llm++;
        } else {
          lexicon++;
        }
      } else {
        lexicon++;
      }

      await pool.query(
        `UPDATE task_events
            SET sentiment = $2, sentiment_src = $3, emotions = $4::jsonb, mood = $5
          WHERE id = $1`,
        [r.id, valence, src, emotions ? JSON.stringify(emotions) : null, mood],
      );
    } else if (r.event_type === 'status_changed') {
      const v = valenceFromTransition(r.old_value ?? undefined, r.new_value ?? undefined);
      if (v == null) {
        skipped++;
        continue;
      }
      await pool.query(
        `UPDATE task_events SET sentiment = $2, sentiment_src = 'lexicon' WHERE id = $1`,
        [r.id, v],
      );
      lexicon++;
    } else {
      // created / reassigned — no text and no transition to read.
      skipped++;
    }
  }

  console.log(`Backfill done — lexicon: ${lexicon}, llm: ${llm}, skipped: ${skipped}`);
  await pool.end();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
