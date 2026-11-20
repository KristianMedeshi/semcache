import {
  DIALOG_VALIDATION_LIMITS,
  FREE_OPENROUTER_MODEL_MESSAGE,
  FREE_OPENROUTER_MODEL_REGEX,
  type LlmChatCompletionRequestDto,
  type LlmChatMessageDto,
} from '@semcache/shared-dtos';
import { ChatMessageRole } from '@semcache/shared-types';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ChatMessageItemDto implements LlmChatMessageDto {
  @IsEnum(ChatMessageRole)
  role!: ChatMessageRole;

  @IsString()
  @MinLength(DIALOG_VALIDATION_LIMITS.MESSAGE_MIN_LENGTH)
  @MaxLength(DIALOG_VALIDATION_LIMITS.MESSAGE_MAX_LENGTH)
  content!: string;
}

export class ChatCompletionRequestDto implements LlmChatCompletionRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageItemDto)
  messages!: ChatMessageItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(DIALOG_VALIDATION_LIMITS.MODEL_MAX_LENGTH)
  @Matches(FREE_OPENROUTER_MODEL_REGEX, { message: FREE_OPENROUTER_MODEL_MESSAGE })
  model?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4096)
  maxTokens?: number;
}
