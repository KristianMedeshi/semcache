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
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  KNOWLEDGE_BASE_VALIDATION_LIMITS,
  type ListKnowledgeDocumentsQueryDto,
  type ReprocessKnowledgeDocumentRequestDto,
  type RetrieveKnowledgeContextRequestDto,
  type UploadKnowledgeDocumentRequestDto,
} from '../index';
import { isDefined, trimString } from './dialogs.dto';

export class BaseChunkingDto {
  @ValidateIf(isDefined)
  @IsObject()
  metadata?: Record<string, string | number | boolean>;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(KNOWLEDGE_BASE_VALIDATION_LIMITS.MIN_CHUNK_SIZE)
  @Max(KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_CHUNK_SIZE)
  chunkSize?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(0)
  @Max(KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_CHUNK_OVERLAP)
  chunkOverlap?: number;
}

export class UploadKnowledgeDocumentDto
  extends BaseChunkingDto
  implements UploadKnowledgeDocumentRequestDto
{
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.TITLE_MAX_LENGTH)
  title!: string;

  @IsString()
  @MinLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.CONTENT_MIN_LENGTH)
  @MaxLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.CONTENT_MAX_LENGTH)
  content!: string;

  @ValidateIf(isDefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.FILENAME_MAX_LENGTH)
  fileName?: string;

  @ValidateIf(isDefined)
  @IsEnum(KnowledgeDocumentFormat)
  format?: KnowledgeDocumentFormat;

  @ValidateIf(isDefined)
  @IsEnum(QueryCategory)
  category?: QueryCategory;
}

export class ListKnowledgeDocumentsDto implements ListKnowledgeDocumentsQueryDto {
  @ValidateIf(isDefined)
  @IsEnum(QueryCategory)
  category?: QueryCategory;

  @ValidateIf(isDefined)
  @IsEnum(KnowledgeDocumentStatus)
  status?: KnowledgeDocumentStatus;
}

export class RetrieveKnowledgeContextDto implements RetrieveKnowledgeContextRequestDto {
  @Transform(trimString)
  @IsString()
  @MinLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.QUERY_MIN_LENGTH)
  @MaxLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.QUERY_MAX_LENGTH)
  query!: string;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(KNOWLEDGE_BASE_VALIDATION_LIMITS.MIN_TOP_K)
  @Max(KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_TOP_K)
  topK?: number;

  @ValidateIf(isDefined)
  @IsNumber()
  @Min(0)
  @Max(1)
  minSimilarity?: number;

  @ValidateIf(isDefined)
  @IsEnum(QueryCategory)
  category?: QueryCategory;
}

export class ReprocessKnowledgeDocumentDto
  extends BaseChunkingDto
  implements ReprocessKnowledgeDocumentRequestDto
{
  @ValidateIf(isDefined)
  @IsString()
  @MinLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.CONTENT_MIN_LENGTH)
  @MaxLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.CONTENT_MAX_LENGTH)
  content?: string;

  @ValidateIf(isDefined)
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(KNOWLEDGE_BASE_VALIDATION_LIMITS.TITLE_MAX_LENGTH)
  title?: string;

  @ValidateIf(isDefined)
  @IsBoolean()
  includeChunks?: boolean;
}
