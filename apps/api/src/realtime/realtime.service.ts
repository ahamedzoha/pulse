import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { ActivityFeedItem } from '@pulse/shared-types';

/**
 * In-process bridge between the realtime worker (producer) and the Intel SSE
 * stream (consumer). POC scope — no persistence or replay.
 */
@Injectable()
export class RealtimeService {
  readonly stream$ = new Subject<ActivityFeedItem>();

  broadcast(item: ActivityFeedItem): void {
    this.stream$.next(item);
  }
}
