import { type Ability, Policy, type PolicyBefore } from '@nestjs/authorization';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';

@Policy()
export class GatewayAccessPolicy implements PolicyBefore<
  UserResponseDto,
  Ability<GatewayAccessPolicy>
> {
  before(user: UserResponseDto | null): boolean | undefined {
    if (user?.role === UserRole.ADMIN) {
      return true;
    }
    return undefined;
  }

  /**
   * Auth, user-profile, and admin-user endpoints proxy cookie-authenticated requests
   * directly to `auth-service`, which enforces session authentication and `UserPolicy`.
   */
  proxyAuthRequest(_user: UserResponseDto | null): boolean {
    return true;
  }

  readSelf(user: UserResponseDto | null): boolean {
    return this.isAllowedUser(user);
  }

  viewProfile(user: UserResponseDto | null, targetUserId: string): boolean {
    return this.canAccessProfile(user, targetUserId);
  }

  updateProfile(user: UserResponseDto | null, targetUserId: string): boolean {
    return this.canAccessProfile(user, targetUserId);
  }

  private canAccessProfile(user: UserResponseDto | null, targetUserId: string): boolean {
    return (
      user !== null &&
      (user.role === UserRole.ADMIN ||
        (user.role === UserRole.CUSTOMER && user.id === targetUserId))
    );
  }

  manageUsers(user: UserResponseDto | null): boolean {
    return user !== null && user.role === UserRole.ADMIN;
  }

  accessDialogs(user: UserResponseDto | null): boolean {
    return this.isAllowedUser(user);
  }

  readKnowledgeBase(user: UserResponseDto | null): boolean {
    return this.isAllowedUser(user);
  }

  manageKnowledgeBase(user: UserResponseDto | null): boolean {
    return user !== null && user.role === UserRole.ADMIN;
  }

  manageSemanticCache(user: UserResponseDto | null): boolean {
    return user !== null && user.role === UserRole.ADMIN;
  }

  viewDialogStats(user: UserResponseDto | null): boolean {
    return user !== null && user.role === UserRole.ADMIN;
  }

  private isAllowedUser(user: UserResponseDto | null): boolean {
    return user !== null && (user.role === UserRole.CUSTOMER || user.role === UserRole.ADMIN);
  }
}
