import {
  type InvalidateCacheBySourcesRequestDto,
  SEMANTIC_CACHE_VALIDATION_LIMITS,
  type UpdateSemanticCacheSettingsRequestDto,
} from '@semcache/shared-dtos';
import { CacheMode, QueryCategory } from '@semcache/shared-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const isDefined = (_: unknown, value: unknown): boolean => value !== undefined;

export class GatewayCategoryWeightsDto {
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

export class GatewayUpdateSemanticCacheSettingsDto implements UpdateSemanticCacheSettingsRequestDto {
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
  @Type(() => GatewayCategoryWeightsDto)
  categoryWeights?: GatewayCategoryWeightsDto;
}

export class GatewayInvalidateCacheBySourcesDto implements InvalidateCacheBySourcesRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  documentIds!: string[];
}
