import type { UserResponseDto } from '@semcache/shared-dtos';

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: UserResponseDto;
  }
}
