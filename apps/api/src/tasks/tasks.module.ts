import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { QueueModule } from '../queue/queue.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [EventsModule, QueueModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
