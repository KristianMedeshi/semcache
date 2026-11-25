import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import { isPgUniqueViolation } from '../db/pg-error.util';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class CredentialsService {
  private readonly logger = new Logger(CredentialsService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(email: string, password: string): Promise<UserResponseDto> {
    return this.createAccount(email, password, UserRole.CUSTOMER);
  }

  async createAccount(email: string, password: string, role: UserRole): Promise<UserResponseDto> {
    const existing = await this.usersRepository.findByEmail(email);
    if (existing) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.register.conflict',
          reason: 'duplicate_email',
        }),
      );
      throw new ConflictException('Unable to complete registration with provided credentials');
    }

    const passwordHash = await this.passwordHasher.hash(password);
    let user: UserResponseDto;
    try {
      user = await this.usersRepository.create(email, {
        passwordHash,
        role,
      });
    } catch (error) {
      if (isPgUniqueViolation(error)) {
        this.logger.warn(
          JSON.stringify({
            event: 'auth.register.conflict',
            reason: 'duplicate_email',
          }),
        );
        throw new ConflictException('Unable to complete registration with provided credentials');
      }
      throw error;
    }

    this.logger.log(
      JSON.stringify({
        event: 'auth.register.success',
        userId: user.id,
        role: user.role,
      }),
    );

    return user;
  }

  async verify(email: string, password: string): Promise<UserResponseDto | null> {
    const found = await this.usersRepository.findCredentials(email);
    const valid = await this.passwordHasher.verify(password, found?.passwordHash);
    if (!valid || !found?.passwordHash) {
      this.logger.warn(
        JSON.stringify({
          event: 'auth.login.failed',
          userId: found?.user.id,
          reason: 'invalid_credentials',
        }),
      );
      return null;
    }

    if (this.passwordHasher.needsRehash(found.passwordHash)) {
      await this.usersRepository.updatePasswordHash(
        found.user.id,
        await this.passwordHasher.hash(password),
      );
    }

    this.logger.log(
      JSON.stringify({
        event: 'auth.login.verified',
        userId: found.user.id,
        role: found.user.role,
      }),
    );

    return found.user;
  }
}
