import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  SessionCookieProvider,
  type SessionRecord,
} from '@nestjs/authentication';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class SessionAuth extends SessionCookieProvider<UserResponseDto> {
  constructor(
    private readonly usersRepository: UsersRepository,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  async validate(session: SessionRecord): Promise<UserResponseDto | null> {
    return session.extra?.user ?? (await this.usersRepository.findById(session.userId));
  }
}
