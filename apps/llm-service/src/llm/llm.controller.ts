import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { LlmChatCompletionResponseDto } from '@semcache/shared-dtos';
import { ChatCompletionRequestDto } from './dto/chat-completion.dto';
import { LlmService } from './llm.service';

@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() dto: ChatCompletionRequestDto): Promise<LlmChatCompletionResponseDto> {
    return this.llmService.generateChatCompletion(dto);
  }
}
