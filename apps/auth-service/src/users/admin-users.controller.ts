import { Controller, ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { RevokeUserSessionsResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS, UserRole } from '@semcache/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserPolicy } from '../auth/policies/user.policy';
import { UsersService } from './users.service';

@Controller()
@Roles(UserRole.ADMIN)
@Can(UserPolicy, 'manageUsers')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(SERVICE_TCP_PATTERNS.ADMIN_USERS_LIST)
  async listUsers(@CurrentUser() actor: UserResponseDto): Promise<UserResponseDto[]> {
    return this.usersService.listAllUsers(actor);
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.ADMIN_USERS_REVOKE_SESSIONS)
  async revokeUserSessions(
    @Payload('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: UserResponseDto,
  ): Promise<RevokeUserSessionsResponseDto> {
    return this.usersService.revokeUserSessions(actor, id);
  }
}
