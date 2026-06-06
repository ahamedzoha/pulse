import { Module } from '@nestjs/common';
import { DashScopeService } from './dashscope.service';

@Module({
  providers: [DashScopeService],
  exports: [DashScopeService],
})
export class LlmModule {}
