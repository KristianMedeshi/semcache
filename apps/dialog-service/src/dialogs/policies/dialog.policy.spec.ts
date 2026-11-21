import { AuthorizationModule, AuthorizationService } from '@nestjs/authorization';
import { Test } from '@nestjs/testing';
import type { DialogResponseDto } from '@semcache/shared-dtos';
import { type AuthenticatedUser, UserRole } from '@semcache/shared-types';
import { DialogPolicy } from './dialog.policy';

describe('DialogPolicy', () => {
  let policy: DialogPolicy;

  const customer: AuthenticatedUser = {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'customer@example.com',
    role: UserRole.CUSTOMER,
    sessionId: 'sess-1',
  };

  const otherCustomer: AuthenticatedUser = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'other@example.com',
    role: UserRole.CUSTOMER,
    sessionId: 'sess-2',
  };

  const dialog: DialogResponseDto = {
    id: '33333333-3333-4333-8333-333333333333',
    userId: customer.id,
    title: 'Support Question',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    policy = new DialogPolicy();
  });

  it('denies guests in before() and route abilities', () => {
    expect(policy.before(null)).toBe(false);
    expect(policy.before(customer)).toBeUndefined();
    expect(policy.create(null)).toBe(false);
    expect(policy.list(null)).toBe(false);
    expect(policy.viewMessages(null)).toBe(false);
    expect(policy.sendMessage(null)).toBe(false);
    expect(policy.streamMessage(null)).toBe(false);
  });

  it('allows authenticated users on route abilities and enforces dialog ownership', () => {
    expect(policy.create(customer)).toBe(true);
    expect(policy.list(customer)).toBe(true);
    expect(policy.accessDialog(customer, dialog)).toBe(true);
    expect(policy.accessDialog(otherCustomer, dialog)).toBe(false);
  });

  it('enforces DialogPolicy through AuthorizationService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthorizationModule.forRoot()],
      providers: [DialogPolicy],
    }).compile();
    await moduleRef.init();

    const authz = moduleRef.get(AuthorizationService);
    await expect(
      authz.authorize(DialogPolicy, 'accessDialog', customer, dialog),
    ).resolves.toBeUndefined();
    await expect(
      authz.authorize(DialogPolicy, 'accessDialog', otherCustomer, dialog),
    ).rejects.toMatchObject({ reason: 'forbidden', ability: 'accessDialog' });

    await moduleRef.close();
  });
});
