import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ALLOWED_LLM_MODEL_MESSAGE,
  DIALOG_VALIDATION_LIMITS,
  type DeleteAllDialogsResponseDto,
  type DeleteDialogResponseDto,
  type DialogMessageResponseDto,
  type DialogRecentActivityDto,
  type DialogResponseDto,
  type DialogStatsResponseDto,
  type LlmTokenUsageDto,
  type SemanticCacheTurnMetadataDto,
  type SendMessageResponseDto,
} from '@semcache/shared-dtos';
import {
  CreateDialogDto,
  EditMessageDto,
  SendMessageDto,
  UpdateDialogDto,
} from '@semcache/shared-dtos/validation';
import { CacheHitStatus, CacheMode, ChatMessageRole, QueryCategory } from '@semcache/shared-types';

export class GatewayCreateDialogDto extends CreateDialogDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: DIALOG_VALIDATION_LIMITS.TITLE_MAX_LENGTH,
    example: 'EU Roaming Allowance Inquiry',
  })
  declare title?: string;
}

export class GatewayUpdateDialogDto extends UpdateDialogDto {
  @ApiProperty({
    minLength: 1,
    maxLength: DIALOG_VALIDATION_LIMITS.TITLE_MAX_LENGTH,
    example: 'Updated Roaming Inquiry',
  })
  declare title: string;
}

export class GatewayEditMessageDto extends EditMessageDto {
  @ApiProperty({
    minLength: DIALOG_VALIDATION_LIMITS.MESSAGE_MIN_LENGTH,
    maxLength: DIALOG_VALIDATION_LIMITS.MESSAGE_MAX_LENGTH,
    example: 'What is my EU roaming data allowance on the Plus plan?',
  })
  declare content: string;

  @ApiPropertyOptional({
    maxLength: DIALOG_VALIDATION_LIMITS.MODEL_MAX_LENGTH,
    description: ALLOWED_LLM_MODEL_MESSAGE,
    example: 'openrouter/free',
  })
  declare model?: string;
}

export class GatewaySendMessageDto extends SendMessageDto {
  @ApiProperty({
    minLength: DIALOG_VALIDATION_LIMITS.MESSAGE_MIN_LENGTH,
    maxLength: DIALOG_VALIDATION_LIMITS.MESSAGE_MAX_LENGTH,
    example: 'How do I activate eSIM roaming before travelling to France?',
  })
  declare content: string;

  @ApiPropertyOptional({
    maxLength: DIALOG_VALIDATION_LIMITS.MODEL_MAX_LENGTH,
    description: ALLOWED_LLM_MODEL_MESSAGE,
    example: 'openrouter/free',
  })
  declare model?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Optional parent message UUID to branch from, or null for a new root turn',
    example: null,
  })
  declare parentMessageId?: string | null;

  @ApiPropertyOptional({ enum: QueryCategory, example: QueryCategory.PRODUCT_INQUIRY })
  declare category?: QueryCategory;

  @ApiPropertyOptional({ enum: CacheMode, example: CacheMode.ADAPTIVE })
  declare cacheMode?: CacheMode;

  @ApiPropertyOptional({ minimum: 0, maximum: 1, example: 0.9 })
  declare fixedThresholdOverride?: number;
}

export class LlmTokenUsageSwaggerDto implements LlmTokenUsageDto {
  @ApiProperty({ example: 145 })
  promptTokens!: number;

  @ApiProperty({ example: 64 })
  completionTokens!: number;

  @ApiProperty({ example: 209 })
  totalTokens!: number;
}

export class DialogResponseSwaggerDto implements DialogResponseDto {
  @ApiProperty({ format: 'uuid', example: '22222222-2222-4222-8222-222222222222' })
  id!: string;

  @ApiProperty({ format: 'uuid', example: '11111111-1111-4111-8111-111111111111' })
  userId!: string;

  @ApiProperty({ example: 'EU Roaming Allowance Inquiry' })
  title!: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:01:00.000Z' })
  updatedAt!: string;
}

export class DialogMessageResponseSwaggerDto implements DialogMessageResponseDto {
  @ApiProperty({ format: 'uuid', example: '33333333-3333-4333-8333-333333333333' })
  id!: string;

