import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { CurrentSession, CurrentUser, type SessionRecord } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import type { UserResponseDto } from '@semcache/shared-dtos';
import { UpdateProfileDto } from '../auth/dto/update-profile.dto';
import { UserPolicy } from '../auth/policies/user.policy';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @Can(UserPolicy, 'viewProfile', (ctx) => {
    const req = ctx
      .switchToHttp()
      .getRequest<{ params?: Record<string, string | string[] | undefined> }>();
    const id = req.params?.id;
    return [Array.isArray(id) ? (id[0] ?? '') : (id ?? '')];
  })
  async getUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: UserResponseDto,
  ): Promise<UserResponseDto> {
    return this.usersService.getUserProfile(actor, id);
  }

  @Patch(':id')
  @Can(UserPolicy, 'updateProfile', (ctx) => {
    const req = ctx
      .switchToHttp()
      .getRequest<{ params?: Record<string, string | string[] | undefined> }>();
    const id = req.params?.id;
    return [Array.isArray(id) ? (id[0] ?? '') : (id ?? '')];
  })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProfileDto,
    @CurrentUser() actor: UserResponseDto,
    @CurrentSession() session?: SessionRecord,
  ): Promise<UserResponseDto> {
    return this.usersService.updateUserProfile(actor, id, dto, session?.id);
  }
}
