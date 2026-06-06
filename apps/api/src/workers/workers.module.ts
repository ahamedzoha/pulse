import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LlmModule } from '../llm/llm.module';
import { QueueModule } from '../queue/queue.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { EmbedService } from './embed.service';
import { HealthService } from './health.service';
import { TaskEventsProcessor } from './task-events.processor';

@Module({
  imports: [ScheduleModule.forRoot(), LlmModule, QueueModule, RealtimeModule],
  providers: [EmbedService, HealthService, TaskEventsProcessor],
  exports: [HealthService],
})
export class WorkersModule {}
