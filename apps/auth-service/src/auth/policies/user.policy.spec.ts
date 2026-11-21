import { AuthenticationContext } from '@nestjs/authentication';
import { AuthorizationModule, AuthorizationService } from '@nestjs/authorization';
import { Test } from '@nestjs/testing';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import { UserPolicy } from './user.policy';

describe('UserPolicy', () => {
  let policy: UserPolicy;

  const customerA: UserResponseDto = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'customer-a@example.com',
    role: UserRole.CUSTOMER,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const customerBId = '22222222-2222-4222-8222-222222222222';

  const adminUser: UserResponseDto = {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'admin@example.com',
    role: UserRole.ADMIN,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    policy = new UserPolicy();
  });

  describe('before', () => {
    it('allows admins ahead of ability checks except hasRole', () => {
      expect(policy.before(adminUser, 'viewProfile')).toBe(true);
      expect(policy.before(adminUser, 'updateProfile')).toBe(true);
      expect(policy.before(adminUser, 'hasRole')).toBeUndefined();
      expect(policy.before(customerA, 'viewProfile')).toBeUndefined();
      expect(policy.before(null, 'viewProfile')).toBeUndefined();
    });
  });

  describe('readSelf', () => {
    it('allows authenticated customer and admin users', () => {
      expect(policy.readSelf(customerA)).toBe(true);
      expect(policy.readSelf(adminUser)).toBe(true);
    });

    it('denies unauthenticated guests', () => {
      expect(policy.readSelf(null)).toBe(false);
    });
  });

  describe('viewProfile', () => {
    it('allows customers to view only their own profile', () => {
      expect(policy.viewProfile(customerA, customerA.id)).toBe(true);
      expect(policy.viewProfile(customerA, customerBId)).toBe(false);
    });

    it('allows admins to view any profile', () => {
      expect(policy.viewProfile(adminUser, customerA.id)).toBe(true);
      expect(policy.viewProfile(adminUser, customerBId)).toBe(true);
    });

    it('denies unauthenticated requests', () => {
      expect(policy.viewProfile(null, customerA.id)).toBe(false);
    });
  });

  describe('updateProfile', () => {
    it('allows customers to update only their own profile', () => {
      expect(policy.updateProfile(customerA, customerA.id)).toBe(true);
      expect(policy.updateProfile(customerA, customerBId)).toBe(false);
    });

    it('allows admins to update any profile', () => {
      expect(policy.updateProfile(adminUser, customerA.id)).toBe(true);
    });

    it('denies unauthenticated requests', () => {
      expect(policy.updateProfile(null, customerA.id)).toBe(false);
    });
  });

  describe('manageUsers', () => {
    it('allows only admins', () => {
      expect(policy.manageUsers(adminUser)).toBe(true);
      expect(policy.manageUsers(customerA)).toBe(false);
      expect(policy.manageUsers(null)).toBe(false);
    });
  });

  describe('hasRole', () => {
    it('checks whether user holds one of the allowed roles', () => {
      expect(policy.hasRole(adminUser, [UserRole.ADMIN])).toBe(true);
      expect(policy.hasRole(customerA, [UserRole.ADMIN])).toBe(false);
      expect(policy.hasRole(customerA, [UserRole.CUSTOMER, UserRole.ADMIN])).toBe(true);
      expect(policy.hasRole(null, [UserRole.CUSTOMER])).toBe(false);
    });
  });

  describe('AuthorizationService integration', () => {
    it('enforces UserPolicy via AuthorizationModule and AuthenticationContext', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [AuthorizationModule.forRoot()],
        providers: [
          UserPolicy,
          { provide: AuthenticationContext, useValue: { requireUser: () => customerA } },
        ],
      }).compile();
      await moduleRef.init();

      const authz = moduleRef.get(AuthorizationService);
      await expect(
        authz.authorize(UserPolicy, 'viewProfile', customerA, customerA.id),
      ).resolves.toBeUndefined();
      await expect(
        authz.authorize(UserPolicy, 'viewProfile', customerA, customerBId),
      ).rejects.toMatchObject({ reason: 'forbidden', ability: 'viewProfile' });
      await expect(
        authz.authorize(UserPolicy, 'viewProfile', null, customerA.id),
      ).rejects.toMatchObject({ reason: 'unauthenticated', ability: 'viewProfile' });

      await moduleRef.close();
    });
  });
});
