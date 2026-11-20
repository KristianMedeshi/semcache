import {
  AUTH_VALIDATION_LIMITS,
  type LoginRequestDto,
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  type RegisterRequestDto,
  type UpdateUserProfileRequestDto,
} from '@semcache/shared-dtos';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const normalizeGatewayEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().normalize('NFC').toLowerCase() : value;

class GatewayEmailBodyDto {
  @Transform(normalizeGatewayEmail)
  @IsEmail()
  @MaxLength(AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH)
  email!: string;
}

export class GatewayRegisterDto extends GatewayEmailBodyDto implements RegisterRequestDto {
  @IsString()
  @MinLength(AUTH_VALIDATION_LIMITS.PASSWORD_MIN_LENGTH)
  @MaxLength(AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE })
  password!: string;
}

export class GatewayLoginDto extends GatewayEmailBodyDto implements LoginRequestDto {
  @IsString()
  @MinLength(AUTH_VALIDATION_LIMITS.PASSWORD_LOGIN_MIN_LENGTH)
  @MaxLength(AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH)
  password!: string;
}

export class GatewayUpdateProfileDto implements UpdateUserProfileRequestDto {
  @IsOptional()
  @Transform(normalizeGatewayEmail)
  @IsEmail()
  @MaxLength(AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(AUTH_VALIDATION_LIMITS.PASSWORD_MIN_LENGTH)
  @MaxLength(AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE })
  password?: string;
}
