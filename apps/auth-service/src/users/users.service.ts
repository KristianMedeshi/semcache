import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AuthenticationContext,
  PasswordHasher,
  type SessionRecord,
  SessionService,
} from '@nestjs/authentication';
import { AuthorizationService } from '@nestjs/authorization';
import type {
  AuthTcpResponseDto,
  RevokeUserSessionsResponseDto,
  UserResponseDto,
} from '@semcache/shared-dtos';
import type { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import { UserPolicy } from '../auth/policies/user.policy';
import { UsersRepository, normalizeEmail } from './users.repository';

function isSessionRecord(value: unknown): value is SessionRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'userId' in value &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { userId?: unknown }).userId === 'string'
  );
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionService: SessionService,
    private readonly authorizationService: AuthorizationService,
    private readonly authContext: AuthenticationContext,
  ) {}

  async getUserProfile(targetUserId: string, actor?: UserResponseDto): Promise<UserResponseDto> {
    const resolvedActor = actor ?? this.authContext.requireUser();
    const user = await this.usersRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.authorizationService.authorize(UserPolicy, 'viewProfile', resolvedActor, user.id);
    return user;
  }

  async updateUserProfile(
    targetUserId: string,
    dto: UpdateProfileDto,
    actor?: UserResponseDto,
    currentSession?: SessionRecord | string,
  ): Promise<AuthTcpResponseDto<UserResponseDto>> {
    const resolvedActor = actor ?? this.authContext.requireUser();
    const contextSession = this.authContext.session;
    const resolvedSession: SessionRecord | string | undefined =
      currentSession ?? (isSessionRecord(contextSession) ? contextSession : undefined);

    const existingUser = await this.usersRepository.findById(targetUserId);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    await this.authorizationService.authorize(
      UserPolicy,
      'updateProfile',
      resolvedActor,
      existingUser.id,
    );

    let normalizedEmail: string | undefined;
    if (dto.email !== undefined) {
      normalizedEmail = normalizeEmail(dto.email);
      const emailOwner = await this.usersRepository.findByEmail(normalizedEmail);
      if (emailOwner && emailOwner.id !== targetUserId) {
        throw new ConflictException('Unable to update email address');
      }
    }

    let passwordHash: string | undefined;
    if (dto.password !== undefined) {
      passwordHash = await this.passwordHasher.hash(dto.password);
    }

    if (normalizedEmail === undefined && passwordHash === undefined) {
      return { data: existingUser };
    }

    const updatedUser = await this.usersRepository.updateProfile(targetUserId, {
      email: normalizedEmail,
      passwordHash,
    });
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    let setCookie: string | undefined;
    if (passwordHash !== undefined) {
      if (resolvedActor.id === targetUserId) {
        const rotated =
          typeof resolvedSession === 'object' && resolvedSession !== null
            ? await this.sessionService.rotate(resolvedSession)
            : null;
        const keptSessionId =
          rotated?.session.id ??
          (typeof resolvedSession === 'string' ? resolvedSession : resolvedSession?.id);
        if (rotated?.cookie) {
          setCookie = rotated.cookie;
        }
        await this.sessionService.revokeAll(
          targetUserId,
          keptSessionId ? { except: keptSessionId } : undefined,
        );
      } else {
        await this.sessionService.revokeAll(targetUserId);
      }
    }

    this.logger.log(
      JSON.stringify({
        event: 'users.profile.updated',
        actorId: resolvedActor.id,
        targetUserId,
        passwordChanged: passwordHash !== undefined,
      }),
    );

    return {
      data: updatedUser,
      ...(setCookie ? { setCookie } : {}),
    };
  }

  async listAllUsers(actor?: UserResponseDto): Promise<UserResponseDto[]> {
    const resolvedActor = actor ?? this.authContext.requireUser();
    await this.authorizationService.authorize(UserPolicy, 'manageUsers', resolvedActor);
    return this.usersRepository.findAll();
  }

  async revokeUserSessions(
    targetUserId: string,
    actor?: UserResponseDto,
  ): Promise<RevokeUserSessionsResponseDto> {
    const resolvedActor = actor ?? this.authContext.requireUser();
    await this.authorizationService.authorize(UserPolicy, 'manageUsers', resolvedActor);

    const targetUser = await this.usersRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const activeSessions = await this.sessionService.list(targetUserId);
    await this.sessionService.revokeAll(targetUserId);

    this.logger.log(
      JSON.stringify({
        event: 'auth.sessions.revoked',
        actorId: resolvedActor.id,
        targetUserId,
        revokedCount: activeSessions.length,
      }),
    );

    return { revokedCount: activeSessions.length };
  }
}
