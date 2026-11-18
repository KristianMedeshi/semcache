import type {
  LoginRequestDto,
  RegisterRequestDto,
  UpdateUserProfileRequestDto,
} from '@semcache/shared-dtos';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).{8,128}$/;

export class GatewayRegisterDto implements RegisterRequestDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().normalize('NFC').toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_COMPLEXITY_REGEX, {
    message:
      'Password must be 8-128 characters and include uppercase, lowercase, and a number or special character',
  })
  password!: string;
}

export class GatewayLoginDto implements LoginRequestDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().normalize('NFC').toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class GatewayUpdateProfileDto implements UpdateUserProfileRequestDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().normalize('NFC').toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(PASSWORD_COMPLEXITY_REGEX, {
    message:
      'Password must be 8-128 characters and include uppercase, lowercase, and a number or special character',
  })
  password?: string;
}
