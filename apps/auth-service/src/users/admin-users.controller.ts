import { Controller, Delete, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { RevokeUserSessionsResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { UserRole } from '@semcache/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserPolicy } from '../auth/policies/user.policy';
import { UsersService } from './users.service';

@Controller('admin/users')
@Roles(UserRole.ADMIN)
@Can(UserPolicy, 'manageUsers')
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers(@CurrentUser() actor: UserResponseDto): Promise<UserResponseDto[]> {
    return this.usersService.listAllUsers(actor);
  }

  @Delete(':id/sessions')
  async revokeUserSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: UserResponseDto,
  ): Promise<RevokeUserSessionsResponseDto> {
    return this.usersService.revokeUserSessions(actor, id);
  }
}
