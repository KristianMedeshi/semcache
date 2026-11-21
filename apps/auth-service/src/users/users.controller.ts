import { Controller, type ExecutionContext, ParseUUIDPipe } from '@nestjs/common';
import { CurrentSession, CurrentUser, type SessionRecord } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type { AuthTcpResponseDto, UserResponseDto } from '@semcache/shared-dtos';
import { SERVICE_TCP_PATTERNS } from '@semcache/shared-types';
import { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import { UserPolicy } from '../auth/policies/user.policy';
import { UsersService } from './users.service';

function resolveTargetUserId(ctx: ExecutionContext): [string] {
  const data = ctx.switchToRpc().getData<{ id?: unknown } | undefined>();
  return [typeof data?.id === 'string' ? data.id : ''];
}

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(SERVICE_TCP_PATTERNS.USERS_GET)
  @Can(UserPolicy, 'viewProfile', resolveTargetUserId)
  async getUser(
    @Payload('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: UserResponseDto,
  ): Promise<UserResponseDto> {
    return this.usersService.getUserProfile(actor, id);
  }

  @MessagePattern(SERVICE_TCP_PATTERNS.USERS_UPDATE)
  @Can(UserPolicy, 'updateProfile', resolveTargetUserId)
  async updateUser(
    @Payload('id', ParseUUIDPipe) id: string,
    @Payload('body') dto: UpdateProfileDto,
    @CurrentUser() actor: UserResponseDto,
    @CurrentSession() session?: SessionRecord | null,
  ): Promise<AuthTcpResponseDto<UserResponseDto>> {
    return this.usersService.updateUserProfile(actor, id, dto, session ?? undefined);
  }
}
