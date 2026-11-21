import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PasswordHasher, type SessionRecord, SessionService } from '@nestjs/authentication';
import { AuthorizationService } from '@nestjs/authorization';
import type {
  AuthTcpResponseDto,
  RevokeUserSessionsResponseDto,
  UserResponseDto,
} from '@semcache/shared-dtos';
import type { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import { UserPolicy } from '../auth/policies/user.policy';
import { UsersRepository, normalizeEmail } from './users.repository';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionService: SessionService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async getUserProfile(actor: UserResponseDto, targetUserId: string): Promise<UserResponseDto> {
    await this.authorizationService.authorize(UserPolicy, 'viewProfile', actor, targetUserId);

    const user = await this.usersRepository.findById(targetUserId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUserProfile(
    actor: UserResponseDto,
    targetUserId: string,
    dto: UpdateProfileDto,
    currentSession?: SessionRecord | string,
  ): Promise<AuthTcpResponseDto<UserResponseDto>> {
    await this.authorizationService.authorize(UserPolicy, 'updateProfile', actor, targetUserId);

    const existingUser = await this.usersRepository.findById(targetUserId);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

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
      if (actor.id === targetUserId) {
        const rotated =
          typeof currentSession === 'object' && currentSession !== null
            ? await this.sessionService.rotate(currentSession)
            : null;
        const keptSessionId =
          rotated?.session.id ??
          (typeof currentSession === 'string' ? currentSession : currentSession?.id);
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
        actorId: actor.id,
        targetUserId,
        passwordChanged: passwordHash !== undefined,
      }),
    );

    return {
      data: updatedUser,
      ...(setCookie ? { setCookie } : {}),
    };
  }

  async listAllUsers(actor: UserResponseDto): Promise<UserResponseDto[]> {
    await this.authorizationService.authorize(UserPolicy, 'manageUsers', actor);
    return this.usersRepository.findAll();
  }

  async revokeUserSessions(
    actor: UserResponseDto,
    targetUserId: string,
  ): Promise<RevokeUserSessionsResponseDto> {
    await this.authorizationService.authorize(UserPolicy, 'manageUsers', actor);

    const targetUser = await this.usersRepository.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    const activeSessions = await this.sessionService.list(targetUserId);
    await this.sessionService.revokeAll(targetUserId);

    this.logger.log(
      JSON.stringify({
        event: 'auth.sessions.revoked',
        actorId: actor.id,
        targetUserId,
        revokedCount: activeSessions.length,
      }),
    );

    return { revokedCount: activeSessions.length };
  }
}
