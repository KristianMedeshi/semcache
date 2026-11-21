import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { LlmChatCompletionResponseDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { ChatCompletionRequestDto } from './dto/chat-completion.dto';
import { LlmService } from './llm.service';

@Controller()
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @MessagePattern(SERVICE_TCP_PATTERNS.LLM_CHAT)
  async chat(@Payload() dto: ChatCompletionRequestDto): Promise<LlmChatCompletionResponseDto> {
    return this.llmService.generateChatCompletion(dto);
  }
}
