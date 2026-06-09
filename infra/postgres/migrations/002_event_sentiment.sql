-- Multi-dimensional mood (Phase 1): add valence (sentiment) + energy override
-- flag + LLM emotions to task_events. Energy stays in the existing `mood` column.
--
-- Run on existing Pulse DBs created before this feature:
-- docker compose -f infra/docker-compose.yml exec postgres \
--   psql -U pulse -d pulse -f /path/on/host/002_event_sentiment.sql
-- Or paste into psql.

ALTER TABLE task_events
  ADD COLUMN IF NOT EXISTS mood_manual   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sentiment     real,
  ADD COLUMN IF NOT EXISTS sentiment_src text,
  ADD COLUMN IF NOT EXISTS emotions      jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_events_sentiment_range'
  ) THEN
    ALTER TABLE task_events
      ADD CONSTRAINT task_events_sentiment_range
      CHECK (sentiment IS NULL OR (sentiment >= -1 AND sentiment <= 1));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_events_sentiment_src'
  ) THEN
    ALTER TABLE task_events
      ADD CONSTRAINT task_events_sentiment_src
      CHECK (sentiment_src IS NULL OR sentiment_src IN ('lexicon', 'llm'));
  END IF;
END $$;
