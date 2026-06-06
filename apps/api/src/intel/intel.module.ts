import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { IntelController } from './intel.controller';
import { IntelService } from './intel.service';

@Module({
  imports: [RealtimeModule, LlmModule],
  controllers: [IntelController],
  providers: [IntelService],
})
export class IntelModule {}
