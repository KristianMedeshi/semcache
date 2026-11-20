import type { LoginRequestDto } from '@semcache/shared-dtos';
import { IsLoginPassword, IsNormalizedEmail } from './auth-field.decorators';

export class LoginDto implements LoginRequestDto {
  @IsNormalizedEmail()
  email!: string;

  @IsLoginPassword()
  password!: string;
}
