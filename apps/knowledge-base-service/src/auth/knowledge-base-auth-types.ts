import type { AuthenticatedUser } from '@semcache/shared-types';

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: AuthenticatedUser;
  }
}
