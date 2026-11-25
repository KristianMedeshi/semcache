import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  type DeleteKnowledgeDocumentResponseDto,
  KNOWLEDGE_BASE_VALIDATION_LIMITS,
  type KnowledgeChunkResponseDto,
  type KnowledgeContextSourceReferenceDto,
  type KnowledgeDocumentDetailResponseDto,
  type KnowledgeDocumentResponseDto,
  type RetrieveKnowledgeContextResponseDto,
  type RetrievedKnowledgeChunkDto,
} from '@semcache/shared-dtos';
import {
  ListKnowledgeDocumentsDto,
  ReprocessKnowledgeDocumentDto,
  RetrieveKnowledgeContextDto,
  UploadKnowledgeDocumentDto,
} from '@semcache/shared-dtos/validation';
import {
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
  QueryCategory,
} from '@semcache/shared-types';

export class GatewayUploadKnowledgeDocumentDto extends UploadKnowledgeDocumentDto {
  @ApiProperty({
    minLength: 1,
    maxLength: KNOWLEDGE_BASE_VALIDATION_LIMITS.TITLE_MAX_LENGTH,
    example: 'EU Roaming Fair Use Policy',
  })
  declare title: string;

  @ApiProperty({
    minLength: KNOWLEDGE_BASE_VALIDATION_LIMITS.CONTENT_MIN_LENGTH,
    maxLength: KNOWLEDGE_BASE_VALIDATION_LIMITS.CONTENT_MAX_LENGTH,
    example: 'Customers on Plus plans receive 25 GB of EU roaming data per billing cycle.',
  })
  declare content: string;

  @ApiPropertyOptional({
    maxLength: KNOWLEDGE_BASE_VALIDATION_LIMITS.FILENAME_MAX_LENGTH,
    example: 'eu-roaming.md',
  })
  declare fileName?: string;

  @ApiPropertyOptional({ enum: KnowledgeDocumentFormat, example: KnowledgeDocumentFormat.MARKDOWN })
  declare format?: KnowledgeDocumentFormat;

  @ApiPropertyOptional({ enum: QueryCategory, example: QueryCategory.PRODUCT_INQUIRY })
  declare category?: QueryCategory;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { region: 'EU', effectiveYear: 2026 },
  })
  declare metadata?: Record<string, string | number | boolean>;

  @ApiPropertyOptional({
    minimum: KNOWLEDGE_BASE_VALIDATION_LIMITS.MIN_CHUNK_SIZE,
    maximum: KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_CHUNK_SIZE,
    example: KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_CHUNK_SIZE,
  })
  declare chunkSize?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_CHUNK_OVERLAP,
    example: KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_CHUNK_OVERLAP,
  })
  declare chunkOverlap?: number;
}

export class GatewayListKnowledgeDocumentsQueryDto extends ListKnowledgeDocumentsDto {
  @ApiPropertyOptional({ enum: QueryCategory })
  declare category?: QueryCategory;

  @ApiPropertyOptional({ enum: KnowledgeDocumentStatus })
  declare status?: KnowledgeDocumentStatus;
}

export class GatewayRetrieveKnowledgeContextDto extends RetrieveKnowledgeContextDto {
  @ApiProperty({
    minLength: KNOWLEDGE_BASE_VALIDATION_LIMITS.QUERY_MIN_LENGTH,
    maxLength: KNOWLEDGE_BASE_VALIDATION_LIMITS.QUERY_MAX_LENGTH,
    example: 'How much EU roaming data is included?',
  })
  declare query: string;

  @ApiPropertyOptional({
    minimum: KNOWLEDGE_BASE_VALIDATION_LIMITS.MIN_TOP_K,
    maximum: KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_TOP_K,
    example: KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_TOP_K,
  })
  declare topK?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 1,
    example: KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_MIN_SIMILARITY,
  })
  declare minSimilarity?: number;

  @ApiPropertyOptional({ enum: QueryCategory })
  declare category?: QueryCategory;
}

export class GatewayReprocessKnowledgeDocumentDto extends ReprocessKnowledgeDocumentDto {
  @ApiPropertyOptional({
    minLength: KNOWLEDGE_BASE_VALIDATION_LIMITS.CONTENT_MIN_LENGTH,
    maxLength: KNOWLEDGE_BASE_VALIDATION_LIMITS.CONTENT_MAX_LENGTH,
  })
  declare content?: string;

  @ApiPropertyOptional({
    minLength: 1,
    maxLength: KNOWLEDGE_BASE_VALIDATION_LIMITS.TITLE_MAX_LENGTH,
  })
  declare title?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  declare metadata?: Record<string, string | number | boolean>;

  @ApiPropertyOptional({
    minimum: KNOWLEDGE_BASE_VALIDATION_LIMITS.MIN_CHUNK_SIZE,
    maximum: KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_CHUNK_SIZE,
  })
  declare chunkSize?: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_CHUNK_OVERLAP,
  })
  declare chunkOverlap?: number;

  @ApiPropertyOptional({ example: true })
  declare includeChunks?: boolean;
}

