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
import {
  type InvalidateCacheBySourcesRequestDto,
  SEMANTIC_CACHE_VALIDATION_LIMITS,
  type UpdateSemanticCacheSettingsRequestDto,
} from '../index';
import { isDefined } from './dialogs.dto';

function composePropertyDecorators(...decorators: PropertyDecorator[]): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    for (const decorator of decorators) {
      decorator(target, propertyKey);
    }
  };
}

function IsCategoryWeight(): PropertyDecorator {
  return composePropertyDecorators(
    ValidateIf(isDefined),
    IsNumber({ allowNaN: false, allowInfinity: false }),
    Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_CATEGORY_WEIGHT),
    Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_CATEGORY_WEIGHT),
  );
}

function IsThresholdValue(): PropertyDecorator {
  return composePropertyDecorators(
    ValidateIf(isDefined),
    IsNumber({ allowNaN: false, allowInfinity: false }),
    Min(SEMANTIC_CACHE_VALIDATION_LIMITS.MIN_THRESHOLD),
    Max(SEMANTIC_CACHE_VALIDATION_LIMITS.MAX_THRESHOLD),
  );
}

export class SemanticCacheCategoryWeightsInputDto {
  @IsCategoryWeight()
  [QueryCategory.BILLING]?: number;

  @IsCategoryWeight()
  [QueryCategory.TECHNICAL_SUPPORT]?: number;

  @IsCategoryWeight()
  [QueryCategory.ACCOUNT_MANAGEMENT]?: number;

  @IsCategoryWeight()
  [QueryCategory.PRODUCT_INQUIRY]?: number;

  @IsCategoryWeight()
  [QueryCategory.GENERAL]?: number;
}

export class UpdateSemanticCacheSettingsDto implements UpdateSemanticCacheSettingsRequestDto {
  @ValidateIf(isDefined)
  @IsEnum(CacheMode)
  mode?: CacheMode;

  @IsThresholdValue()
  fixedThreshold?: number;

  @IsThresholdValue()
  adaptiveBaseThreshold?: number;

  @IsThresholdValue()
  minAdaptiveThreshold?: number;

  @IsThresholdValue()
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

export class InvalidateCacheBySourcesDto implements InvalidateCacheBySourcesRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  documentIds!: string[];
}
