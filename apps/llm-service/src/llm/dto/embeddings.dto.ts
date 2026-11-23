import {
  KNOWLEDGE_BASE_VALIDATION_LIMITS,
  type LlmGenerateEmbeddingsRequestDto,
} from '@semcache/shared-dtos';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GenerateEmbeddingsRequestDto implements LlmGenerateEmbeddingsRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_EMBEDDING_BATCH_SIZE)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  texts!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;
}
