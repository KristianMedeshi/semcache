import { Global, Module } from '@nestjs/common';
import { SharedConfigModule } from '@semcache/shared-config';
import { LlmConfigService } from './llm-config.service';
import { llmEnvSchema } from './llm.env';

@Global()
@Module({
  imports: [SharedConfigModule.forRoot(llmEnvSchema)],
  providers: [LlmConfigService],
  exports: [SharedConfigModule, LlmConfigService],
})
export class LlmConfigModule {}
