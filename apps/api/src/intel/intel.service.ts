import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  INTEL_CHAT_LLM_HISTORY_LIMIT,
  MOOD_WEIGHTS,
  type ActivityFeedItem,
  type EventType,
  type IntelChatSource,
  type IntelChatTurn,
  type IntelTaskDetail,
  type IntelTaskEvent,
  type Mood,
  type TaskStatus,
} from '@pulse/shared-types';
import { env } from '../config/env';
import { DatabaseService } from '../database/database.service';
import { DashScopeService } from '../llm/dashscope.service';

export interface LeaderboardEntry {
  id: string;
  title: string;
  status: string;
  healthScore: number;
  assigneeName: string | null;
  lastActivityAt: string;
}

export interface MomentumSnapshot {
  /** Weighted mood average over the last 24h (1–4 scale). */
  average: number;
  /** Same value scaled to 0–100 for the meter UI. */
  percentage: number;
  eventCount: number;
}

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

  /** Recent activity for Intel feed hydration (newest first). */
  async recentFeed(limit = 50): Promise<ActivityFeedItem[]> {
    const { rows } = await this.db.query<{
      id: string;
      task_id: string;
      actor_id: string;
      event_type: EventType;
      old_value: string | null;
      new_value: string | null;
      comment_text: string | null;
      mood: Mood;
      occurred_at: Date;
      task_title: string;
      task_status: TaskStatus;
      actor_name: string;
    }>(
      `SELECT te.id, te.task_id, te.actor_id, te.event_type,
              te.old_value, te.new_value, te.comment_text, te.mood, te.occurred_at,
              t.title AS task_title, t.status AS task_status,
              u.display_name AS actor_name
         FROM task_events te
         JOIN tasks t ON t.id = te.task_id
         JOIN users u ON u.id = te.actor_id
        ORDER BY te.occurred_at DESC
        LIMIT $1`,
      [limit],
    );

    return rows.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      actorId: r.actor_id,
      eventType: r.event_type,
      oldValue: r.old_value ?? undefined,
      newValue: r.new_value ?? undefined,
      commentText: r.comment_text ?? undefined,
      mood: r.mood,
      occurredAt: r.occurred_at.toISOString(),
      taskTitle: r.task_title,
      taskStatus: r.task_status,
      actorName: r.actor_name,
    }));
  }

  /** Read-only task detail for Intel expandable cards (all authenticated roles). */
  async taskDetail(taskId: string): Promise<IntelTaskDetail> {
    const { rows: taskRows } = await this.db.query<{
      id: string;
      title: string;
      description: string | null;
      status: TaskStatus;
      health_score: number;
      created_at: Date;
      updated_at: Date;
      last_activity_at: Date;
      assignee_name: string | null;
      creator_name: string;
    }>(
      `SELECT t.id, t.title, t.description, t.status, t.health_score,
              t.created_at, t.updated_at, t.last_activity_at,
              assignee.display_name AS assignee_name,
              creator.display_name AS creator_name
         FROM tasks t
         JOIN users creator ON creator.id = t.created_by
         LEFT JOIN users assignee ON assignee.id = t.assignee_id
        WHERE t.id = $1`,
      [taskId],
    );

    const task = taskRows[0];
    if (!task) throw new NotFoundException('Task not found');

    const { rows: eventRows } = await this.db.query<{
      id: string;
      event_type: EventType;
      old_value: string | null;
      new_value: string | null;
      comment_text: string | null;
      mood: Mood;
      occurred_at: Date;
      actor_name: string;
    }>(
      `SELECT te.id, te.event_type, te.old_value, te.new_value, te.comment_text,
              te.mood, te.occurred_at, u.display_name AS actor_name
         FROM task_events te
         JOIN users u ON u.id = te.actor_id
        WHERE te.task_id = $1
        ORDER BY te.occurred_at DESC
        LIMIT 50`,
      [taskId],
    );

    const events: IntelTaskEvent[] = eventRows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      actorName: r.actor_name,
      oldValue: r.old_value ?? undefined,
      newValue: r.new_value ?? undefined,
      commentText: r.comment_text ?? undefined,
      mood: r.mood,
      occurredAt: r.occurred_at.toISOString(),
    }));

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      healthScore: task.health_score,
      assigneeName: task.assignee_name,
      creatorName: task.creator_name,
      createdAt: task.created_at.toISOString(),
      updatedAt: task.updated_at.toISOString(),
      lastActivityAt: task.last_activity_at.toISOString(),
      events,
    };
  }

  /** Tasks sorted by health_score ASC (lowest / most at-risk first). */
  async leaderboard(limit = 20): Promise<LeaderboardEntry[]> {
    const { rows } = await this.db.query<{
      id: string;
      title: string;
      status: string;
      health_score: number;
      assignee_name: string | null;
      last_activity_at: Date;
    }>(
      `SELECT t.id, t.title, t.status, t.health_score, t.last_activity_at,
              u.display_name AS assignee_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
        ORDER BY t.health_score ASC, t.last_activity_at ASC
        LIMIT $1`,
      [limit],
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      healthScore: r.health_score,
      assigneeName: r.assignee_name,
      lastActivityAt: r.last_activity_at.toISOString(),
    }));
  }

  /** Rolling 24h average of MOOD_WEIGHTS across task_events. */
  async momentum(): Promise<MomentumSnapshot> {
    const { rows } = await this.db.query<{ mood: Mood }>(
      `SELECT mood FROM task_events
        WHERE occurred_at >= now() - interval '24 hours'`,
    );
    if (!rows.length) {
      return { average: 2, percentage: 50, eventCount: 0 };
    }
    const sum = rows.reduce((acc, r) => acc + MOOD_WEIGHTS[r.mood], 0);
    const average = sum / rows.length;
    const max = Math.max(...Object.values(MOOD_WEIGHTS));
    return {
      average: Math.round(average * 100) / 100,
      percentage: Math.round((average / max) * 100),
      eventCount: rows.length,
    };
  }

  /** Load persisted chat turns for the Intel UI (oldest first). */
  async listChatTurns(userId: string, limit = 100): Promise<IntelChatTurn[]> {
    const { rows } = await this.db.query<{
      id: string;
      question: string;
      answer: string | null;
      sources: IntelChatSource[];
      error: string | null;
      created_at: Date;
    }>(
      `SELECT id, question, answer, sources, error, created_at
         FROM intel_chat_turns
        WHERE user_id = $1
        ORDER BY created_at ASC
        LIMIT $2`,
      [userId, limit],
    );

    return rows.map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer ?? '',
      sources: Array.isArray(r.sources) ? r.sources : [],
      error: r.error ?? undefined,
      createdAt: r.created_at.toISOString(),
    }));
  }

  /** Prior completed turns for LLM multi-turn context (excludes current question). */
  async chatHistoryForLlm(
    userId: string,
    limit = INTEL_CHAT_LLM_HISTORY_LIMIT,
  ): Promise<Array<{ question: string; answer: string }>> {
    const { rows } = await this.db.query<{ question: string; answer: string }>(
      `SELECT question, answer
         FROM intel_chat_turns
        WHERE user_id = $1
          AND error IS NULL
          AND answer IS NOT NULL
          AND btrim(answer) <> ''
        ORDER BY created_at DESC
        LIMIT $2`,
      [userId, limit],
    );
    return rows.reverse();
  }

  async createChatTurn(userId: string, question: string): Promise<string> {
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO intel_chat_turns (user_id, question)
       VALUES ($1, $2)
       RETURNING id`,
      [userId, question],
    );
    return rows[0].id;
  }

  async finalizeChatTurn(
    turnId: string,
    userId: string,
    answer: string,
    sources: SourceChunk[],
    error?: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE intel_chat_turns
          SET answer = $3, sources = $4::jsonb, error = $5
        WHERE id = $1 AND user_id = $2`,
      [turnId, userId, answer, JSON.stringify(sources), error ?? null],
    );
  }

  async clearChat(userId: string): Promise<void> {
    await this.db.query(`DELETE FROM intel_chat_turns WHERE user_id = $1`, [
      userId,
    ]);
  }

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

  /** Stream a grounded answer from Qwen using RAG context + prior chat turns. */
  async *streamAnswer(
    question: string,
    sources: SourceChunk[],
    history: Array<{ question: string; answer: string }>,
  ): AsyncGenerator<string> {
    const context = sources.length
      ? sources
          .map((s, i) => `[${i + 1}] (${s.status}) ${s.contentText}`)
          .join('\n')
      : '(no relevant activity found)';

    type Msg = { role: 'system' | 'user' | 'assistant'; content: string };
    const messages: Msg[] = [
      {
        role: 'system',
        content:
          'You are Pulse Intel, an assistant that answers questions about a team task ' +
          'board. Use the retrieved activity context for factual answers about tasks and ' +
          'events. Use prior conversation turns for follow-up questions and continuity. ' +
          "If the context doesn't contain the answer, say you don't have enough information. " +
          'Be concise.',
      },
    ];

    for (const turn of history) {
      messages.push({ role: 'user', content: turn.question });
      messages.push({ role: 'assistant', content: turn.answer });
    }

    messages.push({
      role: 'user',
      content:
        `Retrieved activity context for this question:\n${context}\n\n` +
        `Question: ${question}`,
    });

    const stream = await this.dashscope.raw.chat.completions.create({
      model: env.dashscope.llmModel,
      stream: true,
      messages,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
