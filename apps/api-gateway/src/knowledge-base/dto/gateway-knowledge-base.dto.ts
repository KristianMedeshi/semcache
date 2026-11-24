import {
  KNOWLEDGE_BASE_VALIDATION_LIMITS,
  type ListKnowledgeDocumentsQueryDto,
  type ReprocessKnowledgeDocumentRequestDto,
  type RetrieveKnowledgeContextRequestDto,
  type UploadKnowledgeDocumentRequestDto,
} from '@semcache/shared-dtos';
import {
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
  QueryCategory,
} from '@semcache/shared-types';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class GatewayUploadKnowledgeDocumentDto implements UploadKnowledgeDocumentRequestDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.TITLE_MAX_LENGTH)
  title!: string;

  @IsString()
  @MinLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.CONTENT_MIN_LENGTH)
  @MaxLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.CONTENT_MAX_LENGTH)
  content!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.FILENAME_MAX_LENGTH)
  fileName?: string;

  @IsOptional()
  @IsEnum(KnowledgeDocumentFormat)
  format?: KnowledgeDocumentFormat;

  @IsOptional()
  @IsEnum(QueryCategory)
  category?: QueryCategory;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string | number | boolean>;

  @IsOptional()
  @IsInt()
  @Min(KNOWLEDGE_BASE_VALIDATION_LIMITS.MIN_CHUNK_SIZE)
  @Max(KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_CHUNK_SIZE)
  chunkSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_CHUNK_OVERLAP)
  chunkOverlap?: number;
}

export class GatewayListKnowledgeDocumentsQueryDto implements ListKnowledgeDocumentsQueryDto {
  @IsOptional()
  @IsEnum(QueryCategory)
  category?: QueryCategory;

  @IsOptional()
  @IsEnum(KnowledgeDocumentStatus)
  status?: KnowledgeDocumentStatus;
}

export class GatewayRetrieveKnowledgeContextDto implements RetrieveKnowledgeContextRequestDto {
  @Transform(trimString)
  @IsString()
  @MinLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.QUERY_MIN_LENGTH)
  @MaxLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.QUERY_MAX_LENGTH)
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(KNOWLEDGE_BASE_VALIDATION_LIMITS.MIN_TOP_K)
  @Max(KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_TOP_K)
  topK?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minSimilarity?: number;

  @IsOptional()
  @IsEnum(QueryCategory)
  category?: QueryCategory;
}

export class GatewayReprocessKnowledgeDocumentDto implements ReprocessKnowledgeDocumentRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.CONTENT_MIN_LENGTH)
  @MaxLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.CONTENT_MAX_LENGTH)
  content?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.TITLE_MAX_LENGTH)
  title?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string | number | boolean>;

  @IsOptional()
  @IsInt()
  @Min(KNOWLEDGE_BASE_VALIDATION_LIMITS.MIN_CHUNK_SIZE)
  @Max(KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_CHUNK_SIZE)
  chunkSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_CHUNK_OVERLAP)
  chunkOverlap?: number;

  @IsOptional()
  @IsBoolean()
  includeChunks?: boolean;
}
