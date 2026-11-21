import { type Ability, Policy, type PolicyBefore } from '@nestjs/authorization';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';

@Policy()
export class UserPolicy implements PolicyBefore<UserResponseDto, Ability<UserPolicy>> {
  before(user: UserResponseDto | null, ability: Ability<UserPolicy>): boolean | undefined {
    if (user?.role === UserRole.ADMIN && ability !== 'hasRole') {
      return true;
    }
    return undefined;
  }

  readSelf(user: UserResponseDto | null): boolean {
    return user !== null && (user.role === UserRole.CUSTOMER || user.role === UserRole.ADMIN);
  }

  viewProfile(user: UserResponseDto | null, targetUserId: string): boolean {
    return this.isOwnerOrAdmin(user, targetUserId);
  }

  updateProfile(user: UserResponseDto | null, targetUserId: string): boolean {
    return this.isOwnerOrAdmin(user, targetUserId);
  }

  manageUsers(user: UserResponseDto | null): boolean {
    return user !== null && user.role === UserRole.ADMIN;
  }

  hasRole(user: UserResponseDto | null, allowedRoles: readonly UserRole[]): boolean {
    return user !== null && allowedRoles.includes(user.role);
  }

  private isOwnerOrAdmin(user: UserResponseDto | null, targetUserId: string): boolean {
    if (!user) {
      return false;
    }
    return (
      user.role === UserRole.ADMIN || (user.role === UserRole.CUSTOMER && user.id === targetUserId)
    );
  }
}