  @ApiProperty({ format: 'uuid', example: '22222222-2222-4222-8222-222222222222' })
  dialogId!: string;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, example: null })
  parentMessageId?: string | null;

  @ApiProperty({ enum: ChatMessageRole, example: ChatMessageRole.ASSISTANT })
  role!: ChatMessageRole;

  @ApiProperty({ example: 'You have 25 GB of EU roaming data included.' })
  content!: string;

  @ApiProperty({ type: String, nullable: true, example: 'openrouter/free' })
  model!: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 120 })
  latencyMs!: number | null;

  @ApiProperty({ type: LlmTokenUsageSwaggerDto, nullable: true })
  usage!: LlmTokenUsageSwaggerDto | null;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:01.000Z' })
  createdAt!: string;
}

export class SemanticCacheTurnMetadataSwaggerDto implements SemanticCacheTurnMetadataDto {
  @ApiProperty({ enum: CacheHitStatus, example: CacheHitStatus.HIT })
  status!: CacheHitStatus;

  @ApiProperty({ enum: CacheMode, example: CacheMode.ADAPTIVE })
  mode!: CacheMode;

  @ApiPropertyOptional({ format: 'uuid', example: '44444444-4444-4444-8444-444444444444' })
  entryId?: string;

  @ApiPropertyOptional({ example: 'What is my EU roaming allowance?' })
  matchedQuery?: string;

  @ApiProperty({ example: 0.942 })
  cosineSimilarity!: number;

  @ApiProperty({ example: 0.871 })
  adaptiveThreshold!: number;

  @ApiPropertyOptional({ example: 0.81 })
  localClusterDensity?: number;

  @ApiPropertyOptional({ example: 5 })
  neighborCount?: number;

  @ApiProperty({ enum: QueryCategory, example: QueryCategory.PRODUCT_INQUIRY })
  category!: QueryCategory;

  @ApiPropertyOptional({ type: [String], example: ['55555555-5555-4555-8555-555555555555'] })
  knowledgeSourceIds?: string[];
}

export class SendMessageResponseSwaggerDto implements SendMessageResponseDto {
  @ApiProperty({ type: DialogResponseSwaggerDto })
  dialog!: DialogResponseSwaggerDto;

  @ApiProperty({ type: DialogMessageResponseSwaggerDto })
  userMessage!: DialogMessageResponseSwaggerDto;

  @ApiProperty({ type: DialogMessageResponseSwaggerDto })
  assistantMessage!: DialogMessageResponseSwaggerDto;

  @ApiPropertyOptional({ type: SemanticCacheTurnMetadataSwaggerDto })
  cache?: SemanticCacheTurnMetadataSwaggerDto;
}

export class DeleteDialogResponseSwaggerDto implements DeleteDialogResponseDto {
  @ApiProperty({ format: 'uuid', example: '22222222-2222-4222-8222-222222222222' })
  id!: string;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class DeleteAllDialogsResponseSwaggerDto implements DeleteAllDialogsResponseDto {
  @ApiProperty({ example: 3 })
  deletedCount!: number;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class DialogRecentActivitySwaggerDto implements DialogRecentActivityDto {
  @ApiProperty({ format: 'uuid', example: '22222222-2222-4222-8222-222222222222' })
  id!: string;

  @ApiProperty({ format: 'uuid', example: '11111111-1111-4111-8111-111111111111' })
  userId!: string;

  @ApiProperty({ example: 'EU Roaming Allowance Inquiry' })
  title!: string;

  @ApiProperty({ example: 6 })
  messageCount!: number;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:05:00.000Z' })
  updatedAt!: string;
}

export class DialogStatsResponseSwaggerDto implements DialogStatsResponseDto {
  @ApiProperty({ example: 24 })
  totalDialogs!: number;

  @ApiProperty({ example: 8 })
  activeUsersCount!: number;

  @ApiProperty({ example: 96 })
  totalMessages!: number;

  @ApiProperty({ example: 48 })
  userMessages!: number;

  @ApiProperty({ example: 48 })
  assistantMessages!: number;

  @ApiProperty({ example: 28 })
  cachedAssistantMessages!: number;

  @ApiProperty({ example: 20 })
  llmAssistantMessages!: number;

  @ApiProperty({ example: 0.5833 })
  cacheHitRate!: number;

  @ApiProperty({ type: Number, nullable: true, example: 215 })
  averageLatencyMs!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 14 })
  averageCachedLatencyMs!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 496 })
  averageLlmLatencyMs!: number | null;

  @ApiProperty({ example: 12480 })
  totalTokens!: number;

  @ApiProperty({ example: 8920 })
  promptTokens!: number;

  @ApiProperty({ example: 3560 })
  completionTokens!: number;

  @ApiProperty({ type: [DialogRecentActivitySwaggerDto] })
  recentDialogs!: DialogRecentActivitySwaggerDto[];
}