export class KnowledgeDocumentResponseSwaggerDto implements KnowledgeDocumentResponseDto {
  @ApiProperty({ format: 'uuid', example: '55555555-5555-4555-8555-555555555555' })
  id!: string;

  @ApiProperty({ example: 'EU Roaming Fair Use Policy' })
  title!: string;

  @ApiProperty({ type: String, nullable: true, example: 'eu-roaming.md' })
  fileName!: string | null;

  @ApiProperty({ enum: KnowledgeDocumentFormat, example: KnowledgeDocumentFormat.MARKDOWN })
  format!: KnowledgeDocumentFormat;

  @ApiProperty({ enum: QueryCategory, example: QueryCategory.PRODUCT_INQUIRY })
  category!: QueryCategory;

  @ApiProperty({ enum: KnowledgeDocumentStatus, example: KnowledgeDocumentStatus.READY })
  status!: KnowledgeDocumentStatus;

  @ApiProperty({ example: 4 })
  chunkCount!: number;

  @ApiProperty({ example: 1850 })
  characterCount!: number;

  @ApiProperty({ type: String, nullable: true, example: null })
  errorMessage!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true, example: {} })
  metadata!: Record<string, string | number | boolean>;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    example: '99999999-9999-4999-8999-999999999999',
  })
  uploadedBy!: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:05.000Z' })
  updatedAt!: string;
}

export class KnowledgeChunkResponseSwaggerDto implements KnowledgeChunkResponseDto {
  @ApiProperty({ format: 'uuid', example: '66666666-6666-4666-8666-666666666666' })
  id!: string;

  @ApiProperty({ format: 'uuid', example: '55555555-5555-4555-8555-555555555555' })
  documentId!: string;

  @ApiProperty({ example: 0 })
  chunkIndex!: number;

  @ApiProperty({ example: 'Customers on Plus plans receive 25 GB of EU roaming data.' })
  content!: string;

  @ApiProperty({ example: 14 })
  tokenCount!: number;

  @ApiProperty({ example: 62 })
  characterCount!: number;

  @ApiProperty({ type: 'object', additionalProperties: true, example: {} })
  metadata!: Record<string, string | number | boolean>;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:05.000Z' })
  createdAt!: string;
}

export class KnowledgeDocumentDetailResponseSwaggerDto
  extends KnowledgeDocumentResponseSwaggerDto
  implements KnowledgeDocumentDetailResponseDto
{
  @ApiProperty({ example: 'Customers on Plus plans receive 25 GB of EU roaming data.' })
  content!: string;

  @ApiPropertyOptional({ type: [KnowledgeChunkResponseSwaggerDto] })
  chunks?: KnowledgeChunkResponseSwaggerDto[];
}

export class DeleteKnowledgeDocumentResponseSwaggerDto implements DeleteKnowledgeDocumentResponseDto {
  @ApiProperty({ format: 'uuid', example: '55555555-5555-4555-8555-555555555555' })
  id!: string;

  @ApiProperty({ example: true })
  deleted!: true;

  @ApiProperty({ example: 4 })
  deletedChunksCount!: number;
}

export class KnowledgeContextSourceReferenceSwaggerDto implements KnowledgeContextSourceReferenceDto {
  @ApiProperty({ format: 'uuid', example: '55555555-5555-4555-8555-555555555555' })
  documentId!: string;

  @ApiProperty({ example: 'EU Roaming Fair Use Policy' })
  documentTitle!: string;

  @ApiProperty({ type: String, nullable: true, example: 'eu-roaming.md' })
  fileName!: string | null;

  @ApiProperty({ enum: QueryCategory, example: QueryCategory.PRODUCT_INQUIRY })
  category!: QueryCategory;

  @ApiProperty({ format: 'uuid', example: '66666666-6666-4666-8666-666666666666' })
  chunkId!: string;

  @ApiProperty({ example: 0 })
  chunkIndex!: number;
}

export class RetrievedKnowledgeChunkSwaggerDto
  extends KnowledgeContextSourceReferenceSwaggerDto
  implements RetrievedKnowledgeChunkDto
{
  @ApiProperty({ example: 'Customers on Plus plans receive 25 GB of EU roaming data.' })
  content!: string;

  @ApiProperty({ example: 0.892 })
  similarity!: number;

  @ApiProperty({ type: KnowledgeContextSourceReferenceSwaggerDto })
  source!: KnowledgeContextSourceReferenceSwaggerDto;
}

export class RetrieveKnowledgeContextResponseSwaggerDto implements RetrieveKnowledgeContextResponseDto {
  @ApiProperty({ example: 'How much EU roaming data is included?' })
  query!: string;

  @ApiProperty({ example: true })
  hasRelevantContext!: boolean;

  @ApiProperty({ example: '[Source 1: EU Roaming Fair Use Policy]\n25 GB EU roaming included.' })
  formattedContext!: string;

  @ApiProperty({ type: [RetrievedKnowledgeChunkSwaggerDto] })
  results!: RetrievedKnowledgeChunkSwaggerDto[];

  @ApiProperty({ type: [KnowledgeContextSourceReferenceSwaggerDto] })
  sources!: KnowledgeContextSourceReferenceSwaggerDto[];
}
