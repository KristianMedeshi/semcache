import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  type CacheInvalidationResponseDto,
  type CacheInvalidationScope,
  DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS,
  SEMANTIC_CACHE_VALIDATION_LIMITS,
  type SemanticCacheCategoryStatsDto,
  type SemanticCacheCategoryWeightsDto,
  type SemanticCacheSettingsResponseDto,
  type SemanticCacheStatsResponseDto,
} from '@semcache/shared-dtos';
import {
  InvalidateCacheBySourcesDto,
  SemanticCacheCategoryWeightsInputDto,
  UpdateSemanticCacheSettingsDto,
} from '@semcache/shared-dtos/validation';
import { CacheMode, QueryCategory } from '@semcache/shared-types';
import { Type } from 'class-transformer';

function ApiCategoryWeightProperty(category: QueryCategory): PropertyDecorator {
  return ApiPropertyOptional({
    minimum: SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_CATEGORY_WEIGHT,
    maximum: SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_CATEGORY_WEIGHT,
    example: DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS[category],
  });
}

function ApiThresholdProperty(example: number): PropertyDecorator {
  return ApiPropertyOptional({
    minimum: SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_THRESHOLD,
    maximum: SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_THRESHOLD,
    example,
  });
}

export class GatewayCategoryWeightsDto extends SemanticCacheCategoryWeightsInputDto {
  @ApiCategoryWeightProperty(QueryCategory.BILLING)
  declare [QueryCategory.BILLING]?: number;

  @ApiCategoryWeightProperty(QueryCategory.TECHNICAL_SUPPORT)
  declare [QueryCategory.TECHNICAL_SUPPORT]?: number;

  @ApiCategoryWeightProperty(QueryCategory.ACCOUNT_MANAGEMENT)
  declare [QueryCategory.ACCOUNT_MANAGEMENT]?: number;

  @ApiCategoryWeightProperty(QueryCategory.PRODUCT_INQUIRY)
  declare [QueryCategory.PRODUCT_INQUIRY]?: number;

  @ApiCategoryWeightProperty(QueryCategory.GENERAL)
  declare [QueryCategory.GENERAL]?: number;
}

export class GatewayUpdateSemanticCacheSettingsDto extends UpdateSemanticCacheSettingsDto {
  @ApiPropertyOptional({ enum: CacheMode, example: CacheMode.ADAPTIVE })
  declare mode?: CacheMode;

  @ApiThresholdProperty(SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_FIXED_THRESHOLD)
  declare fixedThreshold?: number;

  @ApiThresholdProperty(SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_BASE_THRESHOLD)
  declare adaptiveBaseThreshold?: number;

  @ApiThresholdProperty(SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_MIN_ADAPTIVE_THRESHOLD)
  declare minAdaptiveThreshold?: number;

  @ApiThresholdProperty(SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_MAX_ADAPTIVE_THRESHOLD)
  declare maxAdaptiveThreshold?: number;

  @ApiPropertyOptional({
    minimum: SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_DENSITY_WEIGHT,
    maximum: SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_DENSITY_WEIGHT,
    example: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_DENSITY_WEIGHT,
  })
  declare densityWeight?: number;

  @ApiPropertyOptional({
    minimum: SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_DENSITY_K_NEIGHBORS,
    maximum: SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_DENSITY_K_NEIGHBORS,
    example: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_DENSITY_K_NEIGHBORS,
  })
  declare densityKNeighbors?: number;

  @ApiPropertyOptional({ type: () => GatewayCategoryWeightsDto })
  @Type(() => GatewayCategoryWeightsDto)
  declare categoryWeights?: GatewayCategoryWeightsDto;
}

export class GatewayInvalidateCacheBySourcesDto extends InvalidateCacheBySourcesDto {
  @ApiProperty({
    type: [String],
    minItems: 1,
    maxItems: 200,
    example: ['55555555-5555-4555-8555-555555555555'],
  })
  declare documentIds: string[];
}

