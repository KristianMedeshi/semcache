import {
  ALLOWED_LLM_MODEL_MESSAGE,
  ALLOWED_LLM_MODEL_REGEX,
  type CreateDialogRequestDto,
  DIALOG_VALIDATION_LIMITS,
  type EditMessageRequestDto,
  type SendMessageRequestDto,
  type UpdateDialogRequestDto,
} from '@semcache/shared-dtos';
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

const trimOptionalString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizeCategory = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const v = value.trim().toLowerCase();
  if (v === 'roaming' || v === 'tariff_plan') return QueryCategory.PRODUCT_INQUIRY;
  if (v === 'sim_esim' || v === 'contract_termination') return QueryCategory.ACCOUNT_MANAGEMENT;
  if (v === 'outage_incident') return QueryCategory.TECHNICAL_SUPPORT;
  return v;
};

const normalizeCacheMode = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const v = value.trim().toLowerCase();
  return v === 'no-cache' ? CacheMode.DISABLED : v;
};

export class GatewayCreateDialogDto implements CreateDialogRequestDto {
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MinLength(1)
  @MaxLength(DIALOG_VALIDATION_LIMITS.TITLE_MAX_LENGTH)
  title?: string;
}

export class GatewayUpdateDialogDto implements UpdateDialogRequestDto {
  @Transform(trimOptionalString)
  @IsString()
  @MinLength(1)
  @MaxLength(DIALOG_VALIDATION_LIMITS.TITLE_MAX_LENGTH)
  title!: string;
}

export class GatewayEditMessageDto implements EditMessageRequestDto {
  @Transform(trimOptionalString)
  @IsString()
  @MinLength(DIALOG_VALIDATION_LIMITS.MESSAGE_MIN_LENGTH)
  @MaxLength(DIALOG_VALIDATION_LIMITS.MESSAGE_MAX_LENGTH)
  content!: string;

  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(DIALOG_VALIDATION_LIMITS.MODEL_MAX_LENGTH)
  @Matches(ALLOWED_LLM_MODEL_REGEX, { message: ALLOWED_LLM_MODEL_MESSAGE })
  model?: string;
}

export class GatewaySendMessageDto extends GatewayEditMessageDto implements SendMessageRequestDto {
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
