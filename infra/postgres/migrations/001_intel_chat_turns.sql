-- Run on existing Pulse DBs created before intel chat persistence:
-- docker compose -f infra/docker-compose.yml exec postgres \
--   psql -U pulse -d pulse -f /path/on/host/001_intel_chat_turns.sql
-- Or paste into psql.

CREATE TABLE IF NOT EXISTS intel_chat_turns (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question      text NOT NULL,
  answer        text,
  sources       jsonb NOT NULL DEFAULT '[]',
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intel_chat_turns_user_created
  ON intel_chat_turns (user_id, created_at ASC);
