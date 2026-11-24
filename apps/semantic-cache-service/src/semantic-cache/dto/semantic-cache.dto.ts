import {
  type CacheKnowledgeSourceReferenceDto,
  type InvalidateCacheByCategoryRequestDto,
  type InvalidateCacheBySourcesRequestDto,
  SEMANTIC_CACHE_VALIDATION_LIMITS,
  type SemanticCacheLookupRequestDto,
  type SemanticCacheStoreRequestDto,
  type UpdateSemanticCacheSettingsRequestDto,
} from '@semcache/shared-dtos';
import { CacheMode, QueryCategory } from '@semcache/shared-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const isDefined = (_: unknown, value: unknown): boolean => value !== undefined;

export class CacheKnowledgeSourceReferenceInputDto implements CacheKnowledgeSourceReferenceDto {
  @IsUUID('all')
  documentId!: string;

  @ValidateIf(isDefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  documentTitle?: string;

  @ValidateIf(isDefined)
  @IsUUID('all')
  chunkId?: string;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(0)
  chunkIndex?: number;
}

export class SemanticCacheLookupDto implements SemanticCacheLookupRequestDto {
  @Transform(trimString)
  @IsString()
  @MinLength(SEMANTIC_CACHE_VALIDATION_LIMITS.QUERY_MIN_LENGTH)
  @MaxLength(SEMANTIC_CACHE_VALIDATION_LIMITS.QUERY_MAX_LENGTH)
  query!: string;

  @IsArray()
  @ArrayMinSize(SEMANTIC_CACHE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS)
  @ArrayMaxSize(SEMANTIC_CACHE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  embedding!: number[];

  @ValidateIf(isDefined)
  @IsEnum(QueryCategory)
  category?: QueryCategory;

  @ValidateIf(isDefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(128)
  sessionId?: string;

  @ValidateIf(isDefined)
  @IsEnum(CacheMode)
  mode?: CacheMode;

  @ValidateIf(isDefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_THRESHOLD)
  @Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_THRESHOLD)
  fixedThresholdOverride?: number;
}

export class SemanticCacheStoreDto implements SemanticCacheStoreRequestDto {
  @Transform(trimString)
  @IsString()
  @MinLength(SEMANTIC_CACHE_VALIDATION_LIMITS.QUERY_MIN_LENGTH)
  @MaxLength(SEMANTIC_CACHE_VALIDATION_LIMITS.QUERY_MAX_LENGTH)
  query!: string;

  @IsString()
  @MinLength(SEMANTIC_CACHE_VALIDATION_LIMITS.RESPONSE_MIN_LENGTH)
  @MaxLength(SEMANTIC_CACHE_VALIDATION_LIMITS.RESPONSE_MAX_LENGTH)
  response!: string;

  @IsArray()
  @ArrayMinSize(SEMANTIC_CACHE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS)
  @ArrayMaxSize(SEMANTIC_CACHE_VALIDATION_LIMITS.EMBEDDING_DIMENSIONS)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { each: true })
  embedding!: number[];

  @ValidateIf(isDefined)
  @IsEnum(QueryCategory)
  category?: QueryCategory;

  @ValidateIf(isDefined)
  @IsArray()
  @ArrayMaxSize(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_SOURCE_IDS_PER_ENTRY)
  @IsUUID('all', { each: true })
  knowledgeSourceIds?: string[];

  @ValidateIf(isDefined)
  @IsArray()
  @ArrayMaxSize(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_SOURCE_IDS_PER_ENTRY)
  @ValidateNested({ each: true })
  @Type(() => CacheKnowledgeSourceReferenceInputDto)
  knowledgeSources?: CacheKnowledgeSourceReferenceInputDto[];

  @ValidateIf(isDefined)
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  model?: string;

  @ValidateIf(isDefined)
  @IsObject()
  metadata?: Record<string, string | number | boolean>;
}

export class InvalidateCacheBySourcesDto implements InvalidateCacheBySourcesRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  documentIds!: string[];
}

export class InvalidateCacheByCategoryDto implements InvalidateCacheByCategoryRequestDto {
  @IsEnum(QueryCategory)
  category!: QueryCategory;
}

export class SemanticCacheCategoryWeightsInputDto {
  @ValidateIf(isDefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_CATEGORY_WEIGHT)
  @Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_CATEGORY_WEIGHT)
  [QueryCategory.BILLING]?: number;

  @ValidateIf(isDefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_CATEGORY_WEIGHT)
  @Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_CATEGORY_WEIGHT)
  [QueryCategory.TECHNICAL_SUPPORT]?: number;

  @ValidateIf(isDefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_CATEGORY_WEIGHT)
  @Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_CATEGORY_WEIGHT)
  [QueryCategory.ACCOUNT_MANAGEMENT]?: number;

  @ValidateIf(isDefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_CATEGORY_WEIGHT)
  @Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_CATEGORY_WEIGHT)
  [QueryCategory.PRODUCT_INQUIRY]?: number;

  @ValidateIf(isDefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_CATEGORY_WEIGHT)
  @Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_CATEGORY_WEIGHT)
  [QueryCategory.GENERAL]?: number;
}

export class UpdateSemanticCacheSettingsDto implements UpdateSemanticCacheSettingsRequestDto {
  @ValidateIf(isDefined)
  @IsEnum(CacheMode)
  mode?: CacheMode;

  @ValidateIf(isDefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_THRESHOLD)
  @Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_THRESHOLD)
  fixedThreshold?: number;

  @ValidateIf(isDefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_THRESHOLD)
  @Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_THRESHOLD)
  adaptiveBaseThreshold?: number;

  @ValidateIf(isDefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_THRESHOLD)
  @Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_THRESHOLD)
  minAdaptiveThreshold?: number;

  @ValidateIf(isDefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_THRESHOLD)
  @Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_THRESHOLD)
  maxAdaptiveThreshold?: number;

  @ValidateIf(isDefined)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_DENSITY_WEIGHT)
  @Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_DENSITY_WEIGHT)
  densityWeight?: number;

  @ValidateIf(isDefined)
  @IsInt()
  @Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_DENSITY_K_NEIGHBORS)
  @Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_DENSITY_K_NEIGHBORS)
  densityKNeighbors?: number;

  @ValidateIf(isDefined)
  @ValidateNested()
  @Type(() => SemanticCacheCategoryWeightsInputDto)
  categoryWeights?: SemanticCacheCategoryWeightsInputDto;
}
