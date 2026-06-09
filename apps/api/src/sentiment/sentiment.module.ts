import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { SentimentService } from './sentiment.service';

@Module({
  imports: [LlmModule],
  providers: [SentimentService],
  exports: [SentimentService],
})
export class SentimentModule {}
