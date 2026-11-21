import { Global, Module } from '@nestjs/common';
import { SharedConfigModule, llmEnvSchema } from '@semcache/shared-config';
import { LlmConfigService } from './llm-config.service';

@Global()
@Module({
  imports: [SharedConfigModule.forRoot(llmEnvSchema)],
  providers: [LlmConfigService],
  exports: [SharedConfigModule, LlmConfigService],
})
export class LlmConfigModule {}
