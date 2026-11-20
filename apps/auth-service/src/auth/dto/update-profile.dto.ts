import type { UpdateUserProfileRequestDto } from '@semcache/shared-dtos';
import { IsNormalizedEmail, IsStrongPassword } from './auth-field.decorators';

export class UpdateProfileDto implements UpdateUserProfileRequestDto {
  @IsNormalizedEmail({ optional: true })
  email?: string;

  @IsStrongPassword({ optional: true })
  password?: string;
}