export class SemanticCacheCategoryWeightsSwaggerDto implements SemanticCacheCategoryWeightsDto {
  @ApiProperty({ example: DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS[QueryCategory.BILLING] })
  [QueryCategory.BILLING]!: number;

  @ApiProperty({
    example: DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS[QueryCategory.TECHNICAL_SUPPORT],
  })
  [QueryCategory.TECHNICAL_SUPPORT]!: number;

  @ApiProperty({
    example: DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS[QueryCategory.ACCOUNT_MANAGEMENT],
  })
  [QueryCategory.ACCOUNT_MANAGEMENT]!: number;

  @ApiProperty({ example: DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS[QueryCategory.PRODUCT_INQUIRY] })
  [QueryCategory.PRODUCT_INQUIRY]!: number;

  @ApiProperty({ example: DEFAULT_SEMANTIC_CACHE_CATEGORY_WEIGHTS[QueryCategory.GENERAL] })
  [QueryCategory.GENERAL]!: number;
}

export class SemanticCacheSettingsResponseSwaggerDto implements SemanticCacheSettingsResponseDto {
  @ApiProperty({ example: 'default' })
  id!: string;

  @ApiProperty({ enum: CacheMode, example: CacheMode.ADAPTIVE })
  mode!: CacheMode;

  @ApiProperty({ example: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_FIXED_THRESHOLD })
  fixedThreshold!: number;

  @ApiProperty({ example: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_BASE_THRESHOLD })
  adaptiveBaseThreshold!: number;

  @ApiProperty({ example: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_MIN_ADAPTIVE_THRESHOLD })
  minAdaptiveThreshold!: number;

  @ApiProperty({ example: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_MAX_ADAPTIVE_THRESHOLD })
  maxAdaptiveThreshold!: number;

  @ApiProperty({ example: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_DENSITY_WEIGHT })
  densityWeight!: number;

  @ApiProperty({ example: SEMANTIC_CACHE_VALIDATION_LIMITS.DEFAULT_DENSITY_K_NEIGHBORS })
  densityKNeighbors!: number;

  @ApiProperty({ type: SemanticCacheCategoryWeightsSwaggerDto })
  categoryWeights!: SemanticCacheCategoryWeightsSwaggerDto;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    example: '99999999-9999-4999-8999-999999999999',
  })
  updatedBy!: string | null;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:05:00.000Z' })
  updatedAt!: string;
}

export class SemanticCacheCategoryStatsSwaggerDto implements SemanticCacheCategoryStatsDto {
  @ApiProperty({ enum: QueryCategory, example: QueryCategory.BILLING })
  category!: QueryCategory;

  @ApiProperty({ example: 12 })
  entryCount!: number;

  @ApiProperty({ example: 48 })
  totalHits!: number;
}

export class SemanticCacheStatsResponseSwaggerDto implements SemanticCacheStatsResponseDto {
  @ApiProperty({ enum: CacheMode, example: CacheMode.ADAPTIVE })
  mode!: CacheMode;

  @ApiProperty({ example: 42 })
  totalEntries!: number;

  @ApiProperty({ example: 185 })
  totalHits!: number;

  @ApiProperty({ type: [SemanticCacheCategoryStatsSwaggerDto] })
  byCategory!: SemanticCacheCategoryStatsSwaggerDto[];
}

export class CacheInvalidationResponseSwaggerDto implements CacheInvalidationResponseDto {
  @ApiProperty({ example: 3 })
  invalidatedCount!: number;

  @ApiProperty({ enum: ['sources', 'category', 'unlinked', 'all'], example: 'sources' })
  scope!: CacheInvalidationScope;

  @ApiPropertyOptional({ enum: QueryCategory })
  category?: QueryCategory;

  @ApiPropertyOptional({ type: [String] })
  documentIds?: string[];
}
