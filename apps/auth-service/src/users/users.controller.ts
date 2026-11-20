import {
  Body,
  Controller,
  type ExecutionContext,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { CurrentSession, CurrentUser, type SessionRecord } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import { UserPolicy } from '../auth/policies/user.policy';
import { UsersService } from './users.service';

function resolveTargetUserId(ctx: ExecutionContext): [string] {
  const req = ctx
    .switchToHttp()
    .getRequest<{ params?: Record<string, string | string[] | undefined> }>();
  const id = req.params?.id;
  return [Array.isArray(id) ? (id[0] ?? '') : (id ?? '')];
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @Can(UserPolicy, 'viewProfile', resolveTargetUserId)
  async getUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: UserResponseDto,
  ): Promise<UserResponseDto> {
    return this.usersService.getUserProfile(actor, id);
  }

  @Patch(':id')
  @Can(UserPolicy, 'updateProfile', resolveTargetUserId)
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() actor: UserResponseDto,
    @CurrentSession() session?: SessionRecord,
  ): Promise<UserResponseDto> {
    return this.usersService.updateUserProfile(actor, id, dto, session?.id);
  }
}
