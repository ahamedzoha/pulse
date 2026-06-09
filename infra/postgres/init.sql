-- Pulse — PostgreSQL 16 + pgvector schema
-- Loaded automatically on first container boot via docker-entrypoint-initdb.d

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (synced from Entra on first login via OIDC token claims)
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entra_oid     text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  email         text UNIQUE NOT NULL,
  role          text NOT NULL DEFAULT 'pulse-member'
                CHECK (role IN ('pulse-admin', 'pulse-member', 'pulse-viewer')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE tasks (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title             text NOT NULL,
  description       text,
  status            text NOT NULL DEFAULT 'todo'
                    CHECK (status IN ('todo', 'in_progress', 'review', 'done')),
  assignee_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by        uuid NOT NULL REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  health_score      integer NOT NULL DEFAULT 100
                    CHECK (health_score >= 0 AND health_score <= 100),
  last_activity_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_tasks_health_score ON tasks (health_score ASC);
CREATE INDEX idx_tasks_assignee ON tasks (assignee_id);
CREATE INDEX idx_tasks_last_activity ON tasks (last_activity_at DESC);

-- Task events (append-only activity log)
CREATE TABLE task_events (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id       uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  actor_id      uuid NOT NULL REFERENCES users(id),
  event_type    text NOT NULL
                CHECK (event_type IN ('created', 'status_changed', 'commented', 'reassigned')),
  old_value     text,
  new_value     text,
  comment_text  text,
  mood          text NOT NULL DEFAULT 'neutral'
                CHECK (mood IN ('high', 'medium', 'low', 'neutral')),
  -- Multi-dimensional mood: energy = mood (above), valence = sentiment.
  mood_manual   boolean NOT NULL DEFAULT false,  -- true = user override; LLM won't touch mood
  sentiment     real CHECK (sentiment IS NULL OR (sentiment >= -1 AND sentiment <= 1)),
  sentiment_src text CHECK (sentiment_src IS NULL OR sentiment_src IN ('lexicon', 'llm')),
  emotions      jsonb,                            -- LLM discrete emotions, e.g. ["frustrated"]
  occurred_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_events_task_id ON task_events (task_id, occurred_at DESC);
CREATE INDEX idx_task_events_occurred_at ON task_events (occurred_at DESC);
CREATE INDEX idx_task_events_mood ON task_events (mood, occurred_at DESC);

-- Event embeddings (pgvector RAG store)
CREATE TABLE event_embeddings (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_event_id   uuid NOT NULL UNIQUE REFERENCES task_events(id) ON DELETE CASCADE,
  task_id         uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  content_text    text NOT NULL,
  embedding       vector(1536),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_embeddings_task_id ON event_embeddings (task_id);
CREATE INDEX idx_event_embeddings_hnsw
  ON event_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Intel AI chat history (one continuous thread per user)
CREATE TABLE intel_chat_turns (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question      text NOT NULL,
  answer        text,
  sources       jsonb NOT NULL DEFAULT '[]',
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intel_chat_turns_user_created
  ON intel_chat_turns (user_id, created_at ASC);
