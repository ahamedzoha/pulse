import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, type TaskEvent } from '@pulse/shared-types';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QUEUES.TASK_EVENTS) private readonly queue: Queue,
  ) {}

  /** Enqueue a canonical task event for embed + health recompute + SSE broadcast. */
  async enqueueTaskEvent(event: TaskEvent): Promise<void> {
    await this.queue.add(event.eventType, event, {
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }
}
