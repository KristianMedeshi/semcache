import { Global, Module } from '@nestjs/common';
import { LlmConfigService } from './llm-config.service';

@Global()
@Module({
  providers: [LlmConfigService],
  exports: [LlmConfigService],
})
export class LlmConfigModule {}
