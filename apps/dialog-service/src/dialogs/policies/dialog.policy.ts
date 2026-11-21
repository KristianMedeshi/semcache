import { type Ability, Policy, type PolicyBefore } from '@nestjs/authorization';
import type { DialogResponseDto } from '@semcache/shared-dtos';
import { type AuthenticatedUser, UserRole } from '@semcache/shared-types';

@Policy()
export class DialogPolicy implements PolicyBefore<AuthenticatedUser, Ability<DialogPolicy>> {
  before(user: AuthenticatedUser | null): boolean | undefined {
    if (!user) {
      return false;
    }
    return undefined;
  }

  create(user: AuthenticatedUser | null): boolean {
    return this.isAuthenticatedUser(user);
  }

  list(user: AuthenticatedUser | null): boolean {
    return this.isAuthenticatedUser(user);
  }

  update(user: AuthenticatedUser | null): boolean {
    return this.isAuthenticatedUser(user);
  }

  delete(user: AuthenticatedUser | null): boolean {
    return this.isAuthenticatedUser(user);
  }

  viewMessages(user: AuthenticatedUser | null): boolean {
    return this.isAuthenticatedUser(user);
  }

  sendMessage(user: AuthenticatedUser | null): boolean {
    return this.isAuthenticatedUser(user);
  }

  streamMessage(user: AuthenticatedUser | null): boolean {
    return this.isAuthenticatedUser(user);
  }

  editMessage(user: AuthenticatedUser | null): boolean {
    return this.isAuthenticatedUser(user);
  }

  streamEditMessage(user: AuthenticatedUser | null): boolean {
    return this.isAuthenticatedUser(user);
  }

  accessDialog(user: AuthenticatedUser, dialog: DialogResponseDto): boolean {
    return dialog.userId === user.id;
  }

  private isAuthenticatedUser(user: AuthenticatedUser | null): boolean {
    return user !== null && (user.role === UserRole.CUSTOMER || user.role === UserRole.ADMIN);
  }
}
