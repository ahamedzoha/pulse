import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '@pulse/shared-types';
import { env } from '../config/env';
import { QueueService } from './queue.service';

const redis = new URL(env.redisUrl);

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: redis.hostname,
        port: Number(redis.port) || 6379,
      },
    }),
    BullModule.registerQueue({ name: QUEUES.TASK_EVENTS }),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
