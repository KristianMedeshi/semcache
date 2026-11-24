import { Policy } from '@nestjs/authorization';
import { type AuthenticatedUser, UserRole } from '@semcache/shared-types';

@Policy()
export class SemanticCachePolicy {
  lookup(_user: unknown): boolean {
    return true;
  }

  store(_user: unknown): boolean {
    return true;
  }

  invalidate(user: AuthenticatedUser | null): boolean {
    return this.isAdmin(user);
  }

  manageSettings(user: AuthenticatedUser | null): boolean {
    return this.isAdmin(user);
  }

  readStats(user: AuthenticatedUser | null): boolean {
    return this.isAdmin(user);
  }

  private isAdmin(user: AuthenticatedUser | null): boolean {
    return user !== null && user.role === UserRole.ADMIN;
  }
}
