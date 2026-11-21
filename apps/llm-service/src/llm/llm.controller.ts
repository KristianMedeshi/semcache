import { Controller } from '@nestjs/common';
import { Authenticate } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { LlmChatCompletionResponseDto, LlmChatStreamEventDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import type { Observable } from 'rxjs';
import { ChatCompletionRequestDto } from './dto/chat-completion.dto';
import { LlmService } from './llm.service';
import { LlmPolicy } from './policies/llm.policy';

@Authenticate({ optional: true })
@Controller()
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Can(LlmPolicy, 'generateCompletion')
  @MessagePattern(SERVICE_TCP_PATTERNS.LLM_CHAT)
  async chat(@Payload() dto: ChatCompletionRequestDto): Promise<LlmChatCompletionResponseDto> {
    return this.llmService.generateChatCompletion(dto);
  }

  @Can(LlmPolicy, 'streamCompletion')
  @MessagePattern(SERVICE_TCP_PATTERNS.LLM_CHAT_STREAM)
  streamChat(@Payload() dto: ChatCompletionRequestDto): Observable<LlmChatStreamEventDto> {
    return this.llmService.streamChatCompletion(dto);
  }
}
