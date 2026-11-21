import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { LlmChatCompletionResponseDto, LlmChatStreamEventDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Observable } from 'rxjs';
import { ChatCompletionRequestDto } from './dto/chat-completion.dto';
import { LlmService } from './llm.service';

@Controller()
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @MessagePattern(SERVICE_TCP_PATTERNS.LLM_CHAT)
  async chat(@Payload() dto: ChatCompletionRequestDto): Promise<LlmChatCompletionResponseDto> {
    return this.llmService.generateChatCompletion(dto);
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.LLM_CHAT_STREAM)
  streamChat(@Payload() dto: ChatCompletionRequestDto): Observable<LlmChatStreamEventDto> {
    return this.llmService.streamChatCompletion(dto);
  }
}
