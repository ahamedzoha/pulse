import {
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RealtimeService } from '../realtime/realtime.service';
import { IntelService } from './intel.service';
import { QueryDto } from './dto/query.dto';

@Controller('intel')
export class IntelController {
  constructor(
    private readonly realtime: RealtimeService,
    private readonly intel: IntelService,
  ) {}

  /** Recent feed items for page load (SSE only streams events after connect). */
  @Get('feed/recent')
  @UseGuards(JwtAuthGuard)
  recentFeed(@Query('limit') limit?: string) {
    const n = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100) : 50;
    return this.intel.recentFeed(n);
  }

  /** Persisted Intel AI chat history for the signed-in user. */
  @Get('chat')
  @UseGuards(JwtAuthGuard)
  chatHistory(@CurrentUser() user: AuthUser) {
    return this.intel.listChatTurns(user.userId);
  }

  /** Delete all chat turns for the signed-in user. */
  @Delete('chat')
  @UseGuards(JwtAuthGuard)
  async clearChat(@CurrentUser() user: AuthUser) {
    await this.intel.clearChat(user.userId);
    return { ok: true };
  }

  /**
   * Live activity feed. Native EventSource can't send Authorization headers,
   * so the session JWT is passed as `?token=` and validated by the same
   * JwtAuthGuard as every other endpoint (see JwtStrategy extractors).
   */
  @Sse('feed')
  @UseGuards(JwtAuthGuard)
  feed(): Observable<MessageEvent> {
    return this.realtime.stream$.pipe(map((item) => ({ data: item })));
  }

  /** Health leaderboard — lowest scores first. All authenticated roles. */
  @Get('leaderboard')
  @UseGuards(JwtAuthGuard)
  leaderboard() {
    return this.intel.leaderboard();
  }

  /** Read-only task detail for expandable Intel cards. All authenticated roles. */
  @Get('tasks/:id')
  @UseGuards(JwtAuthGuard)
  taskDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.intel.taskDetail(id);
  }

  /** Team momentum meter — 24h rolling mood average. All authenticated roles. */
  @Get('momentum')
  @UseGuards(JwtAuthGuard)
  momentum() {
    return this.intel.momentum();
  }

  /** Team affect on the valence × energy plane (24h). All authenticated roles. */
  @Get('momentum2d')
  @UseGuards(JwtAuthGuard)
  momentum2d() {
    return this.intel.momentum2d();
  }

  /**
   * RAG Q&A with multi-turn context. Embeds the question → pgvector top-K →
   * streams a grounded Qwen answer. Persists each turn per user; prior turns
   * are included in the LLM messages array.
   */
  @Post('query')
  @UseGuards(JwtAuthGuard)
  async query(
    @CurrentUser() user: AuthUser,
    @Body() dto: QueryDto,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    const turnId = await this.intel.createChatTurn(user.userId, dto.question);
    send({ type: 'turn', id: turnId });

    let answer = '';
    let sources: Awaited<ReturnType<IntelService['search']>>['sources'] = [];

    try {
      const history = await this.intel.chatHistoryForLlm(user.userId);
      const searchResult = await this.intel.search(dto.question);
      if (!searchResult.embedded) {
        const message = 'Embeddings unavailable (no DashScope key)';
        await this.intel.finalizeChatTurn(turnId, user.userId, '', [], message);
        send({ type: 'error', message });
        send({ type: 'done', turnId });
        res.end();
        return;
      }

      sources = searchResult.sources;
      send({ type: 'sources', sources });

      for await (const token of this.intel.streamAnswer(
        dto.question,
        sources,
        history,
      )) {
        answer += token;
        send({ type: 'token', value: token });
      }

      await this.intel.finalizeChatTurn(turnId, user.userId, answer, sources);
      send({ type: 'done', turnId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Query failed';
      await this.intel.finalizeChatTurn(
        turnId,
        user.userId,
        answer,
        sources,
        message,
      );
      send({ type: 'error', message });
      send({ type: 'done', turnId });
    } finally {
      res.end();
    }
  }
}
