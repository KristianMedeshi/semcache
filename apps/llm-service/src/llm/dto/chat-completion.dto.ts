import {
  ALLOWED_LLM_MODEL_MESSAGE,
  ALLOWED_LLM_MODEL_REGEX,
  DIALOG_VALIDATION_LIMITS,
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
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const isDefined = (_: unknown, value: unknown): boolean => value !== undefined;

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

  @ValidateIf(isDefined)
  @IsString()
  @MaxLength(DIALOG_VALIDATION_LIMITS.MODEL_MAX_LENGTH)
  @Matches(ALLOWED_LLM_MODEL_REGEX, { message: ALLOWED_LLM_MODEL_MESSAGE })
  model?: string;

  @ValidateIf(isDefined)
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(1)
  @Max(4096)
  maxTokens?: number;
}
