import { Policy } from '@nestjs/authorization';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';

@Policy()
export class UserPolicy {
  readSelf(user: UserResponseDto | null): boolean {
    return user !== null && (user.role === UserRole.CUSTOMER || user.role === UserRole.ADMIN);
  }

  viewProfile(user: UserResponseDto | null, targetUserId: string): boolean {
    if (!user) {
      return false;
    }
    if (user.role === UserRole.ADMIN) {
      return true;
    }
    return user.role === UserRole.CUSTOMER && user.id === targetUserId;
  }

  updateProfile(user: UserResponseDto | null, targetUserId: string): boolean {
    if (!user) {
      return false;
    }
    if (user.role === UserRole.ADMIN) {
      return true;
    }
    return user.role === UserRole.CUSTOMER && user.id === targetUserId;
  }

  manageUsers(user: UserResponseDto | null): boolean {
    return user !== null && user.role === UserRole.ADMIN;
  }

  hasRole(user: UserResponseDto | null, allowedRoles: readonly UserRole[]): boolean {
    return user !== null && allowedRoles.includes(user.role);
  }
}
