import {
  EMBEDDING_VALIDATION_LIMITS,
  type GenerateEmbeddingsRequestDto,
} from '@semcache/shared-dtos';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class GenerateEmbeddingsDto implements GenerateEmbeddingsRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(EMBEDDING_VALIDATION_LIMITS.MAX_BATCH_SIZE)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  texts!: string[];

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(EMBEDDING_VALIDATION_LIMITS.MODEL_MAX_LENGTH)
  model?: string;
}
