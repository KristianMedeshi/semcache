import {
  type CreateDialogRequestDto,
  DIALOG_VALIDATION_LIMITS,
  type EditMessageRequestDto,
  FREE_OPENROUTER_MODEL_MESSAGE,
  FREE_OPENROUTER_MODEL_REGEX,
  type SendMessageRequestDto,
  type UpdateDialogRequestDto,
} from '@semcache/shared-dtos';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

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

export class SendMessageDto implements SendMessageRequestDto {
  @Transform(trimString)
  @IsString()
  @MinLength(DIALOG_VALIDATION_LIMITS.MESSAGE_MIN_LENGTH)
  @MaxLength(DIALOG_VALIDATION_LIMITS.MESSAGE_MAX_LENGTH)
  content!: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(DIALOG_VALIDATION_LIMITS.MODEL_MAX_LENGTH)
  @Matches(FREE_OPENROUTER_MODEL_REGEX, { message: FREE_OPENROUTER_MODEL_MESSAGE })
  model?: string;

  @IsOptional()
  @IsUUID()
  parentMessageId?: string | null;
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
  @Matches(FREE_OPENROUTER_MODEL_REGEX, { message: FREE_OPENROUTER_MODEL_MESSAGE })
  model?: string;
}
