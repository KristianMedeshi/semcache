import { Can } from '@nestjs/authorization';
import type { UserRole } from '@semcache/shared-types';
import { UserPolicy } from '../policies/user.policy';

/**
 * Policy-backed role guard decorator built on `@nestjs/authorization`'s `@Can()`.
 */
export const Roles = (...roles: UserRole[]) => Can(UserPolicy, 'hasRole', () => [roles]);
