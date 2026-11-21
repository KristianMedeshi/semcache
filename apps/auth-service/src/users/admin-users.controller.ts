import { Controller, ParseUUIDPipe } from '@nestjs/common';
import { Can } from '@nestjs/authorization';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { RevokeUserSessionsResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { UserPolicy } from '../auth/policies/user.policy';
import { UsersService } from './users.service';

@Controller()
@Can(UserPolicy, 'manageUsers')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(SERVICE_TCP_PATTERNS.ADMIN_USERS_LIST)
  async listUsers(): Promise<UserResponseDto[]> {
    return this.usersService.listAllUsers();
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.ADMIN_USERS_REVOKE_SESSIONS)
  async revokeUserSessions(
    @Payload('id', ParseUUIDPipe) id: string,
  ): Promise<RevokeUserSessionsResponseDto> {
    return this.usersService.revokeUserSessions(id);
  }
}
