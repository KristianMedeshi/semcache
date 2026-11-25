import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AUTH_VALIDATION_LIMITS,
  type LoginRequestDto,
  type LogoutResponseDto,
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
  type RegisterRequestDto,
  type RevokeUserSessionsResponseDto,
  type UpdateUserProfileRequestDto,
  type UserResponseDto,
} from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const isDefined = (_: unknown, value: unknown): boolean => value !== undefined;

const normalizeGatewayEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().normalize('NFC').toLowerCase() : value;

class GatewayEmailBodyDto {
  @ApiProperty({
    format: 'email',
    maxLength: AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH,
    example: 'alice@example.com',
  })
  @Transform(normalizeGatewayEmail)
  @IsEmail()
  @MaxLength(AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH)
  email!: string;
}

export class GatewayRegisterDto extends GatewayEmailBodyDto implements RegisterRequestDto {
  @ApiProperty({
    minLength: AUTH_VALIDATION_LIMITS.PASSWORD_MIN_LENGTH,
    maxLength: AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH,
    description: PASSWORD_COMPLEXITY_MESSAGE,
    example: 'StrongPassword1!',
  })
  @IsString()
  @MinLength(AUTH_VALIDATION_LIMITS.PASSWORD_MIN_LENGTH)
  @MaxLength(AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE })
  password!: string;
}

export class GatewayLoginDto extends GatewayEmailBodyDto implements LoginRequestDto {
  @ApiProperty({
    minLength: AUTH_VALIDATION_LIMITS.PASSWORD_LOGIN_MIN_LENGTH,
    maxLength: AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH,
    example: 'StrongPassword1!',
  })
  @IsString()
  @MinLength(AUTH_VALIDATION_LIMITS.PASSWORD_LOGIN_MIN_LENGTH)
  @MaxLength(AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH)
  password!: string;
}

export class GatewayUpdateProfileDto implements UpdateUserProfileRequestDto {
  @ApiPropertyOptional({
    format: 'email',
    maxLength: AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH,
    example: 'alice.updated@example.com',
  })
  @ValidateIf(isDefined)
  @Transform(normalizeGatewayEmail)
  @IsEmail()
  @MaxLength(AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH)
  email?: string;

  @ApiPropertyOptional({
    minLength: AUTH_VALIDATION_LIMITS.PASSWORD_MIN_LENGTH,
    maxLength: AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH,
    description: PASSWORD_COMPLEXITY_MESSAGE,
    example: 'NewStrongPassword1!',
  })
  @ValidateIf(isDefined)
  @IsString()
  @MinLength(AUTH_VALIDATION_LIMITS.PASSWORD_MIN_LENGTH)
  @MaxLength(AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH)
  @Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE })
  password?: string;
}

export class UserResponseSwaggerDto implements UserResponseDto {
  @ApiProperty({ format: 'uuid', example: '11111111-1111-4111-8111-111111111111' })
  id!: string;

  @ApiProperty({ format: 'email', example: 'alice@example.com' })
  email!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.CUSTOMER })
  role!: UserRole;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:00.000Z' })
  updatedAt!: string;
}

export class LogoutResponseSwaggerDto implements LogoutResponseDto {
  @ApiProperty({ example: true })
  success!: true;
}

export class RevokeUserSessionsResponseSwaggerDto implements RevokeUserSessionsResponseDto {
  @ApiProperty({ example: 2 })
  revokedCount!: number;
}
