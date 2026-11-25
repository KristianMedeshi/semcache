import { CacheMode, QueryCategory } from '@semcache/shared-types';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ALLOWED_LLM_MODEL_MESSAGE,
  ALLOWED_LLM_MODEL_REGEX,
  type CreateDialogRequestDto,
  DIALOG_VALIDATION_LIMITS,
  type EditMessageRequestDto,
  type SendMessageRequestDto,
  type UpdateDialogRequestDto,
} from '../index';

export const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const CATEGORY_ALIASES: Record<string, QueryCategory> = {
  roaming: QueryCategory.PRODUCT_INQUIRY,
  tariff_plan: QueryCategory.PRODUCT_INQUIRY,
  sim_esim: QueryCategory.ACCOUNT_MANAGEMENT,
  contract_termination: QueryCategory.ACCOUNT_MANAGEMENT,
  outage_incident: QueryCategory.TECHNICAL_SUPPORT,
};

export const normalizeCategory = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  return CATEGORY_ALIASES[normalized] ?? normalized;
};

export const normalizeCacheMode = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === 'no-cache' ? CacheMode.DISABLED : normalized;
};

export class CreateDialogDto implements CreateDialogRequestDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(DIALOG_VALIDATION_LIMITS.TITLE_MAX_LENGTH)
  title?: string;
}

export class UpdateDialogDto implements UpdateDialogRequestDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(DIALOG_VALIDATION_LIMITS.TITLE_MAX_LENGTH)
  title!: string;
}

export class EditMessageDto implements EditMessageRequestDto {
  @Transform(trimString)
  @IsString()
  @MinLength(DIALOG_VALIDATION_LIMITS.MESSAGE_MIN_LENGTH)
  @MaxLength(DIALOG_VALIDATION_LIMITS.MESSAGE_MAX_LENGTH)
  content!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(DIALOG_VALIDATION_LIMITS.MODEL_MAX_LENGTH)
  @Matches(ALLOWED_LLM_MODEL_REGEX, { message: ALLOWED_LLM_MODEL_MESSAGE })
  model?: string;
}

export class SendMessageDto extends EditMessageDto implements SendMessageRequestDto {
  @IsOptional()
  @IsUUID()
  parentMessageId?: string | null;

  @IsOptional()
  @Transform(normalizeCategory)
  @IsEnum(QueryCategory)
  category?: QueryCategory;

  @IsOptional()
  @Transform(normalizeCacheMode)
  @IsEnum(CacheMode)
  cacheMode?: CacheMode;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  fixedThresholdOverride?: number;
}
