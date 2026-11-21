import { Policy } from '@nestjs/authorization';
import { type AuthenticatedUser, UserRole } from '@semcache/shared-types';

@Policy()
export class KnowledgeBasePolicy {
  retrieveContext(_user: unknown): boolean {
    return true;
  }

  readDocument(user: AuthenticatedUser | null): boolean {
    return user !== null && (user.role === UserRole.CUSTOMER || user.role === UserRole.ADMIN);
  }

  manageDocuments(user: AuthenticatedUser | null): boolean {
    return user !== null && user.role === UserRole.ADMIN;
  }
}
