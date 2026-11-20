import type { RegisterRequestDto } from '@semcache/shared-dtos';
import { IsNormalizedEmail, IsStrongPassword } from './auth-field.decorators';

export class RegisterDto implements RegisterRequestDto {
  @IsNormalizedEmail()
  email!: string;

  @IsStrongPassword()
  password!: string;
}
