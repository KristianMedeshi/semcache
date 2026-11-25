import { applyDecorators } from '@nestjs/common';
import {
  AUTH_VALIDATION_LIMITS,
  PASSWORD_COMPLEXITY_MESSAGE,
  PASSWORD_COMPLEXITY_REGEX,
} from '@semcache/shared-dtos';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { normalizeEmail } from '../../users/users.repository';

const isDefined = (_: unknown, value: unknown): boolean => value !== undefined;

/**
 * Normalizes and validates an email field on auth-service request DTOs.
 */
export function IsNormalizedEmail(options?: { optional?: boolean }): PropertyDecorator {
  const decorators: PropertyDecorator[] = [
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? normalizeEmail(value) : value,
    ),
    IsEmail(),
    MaxLength(AUTH_VALIDATION_LIMITS.EMAIL_MAX_LENGTH),
  ];
  if (options?.optional) {
    decorators.unshift(ValidateIf(isDefined));
  }
  return applyDecorators(...decorators);
}

/**
 * Validates password strength and bounds for registration and profile updates.
 */
export function IsStrongPassword(options?: { optional?: boolean }): PropertyDecorator {
  const decorators: PropertyDecorator[] = [
    IsString(),
    MinLength(AUTH_VALIDATION_LIMITS.PASSWORD_MIN_LENGTH),
    MaxLength(AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH),
    Matches(PASSWORD_COMPLEXITY_REGEX, { message: PASSWORD_COMPLEXITY_MESSAGE }),
  ];
  if (options?.optional) {
    decorators.unshift(ValidateIf(isDefined));
  }
  return applyDecorators(...decorators);
}

/**
 * Validates non-empty login password input within configured length bounds.
 */
export function IsLoginPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(AUTH_VALIDATION_LIMITS.PASSWORD_LOGIN_MIN_LENGTH),
    MaxLength(AUTH_VALIDATION_LIMITS.PASSWORD_MAX_LENGTH),
  );
}
