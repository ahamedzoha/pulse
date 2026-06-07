import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { ActivityFeedItem } from '@pulse/shared-types';

/**
 * In-process bridge between the realtime worker (producer) and the Intel SSE
 * stream (consumer). SSE only pushes new events; GET /intel/feed/recent
 * hydrates history from task_events on page load.
 */
@Injectable()
export class RealtimeService {
  readonly stream$ = new Subject<ActivityFeedItem>();

  broadcast(item: ActivityFeedItem): void {
    this.stream$.next(item);
  }
}
