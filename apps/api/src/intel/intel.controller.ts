import {
  Body,
  Controller,
  MessageEvent,
  Post,
  Res,
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
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

  /**
   * Live activity feed. Native EventSource can't send Authorization headers,
   * so this stream is unauthenticated for the POC (data is non-sensitive
   * activity). Token-via-query can be added with the Intel UI.
   */
  @Sse('feed')
  feed(): Observable<MessageEvent> {
    return this.realtime.stream$.pipe(map((item) => ({ data: item })));
  }

  /**
   * RAG Q&A. Embeds the question → pgvector top-K → streams a grounded Qwen
   * answer as SSE-formatted chunks over POST (consume via fetch + ReadableStream).
   * Available to any authenticated user (viewers included).
   */
  @Post('query')
  @UseGuards(JwtAuthGuard)
  async query(@Body() dto: QueryDto, @Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
      const { embedded, sources } = await this.intel.search(dto.question);
      if (!embedded) {
        send({ type: 'error', message: 'Embeddings unavailable (no DashScope key)' });
        res.end();
        return;
      }

      send({ type: 'sources', sources });
      for await (const token of this.intel.streamAnswer(dto.question, sources)) {
        send({ type: 'token', value: token });
      }
      send({ type: 'done' });
    } catch (err) {
      send({
        type: 'error',
        message: err instanceof Error ? err.message : 'Query failed',
      });
    } finally {
      res.end();
    }
  }
}
